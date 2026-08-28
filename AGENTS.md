# AGENTS.md — Arabic Script Practice

Arabic handwriting practice app — **PWA** (React 19 + Vite 8) + **native desktop**
(Tauri 2 + Rust). Canvas drawing (Apple Pencil / touch / mouse) + AI calligraphy
feedback via OpenRouter vision API. Web on Vercel, desktop as .exe/.dmg/.AppImage.

## Commands

```bash
npm run dev          # Vite dev server → localhost:5173
npm run build        # Production build → dist/ + auto-updates sw.js
npm run preview      # Preview production build locally
npm run tauri dev    # Native window with Vite HMR (requires Rust)
npm run tauri build  # Native binaries
npm run lint         # ESLint (`npm run lint:fix` to auto-fix)
npm run format       # Prettier write (`format:check` for read-only)
npm run typecheck    # tsc -p jsconfig.json --noEmit
npm run test:run     # Vitest single run (`npm test` = watch mode)
npm run visual       # No-MCP host-Chrome smoke (load/draw/RTL/dark + screenshots)
npm run tauri:check  # cargo check in src-tauri/
```

**Verification after changes:** `npm run lint && npm run typecheck && npm run test:run && npm run build`
(all must exit zero); for Tauri changes also `npm run tauri:check`.

Pre-commit hook runs `eslint --fix` + `prettier --write` on staged files.
**LSP:** `typescript-language-server` pinned to **4.3.4** — do NOT upgrade.
**opencode:** `opencode.json` (tracked) defines `/verify`, `/lint`, `/test` etc.
slash commands mirroring these gates — keep it in sync with this section.

**Visual checks:** the containerized Playwright MCP **cannot** reach this app
(Chrome Private Network Access blocks `host.docker.internal` from a non-secure
context; request interception deadlocks the service worker + driver — it once
took the whole MCP gateway down). Use the packaged one-command flow:
**`npm run visual`** (`scripts/visual-smoke.js`) drives the **host's own Chrome**
against `npm run dev` / `npm run preview` via an absolute-path `playwright-core`
(never a repo dependency; override with `PLAYWRIGHT_CORE_PATH`). A Kanban
worktree has no `node_modules`, so start the dev server from the MAIN checkout
(`C:\Users\Admin\Desktop\Coding\Arabic-Handwriting`) and let the script resolve
playwright-core from its absolute path — never install playwright-core in a
worktree or commit it.

## MCP Tools

| Tool        | Purpose                                    | Primary user             |
| ----------- | ------------------------------------------ | ------------------------ |
| `context7`  | Up-to-date library docs & API references   | @librarian               |
| `exa`       | Web search & page fetching                 | @librarian, orchestrator |
| `gh_grep`   | GitHub code search for real-world examples | @librarian, @fixer       |
| `websearch` | General web search                         | @librarian, orchestrator |

Orchestrator uses exa/websearch/gh_grep only for quick lookups to inform
planning. Deep research always delegates to @librarian.

## Architecture Map

