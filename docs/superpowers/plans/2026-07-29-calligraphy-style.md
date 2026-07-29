# Calligraphy Style Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~18 hardcoded `fontFamily` strings across 4 files (plus 2 dead-code removals) with a user preference (`calligraphy_style`) + centralized `getFontStack()` helper. Two-font picker (Amiri/Scheherazade New) in Settings.

**Architecture:** New `SCRIPT_STYLES` registry in `themes.js` (matching `BRUSH_PACKS` pattern), `getFontStack()` resolver consumed by canvas hooks and JSX. Preference persisted via `usePrefs.js` (matching `brush_pack` pattern), stored in `backup.js` BACKUP_KEYS. Unused `ghostLetter` / `ghostWord` style objects removed.

**Tech Stack:** React 19 + JSX, Vite 8, ESLint flat config, Vitest, no TypeScript.

## Global Constraints

- No React Context / global state — `calligraphyStyle` via props only
- All storage through `storage.js` (`getItem`/`setItem`), never `localStorage` directly
- Storage key: `calligraphy_style` (snake_case, matching `brush_pack`)
- All visible strings through `t()` from `locales/index.js` — 4 EN + 4 AR entries
- Hook naming: destructured exports use prefix convention (none needed — `calligraphyStyle` + `handleCalligraphyStyleChange` match existing `paperTheme`/`handleThemeChange` pattern)
- `loginStyles.js` is deliberately excluded (pre-login screen, not worth plumbing)
- Canvas invalidation: unconditional `redrawRef.current(strokesRef.current)` + null `restGlyphRef` (like `handleThemeChange`, not `handleTemplateScaleChange`)
- `BACKUP_KEYS` in `backup.js` must include `calligraphy_style`
- No logging of data payloads or base64

---

### Task 1: Add SCRIPT_STYLES registry + getFontStack() helper

**Files:**

- Modify: `src/styles/themes.js:125` (append after last export)

**Interfaces:**

- Produces: `SCRIPT_STYLES` (object), `getFontStack(styleId)` → string (font-family value, e.g. `'"Amiri","Scheherazade New","Arial Unicode MS",serif'`)

- [ ] **Step 1: Append registry and helper to themes.js**

Append the following after the last function (`getCanvasInkColor`) at line 125:

```js
/** Calligraphy script styles — controls which font family renders Arabic glyphs. */
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

/** Resolve a calligraphy style ID to a CSS font-family stack. */
export function getFontStack(styleId) {
  return (SCRIPT_STYLES[styleId] || SCRIPT_STYLES.amiri).family;
}
```

- [ ] **Step 2: Verify the file parses**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.js
git commit -m "feat: add SCRIPT_STYLES registry and getFontStack helper"
```

---

### Task 2: Add locale strings (4 EN + 4 AR)

**Files:**

- Modify: `src/locales/index.js`

**Interfaces:**

- Produces: `styleAmiri`, `styleScheherazade`, `settingsCalligraphyStyle`, `ariaCalligraphyStyle` keys in both `en` and `ar` blocks

- [ ] **Step 1: Add EN strings**

In the `en` block, after `settingsBrush: 'Ink color',` (line 30), add:

```js
settingsCalligraphyStyle: 'Calligraphy Style',
```

After `brushClassic: 'Classic Ink',` (line 269), add (near the other theme/brush name keys):

```js
styleAmiri: 'Amiri',
styleScheherazade: 'Scheherazade',
```

After `ariaExportBtn` or near the other aria labels, add (after line 43):

```js
ariaCalligraphyStyle: 'Calligraphy style',
```

- [ ] **Step 2: Add AR strings**

In the `ar` block, after `settingsBrush: 'لون الحبر',` (line 433), add:

```js
settingsCalligraphyStyle: 'نمط الخط',
```

After `brushClassic: 'حبر كلاسيكي',` (line 672), add:

```js
styleAmiri: 'أميري',
styleScheherazade: 'شهرزاد',
```

After the AR `ariaExportBtn` equivalent (near the EN aria line), add:

```js
ariaCalligraphyStyle: 'نمط الخط',
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/locales/index.js
git commit -m "feat: add calligraphy style locale strings (en + ar)"
```

---

### Task 3: Add calligraphy_style to BACKUP_KEYS

**Files:**

- Modify: `src/utils/backup.js:18-34`

**Interfaces:**

- None (standalone key addition)

- [ ] **Step 1: Add key to BACKUP_KEYS array**

In `src/utils/backup.js`, add `'calligraphy_style'` to the `BACKUP_KEYS` array. Insert it after `'brush_pack'` (line 31) to keep canvas-related settings grouped:

```js
  'brush_pack',
  'calligraphy_style',
  'daily_goal',
