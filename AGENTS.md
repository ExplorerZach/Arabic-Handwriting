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

### LSP (for Crush / editor diagnostics)

`typescript-language-server` is pinned to **`4.3.4`** in `devDependencies`. Do
not upgrade to v5.x — it crashes under Crush with `no handler for method:
window/workDoneProgress/create` because Crush's LSP client doesn't implement
that capability. If you see `Language server stderr ... ResponseError: no
handler for method: window/workDoneProgress/create` in `crush_logs`, you've
been upgraded; revert to 4.3.4.

`crush.json` launches it via `node node_modules/typescript-language-server/lib/cli.mjs --stdio`
(direct script path, not the `.cmd` shim — mvdan/sh on Windows chokes on
`./node_modules/.bin/...` invocations).

`jsconfig.json` at the project root teaches tsserver about `jsx: "react-jsx"`
and `moduleResolution: "bundler"`. `checkJs` is off by design (no TypeScript
in this project); tsserver still surfaces real syntax errors and unused
imports.

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
│   ├── lessonOrder.js     — Shape-family groups (with nameKey/descKey locale refs)
│   ├── strokeOrder.js     — Stroke-order coordinates (0–100 space) for "Show me" animation
│   └── words.js           — Word groups (ligatures, common words, phrases)
├── locales/
│   └── index.js           — UI string map + sole source of truth for FORM_NAMES / FORM_SHORT / FORM_FULL / FORM_DESCRIPTIONS
├── utils/
│   ├── api.js             — OpenRouter vision API call with structured error handling
│   ├── drawing.js         — Pressure-aware line width calc (pressure=0 falls back to 0.5), brush scale
│   ├── progress.js        — Practice tracking + SM-2 (cached parse, local dates, renamed-letter migration)
│   └── history.js         — Last-5 AI feedback entries per letter/form (cached, with same migration)
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
   `LoginScreen` also takes `locale` so its copy + aria-labels are translated.
2. `PracticeView` owns all practice state: current letter/word/form index, feedback, drawing
   mode, comparison view, animation state, etc. A `progressVersion` counter state bumps
   on every successful AI write; `useMemo` hooks keyed to it recompute `progressSummary`,
   `completedCount`, and `dueItems` in a single pass instead of 56+ `load()` calls.
3. Canvas pointer events → `strokesRef` (mutable `useRef` array, not React state; points
   stored as **normalized 0–1 coords** so window resize / orientation doesn't mis-place
   them) → `redraw()` on every move.
4. "AI Feedback" → `exportCanvas()` composites ghost watermark + user strokes, downscales to
   512px JPEG → `getAIFeedback()` sends to OpenRouter → response parsed for `[SCORE:N]` tag
   (regex: `/\[SCORE:\s*([1-5])\s*\]/i`) → feedback + score displayed, progress + SM-2
   state updated, `progressVersion` bumped.
5. Progress and history utilities cache parsed JSON in module-level memory; writes go
   through `save()` which updates both the cache and localStorage. Cross-tab edits are
   handled via a `storage` event listener that invalidates the cache.

### Key architectural decisions

- **PracticeView is a single ~1100-line component.** All practice UI lives here.
  New features (buttons, panels, modes) go in this file unless they clearly
  warrant extraction.
- **Stroke data lives in a ref, not state.** Drawing performance depends on this.
  Never move `strokesRef` to `useState`. Coordinates are **normalized 0–1**
  relative to the canvas rect and scaled to CSS pixels inside `redraw`; don't
  push absolute coords into `strokesRef`.
- **No React Context or global state.** `apiKey`, `locale`, `darkMode` flow via
  props from `App`. Everything else is local to `PracticeView` or in localStorage.
- **Letter forms are auto-generated** from the base character using tatweel
  (kashida `ـ`) joining in `letters.js`. Don't manually define positional form
  characters.
- **FORM_NAMES / FORM_SHORT / FORM_FULL / FORM_DESCRIPTIONS live only in
  `src/locales/index.js`.** `data/letters.js` no longer exports these. Import
  from `../locales` when you need them; they resolve to locale keys, so pass
  them through `t()` at the call site.
- **Progress/history reads are cached.** `progress.js` and `history.js` each
  keep an in-memory `cache` of the parsed JSON; every render can safely call
  `getProgressSummary(LETTERS)` / `getDueLetters(LETTERS)` without re-parsing.
  Always go through the exported helpers — never call `localStorage.getItem`
  directly for these keys.

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

