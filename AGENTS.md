# AGENTS.md — Arabic Script Practice

## Project Overview

Arabic handwriting practice PWA (React 19 + Vite 8). Users draw Arabic letters
or words on an HTML canvas (Apple Pencil / touch / mouse) and receive AI
calligraphy feedback via the OpenRouter vision API. Deployed as a static site on
Vercel — push to `main` triggers auto-deploy.

Three practice modes: **Letters** (all 28 Arabic letters in up to 4 positional
forms), **Words** (common ligatures, vocabulary, short phrases), and **Review**
(SM-2 spaced-repetition dashboard showing letters due for re-practice). A guided
**Lesson Mode** reorders letters by shape family for structured learning.

All five roadmap phases are complete except optional cloud sync.

## Commands

```bash
npm run dev       # Vite dev server → localhost:5173
npm run build     # Production build → dist/  AND auto-updates sw.js
npm run preview   # Preview production build locally
```

No test suite, linter, or formatter exists. Verify changes with `npm run build`
(must exit zero) and manual browser testing.

## Architecture

```
index.html                 — Vite entry; loads Google Fonts (Amiri, Scheherazade New), registers SW
src/
├── main.jsx               — createRoot + StrictMode, imports global.css
├── App.jsx                — Root; manages apiKey / locale / darkMode state; gates Login vs Practice
├── components/
│   ├── LoginScreen.jsx    — API key entry + "Continue without AI" skip
│   └── PracticeView.jsx   — Main UI: canvas, drawing, letter/word/review nav, AI feedback, animation
├── data/
│   ├── letters.js         — 28 letters with auto-generated positional forms (tatweel joins)
│   ├── lessonOrder.js     — Shape-family groups for guided lesson mode
│   ├── strokeOrder.js     — Stroke-order coordinates (0–100 space) for "Show me" animation
│   └── words.js           — Word groups (ligatures, common words, phrases)
├── locales/
│   └── index.js           — UI string map: { en: {...}, ar: {...} }; also exports FORM_NAMES etc.
├── utils/
│   ├── api.js             — OpenRouter vision API call with structured error handling
│   ├── drawing.js         — Pressure-aware line width calc, brush scale, stroke color
│   ├── progress.js        — Per-letter/form practice tracking, AI scores, SM-2 SR in localStorage
│   └── history.js         — Last-5 AI feedback entries per letter/form in localStorage
└── styles/
    ├── global.css         — CSS custom properties (light + dark), reset, responsive breakpoints,
    │                        hover/active/focus states (CSS classes)
    ├── practiceStyles.js  — Inline style object for PracticeView (~70 keys)
    └── loginStyles.js     — Inline style object for LoginScreen
public/                    — Copied un-hashed to dist/
├── sw.js                  — Service worker (cache-first; auto-updated by build script)
├── manifest.json          — PWA manifest
├── vercel.json            — Vercel cache headers
├── icon-192.png
└── icon-512.png
scripts/
└── bust-sw.js             — Post-build Node script; bumps SW CACHE version and patches asset hashes
```

### Data flow

1. `App.jsx` reads `openrouter_key` from localStorage → shows `LoginScreen` or `PracticeView`.
   Also manages `locale` (`'en'`/`'ar'`) and `darkMode` (boolean), passes them down as props.
2. `PracticeView` owns all practice state: current letter/word/form index, feedback, drawing
   mode, comparison view, animation state, etc.
3. Canvas pointer events → `strokesRef` (mutable `useRef` array, not React state) →
   `redraw()` on every move.
4. "AI Feedback" → `exportCanvas()` composites ghost watermark + user strokes, downscales to
   512px JPEG → `getAIFeedback()` sends to OpenRouter → response parsed for `[SCORE:N]` tag
   → feedback + score displayed, progress + SM-2 state updated.
5. Progress and history utilities read/write localStorage independently.

### Key architectural decisions

- **PracticeView is a single ~1060-line component.** All practice UI lives here.
  New features (buttons, panels, modes) go in this file unless they clearly
  warrant extraction.
- **Stroke data lives in a ref, not state.** Drawing performance depends on this.
  Never move `strokesRef` to `useState`.
- **No React Context or global state.** `apiKey`, `locale`, `darkMode` flow via
  props from `App`. Everything else is local to `PracticeView` or in localStorage.
