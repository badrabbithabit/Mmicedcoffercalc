# BRH Brewhouse — Split-Flap Coffee Calculator

A PWA that displays coffee recipe calculations on a **split-flap display** (like a
departures board / Solari board). Values flip and scramble into place; static
glyphs (emoji, the "G" unit suffix) render without animation.

## Stack

- Vanilla ES module (`app.js`), no build step.
- `index.html` — two boards: recipe (`flipboard` / `tile-grid`) and daily
  quote (`quote-board` / `quote-grid`), plus a `range` slider for grounds.
- `styles.css` — CSS custom properties drive tile sizing; 3D transforms for the
  flip.
- `sw.js` — service worker, cache-first on install, network-first on fetch.
  **Bump `CACHE_NAME` on every push** or browsers serve stale assets.
- `tests.js` — Node-based logic tests (run with `node tests.js`).

## Grid Layout

### Recipe board (the calculator)
```
GRID_COLS = 11, GRID_ROWS = 4
```
Rows: `DOSE`, `HOT`, `ICE`, `TOTAL`.

Each row is built by `formatLines` and, when `justify === 'justify'`, split on
the first space into **label / emoji / value**:

```
cols (1-based):  1 2 3 4 5 6 7 8 9 10 11
DOSE:            D O S E [gap] ☕ [gap]  1 5  G
HOT:             H O T  [gap] ♨ [gap]  1 3 5  G   (4-char value)
ICE:             I C E  [gap] ❄ [gap]     9 0  G
TOTAL:           T O T A L [gap] ▦ [gap]  2 2 5  G
```

- **Cols 1–5**: label, left-aligned, padded to 5 chars.
- **Col 6**: static emoji glyph.
- **Cols 7–11**: value + `G`, right-aligned within the 5-wide value zone.

`valuePad = 5 - value.length` (NOT `cols - 1 - value.length` — that was a bug
that pushed the value past col 11 and it got truncated, making values vanish).

### Quote board
```
QUOTE_COLS = 11, QUOTE_ROWS = 4
```
One coffee quote per day, uppercased, word-wrapped to ≤ 11 chars/line, max 4
lines. If a quote needs more than 4 lines the last line is truncated with `…`
so nothing is ever silently cut off. Quotes rotate daily via
`QUOTES[dayOfYear % QUOTES.length]`.

## Static Glyphs vs. Animated

`EMOJI_FOR = { dose: '☕', hot: '♨', ice: '❄', total: '▦' }` plus the `G`
suffix are **static** — they never flip or scramble. Everything else (letters,
digits) animates.

`isStaticChar(c)` → true for emoji + `G`. `isEmojiChar(c)` → true only for the
four emoji (they get `EMOJI_YELLOW` color). Static glyphs get a
`.static-glyph` class and skip the scramble in `scrambleTo`.

**Why static:** a split-flap emoji scrambling through random glyphs looks
broken (emoji aren't a single codepoint width in every font, and the visual is
nonsensical). Pinning them to a fixed column keeps the board readable.

## Split-Flap Tile Mechanics

Each cell is a `.tile` → `.tile-inner` → (`.tile-front`, `.tile-back`).

- **`set(char)`**: instant, no animation. Used at board init and for reduced-
  motion. Cancels any in-flight flip.
- **`scrambleTo(target)`**: the cascade. A tile cycles through random chars
  (a "scramble") before settling on `target`, with a per-tile stagger delay so
  the whole board rippled rather than flipping in lockstep.
- **`commit()`**: called when a flip lands — updates text, colors, static-
  glyph class, and the blank class, then marks the tile settled.
- **Reduced motion** (`prefers-reduced-motion`): all tiles use `set()` only,
  no scramble, no stagger.

### Animation queue cap
`activeFlips` counts every tile with a queued or running animation.
`scrambleTo` **refuses to start** once the cap is hit, so a fast slider drag
can't pile up thousands of timeouts and freeze the tab.

### Reset / load-time reveal
On first paint the board goes from a blank grid to the full recipe via a
`releaseReset()` gate: `isResetting` stays true until **every** load-time
animation has actually settled (`settledTiles.size === totalTiles`), not after
a guessed duration. This prevents a second cascade (e.g. from a slider tick
firing mid-load) from double-animating.