```

- [ ] **Step 2: Verify existing backup tests still pass**

Run: `npm test -- src/utils/__tests__/backup.test.js`
Expected: all backup tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/backup.js
git commit -m "feat: add calligraphy_style to BACKUP_KEYS"
```

---

### Task 4: Add calligraphyStyle state + handler to usePrefs

**Files:**

- Modify: `src/hooks/usePrefs.js`

**Interfaces:**

- Consumes: `getFontStack` from `../styles/themes` (Task 1)
- Produces: `calligraphyStyle` (string), `handleCalligraphyStyleChange(styleId)` → void

- [ ] **Step 1: Import getFontStack**

At line 5 of `usePrefs.js`, change the import from themes.js:

```js
import { getBrushColor, getFontStack } from '../styles/themes';
```

Before: `import { getBrushColor } from '../styles/themes';`

- [ ] **Step 2: Add calligraphyStyle state**

After the `brushPack` state line (line 29, `const [brushPack, setBrushPack] = ...`), add:

```js
const [calligraphyStyle, setCalligraphyStyle] = useState(
  () => getItem('calligraphy_style') || 'amiri',
);
```

- [ ] **Step 3: Add handleCalligraphyStyleChange handler**

After `handleBrushPackChange` (lines 125-130), add:

```js
const handleCalligraphyStyleChange = styleId => {
  setCalligraphyStyle(styleId);
  setItem('calligraphy_style', styleId);
  if (restGlyphRef.current) {
    restGlyphRef.current = null;
    setRestingGlyphRef.current?.(false);
  }
  redrawRef.current(strokesRef.current);
};
```

- [ ] **Step 4: Add to the return object**

In the return object (lines 132-162), add the two new exports next to `brushPack` and `handleBrushPackChange`:

```js
    brushPack,
    calligraphyStyle,
    paperTheme,
    ...
    handleBrushPackChange,
    handleCalligraphyStyleChange,
    handleThemeChange,
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePrefs.js
git commit -m "feat: add calligraphyStyle state and change handler"
```

---

### Task 5: Remove dead code — ghostLetter and ghostWord

**Files:**

- Modify: `src/styles/practiceStyles.js` (remove `ghostLetter` object lines ~239-252 and `ghostWord` object lines ~592-603)

**Interfaces:**

- None (these are unused — verified by grep across all `.jsx` components)

- [ ] **Step 1: Remove ghostLetter style object**

At line 239, the object named `ghostLetter` starts. Remove the entire object definition, which spans approximately:

```js
  ghostLetter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '200px',
    fontFamily: "'Amiri','Scheherazade New','Arial Unicode MS',serif",
    color: 'var(--color-ghost)',
    direction: 'rtl',
    pointerEvents: 'none',
    userSelect: 'none',
  },
```

- [ ] **Step 2: Remove ghostWord style object**

At approximately line 592, remove the `ghostWord` object:

```js
  ghostWord: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '100px',
    fontFamily: "'Amiri','Scheherazade New','Arial Unicode MS',serif",
    color: 'var(--color-ghost)',
    direction: 'rtl',
    pointerEvents: 'none',
    userSelect: 'none',
  },
```

- [ ] **Step 3: Verify nothing breaks**

Run: `npm run typecheck && npm run lint`
Also run: `npm test:run` — all tests pass.
Since these objects are never referenced by any component, removing them is a no-op.

- [ ] **Step 4: Commit**

```bash
git add src/styles/practiceStyles.js
git commit -m "chore: remove unused ghostLetter and ghostWord style objects"
```

---

### Task 6: Remove fontFamily from 11 remaining practiceStyles objects

**Files:**

- Modify: `src/styles/practiceStyles.js` — remove `fontFamily` line from each of the 11 live style objects
- Line numbers after Task 5 removal will shift slightly; the objects are: `appTitle`, `miniChar`, `formBtnChar`, `alphaBtn`, `comparisonRef`, `wordBtn`, `reviewTileChar`, `analyticsHeatmapCell`, `analyticsWeakChar`, `deckEditorItemChar`, `deckPickerWordChar`