- **Letter forms are auto-generated** from the base character using tatweel
  (kashida `ـ`) joining in `letters.js`. Don't manually define positional form
  characters.

## Service Worker — Automated

`npm run build` runs `vite build` then immediately executes `scripts/bust-sw.js`,
which:
1. Reads the hashed filenames from `dist/assets/`.
2. Bumps the `CACHE` version string in `public/sw.js` (e.g. `'arabic-v11'` → `'arabic-v12'`).
3. Replaces the JS and CSS asset paths with the new hashes.
4. Copies `public/sw.js` to the root `sw.js` (both must stay in sync; the script does this).

**You do not need to manually touch `sw.js` after a build.** The only time you
would edit it by hand is if you add new files to the `ASSETS` precache list.

## localStorage Keys — Do Not Rename

| Key                        | Type   | Purpose                                        |
|----------------------------|--------|------------------------------------------------|
| `openrouter_key`           | string | API key                                        |
| `openrouter_model`         | string | Selected model ID                              |
| `brushScale`               | string | Brush size multiplier (float as string)        |
| `lessonMode`               | string | `"true"` / `"false"`                           |
| `app_locale`               | string | `"en"` / `"ar"` — UI language                 |
| `app_darkMode`             | string | `"true"` / `"false"` — dark mode preference   |
| `arabic_progress`          | JSON   | Per-letter practice state, scores, SM-2 data  |
| `arabic_feedback_history`  | JSON   | Last 5 AI feedback entries per slot            |

These keys are used by deployed clients. Renaming them silently loses user data.

## Localization

All UI strings live in `src/locales/index.js` as `UI = { en: {...}, ar: {...} }`.

- `PracticeView` receives a `locale` prop (`'en'` or `'ar'`) and creates a
  translation helper: `const t = (key) => UI[locale][key] ?? key;`
- Every visible string goes through `t()` — never hardcode English in JSX.
- When adding UI text: add the key to **both** `en` and `ar` objects in `locales/index.js`.
- `App.jsx` toggles locale, persists to `app_locale`, and sets
  `<html lang>` / `<html dir>` so CSS RTL rules fire automatically.
- `global.css` applies `direction: rtl` via `html[lang="ar"]`.

## Styling

- **Inline JS style objects** in `src/styles/` — no CSS modules, no Tailwind.
- **One exception**: `src/styles/global.css` provides:
  - CSS custom properties for the full color palette (light + dark mode)
  - Hover/active/focus states using CSS classes (`.btn-nav`, `.btn-ai`, `.btn-form`,
    `.btn-alpha`, `.btn-gear`, `.btn-panel`, `.btn-clear`, `.btn-history`, etc.)
  - Responsive breakpoints (`<400px`, `400–639px`, `640–899px`, `≥900px`)
  - RTL layout rules for `html[lang="ar"]`
- Buttons in JSX get a `className` for interactive states AND inline `style` for
  layout/colors. Both must be kept in sync when changing button styling.
- Compose styles with spread: `{ ...styles.btn, ...styles.btnClear }`.
- Color palette exposed as CSS variables: `var(--color-primary)`, `var(--color-accent)`,
  `var(--color-text)`, `var(--color-surface)`, etc. Use variables, not hex literals,
  when adding new elements so dark mode works automatically.
- Dark mode is toggled by `[data-theme="dark"]` on `<html>`. All dark overrides are
  in `global.css` under that selector.

## Arabic Text Rendering

- Always set `lang="ar"`, `direction: "rtl"`, and use Arabic font stacks
  (`'Amiri','Scheherazade New',serif`) when rendering Arabic characters.
- Fonts are loaded via Google Fonts in `index.html`. If adding new Arabic fonts,
  update the `<link>` tag there.
- The `TATWEEL` character (`ـ`, U+0640) is used to generate connected letter
  forms. It's the standard Arabic joining glyph — don't substitute it.

## Canvas & Drawing Details

- HiDPI: canvas physical pixels = CSS pixels × `devicePixelRatio`. Sizing is
  done in a `ResizeObserver` effect. All coordinates must account for DPR.
- Stroke-order animation uses a glyph-reveal technique: renders the real font
  glyph on an offscreen canvas, then progressively reveals it with a brush mask
  (`destination-in` compositing). Coordinates in `strokeOrder.js` are in a
  normalized 0–100 space, scaled at animation time.
