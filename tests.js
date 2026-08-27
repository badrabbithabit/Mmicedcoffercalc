const assert = require('assert');
const {
  BREW_RATIO,
  ICE_PERCENT,
  MAX_BATCH_GRAMS,
  COLS,
  ROWS,
  recipeFor,
  boardLines,
  wrapQuote
} = require('./pwa/recipe.js');

// Mirror of the board layout in app.js (makeBoard/formatLines): same
// COLS/ROWS/GAP_COLS/STATIC_CHARS, same justify algorithm. Asserting
// the board lines through this layout catches grid-shape bugs.
const GAP_COLS = new Set([4, 6]);
function formatLine(line) {
  const chars = Array.from(line);
  const spIdx = chars.indexOf(' ');
  if (spIdx > 0) {
    const label = chars.slice(0, spIdx);
    const emoji = chars.slice(spIdx + 1, spIdx + 2);
    const value = chars.slice(spIdx + 2);
    const labelPad = Math.max(0, 5 - label.length);
    const valuePad = Math.max(0, 5 - value.length);
    return label
      .concat(Array(labelPad).fill(' '), emoji, Array(valuePad).fill(' '), value);
  }
  const pad = Math.max(0, COLS - chars.length);
  return chars.concat(Array(pad).fill(' '));
}
function layoutLine(line) {
  return formatLine(line)
    .map((ch, c) => (GAP_COLS.has(c) ? '·' : ch))
    .join('');
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('recipe.js — shared logic (the code app.js ships)');

test('constants match the hard-coded recipe', () => {
  assert.strictEqual(BREW_RATIO, 15);
  assert.strictEqual(ICE_PERCENT, 40);
  assert.strictEqual(MAX_BATCH_GRAMS, 1000);
  assert.strictEqual(COLS, 11);
  assert.strictEqual(ROWS, 4);
});

test('30g @ 1:15, 40% ice → 270 hot / 180 ice / 450 total', () => {
  const r = recipeFor(30);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.hot, 270);
  assert.strictEqual(r.ice, 180);
  assert.strictEqual(r.total, 450);
  assert.strictEqual(r.warning, false);
});

test('20g → 180/120/300', () => {
  const r = recipeFor(20);
  assert.strictEqual(r.hot, 180);
  assert.strictEqual(r.ice, 120);
  assert.strictEqual(r.total, 300);
});

test('60g (max slider) → 540/360/900, no warning', () => {
  const r = recipeFor(60);
  assert.strictEqual(r.hot, 540);
  assert.strictEqual(r.ice, 360);
  assert.strictEqual(r.total, 900);
  assert.strictEqual(r.warning, false);
});

test('15g (min slider) → 135/90/225', () => {
  const r = recipeFor(15);
  assert.strictEqual(r.hot, 135);
  assert.strictEqual(r.ice, 90);
  assert.strictEqual(r.total, 225);
});

test('70g → 1050 total, warning true (1L cap)', () => {
  const r = recipeFor(70);
  assert.strictEqual(r.total, 1050);
  assert.strictEqual(r.warning, true);
});

test('invalid inputs (0, negative, NaN, undefined) → invalid', () => {
  for (const bad of [0, -5, NaN, undefined]) {
    const r = recipeFor(bad);
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.hot, null);
    assert.strictEqual(r.ice, null);
    assert.strictEqual(r.total, null);
    assert.strictEqual(r.warning, false);
  }
});

console.log('boardLines — 4-row recipe board layout (11 cols, gaps at 5 & 7)');

test('boardLines returns 4 lines (DOSE/HOT/ICE/TOTL)', () => {
  const lines = boardLines(30);
  assert.strictEqual(lines.length, ROWS);
  assert.strictEqual(lines[0], 'DOSE ☕30G');
  assert.strictEqual(lines[1], 'HOT ♨270G');
  assert.strictEqual(lines[2], 'ICE ❄180G');
  assert.strictEqual(lines[3], 'TOTL \u{1F964}450M');
});

test('dose row: label, coffee-bean glyph, 2-unit value + G unit', () => {
  // D O S E · ☕ · ␣ 3 0 G  (cols: 4 gap, 5 emoji, 6 gap, 7 blank value-pad)
  assert.strictEqual(layoutLine('DOSE ☕30G'), 'DOSE·☕· 30G');
});

test('TOTL row: 4-char label, U+1F964, 3-unit value + M unit', () => {
  // T O T L · \u{1F964} · 4 5 0 M  (cols: 4 gap, 5 glyph, 6 gap)
  assert.strictEqual(layoutLine('TOTL \u{1F964}450M'), 'TOTL·\u{1F964}·450M');
});

test('all board lines fit 11 columns (no truncation)', () => {
  for (const g of [15, 20, 30, 40, 60]) {
    for (const line of boardLines(g)) {
      assert.ok(Array.from(line).length <= COLS, `line too wide: ${line}`);
    }
  }
});

console.log('wrapQuote — 11×4 quote board fitting');

test('short quote wraps to 2 lines, padded to 4', () => {
  const lines = wrapQuote('But first, coffee');
  assert.strictEqual(lines.length, ROWS);
  assert.strictEqual(lines[0], 'BUT FIRST,');
  assert.strictEqual(lines[1], 'COFFEE');
  assert.strictEqual(lines[2], ' ');
  assert.strictEqual(lines[3], ' ');
});

test('long quote → truncated with ellipsis on final line', () => {
  const lines = wrapQuote('The ideal life is books and coffee and nothing else at all really');
  assert.strictEqual(lines.length, ROWS);
  assert.strictEqual(lines[ROWS - 1].slice(-1), '…');
  for (const l of lines) assert.ok(l.length <= COLS);
});

console.log(`\nAll ${passed} tests passed!`);
