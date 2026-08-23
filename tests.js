const assert = require('assert');

function calculate(grounds, brewRatio, icePercent, iceOn) {
  const MAX_BATCH_GRAMS = 1000;

  if (!grounds || !brewRatio || brewRatio <= 0) {
    return { hot: '—', ice: '—', total: '—', warning: false };
  }

  const totalWater = grounds * brewRatio;
  let hot, ice;
  if (iceOn) {
    const hotPercent = 100 - icePercent;
    hot = totalWater * (hotPercent / 100);
    ice = totalWater * (icePercent / 100);
  } else {
    hot = totalWater;
    ice = 0;
  }
  const total = hot + ice;

  return { hot, ice, total, warning: total > MAX_BATCH_GRAMS };
}

try {
  // Typical single serving: 30g @ 1:15, 40% ice
  let r = calculate(30, 15, 40, true);
  assert.strictEqual(r.hot, 270);
  assert.strictEqual(r.ice, 180);
  assert.strictEqual(r.total, 450);
  assert.strictEqual(r.warning, false);

  // Smaller serving: 20g @ 1:15, 40% ice
  r = calculate(20, 15, 40, true);
  assert.strictEqual(r.hot, 180);
  assert.strictEqual(r.ice, 120);
  assert.strictEqual(r.total, 300);
  assert.strictEqual(r.warning, false);

  // Two servings: 60g @ 1:15, 40% ice
  r = calculate(60, 15, 40, true);
  assert.strictEqual(r.hot, 540);
  assert.strictEqual(r.ice, 360);
  assert.strictEqual(r.total, 900);
  assert.strictEqual(r.warning, false);

  // 30g @ 1:15, ice off (hot water only)
  r = calculate(30, 15, 0, false);
  assert.strictEqual(r.hot, 450);
  assert.strictEqual(r.ice, 0);
  assert.strictEqual(r.total, 450);
  assert.strictEqual(r.warning, false);

  // 30g @ 1:18, 50% ice
  r = calculate(30, 18, 50, true);
  assert.strictEqual(r.hot, 270);
  assert.strictEqual(r.ice, 270);
  assert.strictEqual(r.total, 540);
  assert.strictEqual(r.warning, false);

  // 50g @ 1:20, 40% ice → 1000g, exactly at limit
  r = calculate(50, 20, 40, true);
  assert.strictEqual(r.hot, 600);
  assert.strictEqual(r.ice, 400);
  assert.strictEqual(r.total, 1000);
  assert.strictEqual(r.warning, false);

  // 55g @ 1:20, 40% ice → 1100g, triggers 1L warning
  r = calculate(55, 20, 40, true);
  assert.strictEqual(r.hot, 660);
  assert.strictEqual(r.ice, 440);
  assert.strictEqual(r.total, 1100);
  assert.strictEqual(r.warning, true);

  // Invalid inputs
  r = calculate(0, 15, 40, true);
  assert.strictEqual(r.hot, '—');
  assert.strictEqual(r.ice, '—');
  assert.strictEqual(r.warning, false);

  console.log('All 8 tests passed!');
} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
}
