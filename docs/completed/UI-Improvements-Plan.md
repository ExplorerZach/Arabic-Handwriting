# Plan: Light-Mode Palette Refactor ("Refined Parchment")

**Branch:** `UI-Improvements` (exists locally, based on `main`; NOT yet pushed to origin).
Working tree on `main` was clean when this plan was written. First step is
`git checkout UI-Improvements` (or `git checkout -b UI-Improvements` if it no
longer exists). **Do not commit until the user approves the visual result.**

## Problem

The app in **light mode** is a low-contrast, muddy, monochromatic brown-on-tan
palette. Dark mode is "a little bit better" but still has a few weak spots
(barely-visible ghost/template glyph, muted labels). The user approved this
direction:

- **"Refined parchment"** — keep the warm calligraphy identity, but shift
  surfaces toward near-white cream, darken muted text, strengthen borders.
- **Scope:** light-mode rework **plus** small dark-mode polish.
- **Canvas paper themes also get retuned**, not just the surrounding UI.

## Architecture facts (why the fix is centralized)

- The entire UI is tokenized through CSS custom properties defined in
  `src/styles/global.css` in three blocks:
  - `:root` — light mode (lines ~124–169)
  - `[data-theme="dark"]` — dark mode (lines ~172–217)
  - `[data-high-contrast="true"]` and `[data-theme="dark"][data-high-contrast="true"]`
    — high-contrast overrides (lines ~540–633) — **do NOT touch these**; they
    override everything anyway.
- Tokens are consumed by `src/styles/practiceStyles.js`,
  `src/styles/loginStyles.js`, and components via `var(--color-*)`. Hardly any
  hardcoded hex exists outside `global.css` / `themes.js` (only `#fff8ee`/`#fff`
  text-on-accent colors, which stay valid).
- Canvas paper backgrounds live in `src/styles/themes.js` (`PAPER_THEMES`),
  brush colors in `BRUSH_PACKS`, canvas glyph ink in `getCanvasInkColor()`.

## Measured contrast (current light mode, WCAG)

Computed with the standard relative-luminance formula (node script used is
reproduced under Verification). Background = `--color-bg` `#fdf0d0`;
surface = blended `rgba(255,255,255,0.6)` over the tan gradient ≈ `#fffaf0`.

| Pair                                           | Ratio | Verdict                                                                     |
| ---------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| `--color-text` `#3d1800` on bg                 | 13.96 | ✅                                                                          |
| `--color-text-muted` `#9b6a30` on bg           | 4.12  | ❌ below AA 4.5:1 (used for subtitles, labels, mini-labels, progress badge) |
| `--color-text-soft` `#6b4010` on bg            | 7.84  | ✅                                                                          |
| `--color-accent` `#8b4513` on bg               | 6.27  | ✅                                                                          |
| `--color-accent-light` `#c0703a` on bg         | 3.30  | ❌ fails (stars, sliders, hint icons, `--color-outline`)                    |
| `--color-accent` on surface                    | 6.82  | ✅                                                                          |
| `--color-text-muted` on surface                | 4.49  | ❌ borderline fail                                                          |
| `#fff8ee` white on form-active gradient (mid)  | 5.11  | ✅ borderline                                                               |
| dark `--color-text-muted` `#c0905a` on dark bg | 6.65  | ✅ (but weak in practice on small labels)                                   |
| dark `--color-accent` `#c0703a` on dark bg     | 5.07  | ✅                                                                          |

Additional "muddiness" causes (not measurable by ratio):

- Surfaces are translucent (`--color-surface-solid: rgba(255,255,255,0.6)`)
  over a heavy tan gradient → cards and buttons visually dissolve into the bg.
- Borders nearly invisible: `--color-border: rgba(180,130,60,0.35)`.
- `--color-btn-clear-bg: rgba(220,180,120,0.3)` — translucent tan-on-tan mud.
- `--color-ghost: rgba(139,90,43,0.18)` — template letter hard to see on light
  canvas; in dark mode `rgba(192,112,58,0.15)` is also too faint (see
  screenshot 3 in original report).

## Changes

### 1. `src/styles/global.css` — rewrite `:root` light palette

Target: all normal text ≥ 4.5:1 on both `--color-bg` and surfaces; visible
borders; opaque-ish surfaces; keep warm parchment identity.

Planned new values (verify each with the contrast script before finalizing;
adjust ±1 shade if any pair dips under 4.5):

- Background gradient (lighter, less saturated, more "air"):
  - `--color-bg: #faf6ec`
  - `--color-bg-alt: #f4ecd8`
  - `--color-gradient-start: #faf6ec`
  - `--color-gradient-mid: #f4ecd8`
  - `--color-gradient-end: #efe5cc`
- Surfaces (near-opaque warm white so cards pop):
  - `--color-surface: rgba(255,253,247,0.92)`
  - `--color-surface-solid: rgba(255,253,247,0.92)`
  - `--color-surface-hover: #fffdf7` (or rgba equivalent)
  - `--color-card-bg: rgba(255,253,247,0.92)`
  - `--color-input-bg: #fffdf7`-equivalent
  - `--color-canvas-bg: rgba(255,253,247,0.92)`
- Text ramp (all ≥ 4.5:1 on bg AND on surfaces):
  - `--color-text: #2e1404` (~14:1)
  - `--color-text-muted: #7a5220` (~5.5:1)
  - `--color-text-soft: #5a3a12` (~8:1)
  - `--color-primary: #4a2408`