- Canvas export for AI: composites a faint reference watermark behind user
  strokes, downscales to max 512px, exports as JPEG quality 0.85. The AI prompt
  explicitly references this watermark layout.
- **Dark mode gotcha**: `redraw` captures `darkMode` via closure but has an empty
  `useCallback` dependency array (`[]`). This means strokes drawn before a dark
  mode toggle retain the old color — they only repaint on the next input event.
  Existing canvases won't auto-repaint when toggling. Don't add `darkMode` to the
  deps without understanding the performance implication.

## AI Integration

- Single function in `api.js`:
  `getAIFeedback(apiKey, imageBase64, letterName, letterChar, romanName, formDescription)`.
- Model selection stored in `openrouter_model` localStorage; defaults to
  `google/gemini-3-flash-preview`. Available choices: Gemini 3 Flash, Gemini 3.1 Pro,
  Claude Sonnet 4.6, GPT-5.4 mini.
- The system prompt instructs the AI to return `[SCORE:N]` (1–5), parsed via regex
  in `PracticeView.requestFeedback`. If you change the scoring format, update both
  the prompt in `api.js` and the parser.
- After a successful AI call in letters mode: `markPracticed` → `setScore` →
  `updateSR` (SM-2) → `addFeedbackEntry` are all called in sequence.
- Error codes 401/402/429/503 from OpenRouter are mapped to human-friendly messages.
  The user can skip the API key entirely (`apiKey === 'skip'`), which disables the AI button.
- Minimum 5 stroke points required before AI analysis is allowed.

## Spaced Repetition (SM-2)

`progress.js` implements a simplified SM-2 algorithm:

- `updateSR(letterName, formKey, quality)` — runs after every scored AI session.
  Maps AI score 1–5 to SM-2 quality 0–5, updates `interval`, `easeFactor`, `lastReview`.
- `getDueLetters(LETTERS)` — returns all letter+form combos where
  `lastReview + interval ≤ today`, or any practiced slot with no `lastReview` date.
- The **Review** tab in PracticeView shows this list. Tapping a tile calls
  `goToReviewItem()` which navigates to that letter in the Letters tab.
- The Review tab badge shows the count of due items.

## Export / Share

- `saveDrawing()` — exports a full-res PNG (canvas over parchment background +
  watermark) via a hidden `<a download>` click.
- `shareDrawing()` — tries `navigator.share({ files: [...] })` (mobile native
  share sheet); falls back to download if unavailable or if the browser rejects
  `canShare`.
- Both are disabled (`hasStrokes` gate) when the canvas is empty.

## PracticeView Props

```js
<PracticeView
  apiKey={string}            // OpenRouter key, or 'skip'
  onClearKey={fn}            // Clears key from state + localStorage
  locale={string}            // 'en' | 'ar'
  darkMode={boolean}
  onToggleDarkMode={fn}
  onToggleLocale={fn}
/>
```

## Conventions

- **JavaScript (JSX)**, ES2022+. No TypeScript. `"type": "module"` in package.json.
- Functional components only, default exports, one per file.
- `useCallback` for handler functions passed as props or in dependency arrays.
- `useRef` for mutable non-rendering data (strokes, canvas snapshot, animation frame ID).
- Named exports for data/utility modules, default exports for components and style objects.
- Constants: `UPPER_SNAKE_CASE`. Components: `PascalCase`. Everything else: `camelCase`.
- Short imperative commit messages. No conventional-commit prefixes.

## MCP Tools

- Prefer built-in `fetch`/`agentic_fetch` for web research and reading pages.
- Only use Playwright MCP for tasks requiring JS rendering, interaction (clicks/forms), or screenshots.

## Roadmap Status

All phases complete except optional cloud sync:

| Phase | Status | Summary |
|-------|--------|---------|
| 1 | ✅ | Fonts, API wiring, Undo, offline indicator |
| 2 | ✅ | Hover states, compressed AI export, progress tracking, feedback history |
| 3 | ✅ | Lesson mode, comparison view, AI scoring, stroke animation, word practice |
| 4 | ✅ | ARIA / keyboard nav, responsive layout, dark mode, EN/AR localization |
| 5 | ✅ | SM-2 spaced repetition, Save/Share export, automated SW cache busting |
| 5* | ☐ | Cloud sync (optional, not started — requires backend) |
