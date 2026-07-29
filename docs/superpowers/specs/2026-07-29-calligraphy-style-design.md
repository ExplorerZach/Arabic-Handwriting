# Calligraphy Style Preference (ROADMAP #10 — Infrastructure)

**Status:** Not started
**Effort:** Small

## Goal

Replace ~18 hardcoded `fontFamily` strings spread across 4 files (plus 2 dead-code removals) with a single
user preference (`calligraphy_style`) and a centralized `resolveFontStack()`
helper. For now the picker offers only the two already-loaded Naskh fonts
(Amiri and Scheherazade New) — the user-visible value is modest (two subtly
different Naskh faces), but the plumbing is the deliverable here. Adding a
genuinely different script (Kufic, Ruq'ah) later becomes a simple one-line
registry entry once a WOFF2 file is bundled.

**ROADMAP status:** Leave #10 unchecked after this. Add a note that the
infrastructure is done but multi-script support is a follow-up (#10b).

---

## Design

### 1. Central font-stack helper (`src/styles/themes.js`)

New registry + resolver, matching the existing `getBrushColor` / `getPaperColors`
pattern:

```js
export const SCRIPT_STYLES = {
  amiri: {
    id: 'amiri',
    nameKey: 'styleAmiri',
    family: '"Amiri","Scheherazade New","Arial Unicode MS",serif',
  },
  scheherazade: {
    id: 'scheherazade',
    nameKey: 'styleScheherazade',
    family: '"Scheherazade New","Amiri","Arial Unicode MS",serif',
  },
};

export function getFontStack(styleId) {
  return (SCRIPT_STYLES[styleId] || SCRIPT_STYLES.amiri).family;
}
```

Called as `getFontStack(calligraphyStyle)` by every consumer.

### 2. Preference key

| Field    | Value                                                   |
| -------- | ------------------------------------------------------- |
| Key      | `calligraphy_style` (snake_case, matching `brush_pack`) |
| Default  | `'amiri'`                                               |
| Location | `usePrefs.js` state + `getItem`/`setItem`               |
| Backup   | Add to `BACKUP_KEYS` in `backup.js`                     |

### 3. Settings UI

Inserted in the **Canvas** section of `SettingsPanel.jsx`, after the Paper/Ink
pickers. Same pattern as the Paper theme row:

- Section label: `t('settingsCalligraphyStyle')` — "Calligraphy Style" / "نمط الخط"
- A row of buttons, one per `SCRIPT_STYLES` entry
- Each button renders the letter `ب` in the corresponding font family (this is
  how users distinguish them — the two Naskh faces differ by a few degrees of
  slant and stroke weight)
- Active button gets the `themeBtnActive` border style

Locale additions (EN + AR):

```
settingsCalligraphyStyle: 'Calligraphy Style'   / 'نمط الخط'
styleAmiri: 'Amiri'                              / 'أميري'
styleScheherazade: 'Scheherazade'                / 'شهرزاد'
ariaCalligraphyStyle: 'Calligraphy style'        / 'نمط الخط'
```

### 4. Consumption sites — replace all font stacks

Every `fontFamily` string in the codebase must be replaced with
`getFontStack(calligraphyStyle)`:

| File                | Lines                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practiceStyles.js` | 26, 135, 185, 246, 366, 537, 599, 618, 741, 976, 1001, 1224, 1257 | Static style objects. Since `getFontStack` is dynamic, these need to be computed in the render path. Prefer **A** — inline `fontFamily` in JSX where the style object used it; leave the rest of the style object as-is. (A CSS custom property on `document.documentElement` + `var(--script-font)` in the static styles would eliminate 13 of the 14 DOM-side edits at the cost of a second mechanism alongside the `ctx.font` helper — not worth the split.) |
| `useDrawing.js`     | 96                                                                | `ctx.font = ${ghost.fontSizePx}px ${getFontStack(...)}`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `useExport.js`      | 36, 134                                                           | `ctx.font = bold ${fontSize}px ${getFontStack(...)}`                                                                                                                                                                                                                                                                                                                                                                                                            |
| `useAnimation.js`   | 119                                                               | Glyph canvas font: `gCtx.font = ${glyphSize}px ${getFontStack(...)}`                                                                                                                                                                                                                                                                                                                                                                                            |
| `useAnimation.js`   | 55                                                                | `drawReferenceGlyph` font (reduced-motion path): same change                                                                                                                                                                                                                                                                                                                                                                                                    |
| `loginStyles.js`    | —                                                                 | **Deliberately excluded.** This is the pre-login screen — threading `calligraphyStyle` through `App.jsx` → `LoginScreen` adds prop plumbing for a decorative title glyph the user only ever sees before touching Settings. Left hardcoded.                                                                                                                                                                                                                      |

**Important behavior change to flag:** `useAnimation.js:55` currently uses
Scheherazade-first, while all other sites use Amiri-first. After this change
the animation reference will follow the user's preference. With the default
(`amiri`), the animation reference font flips from Scheherazade to Amiri.
This is acceptable — the user chose Amiri — but it's a visible change in the
default path.

### 5. Canvas invalidation on pref change

Use an **unconditional** redraw (like `handleThemeChange`), not the conditional
path from `handleTemplateScaleChange`. The unconditional path is simpler and
updates the ghost instantly even with an empty resting-glyph cache:

```js
const handleCalligraphyStyleChange = styleId => {
  setCalligraphyStyle(styleId);
  setItem('calligraphy_style', styleId);
  redrawRef.current(strokesRef.current);
};
```

Also invalidate the resting glyph cache so a stale font isn't restored on the
next stroke:

```js
if (restGlyphRef.current) {
  restGlyphRef.current = null;
  setRestingGlyphRef.current?.(false);
}
```

Both are needed. Without `redrawRef`, switching styles appears to do nothing.
Without nulling `restGlyphRef`, the old font reappears after the next stroke
end when the resting glyph is cached again.

### 6. Preload consideration

`c15df3a` required WOFF2 preload `<link>` tags to prevent a ghost-letter size
jump on first click (`font-display: swap`). Both fonts are already preloaded
in `index.html` — no change needed for the two-font case. If a third font is
added later, the preload list must be updated.

---

## Follow-up: Non-Naskh script support (ROADMAP #10b)

Adding a genuinely different style (Kufic, Ruq'ah) is **not** just "subset a
WOFF2." The full cost includes:

1. **New WOFF2 font files** — subset by Unicode range (Arabic/Latin/Latin-Ext),
   matching the existing `@font-face` pattern in `global.css` (each weight ×
   range = ~3 files per weight). Candidate open-source fonts:
   - Aref Ruqaa (Ruq'ah script)
   - Reem Kufi (Kufic script)
   - Noto Nastaliq Urdu (Nasta'liq)
   - Cairo (geometric Kufic)

2. **Stroke animation incompatibility:** `strokeOrder.js:532` explicitly notes
   coordinates are tuned to "Amiri/Scheherazade glyph shapes in the shared
   0–100 space." Kufic/Ruq'ah glyphs have different stroke structures — the
   Show Me animation would actively mis-teach with non-Naskh fonts. Options:
   - Per-script stroke order data (large — 784-line file × N scripts)
   - Disable Show Me for non-Naskh styles (show reference glyph only, no animation)
   - Accept approximate animation and note in UI

3. **AI feedback prompt** may need a style note so the model doesn't penalize
   legitimate script differences (Ruq'ah has no serif, Kufic is angular).

4. **WOFF2 preload** — each new font needs `<link rel="preload">` in
   `index.html` to avoid the ghost size-jump (`c15df3a`).

**Recommendation:** Fix ROADMAP #15 (stroke animation) before adding non-Naskh
styles, since stroke data drives both and #15 is already partially broken.

---

## Files changed

| File                               | Change                                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/themes.js`             | Add `SCRIPT_STYLES` registry + `getFontStack()`                                                                                                                                                                                               |
| `src/hooks/usePrefs.js`            | Add `calligraphyStyle` state, persistence, `handleCalligraphyStyleChange`, canvas invalidation                                                                                                                                                |
| `src/components/SettingsPanel.jsx` | Add Calligraphy Style picker row in Canvas section, wire props                                                                                                                                                                                |
| `src/locales/index.js`             | Add 4 EN + 4 AR strings                                                                                                                                                                                                                       |
| `src/utils/backup.js`              | Add `'calligraphy_style'` to `BACKUP_KEYS`                                                                                                                                                                                                    |
| `src/hooks/useDrawing.js`          | Replace `ctx.font` family with `getFontStack()`                                                                                                                                                                                               |
| `src/hooks/useExport.js`           | Replace 2 `ctx.font` families                                                                                                                                                                                                                 |
| `src/hooks/useAnimation.js`        | Replace 2 font-family strings                                                                                                                                                                                                                 |
| `src/styles/practiceStyles.js`     | Replace 13 inline `fontFamily` values with computed props or inline JSX                                                                                                                                                                       |
| `src/styles/loginStyles.js`        | **Skipped.** Pre-login decorative title — not worth plumbing `calligraphyStyle` through `App.jsx` → `LoginScreen`. Hardcoded stays.                                                                                                           |
| `src/components/PracticeView.jsx`  | Pass `calligraphyStyle` + `handleCalligraphyStyleChange` to SettingsPanel; thread `getFontStack(calligraphyStyle)` to canvas consumers; inline dynamic `fontFamily` on letter/word display elements that previously used static style objects |

---

## Verification

- `npm run lint && npm run typecheck && npm run test:run && npm run build` all exit zero
- Visual: open Settings → Canvas section → see the new style picker between Ink Color and API Key
- Visual: switch to Scheherazade → ghost glyph and letter picker font change immediately
- Visual: draw a stroke with Scheherazade active, then switch to Amiri → ghost updates in-place (no stale resting glyph)
- Visual: reduced-motion Show Me uses the active style font
- Backup: export → inspect JSON → `calligraphy_style` present; import confirms restore