- Accents (deepened for contrast, still warm copper):
  - `--color-accent: #7d3f0f` (~7:1)
  - `--color-accent-light: #9a5a24` (target ≥ 4.5:1 on bg)
  - `--color-accent-warm: #6b3408`
  - `--color-link: #7d3f0f`
  - `--color-outline: #9a5a24`
- Borders (stronger — cards get visible edges):
  - `--color-border: rgba(150,105,45,0.45)`
  - `--color-border-strong: rgba(150,105,45,0.7)`
  - `--color-canvas-border: rgba(150,105,45,0.5)`
- Shadows slightly deeper for separation:
  - `--color-shadow: rgba(90,55,10,0.15)`
  - `--color-shadow-deep: rgba(110,60,15,0.35)`
- Buttons (solid, no transparency mud):
  - `--color-btn-clear-bg: #f0e4c8` (solid warm tint)
  - `--color-btn-nav-bg: rgba(255,253,247,0.92)`
  - `--color-btn-showme-bg: #f5e9cf`-ish (solid light tint of accent)
  - `--color-btn-alpha-bg: rgba(255,253,247,0.9)`
  - `--color-btn-alpha-hover: #fffdf7`
  - `--color-btn-ai-bg: linear-gradient(135deg, #7d3f0f, #a8601f)` (keep
    white `#fff8ee` text on it ≥ 4.5:1 — verify both gradient ends)
  - `--color-form-active-bg: linear-gradient(150deg, #6b3408, #a8601f)`
    (verify white text on both ends)
- Feedback/template:
  - `--color-ghost: rgba(120,75,30,0.22)` (raised from 0.18)
  - `--color-dot-complete: #3e7a34` (darker green, AA-safe)
  - `--color-dot-started: #9a5a24` (match accent-light)
  - `--color-star-filled: #9a5a24`
  - `--color-star-empty: rgba(150,105,45,0.35)`
  - `--color-progress-badge-bg: rgba(150,105,45,0.15)`
  - `--color-offline-bg: rgba(150,105,45,0.18)`
  - `--color-scrollbar-thumb: rgba(120,75,30,0.4)` / hover `0.65`
  - `--color-feedback-error-*`: keep hue family, verify text `#8b2000` on its
    bg ≥ 4.5 (should be fine)

### 2. `global.css` — dark-mode polish (small; dark is already decent)

In `[data-theme="dark"]` only:

- `--color-text-muted: #c0905a` → `#cfa06a` (small-label legibility)
- `--color-ghost: rgba(192,112,58,0.15)` → `rgba(192,112,58,0.20)` (resting
  glyph barely visible in screenshot 3)
- `--color-border: rgba(192,112,58,0.35)` → `rgba(192,112,58,0.45)`
- Re-verify: muted/bg stays ≥ 4.5; nothing else changes.

### 3. `src/styles/themes.js` — retune light paper themes + canvas ink

- `PAPER_THEMES.parchment.light.bg`: `#fdf6e8` → `#fbf5e6` (only adjust if it
  clashes with new app bg; it is already close)
- `PAPER_THEMES.aged.light.bg`: `#f0e0c0` → `#f2e6ca`
- `ruled` / `grid` light `lineColor` alpha: `0.25` → `0.30` (and `0.20` →
  `0.25`) so lines stay visible on the lighter paper
- `getCanvasInkColor(false)`: `#8b4513` → `#7d3f0f` (match new accent)
- Dark paper themes and `BRUSH_PACKS`: unchanged (brush packs are already
  high-contrast by design).
- Note: `useExport.js` hardcodes `#8b4513` twice for exported glyph ink —
  update to `#7d3f0f` for consistency with the new accent.

### 4. Verification (all must pass)

1. **Contrast re-check** — run a node script over every text/bg and
   text/surface pair for BOTH themes; all normal text ≥ 4.5:1, large text
   (Arabic glyphs, big numerals) ≥ 3:1. Script pattern used during planning:
   ```js
   node -e "function L(h){const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}function cr(a,b){const x=L(a),y=L(b);return((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2);}console.log(cr('#2e1404','#faf6ec'));"
   ```
   For rgba tokens, blend over the app bg first before computing.
2. **Repo gates** (from AGENTS.md — all must exit zero):
   `npm run lint && npm run typecheck && npm run test:run && npm run build`
3. **Manual visual check** — `npm run dev`, verify in light AND dark mode:
   - Practice view (tabs, form switcher, canvas, buttons, alphabet row)
   - Stats tab (XP card, streak, heatmap, timeline bars)
   - Settings panel (paper theme swatches, brush swatches)
   - Confirm ghost template letter is visible on canvas in both modes
   - Spot-check high-contrast mode still looks right (it should be unaffected)

### 5. Wrap-up

- Show user the result; only commit/push on the `UI-Improvements` branch when
  explicitly asked. Push will need `git push -u origin UI-Improvements`
  (branch has no upstream yet).

## Explicitly NOT changing

- No component/JSX restructuring — pure token + paper-theme retune.
- High-contrast CSS blocks (`[data-high-contrast="true"]`) untouched.
- Dark-mode structural layout unchanged; only the 3 token tweaks above.
- `BRUSH_PACKS`, letter data, locales, storage keys — untouched.
- No new dependencies, no new files besides this plan.

## Files touched

1. `src/styles/global.css` — light `:root` palette rewrite + 3 dark tweaks
2. `src/styles/themes.js` — light paper bgs, ruled/grid alphas, canvas ink
3. `src/hooks/useExport.js` — 2 hardcoded `#8b4513` → `#7d3f0f`
