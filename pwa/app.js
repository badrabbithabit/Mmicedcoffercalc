/**
 * Coffee Ratio Calculator — app.js (split-flap flipboard)
 *
 * ── Architecture ─────────────────────────────────────────────────
 * IIFE closure — zero global pollution
 * calculate() — reads slider → computes → pushes new board text
 * SplitFlapBoard / Tile — split-flap display engine (flipoff-inspired)
 * No audio. No framework, no dependencies — vanilla JS only.
 *
 * The ratio math and board line formatting live in recipe.js (UMD),
 * shared with the Node test suite so tests exercise the shipped code.
 */

(() => {
  'use strict';

  // ── Shared pure logic (recipe.js) ────────────────────────────
  const { recipeFor, boardLines, wrapQuote, COLS, ROWS, GAP_COLS, STATIC_CHARS } = window.Recipe;

  // ── Split-flap display constants (flipoff-inspired) ───────────
  const FLIP_DURATION = 260;
  const STAGGER_DELAY = 22;
  const SCRAMBLE_INTERVAL = 70;
  const SCRAMBLES_PER_FLIP = 9;
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.·-: ";

  // Row glyphs (emoji) are STATIC tiles — no flip/scramble — so they
  // stay vertically centred and never jitter during a transition.
  // The unit ㎖ (ml, U+3396) is static too; it sits in the shared
  // STATIC_CHARS list from recipe.js alongside the emoji.
  const STATIC_SET = new Set(STATIC_CHARS);
  const UNIT_CHAR = '㎖';
  const EMOJI_ONLY = new Set(STATIC_CHARS.filter((c) => c !== UNIT_CHAR));
  const isEmojiChar = (ch) => EMOJI_ONLY.has(ch);
  const isStaticChar = (ch) => STATIC_SET.has(ch);
  const EMOJI_YELLOW = '#FFCC00';
  const SCRAMBLE_COLORS = ['#00AAFF', '#00FFCC', '#AA00FF', '#FF2D00', '#FFCC00', '#FFFFFF'];
  const ACCENT_COLORS = ['#00FF7F', '#FF4D00', '#AA00FF', '#00AAFF', '#00FFCC'];
  const MAX_QUEUED_FLIPS = 48;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Daily rotating coffee quote ──────────────────────────────
  // Real, attributed coffee quotes. Kept short so they fit the
  // 11×4 split-flap board (wrapQuote truncates anything longer).
  const QUOTES = [
    { text: 'I like big coffee and I cannot lie', source: 'Trey Songz' },
    { text: 'Coffee is a language in itself', source: 'Haruki Murakami' },
    { text: 'Coffee first, then problems', source: 'Unknown' },
    { text: 'Life begins after coffee', source: 'Unknown' },
    { text: 'Coffee: the elixir of life', source: 'Johann Wolfgang von Goethe' },
    { text: 'Good coffee is only a cup away', source: 'Unknown' },
    { text: 'Coffee is my therapy', source: 'Unknown' },
    { text: 'No coffee, no show', source: 'Unknown' },
    { text: 'But first, coffee', source: 'Unknown' },
    { text: 'The ideal life is books and coffee', source: 'Unknown' },
    { text: 'May your coffee be strong', source: 'Unknown' },
    { text: 'Coffee is a hug for your stomach', source: 'Unknown' }
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
  function createTile(col = 0, gapCols = null) {
    const el = document.createElement('div');
    el.className = 'tile';
    const isGapCol = gapCols ? gapCols.has(col) : false;

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
        const blank = isGapCol && char === ' ';
        frontSpan.textContent = blank ? '' : char;
        backSpan.textContent = '';
        front.style.backgroundColor = '';
        // cancel() does not reset text color — a tile interrupted mid-
        // scramble can still carry a scramble text color.
        const staticGlyph = isStaticChar(char);
        frontSpan.style.color = isEmojiChar(char) ? EMOJI_YELLOW : '';
        front.classList.toggle('static-glyph', staticGlyph);
        el.classList.toggle('tile--blank', blank);
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
          const blank = isGapCol && target === ' ';
          frontSpan.textContent = blank ? '' : target;
          front.style.backgroundColor = '';
          const staticGlyph = isStaticChar(target);
          frontSpan.style.color = isEmojiChar(target) ? EMOJI_YELLOW : '';
          front.classList.toggle('static-glyph', staticGlyph);
          el.classList.toggle('tile--blank', blank);
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
  function makeBoard(zoneEl, gridEl, cols, rows, accentIndexStart, justify, gapCols = null) {
    gridEl.style.setProperty('--grid-cols', cols);
    gridEl.style.setProperty('--grid-rows', rows);

    const tiles = [];
    // What the DOM actually shows right now. Tiles that are mid-flip
    // still display their OLD char, so a new cascade must start from
    // this grid — comparing against the target would double-start.
    const displayedGrid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const t = createTile(c, gapCols);
        t.set(' ');
        gridEl.appendChild(t.el);
        row.push(t);
      }
      tiles.push(row);
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
          //   cols 7..12 → VALUE (digits + unit), right-aligned
          const spIdx = chars.indexOf(' ');
          if (spIdx > 0) {
            const label = chars.slice(0, spIdx);
            const emoji = chars.slice(spIdx + 1, spIdx + 2);
            const value = chars.slice(spIdx + 2);
            // Emoji at col 6 (index 5) → pad the label to exactly 5 wide.
            const labelPad = Math.max(0, 5 - label.length);
            // Value zone is cols 7..11 (5 wide, 0-based 6..10). Right-align
            // so the unit lands on col 10 (a real tile), never col 11 —
            // the trailing gap column with no tile.
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
    displayedGrid.splice(0, displayedGrid.length, ...newGrid);
      accentIndex++;
      paintAccents();
    };

    return { setLines, rows };
  }

  const board = makeBoard(
    document.getElementById('flipboard'),
    document.getElementById('tile-grid'),
    COLS,
    ROWS,
    0,
    'justify',
    new Set(GAP_COLS)
  );

  const quoteBoard = makeBoard(
    document.getElementById('quote-board'),
    document.getElementById('quote-grid'),
    COLS,
    ROWS,
    ACCENT_COLORS.length // offset so accent colors differ from the main board
  );
  const setBoard = (lines) => board.setLines(lines);
  const setQuoteBoard = (lines) => quoteBoard.setLines(lines);

  const quoteSourceEl = document.getElementById('quote-source');
  const setQuoteSource = (source) => {
    if (!quoteSourceEl) return;
    const s = (source || '').trim();
    quoteSourceEl.textContent = s ? `— ${s}` : '';
  };

  // ── DOM refs ─────────────────────────────────────────────────
  const groundsSlider = document.getElementById('grounds-slider');
  const groundsDisplay = document.getElementById('grounds-display');
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warning-text');

  // ── Core calculation ─────────────────────────────────────────
  function applyRecipe(grounds) {
    const r = recipeFor(grounds);
    if (!r.valid) {
      groundsDisplay.textContent = '—';
      warningEl.hidden = true;
      return;
    }

    groundsDisplay.textContent = `${grounds} g`;
    setBoard(boardLines(grounds));
    warningEl.hidden = !r.warning;
    warningText.textContent = 'Total exceeds 1 L max batch. Reduce grounds.';
  }

  let boardDebounce = null;
  function calculate() {
    const grounds = parseInt(groundsSlider.value, 10);

    // Update the plain controls instantly, even while resetting.
    const r = recipeFor(grounds);
    groundsDisplay.textContent = r.valid ? `${grounds} g` : '—';
    warningEl.hidden = !(r.valid && r.warning);
    warningText.textContent = 'Total exceeds 1 L max batch. Reduce grounds.';

    // Never fight the load-time reset animation.
    if (isResetting) return;

    // Debounce the flipboard: slider input fires on every tick while
    // dragging, which would queue up a flip animation per value.
    // Wait for the user to pause (or release) before animating.
    if (boardDebounce) clearTimeout(boardDebounce);
    boardDebounce = setTimeout(() => {
      boardDebounce = null;
      applyRecipe(grounds);
    }, 140);
  }

  function flushBoard() {
    if (boardDebounce) {
      clearTimeout(boardDebounce);
      boardDebounce = null;
      applyRecipe(parseInt(groundsSlider.value, 10));
    }
  }

  // ── Load-time flipboard reset animation ─────────────────────
  // Board starts blank; on load every tile flips in with a staggered
  // cascade to reveal the recipe, then input changes animate normally.
  function runResetAnimation() {
    const grounds = parseInt(groundsSlider.value, 10) || 30;
    const text = boardLines(grounds);
    const today = quoteOfToday();
    setQuoteSource(today.source);
    if (prefersReducedMotion) {
      isResetting = false;
      setBoard(text);
      setQuoteBoard(wrapQuote(today.text));
      return;
    }
    // Blank grid → full cascade reveal. isResetting is released by
    // the flip-completion tracking (releaseReset()) once every
    // load-time animation has actually settled — not by a guessed
    // duration.
    setBoard(text);
    setQuoteBoard(wrapQuote(today.text));
    releaseReset();
  }

  // ── Wiring ───────────────────────────────────────────────────
  groundsSlider.addEventListener('input', calculate);
  groundsSlider.addEventListener('change', flushBoard);
  runResetAnimation();
})();
