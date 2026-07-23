# AGENTS.md — Arabic Script Practice

## Project Overview & Commands

Arabic handwriting practice app — **PWA on the web** (React 19 + Vite 8) and
**native desktop** (Tauri 2 + Rust). Users draw Arabic letters or words on an
HTML canvas (Apple Pencil / touch / mouse) and get AI calligraphy feedback via
the OpenRouter vision API. Web version on Vercel — push to `main` auto-deploys.
Desktop version builds to .exe/.dmg/.AppImage binaries.

Three modes: **Letters** (28 letters, up to 4 positional forms), **Words**
(ligatures, vocabulary, phrases), **Review** (SM-2 spaced-repetition dashboard).
A guided **Lesson Mode** reorders letters by shape family. All roadmap phases
complete except optional cloud sync.

```bash
npm run dev         # Vite dev server → localhost:5173
npm run build       # Production build → dist/  AND auto-updates sw.js
npm run preview     # Preview production build locally
npm run tauri dev   # Native window with Vite HMR (requires Rust)
npm run tauri build # Native binaries (.exe / .dmg / .AppImage)
```

No test suite, linter, or formatter. Verify with `npm run build` (must exit
zero). For Tauri changes also verify `cargo check` in `src-tauri/` (must exit
zero). Manual browser testing for visual regressions.

**Prerequisites:** Rust (via `rustup`), Node.js, and platform build tools
(MSVC on Windows, Xcode on macOS, webkit2gtk on Linux).

**LSP:** `typescript-language-server` is pinned to **`4.3.4`** — do NOT upgrade
to v5.x (crashes under Crush with `no handler for method:
window/workDoneProgress/create`). `jsconfig.json` configures `jsx: "react-jsx"`
+ `moduleResolution: "bundler"`; `checkJs` is off (no TypeScript here).

## Architecture & Data Flow

- `index.html` (Vite entry, fonts), `src/main.jsx` (root, global.css, SW registration, hydration), `src/App.jsx` (manages key/locale/dark props).
- `src/components/`: `LoginScreen.jsx` (API key/skip), `PracticeView.jsx` (main UI, canvas, drawing, nav, AI feedback), `DeckManager.jsx` (presentational deck list/editor/picker, Review sub-tab; bulk-add, word search, checkmark badges, roving tabindex), `UndoToast.jsx` (accessible interactive undo toast).
- `src/data/`: `letters.js` (auto-gen positional forms), `lessonOrder.js` (shape families), `strokeOrder.js` (0-100 coords), `words.js`.
- `src/locales/index.js` (UI strings + sole source of FORM_NAMES/FORM_SHORT/FORM_FULL/FORM_DESCRIPTIONS).
- `src/utils/`: `api.js` (OpenRouter vision), `drawing.js` (pressure/brush), `progress.js` (SM-2; also exports `todayLocal`), `history.js` (feedback history), `decks.js` (study deck CRUD + `duplicateDeck`/`reorderDecks`/`setLastSession`/`bulkAddItems`/`restoreDeck`), `env.js` (Tauri runtime detection — `isTauri`).
- `src/styles/`: `global.css` (CSS vars, breakpoints, hover/focus, RTL), `practiceStyles.js`, `loginStyles.js` (inline styles).
- `public/` (sw.js, manifest.json, icons), `vercel.json` (headers), `scripts/bust-sw.js` (post-build cache-bust).
- `src-tauri/` — Tauri Rust backend: `tauri.conf.json` (window, CSP, bundle targets), `Cargo.toml` (deps), `src/lib.rs` (plugin registration), `capabilities/default.json` (permissions).

### Data flow & key decisions

1. `App.jsx` reads `openrouter_key` → `LoginScreen` or `PracticeView`; manages
   `locale` + `darkMode`, passes as props (incl. to `LoginScreen`).
2. `PracticeView` owns all practice state and is **one ~1100-line component** —
   new UI goes here unless it clearly warrants extraction. A `progressVersion`
   counter bumps on every successful AI write; `useMemo` hooks keyed to it
   recompute `progressSummary`/`completedCount`/`dueItems` in one pass.
3. Pointer events → `strokesRef` (**mutable ref, not state** — drawing perf;
   **normalized 0–1 coords** scaled inside `redraw`, never push absolute) →
   `redraw()` on every move.
4. "AI Feedback" → `exportCanvas()` composites watermark + strokes, downscales
   to 512px JPEG → `getAIFeedback()` → parsed for `[SCORE:N]`
   (`/\[SCORE:\s*([1-5])\s*\]/i`) → progress + SM-2 updated, `progressVersion` bumped.
