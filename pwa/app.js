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
  const GRID_COLS = 16;
  const GRID_ROWS = 5;
  const FLIP_DURATION = 260;
  const STAGGER_DELAY = 22;
  const SCRAMBLE_INTERVAL = 70;
  const SCRAMBLES_PER_FLIP = 9;
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.·-: ";
  const SCRAMBLE_COLORS = ['#00AAFF', '#00FFCC', '#AA00FF', '#FF2D00', '#FFCC00', '#FFFFFF'];
  const ACCENT_COLORS = ['#00FF7F', '#FF4D00', '#AA00FF', '#00AAFF', '#00FFCC'];

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    const clearScramble = () => {
      if (scrambleTimer) { clearInterval(scrambleTimer); scrambleTimer = null; }
    };

    return {
      el,

      // Set a character with no animation.
      set(char) {
        clearScramble();
        currentChar = char;
        frontSpan.textContent = char === ' ' ? '' : char;
        backSpan.textContent = '';
        front.style.backgroundColor = '';
        frontSpan.style.color = '';
      },

      // Animate to a new character: staggered scramble + flip settle.
      scrambleTo(target, delay) {
        if (target === currentChar) return;

        clearScramble();

        const commit = () => {
          frontSpan.textContent = target === ' ' ? '' : target;
          front.style.backgroundColor = '';
          frontSpan.style.color = '';
          currentChar = target;
        };

        if (prefersReducedMotion) { commit(); return; }

        setTimeout(() => {
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
              setTimeout(() => {
                commit();
                backSpan.textContent = target === ' ' ? '' : target;
                inner.style.transition = `transform ${FLIP_DURATION / 2}ms ease-out`;
                inner.style.transform = '';
                setTimeout(() => {
                  backSpan.textContent = '';
                  inner.style.transition = '';
                  el.classList.remove('scrambling');
                }, FLIP_DURATION / 2);
              }, FLIP_DURATION / 2);
            }
          }, SCRAMBLE_INTERVAL);
        }, delay);
      }
    };
  }

  // ── Board: grid of tiles + transition orchestration ──────────
  const boardZone = document.getElementById('flipboard');
  const gridEl = document.getElementById('tile-grid');
  gridEl.style.setProperty('--grid-cols', GRID_COLS);
  gridEl.style.setProperty('--grid-rows', GRID_ROWS);

  const tiles = [];
  const currentGrid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const t = createTile();
      t.set(' ');
      gridEl.appendChild(t.el);
      row.push(t);
    }
    tiles.push(row);
    currentGrid.push(new Array(GRID_COLS).fill(' '));
  }

  let accentIndex = 0;
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
    boardZone.appendChild(bar);
    accentEls.push(segA, segB);
  }
  const paintAccents = () => {
    const color = ACCENT_COLORS[accentIndex % ACCENT_COLORS.length];
    accentEls.forEach(seg => { seg.style.backgroundColor = color; });
  };
  paintAccents();

  function formatLines(lines) {
    const grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const line = (lines[r] || '').toUpperCase();
      const padTotal = GRID_COLS - line.length;
      const padLeft = Math.max(0, Math.floor(padTotal / 2));
      const padded = ' '.repeat(padLeft) + line +
        ' '.repeat(Math.max(0, GRID_COLS - padLeft - line.length));
      grid.push(padded.split(''));
    }
    return grid;
  }

  // Push new text to the board. Only changed tiles animate,
  // cascading left→right, top→bottom (like a real flipboard).
  function setBoard(lines) {
    const newGrid = formatLines(lines);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (newGrid[r][c] !== currentGrid[r][c]) {
          tiles[r][c].scrambleTo(newGrid[r][c], (r * GRID_COLS + c) * STAGGER_DELAY);
        }
      }
    }
    currentGrid.splice(0, currentGrid.length, ...newGrid);
    accentIndex++;
    paintAccents();
  }

  // ── DOM refs ─────────────────────────────────────────────────
  const groundsSlider = document.getElementById('grounds-slider');
  const groundsDisplay = document.getElementById('grounds-display');
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warning-text');

  // ── Core calculation ─────────────────────────────────────────
  let isResetting = true;

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

    const totalLiters = (totalOutput / 1000).toFixed(2);
    const totalCups = (totalOutput / 1000 * CUPS_PER_LITER).toFixed(1);

    const boardText = [
      `TOTAL ${totalLiters}L`,
      `${totalCups} US CUPS`,
      `HOT ${totalLiters}L`,
      `ICE ${ice.toFixed(0)} G`,
      `1:${BREW_RATIO}  ${grounds}G GND`
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
      `TOTAL ${totalLiters}L`,
      `${totalCups} US CUPS`,
      `HOT ${totalLiters}L`,
      `ICE ${ice.toFixed(0)} G`,
      `1:${BREW_RATIO}  ${grounds}G GND`
    ];
    if (prefersReducedMotion) {
      isResetting = false;
      setBoard(text);
      return;
    }
    // Blank grid → full cascade reveal.
    setBoard(text);
    const cascadeMs = (GRID_ROWS * GRID_COLS) * STAGGER_DELAY + FLIP_DURATION + SCRAMBLES_PER_FLIP * SCRAMBLE_INTERVAL + 100;
    setTimeout(() => { isResetting = false; }, cascadeMs);
  }

  // ── Wiring ───────────────────────────────────────────────────
  groundsSlider.addEventListener('input', calculate);
  runResetAnimation();
})();
