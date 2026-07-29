# Security Roadmap — Accounts Readiness

> **How to use:** An agent reads this file, finds the first unchecked box in the
> lowest-numbered active phase, and fixes it. When done, it checks the box and
> commits. If an item is blocked by an unchecked dependency, skip it. Multiple
> agents can work on different items **within the same phase** simultaneously
> if they touch different files. Items marked `[PARALLEL]` have no file overlap
> with others in the same phase.

## Phase 1 — Blockers (must fix before anything else)

### 1.1 Fix Stronghold empty password

- [x] **File:** `src-tauri/src/lib.rs` line 6
- **Issue:** `|_pass| Vec::new()` — vault has no encryption key. API key readable by
  any process with filesystem access.
- **Fix:** Generate a random 32-byte key on first launch, store it in the Tauri
  Store plugin under a dedicated key (e.g. `stronghold_key`), and derive from
  that on subsequent launches. Accept that this is obfuscation, not true
  encryption (the derivation key lives alongside the vault). For true security,
  prompt the user for a passphrase — but that's a UX decision beyond scope.
- **Verify:** Build desktop and confirm the API key is no longer readable from
  the Stronghold snapshot without the derivation key.
- **Depends on:** nothing
- **Touches:** `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml` (may need `rand`)

### 1.2 Sanitize backup import strings

- [x] **File:** `src/utils/backup.js` lines 79–94
- **Issue:** `applyBackup()` writes JSON string values verbatim into
  localStorage. Deck names, feedback text, etc. from a malicious backup file
  could contain XSS payloads that execute when rendered.
- **Fix:** Add a sanitize step. For each string value written, strip HTML tags.
  The simplest safe approach: `val.replace(/<[^>]*>/g, '')` before `setItem`.
  Alternatively, add a pure-function `sanitizeString(str)` that strips tags
  and common event-handler patterns.
- **Verify:** Create a test backup JSON with `<img src=x onerror=alert(1)>` in
  a deck name, import it, verify the deck name renders as plain text.
- **Depends on:** nothing
- **Touches:** `src/utils/backup.js`, `__tests__/` (optional test)

### 1.3 Add privacy policy page

- [x] **New file:** `public/privacy.html` (or React route; static HTML is simpler)
- **Issue:** No privacy policy exists. GDPR/CCPA require disclosure of: what
  data is collected, why, who it's shared with (OpenRouter, Vercel Analytics),
  retention periods, user rights (access, deletion, portability), contact info.
- **Fix:** Create a plain HTML page covering:
  - Data collected: handwriting drawings, practice history, XP, settings
  - Third parties: OpenRouter (AI feedback), Vercel (hosting + analytics)
  - Retention: localStorage until user clears; OpenRouter claims no storage
  - Rights: export backup, delete data, withdraw consent
  - Contact: your email or a GitHub issue link
  - Link it from the LoginScreen and SettingsPanel
- **Verify:** Load `/privacy.html` in browser, confirm all sections present.
- **Depends on:** nothing
- **Touches:** `public/privacy.html` (new), `src/components/LoginScreen.jsx`, `src/components/SettingsPanel.jsx`, `src/locales/index.js` (new keys)

### 1.4 Consent before first AI feedback call

- [x] **Files:** `src/components/PracticeView.jsx` (around AI feedback button)
- **Issue:** User handwriting is sent to a third-party AI without explicit
  consent. Under GDPR Art. 6, you need a lawful basis.
- **Fix:** Add a one-time consent prompt before the first AI feedback request.
  - New localStorage key: `ai_consent` (`"true"` / absent)
  - When user clicks "Get Feedback" and `ai_consent` is not `"true"`, show a
    modal/alert: "Your drawing will be sent to OpenRouter for AI analysis.
    OpenRouter may process this data on servers outside your country.
    [I Agree] [Use Offline Mode Instead]"
  - On agree, set `ai_consent` = `"true"` and proceed.
  - Also add a "Revoke consent" option in Settings that clears the key and
    deletes any server-side data (future).
  - The "skip" mode (no API key) is already an opt-out — make this clearer.