5. progress/history utils cache parsed JSON in module memory; writes go through
   `save()`. Cross-tab edits invalidate cache via a `storage` listener. Always
   use exported helpers (`getProgressSummary`/`getDueLetters`), never
   `localStorage.getItem` directly.

Other constraints: **no React Context / global state** (`apiKey`/`locale`/
`darkMode` via props, rest local or localStorage). **Letter forms auto-generated**
via tatweel (kashida `ـ`) joining in `letters.js` — don't hand-define them.
**FORM_NAMES/FORM_SHORT/FORM_FULL/FORM_DESCRIPTIONS live only in
`locales/index.js`** as locale keys — always pass through `t()`.

## Tauri — Dual Target Architecture

The same `src/` code compiles for both web and native desktop. Runtime detection: `import { isTauri } from './utils/env'` checks `window.__TAURI_INTERNALS__`. Use this to guard web-only or Tauri-only code paths.

- **Web build** (`npm run build`): Vite produces `dist/` → Vercel serves it. SW, CSP headers, Vercel Analytics apply.
- **Tauri build** (`npm run tauri build`): Rust compiles `src-tauri/` wrapping the Vite output into native binaries.
- **Tauri dev** (`npm run tauri dev`): Launches a native window loading the Vite dev server at localhost:5173. HMR works.
- **localStorage** works in both environments (Tauri WebView is a real browser engine). Web and Tauri have separate localStorage sandboxes — no data carry-over.
- **Tauri CSP** is configured in `src-tauri/tauri.conf.json` → `app.security.csp`, separate from the web CSP in `vercel.json`.
- **Plugins** are installed via `npm run tauri add <name>` (handles Cargo.toml, npm, and capabilities). Register in `src-tauri/src/lib.rs`.
- **`src/utils/env.js`** is the single source of truth for `isTauri`. Import it anywhere you need platform branching.
- **Tauri docs:** https://v2.tauri.app

### Key web-only guards already in place

- **Service Worker** (`src/main.jsx`): guarded with `if (!isTauri && 'serviceWorker' in navigator)` — SWs don't work on Tauri's `asset://` protocol.
- **Vercel Analytics** (`src/App.jsx`): wrapped in `{!isTauri && <Analytics />}` — meaningless without Vercel context.

## Service Worker — Web Only

`npm run build` runs `vite build` then `scripts/bust-sw.js`, which bumps the
`CACHE` version in `public/sw.js`, patches JS/CSS asset hashes, and copies it to
the root `sw.js` (both stay in sync). **Don't manually edit `sw.js`** unless
adding new files to the `ASSETS` precache list.
SW registration is guarded with `isTauri` — it only runs in the browser.

## localStorage Keys — Do Not Rename

Keys: `openrouter_key` (API key), `openrouter_model` (model ID), `brushScale` (brush size), `lessonMode` (`"true"`/`"false"`), `app_locale` (`"en"`/`"ar"`), `app_darkMode` (`"true"`/`"false"`), `arabic_progress` (SM-2 progress JSON), `arabic_feedback_history` (last 5 entries JSON), `arabic_decks` (user study decks JSON). Renaming silently loses user data.

**Letter-name keys** must stay distinct (two pairs share romanizations): ح=`Hha`, ه=`Ha`, ط=`Tta`, ت=`Ta`. `progress.js` and `history.js` each have a `migrate()` that copies old `Ha`/`Ta` onto `Hha`/`Tta`. **Never rename these or remove the migration** without a forward migration.

In Tauri, localStorage is backed by the system WebView (Edge on Windows, WebKit on macOS/Linux). It works identically to the browser but is sandboxed per-WebView-instance — no data carry-over between web and desktop. Future storage plugins (Store, Stronghold) may layer on top; never remove localStorage fallback.

## Localization

All UI strings in `src/locales/index.js` as `UI = { en: {...}, ar: {...} }`.
`PracticeView`/`LoginScreen` take a `locale` prop and use
`const t = (key) => UI[locale][key] ?? key;`

- Every visible string goes through `t()` — never hardcode English, never inline `locale === 'ar' ? … : …`. Add new keys to **both** `en` and `ar`.
- `App.jsx` toggles locale, persists `app_locale`, sets `<html lang>`/`<html dir>`; `global.css` applies `direction: rtl` via `html[lang="ar"]`.
- `LESSON_GROUPS` stores `{ nameKey, descKey, letters }`; `FORM_*` maps form keys to locale keys — both looked up via `t()` (e.g. `t(FORM_NAMES[key])`).

