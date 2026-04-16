# AGENTS.md — Arabic Script Practice

## Project Overview

Arabic handwriting practice PWA (React 19 + Vite 8). Users draw Arabic letters
or words on an HTML canvas (Apple Pencil / touch / mouse) and receive AI
calligraphy feedback via the OpenRouter vision API. Deployed as a static site on
Vercel — push to `main` triggers auto-deploy.

The app has two practice modes: **Letters** (all 28 Arabic letters in up to 4
positional forms each) and **Words** (common ligatures, vocabulary, and short
phrases). A guided **Lesson Mode** reorders letters by shape family for
structured learning.

## Commands

```bash
npm run dev       # Vite dev server → localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test suite, linter, or formatter exists. Verify changes with `npm run build`
(must exit zero) and manual browser testing.

## Architecture

```
index.html                 — Vite entry; loads Google Fonts (Amiri, Scheherazade New), registers SW
src/
├── main.jsx               — createRoot + StrictMode, imports global.css
├── App.jsx                — Root; manages API key state, gates Login vs Practice
├── components/
│   ├── LoginScreen.jsx    — API key entry + "Continue without AI" skip
│   └── PracticeView.jsx   — Main UI: canvas, drawing, letter/word nav, AI feedback, animation
├── data/
│   ├── letters.js         — 28 letters with auto-generated positional forms (tatweel joins)
│   ├── lessonOrder.js     — Shape-family groups for guided lesson mode
│   ├── strokeOrder.js     — Stroke-order coordinates (0–100 space) for "Show me" animation
│   └── words.js           — Word groups (ligatures, common words, phrases)
├── utils/
│   ├── api.js             — OpenRouter vision API call with structured error handling
│   ├── drawing.js         — Pressure-aware line width calc, brush scale, stroke color
│   ├── progress.js        — Per-letter/form practice tracking + AI scores in localStorage
│   └── history.js         — Last-5 AI feedback entries per letter/form in localStorage
└── styles/
    ├── global.css         — Reset, scrollbar, hover/active/focus states (CSS classes)
    ├── practiceStyles.js  — Inline style object for PracticeView (~60 keys)
    └── loginStyles.js     — Inline style object for LoginScreen
public/                    — Copied un-hashed to dist/
├── sw.js                  — Service worker (cache-first, canonical copy)
├── manifest.json          — PWA manifest
├── vercel.json            — Vercel cache headers
├── icon-192.png
└── icon-512.png
```

### Data flow

1. `App.jsx` reads `openrouter_key` from localStorage → shows `LoginScreen` or
   `PracticeView`.
2. `PracticeView` owns all state: current letter/word/form index, feedback,
   drawing mode, comparison view, animation state.
3. Canvas pointer events → `strokesRef` (mutable `useRef` array, not React
   state) → `redraw()` on every move.
4. "AI Feedback" → `exportCanvas()` composites ghost watermark + user strokes,
   downscales to 512px JPEG → `getAIFeedback()` sends to OpenRouter → response
   parsed for `[SCORE:N]` tag → feedback + score displayed, progress updated.
5. Progress and history utilities read/write localStorage independently.

### Key architectural decisions

- **PracticeView is a single ~1150-line component.** All practice UI lives here.
  New features (buttons, panels, modes) go in this file unless they clearly
  warrant extraction.
- **Stroke data lives in a ref, not state.** Drawing performance depends on this.
  Never move `strokesRef` to `useState`.
- **No React Context or global state.** `apiKey` flows via props from `App`.
  Everything else is local to `PracticeView` or in localStorage.
- **Letter forms are auto-generated** from the base character using tatweel
  (kashida `ـ`) joining in `letters.js`. Don't manually define positional form
  characters.

## Service Worker — Critical

After **any code change that produces a new build**:

1. Run `npm run build` — note the hashed filenames in `dist/assets/` (e.g.
   `index-XXXXXXXX.js`, `index-XXXXXXXX.css`).
2. Update `public/sw.js`:
   - Bump the `CACHE` version string (e.g. `'arabic-v8'` → `'arabic-v9'`).
   - Replace the JS and CSS paths in the `ASSETS` array with the new hashes.
3. Copy `public/sw.js` to the root `sw.js` (they must stay in sync).

Forgetting this step means returning users get stale cached assets until their
browser evicts the old service worker (~24h).

## localStorage Keys — Do Not Rename

| Key                        | Type   | Purpose                                 |
|----------------------------|--------|-----------------------------------------|
| `openrouter_key`           | string | API key                                 |
| `openrouter_model`         | string | Selected model ID                       |
| `brushScale`               | string | Brush size multiplier (float as string) |
| `lessonMode`               | string | `"true"` / `"false"`                    |
| `arabic_progress`          | JSON   | Per-letter practice state + scores      |
| `arabic_feedback_history`  | JSON   | Last 5 AI feedback entries per slot     |

These keys are used by deployed clients. Renaming them silently loses user data.

## Styling

- **Inline JS style objects** in `src/styles/` — no CSS modules, no Tailwind.
- **One exception**: `src/styles/global.css` provides hover/active/focus states
  using CSS classes (`.btn-nav`, `.btn-ai`, `.btn-form`, `.btn-alpha`, etc.)
  because pseudo-classes can't be expressed in inline styles.
- Buttons in JSX get a `className` for interactive states AND inline `style` for
  layout/colors. Both must be kept in sync when changing button styling.
- Compose styles with spread: `{ ...styles.btn, ...styles.btnClear }`.
- Color palette: warm parchment browns (`#fdf0d0`, `#5c2d00`, `#8b4513`,
  `#c0703a`). Keep new UI elements within this palette.

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

## AI Integration

- Single function in `api.js`: `getAIFeedback(apiKey, imageBase64, letterName, letterChar, romanName, formDescription)`.
- Model selection stored in `openrouter_model` localStorage; defaults to
  `google/gemini-3-flash-preview`.
- The system prompt instructs the AI to return `[SCORE:N]` (1–5) which is parsed
  via regex in `PracticeView`. If you change the scoring format, update both the
  prompt in `api.js` and the parser in `PracticeView.requestFeedback`.
- Error codes 401/402/429/503 from OpenRouter are mapped to human-friendly
  messages. The user can skip the API key entirely (`apiKey === 'skip'`), which
  disables the AI button.
- Minimum 5 stroke points required before AI analysis is allowed.

## Conventions

- **JavaScript (JSX)**, ES2022+. No TypeScript. `"type": "module"` in
  package.json.
- Functional components only, default exports, one per file.
- `useCallback` for handler functions passed as props or in dependency arrays.
- `useRef` for mutable non-rendering data (strokes, canvas snapshot, animation
  frame ID).
- Named exports for data/utility modules, default exports for components and
  style objects.
- Constants: `UPPER_SNAKE_CASE`. Components: `PascalCase`. Everything else:
  `camelCase`.
- Short imperative commit messages. No conventional-commit prefixes.

## MCP Tools

- Prefer built-in `fetch`/`agentic_fetch` for web research and reading pages.
- Only use Playwright MCP for tasks requiring JS rendering, interaction (clicks/forms), or screenshots.

## Roadmap Context

Phases 1–3 are complete (see `ROADMAP.md`). Phase 4 (accessibility, responsive
layout, dark mode, localization) and Phase 5 (spaced repetition, export/share,
automated SW busting, cloud sync) are planned but not started.