- **Verify:** Clear `ai_consent`, click "Get Feedback", confirm prompt appears.
  Accept, verify it doesn't show again. Check Settings for revoke option.
- **Depends on:** 1.3 (privacy page linked from consent prompt)
- **Touches:** `src/components/PracticeView.jsx`, `src/components/SettingsPanel.jsx`, `src/utils/storage.js` (new key), `src/locales/index.js`

---

## Phase 2 — Hardening (improve existing security posture)

### 2.1 Encrypt API key at rest in localStorage (web)

- [x] **File:** `src/utils/secureStorage.js`
- **Issue:** `openrouter_key` is plaintext in localStorage on web. Any XSS or
  malicious extension can read it.
- **Fix:** Use Web Crypto API (`SubtleCrypto`) to encrypt the key before
  storing. Derive an encryption key from a random UUID stored in
  `sessionStorage` (per-session, cleared on tab close). This means the key
  needs re-entry once per browser session — acceptable UX tradeoff.
  - On `setApiKey(key)`: generate a random AES-GCM key, export as JWK, store
    in sessionStorage. Encrypt the API key with it, store ciphertext in localStorage.
  - On `getApiKey()`: read JWK from sessionStorage, import, decrypt ciphertext.
  - If sessionStorage is empty (new tab/session), return empty (user re-enters).
  - Keep Tauri Stronghold path unchanged.
- **Verify:** Check localStorage after setting key — `openrouter_key` should
  be a ciphertext blob, not `sk-or-...`. Check that getApiKey still returns
  the correct key within the same session.
- **Depends on:** 1.1 (Stronghold fix must not break)
- **Touches:** `src/utils/secureStorage.js`

### 2.2 Verify no XSS in feedback/deck rendering — [PARALLEL]

- [x] **File:** `src/components/PracticeView.jsx`, `src/components/DeckManager.jsx`
- **Issue:** AI feedback text and user-editable deck names are rendered. Need
  to confirm they use safe JSX interpolation (`{text}`) not
  `dangerouslySetInnerHTML`.
- **Fix:** Search both files for `dangerouslySetInnerHTML`. If found on
  user-controlled or AI-generated strings, replace with safe JSX. If
  `dangerouslySetInnerHTML` is used only for static SVG markup or
  known-safe content, document it with a comment.
- **Verify:** Search: `rg "dangerouslySetInnerHTML" src/components/`. For each
  match, confirm the source is not user/AI-controlled.
- **Depends on:** nothing
- **Touches:** `src/components/PracticeView.jsx`, `src/components/DeckManager.jsx`

### 2.3 Move esbuild from dependencies to devDependencies — [PARALLEL]

- [x] **File:** `package.json`
- **Issue:** `esbuild` is in `dependencies` (runtime) but is only used during
  build (Vite). It adds ~9MB to the production bundle unnecessarily and
  increases the attack surface.
- **Fix:** Move `"esbuild": "^0.28.1"` from `dependencies` to `devDependencies`.
  Run `npm install` to update lockfile. Run `npm run build` to confirm no
  runtime import of esbuild.
- **Verify:** `npm run build` passes, `npm run preview` works, production
  bundle is smaller.
- **Depends on:** nothing
- **Touches:** `package.json`, `package-lock.json`

### 2.4 Remove Google Fonts preconnect — [PARALLEL]

- [x] **File:** `index.html` lines 13–14
- **Issue:** Preconnect to `fonts.googleapis.com` / `fonts.gstatic.com` sends
  user IP to Google on every page load. Fonts are already self-hosted in
  `public/fonts/`, so the preconnect is unused — but still leaks data.
- **Fix:** Remove the two `<link rel="preconnect">` tags from `<head>`.
  Confirm no `@import url('https://fonts.googleapis.com/...')` exists in CSS.
- **Verify:** `rg "fonts.googleapis"` returns zero results. Page loads with
  Amiri/Scheherazade fonts intact.
- **Depends on:** nothing
- **Touches:** `index.html`

