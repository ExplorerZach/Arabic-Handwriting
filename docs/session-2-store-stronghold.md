# Session 2 — Store Plugin + Stronghold Plugin

(Tasks: #2 Storage persistence, #3 Encrypted API key)

**This is the heaviest session.** It touches ~15 files across the codebase.

---

## Project context

- React 19 + Vite 8 PWA deployed to Vercel (writearabic.app)
- Tauri 2 added as dual build target (single codebase, web + desktop)
- `src-tauri/` already compiles (`npm run tauri dev` works)
- Runtime detection: `src/utils/env.js` exports `isTauri` (checks `window.__TAURI_INTERNALS__`)
- `npm run build` = web; `npm run tauri build` = native binaries
- Read AGENTS.md at root for conventions before starting
- No data carry-over between web and Tauri localStorage (separate sandboxes by design)
- **All localStorage keys are documented in AGENTS.md — do NOT rename any**

## Key files

- `src/App.jsx` — uses localStorage for openrouter_key, app_locale, app_darkMode
- `src/main.jsx` — entry point, call hydrate here
- `src/utils/env.js` — exports `isTauri`
- `src-tauri/Cargo.toml` — Rust deps
- `src-tauri/src/lib.rs` — plugin registration
- `src-tauri/capabilities/default.json` — plugin permissions
- `src/locales/index.js` — UI strings (add keys to both en and ar)

**Every file that uses localStorage directly (use grep to find all):**
- `src/App.jsx`
- `src/components/PracticeView.jsx`
- `src/components/SettingsPanel.jsx`
- `src/utils/progress.js`
- `src/utils/history.js`
- `src/utils/decks.js`
- `src/utils/api.js`
- `src/utils/drawing.js`
- `src/utils/xp.js`
- `src/utils/analytics.js`
- `src/utils/freezes.js`
- `src/utils/backup.js`
- `src/utils/dailyGoal.js`
- `src/utils/sound.js`

---

## Task A — Tauri Store plugin

Create a unified storage layer that uses Tauri Store on desktop and localStorage on web. All existing code continues to use synchronous reads — the Store acts as a transparent persistence backend.

### Step 1 — Install and register plugin

```bash
npm run tauri add store
```

This auto-handles Cargo.toml, npm install, and capabilities. Verify `"store:default"` appears in `capabilities/default.json`.

Add to `src-tauri/src/lib.rs` inside `tauri::Builder::default()` (before `.run()`):

```rust
.plugin(tauri_plugin_store::Builder::default().build())
```

### Step 2 — Create `src/utils/storage.js`

```js
import { isTauri } from './env';

let _store = null;
let _storeReady = false;

async function ensureStore() {
  if (!_store && isTauri) {
    const { load } = await import('@tauri-apps/plugin-store');
    _store = await load('app-data.json', { autoSave: 100 });
  }
  return _store;
}

// In-memory cache for synchronous reads in Tauri
let _cache = null;
let _hydrated = false;

export async function hydrate() {
  if (!isTauri) return;
  const store = await ensureStore();
  _cache = {};
  const entries = await store.entries();
  for (const [k, v] of entries) {
    _cache[k] = v;
  }
  // One-time: pull any existing localStorage data into Store on first run
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (_cache[k] === undefined) {
      _cache[k] = localStorage.getItem(k);
      await store.set(k, localStorage.getItem(k));
    }
  }
  _hydrated = true;
}

export function getItem(key) {
  if (isTauri && _hydrated && _cache !== null) {
    return _cache[key] ?? null;
  }
  return localStorage.getItem(key);
}

export function setItem(key, value) {
  localStorage.setItem(key, value);
  if (isTauri && _hydrated && _cache !== null) {
    _cache[key] = value;
    ensureStore().then(s => s.set(key, value));
  }
}

export function removeItem(key) {
  localStorage.removeItem(key);
  if (isTauri && _hydrated && _cache !== null) {
    delete _cache[key];
    ensureStore().then(s => s.delete(key));
  }
}
```

### Step 3 — Call hydrate early

In `src/main.jsx`, before `createRoot(...).render(...)`, call `hydrate()` and wait for it:

```js
import { hydrate } from './utils/storage';

hydrate().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
```

Move the existing render call inside the `.then()` block (remove the old bare `createRoot` call above it).

### Step 4 — Replace all localStorage calls

Use grep to find every `localStorage.getItem`, `localStorage.setItem`, `localStorage.removeItem` across `src/`. Replace them all:

- `localStorage.getItem('key')` → `getItem('key')`
- `localStorage.setItem('key', val)` → `setItem('key', val)`
- `localStorage.removeItem('key')` → `removeItem('key')`

Import `{ getItem, setItem, removeItem }` from the correct relative path in each file:
- From `src/utils/*.js` → `'./storage.js'` (same dir)
- From `src/App.jsx` → `'./utils/storage'`
- From `src/components/*.jsx` → `'../utils/storage'`

Be thorough — use `replaceAll` in each file. Double-check `src/utils/backup.js` (it reads ALL localStorage keys via `localStorage.getItem` in a loop) and `src/utils/drawing.js` (reads `brushScale`).

### Step 5 — Verify

```bash
npm run build        # web — must exit zero
cd src-tauri; cargo check; cd ..  # Rust — must exit zero
```

---

## Task B — Tauri Stronghold plugin (encrypt API key)

### Step 1 — Install and register

```bash
npm run tauri add stronghold
```

Verify `"stronghold:default"` in capabilities. Add to `src-tauri/src/lib.rs`:

```rust
.plugin(tauri_plugin_stronghold::Builder::default().build())
```

### Step 2 — Create `src/utils/secureStorage.js`

```js
import { isTauri } from './env';
import { getItem, setItem, removeItem } from './storage';

const KEY_NAME = 'openrouter_key';
const VAULT_NAME = 'arabic-script-vault';
const SECRET_NAME = 'api-key';

export async function getApiKey() {
  if (!isTauri) return getItem(KEY_NAME) || '';
  try {
    const { Client } = await import('@tauri-apps/plugin-stronghold');
    const client = new Client(VAULT_NAME);
    const store = client.getStore();
    const payload = await store.get(SECRET_NAME);
    if (!payload) return '';
    return new TextDecoder().decode(payload);
  } catch {
    return '';
  }
}

export async function setApiKey(key) {
  if (!isTauri) { setItem(KEY_NAME, key); return; }
  const { Client } = await import('@tauri-apps/plugin-stronghold');
  const client = new Client(VAULT_NAME);
  const store = client.getStore();
  await store.insert(SECRET_NAME, new TextEncoder().encode(key));
  await client.save();
}

export async function removeApiKey() {
  if (!isTauri) { removeItem(KEY_NAME); return; }
  const { Client } = await import('@tauri-apps/plugin-stronghold');
  const client = new Client(VAULT_NAME);
  const store = client.getStore();
  await store.remove(SECRET_NAME);
  await client.save();
}
```

### Step 3 — Update `src/App.jsx`

Import from `secureStorage`:

```js
import { getApiKey, setApiKey, removeApiKey } from './utils/secureStorage';
```

Change the `apiKey` state init to empty string + useEffect:

```js
const [apiKey, setApiKeyState] = useState('');

useEffect(() => {
  getApiKey().then(setApiKeyState);
}, []);
```

Update handlers:

```js
const handleSetKey = (key) => {
  setApiKey(key).then(() => setApiKeyState(key));
};
const handleClearKey = () => {
  removeApiKey().then(() => setApiKeyState(''));
};
```

Note: `setApiKeyState` is the React state setter (renamed from `setApiKey` to avoid name collision with the secureStorage export). Rename all uses of `setApiKey` in App.jsx accordingly: pass `setApiKeyState` as the `onSetKey` prop (the prop name stays the same), and update the state setter variable name.

### Step 4 — Verify

```bash
npm run build        # web — must exit zero
cd src-tauri; cargo check; cd ..  # Rust — must exit zero
```