## Styling & Arabic Text

- **Inline JS style objects** in `src/styles/` — no CSS modules, no Tailwind. Exception: `global.css` holds CSS color vars (light+dark), hover/active/focus classes (`.btn-nav`, `.btn-ai`, etc.), breakpoints (`<400`/`400–639`/`640–899`/`≥900`), and RTL rules.
- Buttons get a `className` (interactive states) AND inline `style` (layout/colors) — keep both in sync. Compose with spread: `{...styles.btn, ...styles.btnClear}`.
- Use CSS vars (`var(--color-primary)`), not hex literals, so dark mode works (`[data-theme="dark"]` on `<html>`).
- Arabic text: set `lang="ar"`, `direction: "rtl"`, font `'Amiri','Scheherazade New',serif` (loaded via Google Fonts in `index.html` or bundled locally for Tauri offline use). `TATWEEL` (`ـ`, U+0640) generates connected forms — don't substitute it.

## Canvas & Drawing

- HiDPI: bitmap = CSS px × dpr; resize uses `ctx.setTransform(dpr,0,0,dpr,0,0)` (not `ctx.scale`). Draw in CSS-pixel coords. Points normalized 0–1; `redraw` multiplies by current rect each pass. `getPoint` null-guards `canvasRef.current` + zero-size rects.
- Pressure: `e.pressure > 0 ? e.pressure : 0.5` (NOT nullish-coalesce — touch devices legitimately report 0). Pointer leave/re-enter mid-stroke: `strokeResumedRef` forces a new stroke; `setPointerCapture`/`release` wired on down/up/cancel.
- Stroke-order animation renders real glyph offscreen, reveals with a brush mask (`destination-in`); coords in `strokeOrder.js` are 0–100 space. Cleanup (`useEffect([letterIndex, formIndex, practiceMode])`) cancels RAF + clears animating state. `playStrokeAnimation` guards on `animatingRef.current`, NOT in `useCallback` deps.
- AI export: watermark behind strokes, ≤512px JPEG q0.85, light background unconditionally (model trained on light parchment).
- **Dark mode in `redraw`:** empty `useCallback` deps, so `darkMode` comes from `darkModeRef.current`; a `useEffect([darkMode, redraw])` syncs the ref AND repaints existing strokes.

## AI Integration & Spaced Repetition (SM-2)

- `getAIFeedback(apiKey, imageBase64, letterName, letterChar, romanName, formDescription)`
  in `api.js`. Model in `openrouter_model` (default `google/gemini-3-flash-preview`;
  choices: Gemini 3 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, GPT-5.4 mini).
- Prompt returns `[SCORE:N]` (1–5) — if changing format, update prompt AND parser.
  `apiKey === 'skip'` disables AI; minimum 5 stroke points required. Errors
  401/402/429/503 mapped to friendly messages.
- After a scored letters call: `markPracticed` → `setScore` → `updateSR` →
  `addFeedbackEntry`.
- **Words are first-class progress entries** when practiced via a deck session:
  `name` = the Arabic word string, `formKey` = `"word"`. Word strings (Arabic)
  never collide with letter/number/diacritic names (romanized). **Deck sessions
  do NOT call `updateSR`** — they're full-pass, no SM-2. Only regular practice
  and Auto Review use SM-2 scheduling.
- **Deck session modes:** Full-pass (default) and low-score re-run
  (`mode: "lowScore"`). Low-score re-runs filter `deck.lastSession.items`
  to `score == null || score <= 3` and constrain each queue entry to the
  specific `formKey` that scored low. Both modes skip `updateSR`.
  `setLastSession(deckId, session)` is called only on `finished: true` in
  `advanceDeck` — the single write site. `deck.lastSession` stores
  `{ date, mode, avgScore, items: [{ref, type, formKey, score}] }`.
  `deck.order` is a stable integer for list reordering.
- `progress.js` SM-2: `updateSR(letterName, formKey, aiScore)` takes the **raw AI
  score 1–5** and maps internally (1→quality 0, else identity) — pass the model's
  score, not a pre-mapped quality. **Dates are local, not UTC**
  (`todayLocal`/`addDaysLocal`/`parseLocalDate`); never reintroduce
  `.toISOString().split('T')[0]` for scheduling.