### Letter-name keys inside `arabic_progress` / `arabic_feedback_history`

Two letter pairs share Arabic-to-Latin romanizations, so their `name` fields
**must stay distinct** to avoid progress collisions:

| Char | `name` (key)  | Roman  | Notes                           |
|------|---------------|--------|----------------------------------|
| ح    | `Hha`         | `ḥ`    | pharyngeal Hāʾ (dotless hook)   |
| ه    | `Ha`          | `h`    | plain Hāʾ (figure-eight loops)  |
| ط    | `Tta`         | `ṭ`    | emphatic Ṭāʾ (oval + stroke)    |
| ت    | `Ta`          | `t`    | plain Tāʾ (flat base, 2 dots)   |

Before the audit, both pairs shared `Ha`/`Ta`, silently merging progress.
`progress.js` and `history.js` each contain a `migrate()` function that runs
once on module load and copies any old `Ha`/`Ta` entries onto `Hha`/`Tta` so
no user data is lost. **Never rename these fields or remove the migration**
without providing a forward migration for deployed clients.

## Localization

All UI strings live in `src/locales/index.js` as `UI = { en: {...}, ar: {...} }`.

- `PracticeView` and `LoginScreen` both receive a `locale` prop (`'en'` or
  `'ar'`) and create a translation helper: `const t = (key) => UI[locale][key] ?? key;`
- Every visible string goes through `t()` — never hardcode English in JSX,
  never inline `locale === 'ar' ? '…' : '…'` ternaries.
- When adding UI text: add the key to **both** `en` and `ar` objects in `locales/index.js`.
- `App.jsx` toggles locale, persists to `app_locale`, and sets
  `<html lang>` / `<html dir>` so CSS RTL rules fire automatically. It also
  renders the skip-link text (`t('skipLink')`) — pass `locale` to any new
  top-level component that renders user-visible text.
- `global.css` applies `direction: rtl` via `html[lang="ar"]`.
- `LESSON_GROUPS` in `data/lessonOrder.js` stores `{ nameKey, descKey, letters }`;
  the name + description are always looked up via `t(group.nameKey)` at render
  time so lesson banners translate correctly.
- `FORM_NAMES` / `FORM_SHORT` / `FORM_FULL` / `FORM_DESCRIPTIONS` exported from
  `locales/index.js` map form keys (`isolated`/`initial`/`medial`/`final`) to
  locale keys — always call `t(FORM_NAMES[key])`, never use the map value raw.

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

- HiDPI: canvas bitmap = CSS pixels × `devicePixelRatio`. The resize effect
  uses `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` (not `ctx.scale`) so repeated
  resizes don't accumulate scale. Draw in CSS-pixel coordinates.
- Stroke points are **normalized 0–1** (`pt.x = (clientX - rect.left) / rect.width`).
  `redraw` multiplies by the current rect on every pass, so window resize /
  orientation change re-places strokes correctly instead of anchoring them to
  stale absolute coords. `getPoint` also null-guards `canvasRef.current` and
  zero-size rects.
- Pointer pressure: `e.pressure > 0 ? e.pressure : 0.5`. Nullish-coalesce is
  wrong here — many touch devices legitimately report `0`, which would collapse
  strokes to the 3 px minimum.
- Pointer leave/re-enter mid-stroke: `strokeResumedRef` flips on `onPointerLeave`
  when `buttons !== 0`, forcing the next recorded point to start a new stroke
  (prevents a straight line drawn across the off-canvas gap). `setPointerCapture`
  on down / `releasePointerCapture` on up/cancel are also wired.
- Stroke-order animation uses a glyph-reveal technique: renders the real font
  glyph on an offscreen canvas, then progressively reveals it with a brush mask
  (`destination-in` compositing). Coordinates in `strokeOrder.js` are in a
  normalized 0–100 space, scaled at animation time.
- Animation cleanup: the `useEffect(..., [letterIndex, formIndex, practiceMode])`
  cleanup cancels the in-flight `requestAnimationFrame` AND calls
  `setAnimating(false)` / clears `animatingRef` — so the "Show me" button never
  stays disabled after navigating away mid-play. `playStrokeAnimation` guards
  on `animatingRef.current` (not state) and is NOT in `useCallback` deps, or
  the callback would be recreated every animation frame.
