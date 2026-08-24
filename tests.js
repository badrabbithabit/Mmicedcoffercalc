const assert = require('assert');

// Hard-coded Japanese Iced Coffee settings (mirrors pwa/app.js)
const BREW_RATIO = 15;  // 1:15 total liquid (hot water + ice) per gram of grounds
const ICE_PERCENT = 40; // 40% ice / 60% hot water
const MAX_BATCH_GRAMS = 1000;

function calculate(grounds) {
  if (!grounds || grounds <= 0) {
    return { hot: '—', ice: '—', total: '—', warning: false };
  }

  const totalWater = grounds * BREW_RATIO;
  const hotPercent = 100 - ICE_PERCENT;
  const hot = totalWater * (hotPercent / 100);
  const ice = totalWater * (ICE_PERCENT / 100);
  const total = hot + ice;

  return { hot, ice, total, warning: total > MAX_BATCH_GRAMS };
}

try {
  // 30g @ 1:15, 40% ice → 450g total (270 hot / 180 ice)
  let r = calculate(30);
  assert.strictEqual(r.hot, 270);
  assert.strictEqual(r.ice, 180);
  assert.strictEqual(r.total, 450);
  assert.strictEqual(r.warning, false);

  // 20g @ 1:15, 40% ice → 300g total
  r = calculate(20);
  assert.strictEqual(r.hot, 180);
  assert.strictEqual(r.ice, 120);
  assert.strictEqual(r.total, 300);
  assert.strictEqual(r.warning, false);

  // 60g @ 1:15, 40% ice → 900g total (max slider value)
  r = calculate(60);
  assert.strictEqual(r.hot, 540);
  assert.strictEqual(r.ice, 360);
  assert.strictEqual(r.total, 900);
  assert.strictEqual(r.warning, false);

  // 15g @ 1:15, 40% ice → 225g total (min slider value)
  r = calculate(15);
  assert.strictEqual(r.hot, 135);
  assert.strictEqual(r.ice, 90);
  assert.strictEqual(r.total, 225);
  assert.strictEqual(r.warning, false);

  // 40g @ 1:15 → 600g total
  r = calculate(40);
  assert.strictEqual(r.hot, 360);
  assert.strictEqual(r.ice, 240);
  assert.strictEqual(r.total, 600);
  assert.strictEqual(r.warning, false);

  // Invalid inputs
  r = calculate(0);
  assert.strictEqual(r.hot, '—');
  assert.strictEqual(r.ice, '—');
  assert.strictEqual(r.total, '—');
  assert.strictEqual(r.warning, false);

  console.log('All 6 tests passed!');
} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
}
