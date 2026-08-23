/**
 * Coffee Ratio Calculator — app.js
 *
 * ALL calculation logic. This is the single source of truth for the app.
 * Every input change triggers calculate() which reads DOM values,
 * computes outputs, and updates the DOM in real-time.
 *
 * ── Architecture ─────────────────────────────────────────────────
 * IIFE closure — zero global pollution
 * calculate()    — pure function: reads DOM → computes → writes DOM
 * No framework, no dependencies — vanilla JS only
 *
 * ── Module-level State ────────────────────────────────────────────
 * iceOn    : boolean                — whether ice is active
 *
 * ── Formula ───────────────────────────────────────────────────────
 * totalWater = grounds × brewRatio
 * hotWater   = totalWater × (hotPercent / 100)
 * ice        = totalWater × (icePercent / 100)   [when iceOn]
 * hotWater   = totalWater                        [when !iceOn]
 * ice        = 0                                  [when !iceOn]
 * totalOutput = hotWater + ice
 *
 * ── Constants ─────────────────────────────────────────────────────
 * MAX_BATCH_GRAMS : 1000 (1L hard cap)
 * CUPS_PER_LITER  : 4.22675 (US cups)
 */

(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const CUPS_PER_LITER = 4.22675;
  const MAX_BATCH_GRAMS = 1000;

  // ── DOM Elements ───────────────────────────────────────────
  const groundsSlider = document.getElementById('grounds-slider');
  const groundsDisplay = document.getElementById('grounds-display');
  const brewRatioInput = document.getElementById('brew-ratio-input');
  const iceSlider = document.getElementById('ice-slider');
  const hotRatioDisplay = document.getElementById('hot-ratio-display');
  const iceRatioDisplay = document.getElementById('ice-ratio-display');
  const iceToggle = document.getElementById('ice-toggle');
  const hotWaterValue = document.getElementById('hot-water-value');
  const iceValue = document.getElementById('ice-value');
  const totalValue = document.getElementById('total-value');
  const iceResult = document.getElementById('ice-result');
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warning-text');
  const totalBreakdownValue = document.getElementById('total-breakdown-value');
  const themeDots = document.querySelectorAll('.theme-dot');

  // ── State ─────────────────────────────────────────────────
  let iceOn = true;

  // ── Theme (Flipboard / Subway style picker) ─────────────────
  const THEME_KEY = 'coffee-ratio-theme';
  const THEMES = ['subway', 'flipboard', 'noir'];

  function applyTheme(theme, persist) {
    if (!THEMES.includes(theme)) theme = 'subway';
    document.body.setAttribute('data-theme', theme);
    themeDots.forEach(dot => {
      const on = dot.dataset.theme === theme;
      dot.classList.toggle('active', on);
      dot.setAttribute('aria-checked', on);
    });
    if (persist !== false) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    }
  }

  themeDots.forEach(dot => {
    dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
  });

  let savedTheme = 'subway';
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'subway'; } catch (e) { /* ignore */ }
  applyTheme(savedTheme, false);

  // ── Helpers ────────────────────────────────────────────────
  function animateValue(el) {
    el.classList.add('value-animate');
    el.addEventListener('animationend', () => el.classList.remove('value-animate'), { once: true });
  }

  // ── Core Calculation ──────────────────────────────────────
  function calculate() {
    const grounds = parseInt(groundsSlider.value, 10);
    const brewRatio = parseFloat(brewRatioInput.value);

    if (isNaN(grounds) || isNaN(brewRatio) || brewRatio <= 0) {
      hotWaterValue.textContent = '—';
      iceValue.textContent = '—';
      totalValue.textContent = '—';
      if (totalBreakdownValue) totalBreakdownValue.textContent = '—';
      warningEl.hidden = true;
      return;
    }

    // Update ground display
    groundsDisplay.textContent = `${grounds} g`;

    // Hot + Ice ratio
    const icePercent = parseInt(iceSlider.value, 10);
    const hotPercent = 100 - icePercent;

    hotRatioDisplay.textContent = hotPercent;
    iceRatioDisplay.textContent = icePercent;

    // Total water = grounds × brew ratio
    const totalWater = grounds * brewRatio;

    // Hot water and ice amounts
    let hotWater, ice;
    if (iceOn) {
      hotWater = totalWater * (hotPercent / 100);
      ice = totalWater * (icePercent / 100);
    } else {
      hotWater = totalWater;
      ice = 0;
    }

    // Total output
    const totalOutput = hotWater + ice;

    // Update UI — hot water: liters + cups, ice: grams, total: liters + cups
    const hotWaterLiters = (hotWater / 1000).toFixed(2);
    const hotWaterCups = (hotWater / 1000 * CUPS_PER_LITER).toFixed(1);
    hotWaterValue.textContent = `${hotWaterLiters} L  ·  ${hotWaterCups} cups`;

    iceValue.textContent = `${ice.toFixed(1)} g`;

    const totalLiters = (totalOutput / 1000).toFixed(2);
    const totalCups = (totalOutput / 1000 * CUPS_PER_LITER).toFixed(1);
    totalValue.textContent = `${totalLiters} L  ·  ${totalCups} cups`;
    if (totalBreakdownValue) totalBreakdownValue.textContent = totalValue.textContent;

    // Show/hide ice result
    iceResult.style.display = iceOn && ice > 0 ? 'flex' : 'none';

    // Update total color
    totalValue.classList.remove('warning');

    // Check max batch
    if (totalOutput > MAX_BATCH_GRAMS) {
      warningEl.hidden = false;
      warningText.textContent = `Total exceeds 1 L max batch. Consider reducing grounds.`;
      totalValue.classList.add('warning');
      if (totalBreakdownValue) totalBreakdownValue.classList.add('warning');
    } else {
      warningEl.hidden = true;
    }

    // Animate values
    animateValue(hotWaterValue);
    animateValue(iceValue);
    animateValue(totalValue);
  }

  // ── Event Listeners ────────────────────────────────────────

  // Grounds slider
  groundsSlider.addEventListener('input', calculate);

  // Brew ratio input
  brewRatioInput.addEventListener('input', calculate);

  // Ice slider
  iceSlider.addEventListener('input', calculate);

  // Ice toggle
  iceToggle.addEventListener('click', () => {
    iceOn = !iceOn;
    iceToggle.classList.toggle('active', iceOn);
    iceToggle.setAttribute('aria-checked', iceOn);
    if (iceOn) {
      iceSlider.value = 40;
    } else {
      iceSlider.value = 100;
    }
    calculate();
  });

  // ── Initial Calculate ──────────────────────────────────────
  calculate();

  // ── PWA Service Worker Registration ────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(() => console.log('SW registered'))
        .catch(() => console.log('SW registration skipped'));
    });
  }
})();
