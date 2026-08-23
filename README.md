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

### Data Flow
```
Grounds Slider (10-100g) ──┐
Brew Ratio Input (1:1-1:30) ──┼──▶ calculate() ──▶ formatDisplay() ──▶ DOM updates
Ice Slider (0-100%) ────────┘      (app.js)       (liters/cups)      (instant)
Ice Toggle (ON/OFF) ─────────┘
Unit Toggle (L/cups) ────────┘
```

### Core Math
All calculations happen in `calculate()` in `app.js`:

```javascript
// 1. Total water from grounds × brew ratio
totalWater = grounds × brewRatio
// e.g., 30g × 15 = 450g total water

// 2. Split between hot water and ice (when ice is ON)
if iceOn:
    hotWater = totalWater × (hotPercent / 100)
    ice = totalWater × (icePercent / 100)
else:
    hotWater = totalWater
    ice = 0

// 3. Total output
totalOutput = hotWater + ice

// 4. Max batch constraint
if totalOutput > 1000: show warning (1L max)
```

### Key Defaults
| Setting | Default | Range |
|---------|---------|-------|
| Grounds | 15g | 10–100g |
| Brew Ratio | 1:15 | Adjustable 1:1 to 1:30 |
| Hot:Ice Split | 60:40 | Adjustable 0–100% ice |
| Max Batch | 1000g (1L) | Hard cap, warns when exceeded |
| Unit | Liters | Toggle to cups (1L = 4.22675 cups) |

### Example Calculation (30g grounds, defaults)
- Total water = 30 × 15 = **450g**
- Hot water = 450 × 0.60 = **270g**
- Ice = 450 × 0.40 = **180g**
- Total = **450g** = 0.45L = 1.9 cups

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
- `#grounds-slider` → `input` event → `calculate()`
- `#brew-ratio-input` → `input` event → `calculate()`
- `#ice-slider` → `input` event → `calculate()`
- `#ice-toggle` → `click` event → toggle `iceOn` state + `calculate()`
- `#unit-liters` → `click` event → set `unit = 'liters'` + `calculate()`
- `#unit-cups` → `click` event → set `unit = 'cups'` + `calculate()`

### State Variables (module scope)
| Variable | Type | Description |
|----------|------|-------------|
| `unit` | `'liters' \| 'cups'` | Current display unit |
| `iceOn` | `boolean` | Whether ice calculation is active |

## Testing Checklist
- [ ] Slider moves smoothly, values update instantly (no lag)
- [ ] Brew ratio input accepts decimals (e.g., 15.5)
- [ ] Ice toggle switches ice display ON/OFF correctly
- [ ] Unit toggle switches between liters and cups
- [ ] Warning appears when total output > 1L
- [ ] Total value turns orange/red when warning is active
- [ ] Dark mode toggles correctly (change system theme)
- [ ] iOS: opens fullscreen in WKWebView with no URL bar
- [ ] iOS: PWA installs to home screen with correct icon
- [ ] Offline: app works after service worker caches everything

## Adding New Features
1. **New calculation input** → Add HTML to `index.html` inside `.ratios-card`, add CSS styling to `styles.css`, add event listener + calculation logic in `calculate()` in `app.js`
2. **New UI card** → New `<section class="card">` in HTML, new class in CSS
3. **New color in dark mode** → Add new `--var-name` in the `@media (prefers-color-scheme: dark)` block in `styles.css`
4. **New iOS feature** → Modify `ContentView.swift` or add new Swift files