- `getDueLetters(LETTERS)` returns due combos (shown + badge-counted on the
  **Review** tab). `getProgressSummary(LETTERS)` returns per-letter
  `{started, complete}` in one pass — use it, don't loop `isLetter*`.

## Export / Share & PracticeView Props

- `saveDrawing()` — full-res PNG via hidden `<a download>` (web) or native save dialog (Tauri, via `@tauri-apps/plugin-dialog`); `shareDrawing()` — `navigator.share({ files })`, falls back to download. Both gated on `hasStrokes`. Guard Tauri paths with `isTauri`.
- Props: `<PracticeView apiKey onClearKey locale darkMode onToggleDarkMode onToggleLocale />` (`apiKey` is an OpenRouter key or `'skip'`).

## Conventions

- **JavaScript (JSX)**, ES2022+, `"type": "module"`. No TypeScript.
- Functional components, default exports, one per file. Named exports for
  data/util modules.
- `useCallback` for handlers passed as props/in deps. `useRef` for mutable
  non-rendering data (strokes, snapshot, RAF id, darkMode mirror, flags).
- Constants `UPPER_SNAKE_CASE`, components `PascalCase`, else `camelCase`.
- **Form controls are controlled** (`value=`, not `defaultValue=`); writes flow
  `setX` → `localStorage.setItem` → side effect.
- After any progress/history write, bump `progressVersion`.
- Short imperative commit messages, no conventional-commit prefixes.

## MCP Tools (Docker MCP gateway, `docker-mcp-gateway_*`)

- **Context7** — up-to-date docs for React 19, Vite 8, Pointer Events, Web Share,
  Service Workers, OpenRouter. Use `resolve-library-id` then `get-library-docs`
  (with a `topic`). Skip for stable APIs (canvas 2D, localStorage, basic CSS).
- **Playwright** — manual browser verification (no test suite). Use for canvas
  pointer behavior, animation cleanup, RTL flip, dark-mode repaint, PWA cache-
  bust, breakpoints. Flow: `npm run dev` → `browser_navigate` → `browser_snapshot`
  (prefer over screenshots for actions) → `browser_take_screenshot` for visuals.
- **GitHub MCP** — PRs (`create/update/merge_pull_request`), `pull_request_read`,
  issue triage, `request_copilot_review`. Use plain `git` for local-only ops.

## Vercel

Project `prj_k4j5UyqgA3Zjab1YdwlYp7Y8SQ6k`, team `team_pRfQNAB4Otffa8UYFOj1gxnY`.
Canonical live URL: **`https://www.writearabic.app`** (use in user-facing copy,
not `.vercel.app` hosts). `writearabic.app` 307-redirects to `www`. DNS at
**Cloudflare**; Vercel holds verification + serves + terminates TLS.

- **CLI deploy:** `npm run build` → `npx vercel deploy --yes`. On Hobby plan,
  CLI deploys from the default branch go to **production** — use a non-default
  branch for a true preview. Git auto-deploy is unaffected.
- **Debug a broken `main`:** `list_deployments` → `get_deployment_build_logs` →
  `get_runtime_logs` (filter `level:["error"]`/`5xx`/`production`) → roll back if
  needed. Protected previews: `get_access_to_vercel_url` / `web_fetch_vercel_url`.

## Roadmap

Phases 1–5 complete (fonts/API/undo; hover/export/progress/history; lessons/
comparison/scoring/animation/words; a11y/responsive/dark/i18n; SM-2/save-share/
SW cache bust). Tauri desktop target added (v1.0.0). **Pending:** cloud sync
(optional, needs backend).

## Frontend Design Guidelines

Avoid generic "AI slop." Before coding UI, decide **purpose**, a **bold tone**
(minimal / maximalist / editorial / luxury / etc.), and a **differentiator**.

- **Typography:** distinctive, characterful fonts — avoid Inter/Roboto/Arial.
- **Color:** cohesive palette via CSS vars; dominant colors + sharp accents.
- **Motion:** CSS-first; favor one orchestrated staggered page-load over scattered
  micro-interactions.
- **Composition:** asymmetry, overlap, grid-breaking, deliberate negative space.
- **Backgrounds:** atmosphere + depth (gradient meshes, noise, patterns, shadows).
- Avoid clichés (purple-on-white gradients, predictable layouts, cookie-cutter).

Match code complexity to the vision, within this project's constraints: inline
style objects, Arabic font stacks, CSS vars from `global.css`, RTL + dark-mode.