### 2.5 Add Content-Security-Policy meta tag in index.html — [PARALLEL]

- [x] **File:** `index.html`
- **Issue:** CSP is delivered via Vercel HTTP headers only. A `<meta>` tag
  provides defense-in-depth if headers are stripped (misconfigured proxy, etc.).
- **Fix:** Add before `<title>`:
  ```html
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; connect-src 'self' https://openrouter.ai https://*.vercel-insights.com https://vitals.vercel-insights.com https://*.vercel-analytics.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"
  />
  ```
  Keep in sync with `vercel.json` CSP value.
- **Verify:** Open browser devtools → Network → response headers, confirm CSP
  is present both as header (Vercel) and meta (HTML).
- **Depends on:** nothing
- **Touches:** `index.html`

### 2.6 Add npm audit / cargo audit to CI — [PARALLEL]

- [x] **Files:** `.github/workflows/web-check.yml`
- **Issue:** No automated dependency vulnerability scanning in CI.
- **Fix:** Add a job to `web-check.yml`:
  ```yaml
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm audit --audit-level=high
  ```
  For Cargo, add a similar job that runs `cargo install cargo-audit` and
  `cargo audit` in `src-tauri/`.
- **Verify:** CI passes. If `npm audit` reports known vulns, triage them.
- **Depends on:** nothing
- **Touches:** `.github/workflows/web-check.yml`

---

## Phase 3 — Sync Foundation (data layer prep for cloud accounts)

### 3.1 Add version fields to all data structures

- [x] **Files:** `src/utils/progress.js`, `src/utils/history.js`, `src/utils/decks.js`, `src/utils/xp.js`, `src/utils/freezes.js`, `src/utils/analytics.js`
- **Issue:** No versioning on data — impossible to do conflict resolution for
  multi-device sync.
