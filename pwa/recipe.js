/**
 * recipe.js — pure coffee-ratio math + split-flap line formatting.
 *
 * Shared by the PWA (app.js) and the Node test suite (tests.js) so the
 * tests exercise the EXACT code that ships, not a copy of it.
 *
 * UMD: loads as a classic script in the browser (window.Recipe) and as a
 * CommonJS module in Node. No DOM dependencies.
 *
 * ── Formula (hard-coded Japanese Iced Coffee) ───────────────────
 * totalWater  = grounds × 15
 * hotWater    = totalWater × 0.60
 * ice         = totalWater × 0.40
 * totalOutput = hotWater + ice
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Recipe = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Formula constants ────────────────────────────────────────
  const BREW_RATIO = 15;    // 1:15 total liquid per gram of grounds
  const ICE_PERCENT = 40;   // 40% ice / 60% hot water split
  const MAX_BATCH_GRAMS = 1000;

  // Board layout shared by the PWA and the tests.
  const COLS = 11;
  const ROWS = 4;
  // 0-based columns rendered as no-tile gaps (the flipboard "space").
  const GAP_COLS = [4, 6];
  // Static (non-flipboard) tiles — emoji and the unit letter.
   const STATIC_CHARS = ['\u{1FAD8}', '♨', '❄', '\u{1F964}', '㎖'];

  // One recipe for a given grounds weight. Invalid input → null values
  // (the UI renders "—" and the tests assert null).
  function recipeFor(grounds) {
    if (!Number.isFinite(grounds) || grounds <= 0) {
      return { valid: false, grounds: null, hot: null, ice: null, total: null, warning: false };
    }
    const totalWater = grounds * BREW_RATIO;
    const hot = totalWater * ((100 - ICE_PERCENT) / 100);
    const ice = totalWater * (ICE_PERCENT / 100);
    const total = hot + ice;
    return {
      valid: true,
      grounds: Math.round(grounds),
      hot: Math.round(hot),
      ice: Math.round(ice),
      total: Math.round(total),
      warning: total > MAX_BATCH_GRAMS
    };
  }

  // The four recipe board lines: DOSE / HOT / ICE / TOTL.
  // Layout (11 cols, gaps at 5 & 7, 1-based):
  //   DOSE 🫘 30G    | cols 1..4 label, col 5 emoji, cols 6..10 value+unit
  //   TOTL \u{1F964} 450㎖ | same layout, unit ㎖ (U+3396, ml)
  function boardLines(grounds) {
    const r = recipeFor(grounds);
    if (!r.valid) {
      return ['DOSE \u{1FAD8} —G', 'HOT ♨ —㎖', 'ICE ❄ —G', 'TOTL \u{1F964} —㎖'];
    }
    return [
      `DOSE \u{1FAD8}${r.grounds}G`,
      `HOT ♨${r.hot}㎖`,
      `ICE ❄${r.ice}G`,
      `TOTL \u{1F964}${r.total}㎖`
    ];
  }

  // Fit a quote onto the quote board's fixed COLS×ROWS grid:
  // longest line ≤ COLS chars, up to ROWS lines. If the quote needs
  // more lines, the final line is truncated with "…" so no quote is
  // ever silently cut off.
  function wrapQuote(quote) {
    const words = String(quote).toUpperCase().split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      if (line && line.length + 1 + w.length > COLS) {
        lines.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) lines.push(line);

    if (lines.length > ROWS) {
      const kept = lines.slice(0, ROWS);
      kept[ROWS - 1] = kept[ROWS - 1].slice(0, COLS - 1).trimEnd() + '…';
      lines.length = 0;
      lines.push(...kept);
    }

    while (lines.length < ROWS) lines.push(' ');
    return lines.slice(0, ROWS);
  }

  return {
    BREW_RATIO,
    ICE_PERCENT,
    MAX_BATCH_GRAMS,
    COLS,
    ROWS,
    GAP_COLS,
    STATIC_CHARS,
    recipeFor,
    boardLines,
    wrapQuote
  };
});
