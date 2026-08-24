# Coffee Ratio Calculator

## Overview
A **Progressive Web App (PWA)** with a minimal **Swift iOS wrapper** for calculating coffee ratios specifically for **Japanese Iced Coffee on a Moccamaster**. The PWA is the single source of truth — all calculation logic lives in the JavaScript layer. The Swift app is a bare-bones WKWebView shell.

## Project Structure

```
coffee-calculator/
├── pwa/                          # PWA — the heart of the app
│   ├── index.html                # Entry point, semantic HTML5 structure
│   ├── styles.css                # Styling (see CSS Architecture below)
│   ├── app.js                    # All calculation & UI logic (see JS Architecture below)
│   ├── manifest.json             # PWA install manifest
│   └── sw.js                     # Service Worker (offline caching)
├── ios/                          # Swift/iOS wrapper
│   ├── CoffeeCalculatorApp.swift # SwiftUI @main entry point
│   └── ContentView.swift         # UIViewRepresentable wrapping WKWebView
└── README.md                     # This file
```

## How It Works

### Hard-Coded Recipe (Japanese Iced Coffee)
Only the **grounds** amount is adjustable (15–60g slider). Everything else is locked
to the researched Japanese iced coffee standard, so the app can never be misconfigured:

| Setting | Value | Why |
|---------|-------|-----|
| Total ratio | **1:15** (grounds : total liquid) | Consensus standard for Japanese flash brew — ice included in the ratio |
| Hot : Ice split | **60% : 40%** | Reliable middle of the ⅓–½ ice range; 40% ice keeps the cup cold and dilutes the concentrate to drinking strength |
| Max Batch | 1000g (1L) | Hard cap, warns when exceeded |