## Gap Columns (the "hidden blanks")

In the recipe board, cols 5 and 7 are **intentional gaps** (the spaces between
label/emoji/value). These render as **no tile at all** — the cell is
`background: transparent` and `.tile-inner { visibility: hidden }` so the board
background shows through instead of a dark empty flap.

### How it's scoped (a hard-won lesson)
Only cols 5 and 7 are hidden — **not** every blank cell. The implementation:

1. `createTile(col, gapCols)` takes the tile's 0-based column and a `Set` of
   gap columns. `isGapCol = gapCols ? gapCols.has(col) : false`.
2. In `set()` and `commit()`: `const blank = isGapCol && char === ' '` — the
   `.tile--blank` class is only applied to a blank cell **in a gap column**.
3. The recipe board is created with `GAP_COLS = new Set([4, 6])` (0-based for
   1-based cols 5 and 7). The quote board passes no `gapCols`, so **all** its
   blanks render normally.

### Why the column-scoped approach (and what broke before)
- **v1 — hide every space:** `char === ' '` → blank. Worked for the recipe
  board but also hid the quote board's trailing padding, making quotes look
  ragged/incomplete. Rejected.
- **v2 — `hideBlanks` flag on the board:** passed a boolean to `makeBoard`.
  But `createTile` was defined at the **IIFE top level**, not inside
  `makeBoard`, so `hideBlanks` was a free variable (out of scope) and the flag
  didn't actually reach the tiles — yet blanks still vanished, because the
  initial `set(' ')` at board construction had already painted every cell blank.
  Rejected.
- **v3 — `hideBlanks` as a `createTile` parameter:** fixed the scoping, but
  still hid **every** blank, including the value-zone padding (cols 8–11 when
  the value is short). The user correctly pointed out cols 4 and 8 should keep
  their tiles. Rejected.
- **v4 (current) — gap-column `Set` per tile:** each tile knows its own column;
  a blank is only suppressed if that column is in the gap set. Precise, and the
  quote board is structurally immune because it passes no gap set.

## Sizing (iPhone Air fit)

```css
--tile-size: clamp(22px, 6.9vw, 50px);
--board-pad-x: clamp(18px, 5vw, 36px);
```
`clamp()` keeps tiles legible on small phones and capped on desktop. The 11-col
grid is the result of fitting label(5) + emoji(1) + value(5) with the gaps —
11 is the narrowest width that gives the value a 5-char home (enough for
`900G` + `G` at the 60g max) without the emoji and value overlapping.

## Service Worker Discipline

`sw.js` uses a single `CACHE_NAME` (`coffee-ratio-vNN`). On `install` it
pre-caches the four static assets; on `activate` it deletes any cache with a
different name, so old versions are purged on update.

**Rule: bump the version number on every push that changes a cached asset.**
Forgetting this is the #1 cause of "I pushed but the user still sees the old
behavior" — the SW happily serves the stale `styles.css`/`app.js` from the
pre-existing cache.

## Testing

`tests.js` runs the pure logic (ratio math, `formatLines`, `wrapQuote`) in
Node. Run with `node tests.js` — expect `All 6 tests passed!`. The DOM/animation
layer isn't unit-tested; verify the boards by hand in the browser.

## File Map

```
pwa/
  index.html    — two boards + slider; aria-live on the quote
  app.js        — board/tile engine, formatLines, wrapQuote, quote rotation
  styles.css    — tile 3D, sizing clamps, .tile--blank, static-glyph
  sw.js         — cache strategy (bump CACHE_NAME every push)
  manifest.json — PWA manifest
tests.js        — Node logic tests
```

## Open Considerations

- Emoji width is font-dependent; the monospace stack + single-cell pinning
  keeps them optically aligned, but a font with a wide emoji could still spill.
  If that ever happens, the fix is a dedicated fixed-width `.emoji-cell` rather
  than relying on the glyph's natural advance.
- `wrapQuote` truncates with `…` when a quote exceeds 4 lines — long quotes in
  `QUOTES` are the only way a line ever gets cut. Keep quotes short.
