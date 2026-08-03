# Connected-Writing Drills (ROADMAP #9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Connect" practice mode where the user joins 2–3 letters (e.g. ب + ا → با) and the app grades the connection — the exact skill (joining) that isolated-glyph practice doesn't build. Mirrors the existing Words-mode flow end-to-end.

**Architecture:** Clone the Words-mode flow as a new `practiceMode === 'connect'` branch backed by a new `CONNECTIONS` dataset. Reuse the entire canvas (`useDrawing`), AI-grading (`useAIFeedback` + `api.js`), and export (`useExport`) pipeline, adding a connect branch wherever those currently branch on `'words'`. Progress stored under the joined-string key with `formKey: 'word'` (zero new storage machinery — `arabic_progress` already syncs wholesale).

**Tech Stack:** React 19 + JSX, Vite 8, ESLint flat config, Vitest, no TypeScript.

## Global Constraints

- No React Context / global state — `practiceMode`/`currentConnection` via props/state only
- All storage through `storage.js` (`getItem`/`setItem`), never `localStorage` directly
- All visible strings through `t()` from `locales/index.js` — every key in BOTH `en` and `ar`
- Hook naming: destructured exports use prefix convention (e.g. `ccConnected` / `ccNextConnection`)
- No logging of data payloads or base64
- `BACKUP_KEYS` unchanged — no new localStorage keys (reuses `arabic_progress`)
- The multi-letter stroke-animation ("Show Me") decision is **deferred to B3** — v1 ships with ghost/watermark reference only (see B3 Options)

---

### Task 1: Add CONNECTIONS dataset (`src/data/connections.js`)

**Files:**

- Add: `src/data/connections.js`

**Interfaces:**

- Produces: `CONNECTIONS` (array of `{ letters: ['ب','ا'], joined: 'با', roman: 'ba', meaning: '...' }`), `ALL_CONNECTIONS` (flattened, if groups are used)

- [ ] **Step 1: Author the dataset**

Mirror `src/data/words.js` shape. Each entry holds the ordered `letters` array (2–3 letters), the pre-joined `joined` string (used as the prompt/watermark/progress key — the font shapes it automatically), `roman`, and `meaning`. Content is pedagogically curated to exercise initial→medial→final transitions (e.g. vowel-adjacent joins, dots, counters). Start with a small v1 set (~20–30 connections) grouped by join pattern.

- [ ] **Step 2: Add a unit test** asserting shape invariants (≥2 letters, `joined.length === letters.length`, all chars in `LETTERS`/letter set, `roman`/`meaning` present, unique keys).

---

### Task 2: Add `'connect'` mode plumbing in PracticeView.jsx

**Files:**

- Modify: `src/components/PracticeView.jsx`

**Interfaces:**

- Consumes: `CONNECTIONS` from `src/data/connections.js`
- Produces: `currentConnection` (resolved object), `connectIndex` state, `selectConnection(i)`, `nextConnection()`

- [ ] **Step 1: Add `'connect'` to the derived dataset blocks**

Add `'connect'` to **both** the early derivation block (`:116-124`, used by the drawing hook) and the late memo block (`:273-283`). This is the classic bug source — both must branch or the drawing hook dereferences a stale/undefined letter. Drive `currentConnection = CONNECTIONS[connectIndex]` and derive `currentChar`/prompt text from `currentConnection.joined`.

- [ ] **Step 2: Add the mode tab + switch handling**

Add a tab button at `:1017-1125` (alongside the six existing tabs) with `practiceMode === 'connect' ? styles.modeTabActive` styling. Extend `switchPracticeMode` (`:340`) to reset `connectIndex` to 0 and clear canvas/history like the other modes.

- [ ] **Step 3: Add connection selection UI**

Add a connection picker (mirroring the word picker `:2211-2238` and group selector `:1708-1743`) so the user can choose a connection, and a "Next" button (`:1940-1985`) advancing `connectIndex`.

- [ ] **Step 4: Prompt + info bar rendering**

Extend the prompt text effect (`:605-615`) and info bar (`:1639-1652`) to render `currentConnection.joined` + `roman`/`meaning` for connect mode.

---

### Task 3: Canvas watermark / ghost branching

**Files:**

- Modify: `src/hooks/useExport.js`
- Modify: `src/hooks/useDrawing.js`

**Interfaces:**

- Consumes: `currentConnection.joined` as the reference string

- [ ] **Step 1: Watermark text in `useExport.js:127`**

The current line branches on `'words'` (`currentWord?.word : currentChar`). Add a `'connect'` branch so the AI snapshot watermark shows `currentConnection.joined` — otherwise the AI sees no reference glyph.

- [ ] **Step 2: Ghost text in `useDrawing.js:93-103`**

Add a `'connect'` branch so the ghost watermark renders the joined string (mirroring the words branch).

---

### Task 4: Connection-specific AI grading

**Files:**