Sources: Online Coffee Guide ("keep total ratio near 1:15, put about 40% of the water in the
server as ice"), Complete Home Barista (1:15–1:16 total), Barista At Home (1:15 total, ⅔ hot / ⅓ ice),
and r/Coffee Moccamaster flash-brew reports (1:10 hot-water concentrate diluted to 1:15 by ~40% ice —
the same 3:1 hot:ice math).

### Data Flow
```
Grounds Slider (15-60g) ──▶ calculate() ──▶ DOM updates
 (the only input)              (app.js)      (instant)
```

### Core Math
All calculations happen in `calculate()` in `app.js` using the constants
`BREW_RATIO = 15`, `ICE_PERCENT = 40`, `ICE_ON = true` (all hard-coded in `app.js`):

```javascript
// 1. Total water from grounds × brew ratio (1:15)
totalWater = grounds × 15
// e.g., 30g × 15 = 450g total water

// 2. Split between hot water and ice (always on)
hotWater = totalWater × 0.60
ice      = totalWater × 0.40

// 3. Total output
totalOutput = hotWater + ice   // = totalWater

// 4. Max batch constraint
if totalOutput > 1000: show warning (1L max)
```

### Example Calculation (30g grounds, hard-coded recipe)
- Total water = 30 × 15 = **450g**
- Hot water = 450 × 0.60 = **270g** (brew at ~1:9 — a concentrate)
- Ice = 450 × 0.40 = **180g**
- Total = **450g** = 0.45L = 1.9 cups — ends at the classic 1:15 strength

## PWA Details

### Manifest (`manifest.json`)
- `display: standalone` — launches as an app, not in browser
- `apple-mobile-web-app-capable` meta tag in HTML header
- SVG icon (green rounded square with coffee emoji)
- `scope: /` — all paths under root

### Service Worker (`sw.js`)
- **Install**: Caches all static assets (`index.html`, `styles.css`, `app.js`, `manifest.json`)
- **Activate**: Cleans old caches, claims all clients
- **Fetch**: Network-first strategy — tries fetch, falls back to cache

### Offline
The app works fully offline once loaded. The service worker caches everything on first visit.

## iOS Wrapper Details

### ContentView.swift
- `UIViewRepresentable` wrapping `WKWebView`
- `webView.configuration.preferences.isJavaScriptEnabled = true`
- `webView.loadFileURL(url, allowingReadAccessTo: resourceURL)` — loads local HTML from bundle
- No navigation controller, no toolbar, no status bar overlay — pure fullscreen experience
- `scrollView.bounces = false` for clean feel

### To build the iOS app:
1. Create a new Xcode iOS App project
2. Add `CoffeeCalculatorApp.swift` as the `@main` entry
3. Add `ContentView.swift`
4. Add the entire `pwa/` folder as a group in the Xcode project (ensure "Create folder references" is checked)
5. The `Bundle.main` will automatically find `index.html` from the copied bundle

## CSS Architecture

### Color System (`styles.css` top-of-file)
```css
/* Light mode (default) */
--bg: #f5f0eb          /* Warm off-white */
--surface: #ffffff     /* Card backgrounds */
--text-primary: #2c2c2c     /* Near-black */
--text-secondary: #7a7570   /* Muted text */
--accent: #6b7c66   /* Sage green */

/* Dark mode (prefers-color-scheme: dark) */
--bg: #1a1a18          /* Dark warm gray */
--surface: #232320     /* Darker card bg */
--text-primary: #e8e4df     /* Off-white */
--accent: #8aaa82   /* Lighter sage */
```

### CSS Classes Reference
| Class | Purpose |
|-------|---------|
| `.app` | Root flex container with safe-area padding |
| `.header` | Title/subtitle area |
| `.calculator` | Main content wrapper (max-width 420px) |
| `.card` | White elevated container with rounded corners |
| `.slider` | Main grounds slider (28px thumb, accent gradient track) |
| `.slider-small` | Ice split slider (22px thumb) |
| `.toggle-btn` | iOS-style toggle switch (active = green) |
| `.unit-btn` | Liter/cup toggle (active = green) |
| `.value-animate` | Triggered via JS for value change flash |
| `.warning` | Max batch warning (orange, slides in) |

### Animation Classes
- **`value-animate`** — CSS animation that flashes opacity from 1 → 0.6 → 1 on value change (300ms). Applied via JS `animateValue()`.
- **`prefers-reduced-motion`** — All transitions snap to 0.01ms when user prefers reduced motion.

## JS Architecture (`app.js`)

### Functions
| Function | Purpose |
|----------|---------|
| `calculate()` | Main calculation — reads all inputs, computes outputs, updates DOM |
| `formatDisplay(value)` | Formats a gram value to liters or cups string |
| `animateValue(el)` | Adds/removes CSS animation class on an element |
| IIFE closure | All logic in an immediately-invoked function — zero global pollution |

### DOM Event Bindings
- `#grounds-slider` → `input` event → `calculate()` — the **only** interactive input
- `.theme-dot[data-theme]` → `click` event → switch visual theme (subway / flipboard / noir), persisted to localStorage

### State Variables (module scope)
| Variable | Type | Description |
|----------|------|-------------|
| `BREW_RATIO` | `15` (const) | Hard-coded 1:15 total ratio |
| `ICE_PERCENT` | `40` (const) | Hard-coded 40% ice / 60% hot water split |
| `ICE_ON` | `true` (const) | Ice is always active |

The `#brew-ratio-input`, `#ice-slider`, and `#ice-toggle` elements remain in the DOM as
**read-only displays** of the locked recipe — they are disabled in `app.js` so the user
cannot change anything but the grounds.

## Testing Checklist
- [ ] Grounds slider moves smoothly, values update instantly (no lag)
- [ ] Brew ratio input is locked at 1:15 (disabled, read-only)
- [ ] Ice slider is locked at 40% (disabled, read-only)
- [ ] Ice toggle is locked ON (disabled)
- [ ] Warning appears when total output > 1L (requires >66g — unreachable via slider, verified in tests.js)
- [ ] Total value turns orange/red when warning is active
- [ ] Theme picker switches subway / flipboard / noir and persists across reload
- [ ] iOS: opens fullscreen in WKWebView with no URL bar
- [ ] iOS: PWA installs to home screen with correct icon
- [ ] Offline: app works after service worker caches everything
- [ ] `node tests.js` → all tests pass

## Adding New Features
1. **New calculation input** → Add HTML to `index.html` inside `.ratios-card`, add CSS styling to `styles.css`, add event listener + calculation logic in `calculate()` in `app.js`
2. **New UI card** → New `<section class="card">` in HTML, new class in CSS
3. **New color in dark mode** → Add new `--var-name` in the `@media (prefers-color-scheme: dark)` block in `styles.css`
4. **New iOS feature** → Modify `ContentView.swift` or add new Swift files