**Interfaces:**

- Produces: Broken JSX (components referencing these styles will lose their font) — fixed in Tasks 11-13

- [ ] **Step 1: Remove fontFamily from each object**

For each of the following 11 style objects, remove the `fontFamily` line (leave the comma on the preceding line):

1. `appTitle` (~line 26): remove `fontFamily: "'Amiri','Scheherazade New','Arial Unicode MS',serif",`
2. `miniChar` (~line 135): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
3. `formBtnChar` (~line 185): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
4. `alphaBtn` (~line 366): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
5. `comparisonRef` (~line 537): remove `fontFamily: "'Amiri','Scheherazade New','Arial Unicode MS',serif",`
6. `wordBtn` (~line 618): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
7. `reviewTileChar` (~line 741): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
8. `analyticsHeatmapCell` (~line 976): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
9. `analyticsWeakChar` (~line 1001): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
10. `deckEditorItemChar` (~line 1224): remove `fontFamily: "'Amiri','Scheherazade New',serif",`
11. `deckPickerWordChar` (~line 1257): remove `fontFamily: "'Amiri','Scheherazade New',serif",`

- [ ] **Step 2: Commit**

```bash
git add src/styles/practiceStyles.js
git commit -m "refactor: remove fontFamily from practiceStyle objects (to be inlined)"
```

---

### Task 7: Replace font stack in useDrawing.js

**Files:**

- Modify: `src/hooks/useDrawing.js:1-2,9,96`
- Modify: `src/components/PracticeView.jsx:144-156` (call site — add `calligraphyStyle` prop)

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from Task 4

- [ ] **Step 1: Add calligraphyStyle parameter to useDrawing**

In `useDrawing.js`, add `calligraphyStyle` to the destructured parameter object. At line 9:

```js
export default function useDrawing({
  darkMode,
  practiceMode,
  calligraphyStyle,
  letter,
```

- [ ] **Step 2: Import getFontStack**

At line 3 of `useDrawing.js`, add `getFontStack` to the import:

```js
import { getBrushColor, getPaperColors, drawPaperPattern, getFontStack } from '../styles/themes';
```

- [ ] **Step 3: Replace font-family string at line 96**

Change the `ctx.font` assignment. Before (line 96):

```js
ctx.font = `${ghost.fontSizePx}px "Amiri", "Scheherazade New", "Arial Unicode MS", serif`;
```

After:

```js
ctx.font = `${ghost.fontSizePx}px ${getFontStack(calligraphyStyle)}`;
```

- [ ] **Step 4: Pass calligraphyStyle at the PracticeView call site**

In `PracticeView.jsx`, add `calligraphyStyle` to the `useDrawing()` call (around line 145-156). Add it after `practiceMode`:

```js
    practiceMode,
    calligraphyStyle,
    letter: _letter,
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDrawing.js src/components/PracticeView.jsx
git commit -m "feat: use dynamic font stack in useDrawing ghost rendering"
```

---

### Task 8: Replace font stacks in useAnimation.js

**Files:**

- Modify: `src/hooks/useAnimation.js:3,5,55,119`
- Modify: `src/components/PracticeView.jsx:566-585` (call site — add `calligraphyStyle` prop)

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from Task 4

- [ ] **Step 1: Add calligraphyStyle parameter and import**

In `useAnimation.js` line 3, add `getFontStack` to the import:

```js
import {
  getPaperColors,
  getCanvasInkColor,
  drawPaperPattern,
  getFontStack,
} from '../styles/themes';
```

At line 5, add `calligraphyStyle` to the destructured parameters (after `templateScale`):

```js
  templateScale,
  calligraphyStyle,
  reduceMotion,
```

- [ ] **Step 2: Replace font at line 55 (drawReferenceGlyph)**

Before:

```js
ctx.font = `${fontSize}px "Scheherazade New", "Amiri", serif`;
```

After:

```js
ctx.font = `${fontSize}px ${getFontStack(calligraphyStyle)}`;
```

**Note:** This was Scheherazade-first before. With default `amiri`, this now renders Amiri-first. This is the intended behavior change — the user's chosen style controls the reference glyph.

- [ ] **Step 3: Replace font at line 119 (glyph canvas)**

Before:

```js
gCtx.font = `${glyphSize}px "Amiri", "Scheherazade New", serif`;
```

After:

```js
gCtx.font = `${glyphSize}px ${getFontStack(calligraphyStyle)}`;
```

- [ ] **Step 4: Pass calligraphyStyle at the PracticeView call site**

In `PracticeView.jsx`, add `calligraphyStyle` to the `useAnimation()` call (around line 566-585). Add it after `templateScale`:

```js
    templateScale,
    calligraphyStyle,
    reduceMotion,
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAnimation.js src/components/PracticeView.jsx
git commit -m "feat: use dynamic font stack in useAnimation (reference glyph + glyph canvas)"
```

---

### Task 9: Replace font stacks in useExport.js

**Files:**

- Modify: `src/hooks/useExport.js:3,5,36,134`
- Modify: `src/components/PracticeView.jsx:510-522` (call site — add `calligraphyStyle` prop)

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from Task 4

- [ ] **Step 1: Add calligraphyStyle parameter and import**

In `useExport.js` line 3, add `getFontStack` to the import:

```js
import { getPaperColors, getBrushColor, drawPaperPattern, getFontStack } from '../styles/themes';
```

At line 5, add `calligraphyStyle` to the destructured parameters (after `darkMode`):

```js
  darkMode,
  calligraphyStyle,
  practiceMode,
```

- [ ] **Step 2: Replace font at line 36 (saveDrawing)**

Before:

```js
ctx.font = `bold ${fontSize}px 'Amiri','Scheherazade New',serif`;
```

After:

```js
ctx.font = `bold ${fontSize}px ${getFontStack(calligraphyStyle)}`;
```

- [ ] **Step 3: Replace font at line 134 (shareDrawing, same pattern)**

Before:

```js
ctx.font = `bold ${fontSize}px 'Amiri','Scheherazade New',serif`;
```

After:

```js
ctx.font = `bold ${fontSize}px ${getFontStack(calligraphyStyle)}`;
```

- [ ] **Step 4: Pass calligraphyStyle at the PracticeView call site**

In `PracticeView.jsx`, add `calligraphyStyle` to the `useExport()` call (around line 510-522):

```js
    darkMode,
    calligraphyStyle,
    practiceMode,
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useExport.js src/components/PracticeView.jsx
git commit -m "feat: use dynamic font stack in useExport (save/share drawing)"
```

---

### Task 10: Add Calligraphy Style picker to SettingsPanel

**Files:**

- Modify: `src/components/SettingsPanel.jsx` (props + JSX)
- Modify: `src/components/PracticeView.jsx:960-994` (pass new props)

**Interfaces:**

- Consumes: `SCRIPT_STYLES` from Task 1, locale strings from Task 2, `calligraphyStyle` + `handleCalligraphyStyleChange` from Task 4

- [ ] **Step 1: Import SCRIPT_STYLES in SettingsPanel**

At line 2 of `SettingsPanel.jsx`, add `SCRIPT_STYLES` to the existing import:

```js
import {
  PAPER_THEMES,
  BRUSH_PACKS,
  SCRIPT_STYLES,
  getPaperColors,
  getBrushColor,
} from '../styles/themes';
```

- [ ] **Step 2: Add calligraphyStyle and handler to destructured props**

At the SettingsPanel function signature (line 11), add `calligraphyStyle` and `handleCalligraphyStyleChange` after `handleBrushPackChange`:

```js
  handleBrushPackChange,
  calligraphyStyle,
  handleCalligraphyStyleChange,
  apiKey,
```

- [ ] **Step 3: Add the picker row in the Canvas section**

After the brush swatches section (after the closing `</div>` of the brush row, around line 250), insert the calligraphy style picker:

```jsx
<div
  style={{
    fontSize: '12px',
    color: 'var(--color-text-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }}
>
  {t('settingsCalligraphyStyle')}
  <div style={styles.themeRow}>
    {Object.values(SCRIPT_STYLES).map(style => {
      const isActive = calligraphyStyle === style.id;
      return (
        <button
          key={style.id}
          className={`btn-theme ${isActive ? 'btn-theme-active' : ''}`}
          style={{ ...styles.themeBtn, ...(isActive ? styles.themeBtnActive : {}) }}
          onClick={() => handleCalligraphyStyleChange(style.id)}
          aria-pressed={isActive}
          aria-label={t('ariaCalligraphyStyle') + ': ' + t(style.nameKey)}
        >
          <span
            style={{
              ...styles.themeSwatch,
              fontFamily: style.family,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              direction: 'rtl',
            }}
            aria-hidden="true"
          >
            ب
          </span>
          <span>{t(style.nameKey)}</span>
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 4: Pass new props from PracticeView**

In `PracticeView.jsx`, at the `<SettingsPanel` call site (lines 961-994), add after `handleBrushPackChange` (line 978):

```jsx
handleBrushPackChange = { handleBrushPackChange };
calligraphyStyle = { calligraphyStyle };
handleCalligraphyStyleChange = { handleCalligraphyStyleChange };
apiKey = { apiKey };
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPanel.jsx src/components/PracticeView.jsx
git commit -m "feat: add Calligraphy Style picker to Settings Canvas section"
```

---

### Task 11: Thread calligraphyStyle through AnalyticsPanel

**Files:**

- Modify: `src/components/AnalyticsPanel.jsx` (receive prop, inline fontFamily)
- Modify: `src/components/PracticeView.jsx:1268-1275` (pass new prop)

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from props

- [ ] **Step 1: Add calligraphyStyle prop and getFontStack import**

In `AnalyticsPanel.jsx` line 14, add `getFontStack` import:

```js
import { getFontStack } from '../styles/themes';
```

Add `calligraphyStyle` to the function signature (line 16):

```js
export default function AnalyticsPanel({ locale, calligraphyStyle, LETTERS, progress, progressVersion, onGoToItem }) {
```

- [ ] **Step 2: Inline fontFamily on analyticsHeatmapCell**

Find the element using `styles.analyticsHeatmapCell` (around line 165). Change:

```js
style={styles.analyticsHeatmapCell}
```

to:

```js
style={{ ...styles.analyticsHeatmapCell, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 3: Inline fontFamily on analyticsWeakChar**

Find the element using `styles.analyticsWeakChar` (around line 191). Change:

```js
style={styles.analyticsWeakChar}
```

to:

```js
style={{ ...styles.analyticsWeakChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 4: Pass calligraphyStyle from PracticeView**

In `PracticeView.jsx`, at the `<AnalyticsPanel` call site (lines 1268-1275), add `calligraphyStyle`:

```jsx
        <AnalyticsPanel
          locale={locale}
          calligraphyStyle={calligraphyStyle}
          LETTERS={[...LETTERS, ...NUMBERS, ...DIACRITICS]}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalyticsPanel.jsx src/components/PracticeView.jsx
git commit -m "feat: thread calligraphyStyle through AnalyticsPanel"
```

---

### Task 12: Thread calligraphyStyle through DeckManager

**Files:**

- Modify: `src/components/DeckManager.jsx` (receive prop, inline fontFamily on 3 style objects)
- Modify: `src/components/PracticeView.jsx:1247-1261` (pass new prop)

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from props

- [ ] **Step 1: Add calligraphyStyle prop and getFontStack import**

In `DeckManager.jsx` line 2, add `getFontStack` import:

```js
import { getFontStack } from '../styles/themes';
```

Add `calligraphyStyle` to the function signature (line 23), after `locale`:

```js
export default function DeckManager({
  t,
  locale,
  calligraphyStyle,
  decks,
```

- [ ] **Step 2: Inline fontFamily on reviewTileChar (3 usage sites)**

Find each element using `styles.reviewTileChar` in DeckManager (lines 528, 565, 602). Change each:

```js
style={styles.reviewTileChar}
```

to:

```js
style={{ ...styles.reviewTileChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 3: Inline fontFamily on deckEditorItemChar (line 414)**

Change:

```js
style={styles.deckEditorItemChar}
```

to:

```js
style={{ ...styles.deckEditorItemChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 4: Inline fontFamily on deckPickerWordChar (line 670)**

Change:

```js
style={styles.deckPickerWordChar}
```

to:

```js
style={{ ...styles.deckPickerWordChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 5: Pass calligraphyStyle from PracticeView**

At the `<DeckManager` call site (lines 1247-1261), add `calligraphyStyle`:

```jsx
            <DeckManager
              t={t}
              locale={locale}
              calligraphyStyle={calligraphyStyle}
              decks={decks}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/DeckManager.jsx src/components/PracticeView.jsx
git commit -m "feat: thread calligraphyStyle through DeckManager"
```

---

### Task 13: Inline fontFamily in PracticeView.jsx DOM elements

**Files:**

- Modify: `src/components/PracticeView.jsx` — inline `fontFamily` on 7 remaining style objects: `appTitle`, `miniChar`, `formBtnChar`, `alphaBtn`, `comparisonRef`, `wordBtn`, `reviewTileChar`

**Interfaces:**

- Consumes: `getFontStack` from Task 1, `calligraphyStyle` from Task 4 (already destructured)

- [ ] **Step 1: Import getFontStack**

PracticeView.jsx does not currently import from `themes.js`. Add the import near the top of the file (alongside other imports around line 4):

```js
import { getFontStack } from '../styles/themes';
```

- [ ] **Step 2: Inline fontFamily on appTitle (line 886)**

Before:

```jsx
<span ref={appTitleRef} style={styles.appTitle} lang="ar">
```

After:

```jsx
<span ref={appTitleRef} style={{ ...styles.appTitle, fontFamily: getFontStack(calligraphyStyle) }} lang="ar">
```

- [ ] **Step 3: Inline fontFamily on miniChar (line 1595)**

Before:

```jsx
style={styles.miniChar}
```

After:

```jsx
style={{ ...styles.miniChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 4: Inline fontFamily on formBtnChar (line 1647)**

Before:

```jsx
...styles.formBtnChar
```

After:

```jsx
...styles.formBtnChar, fontFamily: getFontStack(calligraphyStyle)
```

(Used in a spread context — add the fontFamily inline alongside the spread)

- [ ] **Step 5: Inline fontFamily on alphaBtn (line 2146)**

Before:

```jsx
...styles.alphaBtn
```

After:

```jsx
...styles.alphaBtn, fontFamily: getFontStack(calligraphyStyle)
```

- [ ] **Step 6: Inline fontFamily on comparisonRef (line 2054)**

Before:

```jsx
...styles.comparisonRef
```

After (add fontFamily to the style object where comparisonRef is spread):

```jsx
...styles.comparisonRef, fontFamily: getFontStack(calligraphyStyle)
```

- [ ] **Step 7: Inline fontFamily on wordBtn (line 2187)**

Before:

```jsx
...styles.wordBtn
```

After:

```jsx
...styles.wordBtn, fontFamily: getFontStack(calligraphyStyle)
```

- [ ] **Step 8: Inline fontFamily on reviewTileChar (line 1206)**

Before:

```jsx
style={styles.reviewTileChar}
```

After:

```jsx
style={{ ...styles.reviewTileChar, fontFamily: getFontStack(calligraphyStyle) }}
```

- [ ] **Step 9: Destructure calligraphyStyle from usePrefs if not already**

Verify `calligraphyStyle` is in the destructured return from `usePrefs()` (around line 160-187). It was added in Task 4 but confirm it's being destructured at the call site:

```js
    brushPack,
    calligraphyStyle,
    paperTheme,
```

- [ ] **Step 10: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "feat: inline dynamic fontFamily on PracticeView glyph elements"
```

---

### Task 14: Verification

- [ ] **Step 1: Run full verification suite**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```

Expected: all four commands exit zero.
If `npm run build` fails: check for missing imports or unreferenced variables from the inline refactor.

- [ ] **Step 2: Visual verification (manual)**

Start the dev server: `npm run dev`

- Open Settings → Canvas section → verify "Calligraphy Style" row appears after "Ink color"
- Two buttons: "Amiri" and "Scheherazade" with ب preview glyphs
- Click Scheherazade → ghost glyph on canvas updates immediately
- Click Amiri → ghost glyph reverts
- Draw a stroke, then switch styles → ghost updates in-place, no stale resting glyph
- Switch to Words mode → word tiles use active font
- Switch to Review tab → letter tiles use active font
- Switch to Stats tab → heatmap cells use active font
- Show Me animation uses the active font
- Export a backup → inspect JSON → `calligraphy_style` key present

- [ ] **Step 3: Update ROADMAP**

Add a note under #10 in `docs/ROADMAP.md`:

```markdown
- [ ] **#10 — Calligraphy script styles** 🟡
      _Infrastructure shipped (2026-07-29): user preference + `getFontStack()` + Settings picker with Amiri/Scheherazade. Multi-script support (#10b) deferred — needs new WOFF2 fonts + per-script stroke-order data + AI prompt update (#15 should be fixed first)._
```

- [ ] **Step 4: Final commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: note calligraphy style infrastructure shipped, #10b deferred"
```