```
src/
  App.jsx              # key/locale/dark props, login gate
  main.jsx             # entry, global.css, SW registration
  components/
    PracticeView.jsx   # ~2400-line main UI (canvas, drawing, nav, AI feedback)
    LoginScreen.jsx    # API key entry / skip
    DeckManager.jsx    # deck list/editor/picker + Review sub-tab
    AuthForm.jsx       # shared email/password sign-in/up (ONLY auth quirks here)
    SettingsPanel.jsx  # settings
    AnalyticsPanel.jsx, DailyGoalRing.jsx, LevelBadge.jsx, XpGainToast.jsx
    UndoToast.jsx, AffiliateLinks.jsx, TipJarBanner.jsx
  hooks/
    usePrefs.js        # brush, theme, model, daily goal, sound, motion prefs
    useDrawing.js      # canvas, strokes, pointer events, undo
    useExport.js       # PNG/JPEG export, save, share
    useAIFeedback.js   # OpenRouter vision API, consent dialog
    useAnimation.js    # stroke-order animation, resting glyph
    useReviewSession.js # guided review (SM-2 due queue)
    useDeckSession.js  # study deck full-pass / low-score sessions
    useSyncConflict.js # cloud sync, account-switch detection
  data/
    letters.js         # auto-gen positional forms via tatweel
    numbers.js, diacritics.js, words.js
    lessonOrder.js     # shape families for Lesson Mode
    strokeOrder.js     # 0-100 coords for stroke animation
  locales/index.js     # ALL UI strings (en + ar); sole source of FORM_NAMES etc.
  utils/
    storage.js         # *** unified storage layer *** (getItem/setItem/removeItem/onChange)
    progress.js        # SM-2 scheduling + todayLocal
    history.js         # feedback history
    decks.js           # study deck CRUD
    api.js             # OpenRouter vision API
    sync.js            # Supabase cloud sync (owns ALL sync logic)
    supabase.js        # lazy singleton anon client
    secureStorage.js   # API key: Stronghold (Tauri) / AES-GCM (web)
    env.js             # isTauri runtime detection
    drawing.js, sound.js, xp.js, dailyGoal.js, freezes.js
    analytics.js, backup.js, downloads.js, notifications.js, updater.js
  styles/
    global.css         # CSS vars, breakpoints, RTL, dark mode
    practiceStyles.js, loginStyles.js, themes.js
```

## Critical Rules

1. **No React Context / global state** — `apiKey`/`locale`/`darkMode` via props.
2. **All storage goes through `storage.js`** (`getItem`/`setItem`), never
   `localStorage` directly. Data modules cache in memory; imports from those
   utils invalidate on cross-tab edits via synthetic `storage` events.
3. **Form controls are controlled** (`value=`, not `defaultValue=`).
4. **No TypeScript** — JSX only. `checkJs` is off.
5. **`useRef` for mutable non-rendering data** (strokes, snapshot, RAF ids), not state.
6. **Dates are local** (`todayLocal`/`addDaysLocal`/`parseLocalDate`) — never `.toISOString().split('T')[0]`.
7. **Letter-name keys** ح=`Hha`, ه=`Ha`, ط=`Tta`, ت=`Ta` — never rename. `progress.js`/`history.js`
   each have a `migrate()` for old `Ha`/`Ta` keys.
8. **`backup.js` → `BACKUP_KEYS`** is the canonical list of all data keys — update it when adding one.
9. **API key is never synced** (not in `BACKUP_KEYS`).
10. **Every visible string goes through `t()`** from `locales/index.js` — never hardcode English.
11. **Never log data payloads or base64** — `console.error` only metadata (error messages, not objects). No `console.log` of progress JSON, canvas snapshots, or API request bodies.
12. **Hook naming convention:** destructured exports use prefix (`dCanvasRef`, `eSaveDrawing`, `aiFeedback`, `animAnimating`, `rsReviewSession`, `dsDeckSession`, `scConflictPromptOpen`) — avoids name collisions. New hooks must follow same pattern.
13. **Never commit local `sw.js`/`public/sw.js` cache bumps** — `bust-sw.js`
    increments on every build, so the committed version always trails production.
    Discard after verification builds:
    `git restore --source=HEAD --staged --worktree sw.js public/sw.js`.
14. **`git checkout -- <path>` restores from the index, not HEAD** — use
    `git restore --source=HEAD --staged --worktree <path>` to discard to HEAD.

## Agent Memory

Curated memory bank for AI agents at `docs/agent-memory/`:

- [`README.md`](docs/agent-memory/README.md) — index, authority contract, and
  maintenance rules
- [`decisions.md`](docs/agent-memory/decisions.md) — ADR-style architecture
  and design decisions with rationale
- [`gotchas.md`](docs/agent-memory/gotchas.md) — surprising behaviors,
  footguns, and safe workarounds

Agents should consult relevant entries when making design decisions or
investigating surprising behavior, but always verify against current source
code and tests — the codebase is authoritative over memory.

## Deep Reference

For detailed architecture, data flow, cloud sync, SM-2 scheduling, Tauri
dual-target, Vercel deploy, release process, and design guidelines:
**`docs/architecture.md`**
