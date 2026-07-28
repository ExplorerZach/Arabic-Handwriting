# Architecture — Arabic Script Practice

Deep reference for the Arabic handwriting practice app. For quickstart commands
and rules, see `AGENTS.md`.

## Data Flow & Key Decisions

1. `App.jsx` reads `openrouter_key` → `LoginScreen` or `PracticeView`; manages
   `locale` + `darkMode`, passes as props (incl. to `LoginScreen`).
2. `PracticeView` owns all practice state and is a **~2400-line component**
   (eight hooks extracted to `src/hooks/`: `usePrefs`, `useDrawing`,
   `useExport`, `useAIFeedback`, `useAnimation`, `useReviewSession`,
   `useDeckSession`, `useSyncConflict`). A `progressVersion`
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
   `localStorage.getItem` directly — all storage reads/writes go through
   `storage.js` (`getItem`/`setItem`).

Other constraints: **no React Context / global state** (`apiKey`/`locale`/
`darkMode` via props, rest local or localStorage). **Letter forms auto-generated**
via tatweel (kashida `ـ`) joining in `letters.js` — don't hand-define them.
**FORM_NAMES/FORM_SHORT/FORM_FULL/FORM_DESCRIPTIONS live only in
`locales/index.js`** as locale keys — always pass through `t()`.

## Hooks Architecture

Extracted from `PracticeView` during the ~3400→2400 line refactor. Key patterns:

- **Ref bridges** — when a hook called later needs a value from a hook called
  earlier, the parent defines a `useRef(null)` and passes it to both hooks. The
  later hook wires it (`ref.current = value`) while the earlier hook calls
  `ref.current?.()`. Examples: `setFeedbackRef`, `setRestingGlyphRef`,
  `exitReviewSessionRef`, `setDeckSessionRef`.
- **Naming convention** — destructured exports use a 2–4 character prefix:
  `d` (useDrawing), `e` (useExport), `ai` (useAIFeedback), `anim`
  (useAnimation), `rs` (useReviewSession), `ds` (useDeckSession), `sc`
  (useSyncConflict). `usePrefs` uses no prefix (called first, no collision).
- **Cross-hook refs** — `restGlyphRef` is shared across `useDrawing`,
  `usePrefs`, and `useAnimation`. `reviewSessionRef`/`advanceReviewRef`/
  `deckSessionRef`/`advanceDeckRef` are defined in the parent for
  `useAIFeedback` (called before the review/deck hooks) and wired by the
  respective session hooks.
- **Hook call order** — must match the call order of the original inline
  hooks. New hooks insert at the position of the extracted code.

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

### Key web-only guards

- **Service Worker** (`src/main.jsx`): guarded with `if (!isTauri && 'serviceWorker' in navigator)` — SWs don't work on Tauri's `asset://` protocol.
- **Vercel Analytics** (`src/App.jsx`): wrapped in `{!isTauri && <Analytics />}` — meaningless without Vercel context.

## Service Worker — Web Only

`npm run build` runs `vite build` then `scripts/bust-sw.js`, which bumps the
`CACHE` version in `public/sw.js`, patches JS/CSS asset hashes, and copies it to
the root `sw.js` (both stay in sync). **Don't manually edit `sw.js`** unless
adding new files to the `ASSETS` precache list.
SW registration is guarded with `isTauri` — it only runs in the browser.

`bust-sw.js` increments on EVERY build, so the committed CACHE version always
trails production by one or more — `sw.js` / `public/sw.js` modifications from
local verification builds are noise; don't commit them (AGENTS.md rule 13).
**Never use Playwright request interception on this app** — fulfilled routes plus
the registered service worker deadlock the Playwright driver (it once crashed
the whole MCP gateway container and took every MCP tool with it).

## localStorage Keys — Do Not Rename

