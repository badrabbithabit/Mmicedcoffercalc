# Coffee Ratio Calculator

## Overview
A **Progressive Web App (PWA)** with a minimal **Swift iOS wrapper** for calculating coffee ratios specifically for **Japanese Iced Coffee on a Moccamaster**. The PWA is the single source of truth — all calculation logic lives in the JavaScript layer. The Swift app is a bare-bones WKWebView shell.

The UI is a split-flap (Solari/departures-board) display: the recipe renders on an 11×4 board (DOSE / HOT / ICE / TOTL) with a daily rotating quote on a second 11×4 board. See [DESIGN.md](DESIGN.md) for the flipboard engine details.

## Project Structure

```
coffee-calculator/
├── pwa/                          # PWA — the heart of the app
│   ├── index.html                # Entry point
│   ├── styles.css                # Styling (dark, split-flap theme)
│   ├── recipe.js                 # Pure logic: ratio math + board lines (UMD, shared with tests)
│   ├── app.js                    # Split-flap engine + UI wiring
│   ├── manifest.json             # PWA install manifest
│   ├── sw.js                     # Service Worker (offline caching)
│   ├── version.json              # PWA version marker
│   └── icons/                    # SVG + PNG icons
├── ios/                          # Swift/iOS wrapper
│   ├── CoffeeCalculatorApp.swift # SwiftUI @main entry point
│   └── ContentView.swift         # UIViewRepresentable wrapping WKWebView
├── tests.js                      # Node test suite (node tests.js)
└── README.md                     # This file
```

## How It Works

### Hard-Coded Recipe (Japanese Iced Coffee)
Only the **grounds** amount is adjustable (15–60g slider). Everything else is locked
to the researched Japanese iced coffee standard, so the app can never be misconfigured:

| Setting | Value | Where |
|---------|-------|-------|
| Total ratio | **1:15** (grounds : total liquid) | `BREW_RATIO` in `pwa/recipe.js` |
| Hot : Ice split | **60% : 40%** | `ICE_PERCENT` in `pwa/recipe.js` |
| Max Batch | 1000g (1L) | `MAX_BATCH_GRAMS` in `pwa/recipe.js` — warns when exceeded (slider max 60g → 900g, so the warning is a safety net, not reachable from the UI) |