- Modify: `src/hooks/useAIFeedback.js`
- Modify: `src/utils/api.js`

**Interfaces:**

- Consumes: `currentConnection` (letters, joined, roman, meaning)
- Produces: `[SCORE:N]` (1–5) + feedback text, same as letters/words

- [ ] **Step 1: Add a connect branch in `useAIFeedback.js:63-90`**

Add a branch (alongside the `words`/`letters` branches) that sends `currentConnection.joined` as the name+char, roman, and a connection-specific form description. Ensure the progress-write gate (`:97-125`) includes connect mode so it writes `markPracticed` → `setScore` → `updateSR` → `addXP` → `setCelebrate` → `addFeedbackEntry`.

- [ ] **Step 2: Add a connection-specific system prompt in `api.js`**

Add a prompt variant (or generalize the existing one) that instructs the model to grade **the join itself**: connection angle, stroke continuity between letters, baseline consistency, and dot placement — not just shape fidelity of an isolated glyph. Keep the `[SCORE:N]` tag contract.

- [ ] **Step 3: Progress key**

Store progress under `currentConnection.joined` with `formKey: 'word'` (reuses the existing word-progress path). Verify `progress.js` reads it transparently.

---

### Task 5: Progress surfaced in stats + due queue

**Files:**

- Modify: `src/components/PracticeView.jsx` (summary/due arrays at `:293,303`)
- Modify: `src/utils/progress.js` (optional `getDueConnections` helper)

**Interfaces:**

- Consumes: `CONNECTIONS` appended to the summary + due arrays so connection practice appears in stats and the review queue

- [ ] **Step 1: Append CONNECTIONS to the summary/due arrays**

Add `CONNECTIONS` to the arrays passed at `PracticeView.jsx:293,303` (alongside `[...LETTERS, ...NUMBERS, ...DIACRITICS]`) so connection scores surface in `analytics.js` `getWeaknesses`/`getScoreDistribution`/`getProgressOverTime` automatically.

- [ ] **Step 2: Due-queue integration (review)**

Extend `getDueLetters` (`progress.js:290`) or add a `getDueConnections` helper so completed connections schedule into the review queue. Verify SM-2 works on the `'word'` formKey.

---

### Task 6: Locales (en + ar)

**Files:**

- Modify: `src/locales/index.js`

- [ ] **Step 1: Add keys in both `en` and `ar`**

Tab label (`tabConnected`), ARIA (`ariaConnectedTab`), mode hint, and any connect-specific copy (e.g. `hintDrawConnected`, `connectedJoinHint`). Add a `FORM_FULL`/`FORM_NAMES` entry for the `'word'`/`'connection'` formKey if rendered via `t(FORM_...)`.

---

### Task 7: Verification (all gates)

- [ ] **Step 1: Run the full gate:** `npm run lint && npm run typecheck && npm run test:run && npm run build` (all must exit zero)
- [ ] **Step 2: Stroke-coverage gate:** `npm run test:stroke-coverage` (must stay green — no strokeOrder.js changes expected)
- [ ] **Step 3: Host-Chrome visual smoke:** `npm run visual` against `npm run dev` — confirm a sample connection renders (joined string), draws, and AI-grades.
- [ ] **Step 4: Manual AI check:** verify a connection draw returns a `[SCORE:N]` and progresses (stars + progress entry + XP).

---

## B3 — Deferred decision: stroke animation ("Show Me")

`resolveShowMeAvailable` returns `undefined` for a multi-letter string, so the Show Me button auto-hides in connect mode. Two options:

- **Option A (recommended for v1):** ship with ghost/watermark reference only, no animated reveal. Much smaller scope; still delivers the core "join and get graded" value.
- **Option B:** author multi-letter connection stroke data (reusing the #15 calibration recipe from `scripts/calibrate-forms.py`). Large — replicates the entire #15 authoring effort for every connection. Only pursue if animated reveal is a hard requirement.

## Net-new work by size

| Item                                                        | Size             |
| ----------------------------------------------------------- | ---------------- |
| Connection-specific AI prompt                               | Medium           |
| Mode plumbing (PracticeView derivation blocks, tab, picker) | Medium           |
| `CONNECTIONS` content authoring                             | Medium           |
| Watermark/ghost branching                                   | Small            |
| Progress surface + due queue                                | Small            |
| Locales                                                     | Small            |
| Multi-letter stroke data (Option B)                         | Large (optional) |

## Notes

- **Relationship to #6 (word-level progress):** #9 reuses the word-progress key, so #6 and #9 share plumbing. Build #9 directly; #6 can be folded in as a follow-up.
- **No new localStorage keys** — `arabic_progress` syncs wholesale, so `BACKUP_KEYS`/cloud sync are untouched.
- **Deck integration:** `useDeckSession.resolveDeckItem` (`:37-94`) already maps `type` → dataset; a `type:'connection'` (or reusing `type:'word'`) slots in with no schema change.