Keys: `openrouter_key` (API key — Stronghold vault on Tauri via `secureStorage.js`, AES-GCM encrypted storage on web), `openrouter_model` (model ID), `brushScale` (brush size), `brush_pack`, `lessonMode` (`"true"`/`"false"`), `app_locale` (`"en"`/`"ar"`), `app_darkMode` (`"true"`/`"false"`), `app_theme` (named theme from `themes.js`), `daily_goal`, `last_daily_reminder`, `arabic_progress` (SM-2 progress JSON), `arabic_feedback_history` (last 5 entries JSON), `arabic_decks` (user study decks JSON), `arabic_practice_dates` (heatmap), `arabic_xp`, `arabic_freezes` (streak freezes; `arabic_freezes_v2` is its migration flag), `sync_last_user_id` (last cloud-synced account — account-switch detection). Renaming silently loses user data. `backup.js` → `BACKUP_KEYS` is the canonical export list — update it when adding a key. Sync-internal keys (`_lastSyncTime` in localStorage, `_syncDirty` in sessionStorage) start with `_` and are never in `BACKUP_KEYS` — the App.jsx sync listener ignores anything outside `BACKUP_KEYS` (writing `_lastSyncTime` would otherwise re-arm the debounce after every push: an infinite push loop).

**Letter-name keys** must stay distinct (two pairs share romanizations): ح=`Hha`, ه=`Ha`, ط=`Tta`, ت=`Ta`. `progress.js` and `history.js` each have a `migrate()` that copies old `Ha`/`Ta` onto `Hha`/`Tta`. **Never rename these or remove the migration** without a forward migration.

In Tauri, localStorage is backed by the system WebView (Edge on Windows, WebKit on macOS/Linux). It works identically to the browser but is sandboxed per-WebView-instance — no data carry-over between web and desktop. On desktop, `storage.js` additionally mirrors every write into the Tauri Store plugin (`app-data.json`) and `secureStorage.js` keeps the API key in a Stronghold vault — localStorage remains the source of truth on web; never remove the fallback.

## Cloud Sync (Supabase)