Sources: Online Coffee Guide ("keep total ratio near 1:15, put about 40% of the
water in the server as ice"), Complete Home Barista (1:15–1:16 total), Barista At Home (1:15 total, ⅔ hot / ⅓ ice),
and r/Coffee Moccamaster flash-brew reports (1:10 hot-water concentrate diluted to 1:15 by ~40% ice —
the same 3:1 hot:ice math).

### Data Flow
```
Grounds Slider (15-60g) ──▶ calculate() ──▶ applyRecipe() ──▶ DOM + flipboard
  (the only input)            (app.js)       recipe.js math      (140ms debounce)
```

### Core Math
All math lives in `recipeFor(grounds)` in `pwa/recipe.js` — the single
implementation used by both the app and the tests:

```javascript
// 1. Total water from grounds × brew ratio (1:15)
totalWater = grounds × 15
// e.g., 30g × 15 = 450g total water

// 2. Split between hot water and ice
hotWater = totalWater × 0.60
ice      = totalWater × 0.40

// 3. Total output
totalOutput = hotWater + ice   // = totalWater

// 4. Max batch constraint
warning = totalOutput > 1000   // 1L max
```

### Example Calculation (30g grounds, hard-coded recipe)
- Total water = 30 × 15 = **450g**
- Hot water = 450 × 0.60 = **270g** (brew at ~1:9 — a concentrate)
- Ice = 450 × 0.40 = **180g**
- Total = **450g** = 0.45L — ends at the classic 1:15 strength

### Board Rows
The recipe board renders 4 rows (11 cols, gap columns 5 & 7, static glyphs in
yellow, unit letter static):

| Row | Label | Glyph | Value | Unit |
|-----|-------|-------|-------|------|
| 1 | `DOSE` | ☕ coffee bean | grounds | G (g) |
| 2 | `HOT` | ♨ hot spring | hot water | G (g) |
| 3 | `ICE` | ❄ snowflake | ice | G (g) |
| 4 | `TOTL` | 🥤 U+1F964 | total | **M (ml)** |

## PWA Details

### Manifest (`manifest.json`)
- `display: standalone` — launches as an app, not in browser
- `apple-mobile-web-app-capable` meta tag in HTML header
- SVG + PNG icons
- `scope: /` — all paths under root

### Service Worker (`sw.js`)
- **Install**: Caches all static assets (`index.html`, `styles.css`, `recipe.js`, `app.js`, `manifest.json`)
- **Activate**: Cleans old caches, claims all clients
- **Fetch**: Network-first strategy — tries fetch, falls back to cache
- Bump `CACHE_NAME` on every deploy so clients pick up the new bundle

### Offline
The app works fully offline once loaded. The service worker caches everything on first visit.

## iOS Wrapper Details

### ContentView.swift
- `UIViewRepresentable` wrapping `WKWebView` with a `Coordinator` navigation delegate
- `webView.loadFileURL(indexURL, allowingReadAccessTo: pwaURL)` — loads `index.html` from the bundled `pwa/` folder
- `scrollView.bounces = false`, inline media playback on — pure fullscreen experience, no chrome

### To build the iOS app:
1. Create a new Xcode iOS App project
2. Add `CoffeeCalculatorApp.swift` as the `@main` entry
3. Add `ContentView.swift`
4. Add the entire `pwa/` folder as a **folder reference** (blue folder) in the Xcode project, not a group
5. `Bundle.main` finds `index.html` from the copied bundle folder at runtime

## CSS Architecture

### Color System (`styles.css` top-of-file)
Dark-only theme (split-flap board aesthetic):

```css
--bg: #000                 /* App background */
--surface / --surface-2   /* #000 — no separate card surface */
--text-primary: #f5f5f3   /* Near-white */
--text-secondary: #9b9ba3 /* Muted text */
--accent: #ffb424         /* Amber (values, slider, warning) */
--brand: #ffb424          /* Brand wordmark */
```

### CSS Classes Reference
| Class | Purpose |
|-------|---------|
| `.app` | Root flex container with safe-area padding (100dvh) |
| `.panel` / `.panel-top` / `.panel-quote` | Grey Changi-style board housing |
| `.brand` / `.brand-name` / `.brand-sub` | BRH Brewhouse wordmark |
| `.board` / `.tile-grid` | Split-flap board + CSS grid (11 cols) |
| `.tile` / `.tile-inner` / `.tile-front` / `.tile-back` | One flap (3D flip pair) |
| `.accent-bar` / `.accent-segment` | Cycling color blocks, top corners |
| `.controls` / `.slider` | Grounds slider — the only input |
| `.warning` | Max batch warning (hidden unless triggered) |

### Reduced Motion
- CSS: all transitions/animations snap to 0.01ms
- JS: tiles commit instantly with no scramble/flip (`prefers-reduced-motion` checked in `app.js`)

## JS Architecture

### `pwa/recipe.js` — pure logic (UMD)
| Export | Purpose |
|--------|---------|
| `recipeFor(grounds)` | The ratio math → `{ valid, grounds, hot, ice, total, warning }` |
| `boardLines(grounds)` | The 4 recipe board rows (`DOSE/HOT/ICE/TOTL`) |
| `wrapQuote(text)` | Fit a quote onto the 11×4 quote board, `…` truncation |
| `BREW_RATIO`, `ICE_PERCENT`, `MAX_BATCH_GRAMS`, `COLS`, `ROWS`, `GAP_COLS`, `STATIC_CHARS` | Shared constants |

Loaded as a classic script in the browser (`window.Recipe`) and as a CommonJS
module in Node — which is what lets `tests.js` assert against the exact code
that ships.

### `pwa/app.js` — flipboard engine + UI wiring
| Piece | Purpose |
|-------|---------|
| `createTile()` / `makeBoard()` | Split-flap display engine: per-tile scramble + 3D flip, stagger cascade, in-flight safety, reduced-motion |
| `calculate()` | Slider `input` — updates controls instantly, debounces the board 140ms |
| `flushBoard()` | Slider `change` — commits the board immediately |
| `applyRecipe(grounds)` | Pushes `boardLines(grounds)` to the board + warning state |
| `runResetAnimation()` | Load-time cascade reveal of recipe + quote |
| `quoteOfToday()` | `dayOfYear % 12` into the attributed quote list |

All in an IIFE — zero global pollution.

## Testing
```
node tests.js
```
`tests.js` imports `pwa/recipe.js` directly (no re-implementation) and covers:
the ratio math (all slider bounds + 1L warning + invalid inputs), the 4-row
board layout (label/gap/glyph/value/unit positions), and quote wrapping.

## Adding New Features
1. **Change the recipe math** → edit `recipe.js` only, then run `node tests.js` and extend the tests
2. **New board row** → bump `ROWS` in `recipe.js`, add the line in `boardLines()`, update `styles.css` grid
3. **New quote** → add to `QUOTES` in `app.js` (keep ≤ ~44 chars so it fits 11×4)
4. **New iOS feature** → modify `ContentView.swift`