- **Fix:** Add a `_v: 1` field to each top-level data object. On load, if
  `_v` is missing, set it to 1 and save. Increment `_v` on every write (in each
  module's `save()` function). This is a non-breaking change — old data
  auto-migrates.
  - `arabic_progress`: add `_v` at root
  - `arabic_feedback_history`: add `_v` at root
  - `arabic_decks`: add `_v` at root
  - `arabic_xp`: add `_v`
  - `arabic_freezes`: add `_v`
  - `arabic_practice_dates`: add `_v`
- **Verify:** Load the app with existing data, check localStorage — all keys
  should have `_v: 1`. Perform any action, confirm `_v` increments.
- **Depends on:** nothing (Phase 3 can start after Phase 1 is done)
- **Touches:** `src/utils/progress.js`, `src/utils/history.js`, `src/utils/decks.js`, `src/utils/xp.js`, `src/utils/freezes.js`, `src/utils/analytics.js`

### 3.2 Create a sync utility module

- [x] **New file:** `src/utils/sync.js`
- **Issue:** No abstraction for pushing/pulling data to/from a cloud backend.
- **Fix:** Create `src/utils/sync.js` with:
  - `pushToCloud(data)`: sends all localStorage keys to backend
  - `pullFromCloud()`: fetches server state, merges with localStorage
    (server-wins on version conflict for now)
  - `getLocalSnapshot()`: returns `{ key: value, _v }` for all BACKUP_KEYS
  - `applyRemoteSnapshot(snapshot)`: writes server data to localStorage,
    respecting `_v` (only overwrite if server version > local version)
  - `getLastSyncTime()` / `setLastSyncTime()`: track when last sync occurred
  - The actual HTTP calls should be stubbed (`// TODO: replace with real
endpoint`) — the module defines the interface, implementation comes later.
- **Verify:** Import `sync.js` in browser console, call `getLocalSnapshot()`,
  confirm it returns all keys with `_v` fields.
- **Depends on:** 3.1
- **Touches:** `src/utils/sync.js` (new)
- **File overlap:** none — can run in parallel with 3.3

### 3.3 Add data wipe function for GDPR right-to-deletion — [PARALLEL]

- [x] **File:** `src/utils/backup.js` (or new `src/utils/wipe.js`)
- **Issue:** No way for a user to delete all their data (GDPR Art. 17).
- **Fix:** Export a `wipeAllData()` function that removes all `BACKUP_KEYS`
  from localStorage/Store (and later also calls the backend to delete server
  data). Add a "Delete All Data" button in SettingsPanel behind a
  confirmation dialog ("This cannot be undone. Type DELETE to confirm.").
- **Verify:** Add some practice data, go to Settings, click "Delete All Data",
  type DELETE, confirm all localStorage keys are removed and app returns to
  clean state.
- **Depends on:** nothing
- **Touches:** `src/utils/backup.js`, `src/components/SettingsPanel.jsx`,
  `src/locales/index.js`

---

## Phase 4 — Auth Implementation (accounts feature)

### 4.1 Choose and provision auth provider

- [x] **Decision needed:** Supabase (recommended) vs Firebase vs custom backend
- **Tasks:**
  - Create Supabase/Firebase project
  - Configure email/password + Google OAuth
  - Set up Row-Level Security policies (if Supabase)
  - Add auth SDK to package.json
  - Document credentials/env vars in a secure location (NOT in repo)
- **Depends on:** Phase 1 complete, Phase 3 complete

### 4.2 Implement auth UI (login/signup/profile)

- [x] **Files:** New components built on LoginScreen patterns
- **Tasks:**
  - SignUp / SignIn forms (email + password, Google button)
  - "Continue without account" option (preserves existing skip flow)
  - Profile/settings page with session management (view/revoke devices)
  - Merge prompt on first signup: "You have X items of practice data.
    Merge into your account? [Yes, merge] [Start fresh]"
- **Depends on:** 4.1

### 4.3 Implement cloud sync (connect sync.js to backend)

- [x] **Files:** `src/utils/sync.js`, `src/utils/storage.js`
- **Tasks:**
  - Hook `sync.js` stubs to real Supabase/Firebase endpoints
  - Call `pushToCloud()` from `storage.setItem()` (debounced, 2s)
  - Call `pullFromCloud()` on login and app start
  - Handle merge conflicts (server-wins with user notification)
  - Offline support: queue writes when disconnected
- **Depends on:** 4.1, 3.2

### 4.4 Server-side API key proxy (optional but recommended)

- [ ] **New:** Backend endpoint or edge function
- **Issue:** API key in browser is always vulnerable to XSS.
- **Fix:** Create a serverless function (Vercel Edge or Supabase Edge Function)
  that accepts `{ imageBase64, letterName, letterChar, romanName, formDescription }`
  and forwards to OpenRouter. The user's API key is stored server-side
  (encrypted in DB, decrypted at function runtime). Client never sees it.
- **Depends on:** 4.1

---

## Rules for Agents

1. **Start from the top.** Pick the first unchecked box with no unchecked
   dependencies.
2. **Check the box only after the work is committed.** Don't pre-check.
3. **One item per commit.** Makes bisecting and review trivial.
4. **Run verification after each fix.** `npm run lint && npm run typecheck
&& npm run test:run && npm run build` must all pass. For Tauri changes,
   also `npm run tauri:check`.
5. **Update `BACKUP_KEYS` in `backup.js`** if you add a new localStorage key.
6. **Add locale keys to both `en` and `ar`** in `locales/index.js` if you add
   user-visible strings.
7. **Write tests** in `__tests__/` for new pure functions (sanitization,
   encryption, versioning). Not required for UI-only changes.
8. **If blocked,** leave the item unchecked, add a comment below it explaining
   the blocker, and move to the next unblocked item.
9. **Phase 2 items marked `[PARALLEL]`** can be done simultaneously by
   different agents — they touch different files.

---

## Tracking

| Phase                   | Items  | Completed |
| ----------------------- | ------ | --------- |
| 1 — Blockers            | 4      | 4         |
| 2 — Hardening           | 6      | 3         |
| 3 — Sync Foundation     | 3      | 3         |
| 4 — Auth Implementation | 4      | 3         |
| **Total**               | **17** | **16**    |

**Last updated:** 2026-07-25