Optional, opt-in — the app is fully functional signed-out. Supabase Auth (email/password) + a `public.user_data` table (`user_id`, `key`, `value` jsonb, `version` int, `updated_at`; UNIQUE `(user_id, key)`; RLS: users select/insert/update/**delete** only their own rows).

- `src/utils/supabase.js` — lazy singleton anon client. `src/utils/sync.js` owns ALL sync logic; UI never calls push/pull directly.
- **Serialization:** every cloud op chains onto a module-level promise queue (`enqueue`) so debounced pushes, reconnect flushes, and the sign-in `initialSync` can never interleave.
- **Gating:** the App.jsx `onChange` listener only schedules pushes for keys in `BACKUP_KEYS` (anything else — including `_lastSyncTime` written by sync itself — is ignored, or every successful push would re-arm the debounce: an infinite loop), and only after `isInitialSyncDone(user.id)` (the sign-in pull→push finished). This prevents a scheduled push from racing the sign-in pull and blind-overwriting newer cloud data.
- **Conflict resolution:** remote-wins when `remote.version > local._v`. Only the six `arabic_*` JSON keys carry `_v` (bumped by each module's `save()`); scalar prefs (`app_locale`, `app_theme`, …) have no version, so remote always wins for them on pull — accepted last-puller-wins. Whole-blob versioning **cannot merge** concurrent edits from two simultaneously-active devices (last writer wins per key) — don't add multi-device-collaboration features without field-level merging.
- **Scalars round-trip as raw strings** — push stores them as jsonb strings, pull restores them verbatim. Never `JSON.parse` with an `{}` fallback: bare tokens like `en` throw, and the fallback used to destroy these values in the cloud.
- **Cache invalidation:** pull calls `notifyExternalWrite(key)` (storage.js) per applied key, dispatching a synthetic `storage` event so the data modules' in-memory caches invalidate in the SAME tab. Without it, the next `save()` writes from a stale cache and clobbers the merge.
- **Sign-in effect is keyed to `user?.id`**, never the user object (supabase-js re-fires with fresh objects on TOKEN_REFRESHED). App.jsx relies on the `INITIAL_SESSION` event — do NOT add a separate `getSession()` call (double-fires the sync).
- **Account switch** (`sync_last_user_id` differs + local learning data exists): PracticeView prompts merge vs discard. Discard = `clearSyncableData()` then pull-only (`pushLocal: false`) so the old account's data can't leak into the new account.
- **Failures:** push marks `_syncDirty` (sessionStorage) on error and clears it on success; flushes happen on `online` + `visibilitychange`. Pull failure during `initialSync` skips the push leg and leaves sync gated until a reconnect retry.
- **Wipe:** `handleWipeData` awaits `deleteCloudData()` (needs the DELETE RLS policy) before the local wipe + reload, or deleted data resurrects on next sign-in. An offline wipe leaves cloud rows behind — they'll re-apply on next sign-in.
- **API key is never synced** (not in `BACKUP_KEYS`); auth forms live only in `AuthForm.jsx`.

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

## MCP Tools

- **Context7** — up-to-date docs for React 19, Vite 8, Pointer Events, Web Share,
  Service Workers, OpenRouter. Use `resolve-library-id` then `get-library-docs`
  (with a `topic`). Skip for stable APIs (canvas 2D, localStorage, basic CSS).
- **Playwright** — manual browser verification alongside the Vitest suite. Use for canvas
  pointer behavior, animation cleanup, RTL flip, dark-mode repaint, PWA cache-
  bust, breakpoints. The **containerized** Playwright MCP cannot reach the app:
  `localhost` is unreachable from the container, and Chrome's Private Network
  Access blocks `host.docker.internal` from a non-secure context (no MCP-exposed
  flag disables it; request interception deadlocks the SW — see Service Worker).
  **Sanctioned flow: drive the host's own Chrome** with `playwright-core` (no
  browser download; install it outside the repo, e.g. `%TEMP%\opencode`):

  ```js
  import { chromium } from 'playwright-core';
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('app_darkMode', 'true'); // seed state; no login gate
  });
  ```

  Useful keys: `app_darkMode`, `high_contrast`, `reduce_motion`, `app_theme`,
  `brush_pack`, `app_locale`, `arabic_progress`, `arabic_xp`, `arabic_streak`,
  `arabic_daily_goal`. Tabs are `[role="tab"]`; `colorScheme: 'dark'` in
  `newContext` exercises the `prefers-color-scheme` blocks in `download.html`.
  Prefer accessibility snapshots for actions, screenshots for visuals. For WCAG
  contrast checks (blend rgba tokens over their background first), see
  `docs/completed/session-4-light-palette-handoff.md` §3.

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
  PR previews sit behind Vercel **deployment protection** and serve a login page
  to anonymous fetchers — until a bypass token is configured, the standard
  pre-merge visual check is `npm run preview` + the host-browser recipe above.

## Roadmap

Phases 1–5 complete (fonts/API/undo; hover/export/progress/history; lessons/
comparison/scoring/animation/words; a11y/responsive/dark/i18n; SM-2/save-share/
SW cache bust). Tauri desktop target added (v1.0.0). Cloud sync (Supabase auth +
`user_data` table) implemented.

## Updater Signing

Generate a keypair:

```bash
npx tauri signer generate -w ~/.tauri/arabic-script.key
```

The public key goes in `tauri.conf.json` → `plugins.updater.pubkey`.
The private key goes in GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`.
Optionally set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if password-protected.

## Version Bumping

Before tagging a release:

```bash
node scripts/bump-version.js 1.0.1
npm run tauri:check   # re-syncs Cargo.lock
```

This rewrites `package.json`, `src-tauri/tauri.conf.json`, and
`src-tauri/Cargo.toml` to the given semver. Commit the lockfile with the bump.

## Cutting a Release

Releases are built by `.github/workflows/release.yml`, triggered by pushing a
tag matching `v*` (or manually via `workflow_dispatch` with a `tagName` input).
**The version bump alone does nothing — you must create AND push the tag:**

```bash
# after bumping versions + committing
git tag v1.0.1
git push origin v1.0.1
```

- The tag **must point at a commit that already contains the workflow file** —
  tag runs use the workflow as it exists in the tagged commit. Re-pushing an
  old tag runs the old workflow.
- To re-tag: `git tag -d vX && git push origin :refs/tags/vX && git tag vX &&
git push origin vX` (deleting + re-pushing quickly can fire duplicate runs;
  cancel one in the Actions tab).
- The run builds 4 targets (win x64, mac x64, mac arm64, linux x64) and
  publishes a **draft release** with all assets, signatures, and a merged
  `latest.json` updater manifest. Review and publish the draft by hand.
- **Never use flow-style YAML mappings with `${{ }}` in workflow files**
  (`with: { targets: ${{ matrix.target }} }` is a hard YAML syntax error —
  GitHub rejects the whole workflow with 0 jobs). Always use block style for
  `with:` values containing expressions. Check a failed run's **Annotations**
  for "Invalid workflow file" errors.
- `vite.config.js` targets `safari15` (not the Tauri template's `safari13`) —
  Vite 8/rolldown cannot downlevel destructuring to safari13. Don't lower it.
- tauri-action needs `args: --target ${{ matrix.target }}` or every mac job
  builds arm64 and overwrites each other's assets.

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
