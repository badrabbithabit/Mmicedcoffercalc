/**
 * Coffee Ratio Calculator — app.js (split-flap flipboard)
 *
 * ── Architecture ─────────────────────────────────────────────────
 * IIFE closure — zero global pollution
 * calculate() — reads slider → computes → pushes new board text
 * SplitFlapBoard / Tile — split-flap display engine (flipoff-inspired)
 * No audio. No framework, no dependencies — vanilla JS only.
 *
 * ── Formula (hard-coded Japanese Iced Coffee) ───────────────────
 * totalWater  = grounds × 15
 * hotWater    = totalWater × 0.60
 * ice         = totalWater × 0.40
 * totalOutput = hotWater + ice
 *
 * ── Constants ────────────────────────────────────────────────────
 * BREW_RATIO     : 15 (1:15 total liquid per gram of grounds)
 * ICE_PERCENT    : 40 (40% ice / 60% hot water)
 * MAX_BATCH_GRAMS: 1000 (1L hard cap)
 * CUPS_PER_LITER : 4.22675 (US cups)
 */

(() => {
  'use strict';

  // ── Formula constants ────────────────────────────────────────
  const CUPS_PER_LITER = 4.22675;
  const MAX_BATCH_GRAMS = 1000;
  const BREW_RATIO = 15;   // 1:15 total water per gram of grounds
  const ICE_PERCENT = 40;  // 40% ice / 60% hot water split

  // ── Split-flap display constants (flipoff-inspired) ───────────
  const GRID_COLS = 11;
  const GRID_ROWS = 3;
  const FLIP_DURATION = 260;
  const STAGGER_DELAY = 22;
  const SCRAMBLE_INTERVAL = 70;
  const SCRAMBLES_PER_FLIP = 9;
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.·-: ";

  // Row glyphs. These are rendered as STATIC tiles (no flip/scramble) so
  // they stay vertically centred and never jitter during a transition.
  const EMOJI_FOR = {
    coffee: '☕', // ☕ U+2615
    hot: '♨',      // ♨ U+2668
    ice: '❄',      // ❄ U+2744
    total: '▦'     // ▦ U+25A6
  };
  // Static (non-flipboard) tiles — emoji and the "G" unit.
  const STATIC_EMOJI = new Set(Object.values(EMOJI_FOR));
  const STATIC_UNIT = 'G';
  const isEmojiChar = (ch) => STATIC_EMOJI.has(ch);
  const isStaticChar = (ch) => isEmojiChar(ch) || ch === STATIC_UNIT;
  const EMOJI_YELLOW = '#FFCC00';
  const SCRAMBLE_COLORS = ['#00AAFF', '#00FFCC', '#AA00FF', '#FF2D00', '#FFCC00', '#FFFFFF'];
  const ACCENT_COLORS = ['#00FF7F', '#FF4D00', '#AA00FF', '#00AAFF', '#00FFCC'];
  const MAX_QUEUED_FLIPS = 48;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Daily rotating coffee quote ──────────────────────────────
  const QUOTES = [
    'Coffee keeps the demons away.',
    'All things being equal, coffee is better.',
    'Good coffee is only a cup away.',
    'Coffee is a language in itself.',
    'The ideal life is books and coffee.',
    'Life begins after coffee.',
    'But first, coffee.',
    'May your coffee be strong.',
    'Coffee: because you can.',
    'First coffee, then problems.',
    'Coffee: a taste for life.',
    'Coffee is a hug for your stomach.',
    'The best way to start is to drink coffee.',
    'No coffee, no show.',
    'Coffee breaks the tension.',
    'Coffee is my therapy.',
    'Sweetness is a habit. Coffee is a necessity.',
    'Coffee first, questions later.',
    'Talk is cheap. Coffee is free.',
    'No coffee, no good day.',
    'Coffee is the elixir of life.',
    'My heart beats like a coffee grinder.',
    'Espresso for dark days.',
    'Coffee is life in a cup.',
    'The coffee is my best friend.',
    'Coffee solves problems.',
    'Coffee first, then conquer the world.',
    'I run on coffee and deadlines.',
    'Coffee is my love language.',
    'Problems are easier with coffee in hand.'
  ];

  const quoteOfToday = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return QUOTES[dayOfYear % QUOTES.length];
  };

  // ── Animation queue cap ──────────────────────────────────────
  // Counts every tile animation that is queued or running
  // (from the stagger-delay setTimeout until the flip settles).
  // scrambleTo() refuses to start once the cap is hit, so a fast
  // slider drag can never pile up unbounded overlapping flips.
  let activeFlips = 0;
  let resetSettled = false;
  let totalTiles = 0;
  let isResetting = true;

  // The load-time cascade counts as "done" when there is nothing
  // in flight AND every tile has been touched at least once (either
  // it animated and settled via finish(), or it was skipped because
  // its target matched — both cases are recorded in releaseReset).
  const settledTiles = new Set();
  function releaseReset() {
    if (resetSettled || !isResetting) return;
    if (activeFlips > 0) return;
    if (settledTiles.size < totalTiles) return;
    resetSettled = true;
    isResetting = false;
  }

  // ── Tile: one split-flap cell ────────────────────────────────
  function createTile() {
    const el = document.createElement('div');
    el.className = 'tile';

    const inner = document.createElement('div');
    inner.className = 'tile-inner';

    const front = document.createElement('div');
    front.className = 'tile-front';
    const frontSpan = document.createElement('span');
    front.appendChild(frontSpan);

    const back = document.createElement('div');
    back.className = 'tile-back';
    const backSpan = document.createElement('span');
    back.appendChild(backSpan);

    inner.appendChild(front);
    inner.appendChild(back);
    el.appendChild(inner);

    let currentChar = ' ';
    let scrambleTimer = null;
    let pendingFlip = false;
    const pendingTimers = [];

    const clearScramble = () => {
      if (scrambleTimer) { clearInterval(scrambleTimer); scrambleTimer = null; }
    };
    const clearPendingTimers = () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers.length = 0;
    };
    const trackTimer = (id) => { pendingTimers.push(id); };
    const markSettled = () => {
      settledTiles.add(el);
      releaseReset();
    };

    return {
      el,
      markSettled,

      // Abort whatever animation state this tile is in, mid-flight.
      // Called when a newer setLines() supersedes an in-flight wave.
      cancel() {
        clearScramble();
        clearPendingTimers();
        if (pendingFlip) {
          pendingFlip = false;
          activeFlips = Math.max(0, activeFlips - 1);
        }
        el.classList.remove('scrambling');
        inner.style.transition = '';
        inner.style.transform = '';
        front.style.backgroundColor = '';
        backSpan.textContent = '';
      },

      // Set a character with no animation.
      set(char) {
        this.cancel();
        currentChar = char;
        frontSpan.textContent = char === ' ' ? '' : char;
        backSpan.textContent = '';
        front.style.backgroundColor = '';
        // cancel() does not reset text color — a tile interrupted mid-
        // scramble can still carry a scramble text color.
        const staticGlyph = isStaticChar(char);
        frontSpan.style.color = isEmojiChar(char) ? EMOJI_YELLOW : '';
        front.classList.toggle('static-glyph', staticGlyph);
        markSettled();
      },

      // Animate to a new character: staggered scramble + flip settle.
      // Returns true if the flip was started, false if the board
      // already has MAX_QUEUED_FLIPS in flight and this one was skipped.
      scrambleTo(target, delay) {
        if (target === currentChar) return false;

        // A newer setLines() cancelled our previous wave; this call is
        // part of the replacement wave and must not start on top of it.
        if (pendingFlip) return false;

        if (activeFlips >= MAX_QUEUED_FLIPS) return false;

        clearScramble();
        pendingFlip = true;

        const commit = () => {
          frontSpan.textContent = target === ' ' ? '' : target;
          front.style.backgroundColor = '';
          const staticGlyph = isStaticChar(target);
          frontSpan.style.color = isEmojiChar(target) ? EMOJI_YELLOW : '';
          front.classList.toggle('static-glyph', staticGlyph);
          currentChar = target;
        };

        if (prefersReducedMotion) {
          pendingFlip = false;
          commit();
          return true;
        }

        activeFlips++;
        const finish = () => {
          pendingFlip = false;
          activeFlips = Math.max(0, activeFlips - 1);
          markSettled();
        };

        trackTimer(setTimeout(() => {
          el.classList.add('scrambling');
          let count = 0;
          scrambleTimer = setInterval(() => {
            const randChar = CHARSET[Math.floor(Math.random() * CHARSET.length)];
            frontSpan.textContent = randChar === ' ' ? '' : randChar;
            const color = SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];
            front.style.backgroundColor = color;
            frontSpan.style.color = (color === '#FFFFFF' || color === '#FFCC00') ? '#111' : '';
            count++;
            if (count >= SCRAMBLES_PER_FLIP) {
              clearScramble();
              // Flip settle: hinge the card, then land on the final char.
              inner.style.transition = `transform ${FLIP_DURATION / 2}ms ease-in`;
              inner.style.transform = 'perspective(400px) rotateX(-88deg)';
              trackTimer(setTimeout(() => {
                commit();
                backSpan.textContent = target === ' ' ? '' : target;
                inner.style.transition = `transform ${FLIP_DURATION / 2}ms ease-out`;
                inner.style.transform = '';
                trackTimer(setTimeout(() => {
                  backSpan.textContent = '';
                  inner.style.transition = '';
                  el.classList.remove('scrambling');
                  finish();
                }, FLIP_DURATION / 2));
              }, FLIP_DURATION / 2));
            }
          }, SCRAMBLE_INTERVAL);
        }, delay));
        return true;
      }
    };
  }

  // ── Boards: grid of tiles + transition orchestration ─────────
  function makeBoard(zoneEl, gridEl, cols, rows, accentIndexStart, justify) {
    gridEl.style.setProperty('--grid-cols', cols);
    gridEl.style.setProperty('--grid-rows', rows);

    const tiles = [];
    const currentGrid = [];
    // What the DOM actually shows right now. Tiles that are mid-flip
    // still display their OLD char, so a new cascade must start from
    // this grid — comparing against the target would double-start.
    const displayedGrid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const t = createTile();
        t.set(' ');
        gridEl.appendChild(t.el);
        row.push(t);
      }
      tiles.push(row);
      currentGrid.push(new Array(cols).fill(' '));
      displayedGrid.push(new Array(cols).fill(' '));
    }
    totalTiles += rows * cols;

    let accentIndex = accentIndexStart;
    const accentEls = [];
    for (const side of ['accent-bar-left', 'accent-bar-right']) {
      const bar = document.createElement('div');
      bar.className = 'accent-bar ' + side;
      const segA = document.createElement('div');
      segA.className = 'accent-segment';
      const segB = document.createElement('div');
      segB.className = 'accent-segment';
      bar.appendChild(segA);
      bar.appendChild(segB);
      zoneEl.appendChild(bar);
      accentEls.push(segA, segB);
    }
    const paintAccents = () => {
      const color = ACCENT_COLORS[accentIndex % ACCENT_COLORS.length];
      accentEls.forEach(seg => { seg.style.backgroundColor = color; });
    };
    paintAccents();

    const formatLines = (lines) => {
      const grid = [];
      for (let r = 0; r < rows; r++) {
        const line = (lines[r] || '').toUpperCase();
        const chars = Array.from(line);
        const pad = Math.max(0, cols - chars.length);
        let paddedChars;
        if (justify === 'justify') {
          // Layout for a data row, "LABEL EMOJI VALUE" (chars = the row split
          // into Unicode code points, so a 2-unit emoji still counts as ONE
          // cell). The single space sits between LABEL and EMOJI; there is no
          // space before the value.
          //   cols 1..5  → LABEL (left-aligned)
          //   col  6     → EMOJI  (pinned to column 6 for every row)
          //   cols 7..11 → VALUE (digits + G), right-aligned
          const spIdx = chars.indexOf(' ');
          if (spIdx > 0) {
            const label = chars.slice(0, spIdx);
            const emoji = chars.slice(spIdx + 1, spIdx + 2);
            const value = chars.slice(spIdx + 2);
            // Emoji at col 6 (index 5) → pad the label to exactly 5 wide.
            const labelPad = Math.max(0, 5 - label.length);
            // Value zone is cols 7..11 (5 wide); right-align within it.
            const valuePad = Math.max(0, 5 - value.length);
            paddedChars = label
              .concat(Array(labelPad).fill(' '),
                emoji,
                Array(valuePad).fill(' '),
                value);
          } else {
            paddedChars = chars.concat(Array(Math.max(0, cols - chars.length)).fill(' '));
          }
        } else {
          const padLeft = Math.floor(pad / 2);
          paddedChars = Array(padLeft).fill(' ')
            .concat(chars, Array(Math.max(0, pad - padLeft)).fill(' '));
        }
        // Pad/truncate to exactly cols to stay within the grid.
        if (paddedChars.length < cols) {
          paddedChars = paddedChars.concat(Array(cols - paddedChars.length).fill(' '));
        } else if (paddedChars.length > cols) {
          paddedChars = paddedChars.slice(0, cols);
        }
        grid.push(paddedChars);
      }
      return grid;
    };

    // Push new text to the board. Only changed tiles animate,
    // cascading left→right, top→bottom (like a real flipboard).
    //
    // In-flight tiles are NEVER cancelled here. A tile that is
    // mid-animation already displays its OLD char, and scrambleTo()
    // refuses to double-start while pendingFlip is set — so comparing
    // against displayedGrid (not the target) and skipping the tile
    // lets the existing animation keep running to the SAME final char
    // without piling a second wave on top of it. The DOM therefore
    // always converges to newGrid: every tile either committed
    // instantly or is animating toward the new value.
    //
    // Cancelling in-flight tiles here would break the load-time
    // cascade: the first input change arrives while it is still
    // running, and cancelled tiles never call finish(), so
    // activeFlips would never reach 0 and isResetting would never
    // be released — freezing the board on stale values forever.
    const setLines = (lines) => {
      const newGrid = formatLines(lines);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const target = newGrid[r][c];
          if (target !== displayedGrid[r][c]) {
            // Non-flipboard glyphs (emoji + the "G" unit) snap into place
            // instantly — they must not scramble or flip.
            if (isStaticChar(target)) {
              tiles[r][c].set(target);
            } else {
              const started = tiles[r][c].scrambleTo(target, (r * cols + c) * STAGGER_DELAY);
              if (!started) tiles[r][c].set(target);
            }
          } else {
            // Tile already shows the target — count it as settled for
            // the load-time release check.
            tiles[r][c].markSettled();
          }
        }
      }
      currentGrid.splice(0, currentGrid.length, ...newGrid);
      displayedGrid.splice(0, displayedGrid.length, ...newGrid);
      accentIndex++;
      paintAccents();
    };

    return { setLines, rows };
  }

  const board = makeBoard(
    document.getElementById('flipboard'),
    document.getElementById('tile-grid'),
    GRID_COLS,
    GRID_ROWS,
    0,
    'justify' // labels left, values right
  );

  const QUOTE_COLS = 11;
  const QUOTE_ROWS = 4;
  const quoteBoard = makeBoard(
    document.getElementById('quote-board'),
    document.getElementById('quote-grid'),
    QUOTE_COLS,
    QUOTE_ROWS,
    ACCENT_COLORS.length // offset so accent colors differ from the main board
  );
  const setBoard = (lines) => board.setLines(lines);
  const setQuoteBoard = (lines) => quoteBoard.setLines(lines);

  // ── DOM refs ─────────────────────────────────────────────────
  const groundsSlider = document.getElementById('grounds-slider');
  const groundsDisplay = document.getElementById('grounds-display');
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warning-text');

  // ── Core calculation ─────────────────────────────────────────
  function recalc(grounds) {
    if (isNaN(grounds) || grounds <= 0) {
      groundsDisplay.textContent = '—';
      warningEl.hidden = true;
      return;
    }

    groundsDisplay.textContent = `${grounds} g`;

     const hotPercent = 100 - ICE_PERCENT;
    const totalWater = grounds * BREW_RATIO;
    const hotWater = totalWater * (hotPercent / 100);
    const ice = totalWater * (ICE_PERCENT / 100);
    const totalOutput = hotWater + ice;

    const hotMl = Math.round(hotWater);
    const iceMl = Math.round(ice);
    const totalMl = Math.round(totalOutput);
    const totalCups = (totalOutput / 1000 * CUPS_PER_LITER).toFixed(1);

    const boardText = [
      `DOSE ${EMOJI_FOR.coffee}${grounds}G`,
      `HOT ${EMOJI_FOR.hot}${hotMl}G`,
      `ICE ${EMOJI_FOR.ice}${iceMl}G`,
      `TOTAL ${EMOJI_FOR.total}${totalMl}G`,
    ];

    // Never fight the load-time reset animation.
    if (!isResetting) setBoard(boardText);

    if (totalOutput > MAX_BATCH_GRAMS) {
      warningEl.hidden = false;
      warningText.textContent = 'Total exceeds 1 L max batch. Reduce grounds.';
    } else {
      warningEl.hidden = true;
    }
  }

  let boardDebounce = null;
  function calculate() {
    const grounds = parseInt(groundsSlider.value, 10);

    if (isNaN(grounds) || grounds <= 0) {
      groundsDisplay.textContent = '—';
      warningEl.hidden = true;
      return;
    }

    groundsDisplay.textContent = `${grounds} g`;

    const hotPercent = 100 - ICE_PERCENT;
    const totalWater = grounds * BREW_RATIO;
    const hotWater = totalWater * (hotPercent / 100);
    const ice = totalWater * (ICE_PERCENT / 100);
    const totalOutput = hotWater + ice;

    if (totalOutput > MAX_BATCH_GRAMS) {
      warningEl.hidden = false;
      warningText.textContent = 'Total exceeds 1 L max batch. Reduce grounds.';
    } else {
      warningEl.hidden = true;
    }

    // Debounce the flipboard: slider input fires on every tick while
    // dragging, which would queue up a flip animation per value.
    // Wait for the user to pause (or release) before animating.
    if (boardDebounce) clearTimeout(boardDebounce);
    boardDebounce = setTimeout(() => {
      boardDebounce = null;
      recalc(grounds);
    }, 140);
  }

  function flushBoard() {
    if (boardDebounce) {
      clearTimeout(boardDebounce);
      boardDebounce = null;
      recalc(parseInt(groundsSlider.value, 10));
    }
  }

  // ── Load-time flipboard reset animation ─────────────────────
  // Board starts blank; on load every tile flips in with a staggered
  // cascade to reveal the recipe, then input changes animate normally.
  function runResetAnimation() {
    const grounds = parseInt(groundsSlider.value, 10) || 30;
    const totalWater = grounds * BREW_RATIO;
    const hotWater = totalWater * ((100 - ICE_PERCENT) / 100);
    const ice = totalWater * (ICE_PERCENT / 100);
    const totalOutput = hotWater + ice;
    const totalLiters = (totalOutput / 1000).toFixed(2);
    const totalCups = (totalOutput / 1000 * CUPS_PER_LITER).toFixed(1);
    const text = [
      `DOSE ${EMOJI_FOR.coffee}${grounds}G`,
      `HOT ${EMOJI_FOR.hot}${Math.round(hotWater)}G`,
      `ICE ${EMOJI_FOR.ice}${Math.round(ice)}G`,
      `TOTAL ${EMOJI_FOR.total}${Math.round(totalOutput)}G`,
    ];
    if (prefersReducedMotion) {
      isResetting = false;
      setBoard(text);
      setQuoteBoard(wrapQuote(quoteOfToday()));
      return;
    }
    // Blank grid → full cascade reveal. isResetting is released by
    // the flip-completion tracking (releaseReset()) once every
    // load-time animation has actually settled — not by a guessed
    // duration.
    setBoard(text);
    setQuoteBoard(wrapQuote(quoteOfToday()));
    releaseReset();
  }

  // Fit a quote onto the quote board's fixed 12×4 grid:
  // longest line ≤ 12 chars, up to 4 lines. If the quote needs
  // more than QUOTE_ROWS lines, the final line is truncated with
  // "…" so no quote is ever silently cut off.
  function wrapQuote(quote) {
    const words = quote.toUpperCase().split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      if (line && (line.length + 1 + w.length) > QUOTE_COLS) {
        lines.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) lines.push(line);

    if (lines.length > QUOTE_ROWS) {
      const kept = lines.slice(0, QUOTE_ROWS);
      kept[QUOTE_ROWS - 1] =
        kept[QUOTE_ROWS - 1].slice(0, QUOTE_COLS - 1).trimEnd() + '…';
      lines.length = 0;
      lines.push(...kept);
    }

    while (lines.length < QUOTE_ROWS) lines.push(' ');
    return lines.slice(0, QUOTE_ROWS);
  }

  // ── Wiring ───────────────────────────────────────────────────
  groundsSlider.addEventListener('input', calculate);
  groundsSlider.addEventListener('change', flushBoard);
  runResetAnimation();
})();