- Canvas export for AI: composites a faint reference watermark behind user
  strokes, downscales to max 512px, exports as JPEG quality 0.85. The AI prompt
  explicitly references this watermark layout. Uses a light background
  unconditionally — the AI model is trained on the light-parchment look.
- **Dark mode in `redraw`**: `redraw` has empty `useCallback` deps to stay
  stable (ResizeObserver and undo both depend on it), so `darkMode` comes from
  `darkModeRef.current`. A dedicated `useEffect([darkMode, redraw])` keeps the
  ref in sync AND calls `redraw(strokesRef.current)` to repaint existing
  strokes in the new color. If you change how colors are chosen, update the
  ref at the same time or strokes drawn before a toggle will stay the old hue.

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

- `updateSR(letterName, formKey, aiScore)` — runs after every scored AI session.
  Takes the **raw AI score 1–5** and internally maps it to SM-2 quality: score
  1 → quality 0 (so it actually counts as a fail in the EF formula), 2 → 2,
  3 → 3, 4 → 4, 5 → 5. Callers should pass `score` as returned by the model,
  not a pre-mapped quality. Updates `interval`, `easeFactor`, `lastReview`.
- **Dates are local, not UTC.** `todayLocal()` / `addDaysLocal()` /
  `parseLocalDate()` keep "due today" aligned with the user's wall-clock day
  regardless of timezone. Don't reintroduce `.toISOString().split('T')[0]` for
  scheduling — UTC shifts reviews for users east of UTC.
- `getDueLetters(LETTERS)` — returns all letter+form combos where
  `lastReview + interval ≤ today`, or any practiced slot with no `lastReview` date.
- The **Review** tab in PracticeView shows this list. Tapping a tile calls
  `goToReviewItem()` which navigates to that letter in the Letters tab.
- The Review tab badge shows the count of due items.
- `getProgressSummary(LETTERS)` — returns `{ [letterName]: { started, complete } }`
  in one pass. Use this for any UI that shows per-letter state (e.g. the 28-
  button alphabet row); do not loop `isLetterComplete`/`isLetterStarted`, each
  of which does its own `load()`.

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
- `useRef` for mutable non-rendering data (strokes, canvas snapshot, animation
  frame ID, darkMode mirror, strokeResumed flag, animatingRef).
- Named exports for data/utility modules, default exports for components and style objects.
- Constants: `UPPER_SNAKE_CASE`. Components: `PascalCase`. Everything else: `camelCase`.
- **Form controls bind to state.** Both the model `<select>` and brush `<input
  type="range">` are controlled (`value=`, not `defaultValue=`), and writes
  flow `setX` → `localStorage.setItem` → any module-level side effect. Keeps
  UI + storage + runtime behavior in sync after clear-key / tab-switch round-
  trips.
- After any progress/history write, bump `progressVersion` so memoized
  summaries recompute.
- Short imperative commit messages. No conventional-commit prefixes.

## MCP Tools

This project has three MCP servers available via the **Docker MCP gateway**
(`docker-mcp-gateway_*` tool prefix). Prefer them over ad-hoc fetching or
manual work when the task fits.

### Context7 — up-to-date library docs

Use for anything involving **React 19**, **Vite 8**, Pointer Events, Web Share
API, Service Workers, or OpenRouter model APIs. A lot of training data
predates these versions, so Context7 is the canonical source when you need to
confirm a hook signature, build config option, or browser API.

- `docker-mcp-gateway_resolve-library-id` → resolves a name like `"react"` or
  `"vite"` to a Context7 ID (e.g. `/facebook/react`, `/vitejs/vite`).
- `docker-mcp-gateway_get-library-docs` → fetches the docs. Pass a `topic` to
  scope the response (e.g. `"hooks"`, `"pointer events"`, `"service worker"`).

Skip Context7 for stable / well-known APIs (DOM canvas 2D, localStorage, basic
CSS) — built-in knowledge is fine there.

### Playwright — real browser testing

The project has **no test suite**; verification is manual browser work. Use
Playwright MCP to exercise the UI whenever a change could affect rendering,
input handling, or layout. Typical scenarios:

- Canvas pointer/touch behavior in `PracticeView.jsx` (pressure, leave/re-enter
  mid-stroke, `setPointerCapture`)
- Stroke-order "Show me" animation playback and cleanup on navigation
- RTL layout flipping under `html[lang="ar"]` when toggling locale
- Dark mode repaint of existing strokes (the `darkModeRef` path in `redraw`)
- PWA install / service-worker cache-bust behavior after `npm run build`
- Responsive breakpoints (`<400px`, `400–639px`, `640–899px`, `≥900px`)

Standard flow:
1. `npm run dev` in a terminal (or `npm run preview` after a build).
2. `docker-mcp-gateway_browser_navigate` → `http://localhost:5173`.
3. `docker-mcp-gateway_browser_snapshot` for accessibility-tree inspection
   (prefer this over screenshots for taking actions — it returns element refs
   you can feed to `browser_click` / `browser_type`).
4. `docker-mcp-gateway_browser_take_screenshot` only when you need a visual
   artifact (e.g. confirming dark-mode colors or Arabic glyph rendering).

Prefer built-in `webfetch` for static page reads — Playwright is for tasks
that require JS execution, interaction, or screenshots.

### GitHub — repo, PRs, issues

Deploy flow is "push to `main` → Vercel auto-deploys," so PR hygiene matters.
Use the GitHub MCP instead of shelling out to `gh` when you need to:

- Open / update / merge PRs (`create_pull_request`, `update_pull_request`,
  `merge_pull_request`)
- Read PR state, files, checks, reviews (`pull_request_read` with `method:
  "get"` / `"get_files"` / `"get_check_runs"` / `"get_reviews"`)
- Check Vercel deployment status via commit checks on the head SHA
- Triage issues (`list_issues`, `issue_read`, `issue_write`)
- Request a Copilot review before human review (`request_copilot_review`)

For local-only operations (staging files, writing commits, inspecting working-
tree diffs) keep using the `bash` tool with plain `git` — that's faster and
doesn't round-trip through the API.

### Selection guide

| Task                                              | Tool                                  |
|---------------------------------------------------|---------------------------------------|
| Look up React 19 / Vite 8 / browser API docs      | Context7                              |
| Verify canvas / RTL / dark-mode / PWA behavior    | Playwright                            |
| Open / review / merge a PR, read CI status        | GitHub MCP                            |
| Local git (status, diff, log, commit)             | `bash` + `git`                        |
| Read arbitrary web page (OpenRouter docs, etc.)   | built-in `webfetch`                   |
| Find files / search code in this repo             | built-in `glob` / `grep`              |

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

## Frontend Design Guidelines

When building or modifying UI components, follow these guidelines to avoid
generic "AI slop" aesthetics and create distinctive, polished interfaces.

### Design Thinking

Before coding UI, consider:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a bold direction — brutally minimal, maximalist, retro-futuristic,
  organic/natural, luxury/refined, playful/toy-like, editorial/magazine,
  brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
  Choose one that is true to the project's aesthetic.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone
  will remember?

### Aesthetics

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid
  generic fonts like Arial and Inter; opt for distinctive, characterful choices.
  Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for
  consistency. Dominant colors with sharp accents outperform timid, evenly-distributed
  palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only
  solutions. Focus on high-impact moments: one well-orchestrated page load with
  staggered reveals (`animation-delay`) creates more delight than scattered
  micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow.
  Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting
  to solid colors. Add contextual effects and textures that match the overall
  aesthetic — gradient meshes, noise textures, geometric patterns, layered
  transparencies, dramatic shadows, decorative borders, grain overlays.

### Anti-patterns — Avoid These

- Overused font families (Inter, Roboto, Arial, system fonts as primary choices)
- Clichéd color schemes (purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
- Converging on common choices across generations

### Execution

Match implementation complexity to the aesthetic vision. Maximalist designs need
elaborate code with extensive animations and effects. Minimalist or refined designs
need restraint, precision, and careful attention to spacing, typography, and subtle
details. Elegance comes from executing the vision well.

Note: This project uses inline JS style objects (not Tailwind) and Arabic font
stacks (`'Amiri','Scheherazade New',serif`). Apply these guidelines within those
constraints — use CSS custom properties from `global.css`, maintain RTL support,
and keep dark mode compatibility via `var(--color-*)` variables.
