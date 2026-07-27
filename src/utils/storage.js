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

let _changeListeners = [];

export function onChange(fn) {
  _changeListeners.push(fn);
  return () => {
    _changeListeners = _changeListeners.filter(f => f !== fn);
  };
}

function notifyChange(key, value) {
  for (const fn of _changeListeners) {
    try {
      fn(key, value);
    } catch {
      /* noop */
    }
  }
}

export function setItem(key, value) {
  localStorage.setItem(key, value);
  if (isTauri && _hydrated && _cache !== null) {
    _cache[key] = value;
    ensureStore().then(s => s.set(key, value));
  }
  notifyChange(key, value);
}

export function removeItem(key) {
  localStorage.removeItem(key);
  if (isTauri && _hydrated && _cache !== null) {
    delete _cache[key];
    ensureStore().then(s => s.delete(key));
  }
  notifyChange(key, null);
}

/**
 * Notify same-tab listeners that a key was written outside the normal
 * setItem/removeItem flow (e.g. a cloud pull in sync.js). The data modules
 * (progress.js, history.js, analytics.js, freezes.js, xp.js, decks.js) hold
 * parsed JSON in module-level caches and only invalidate them on the
 * cross-tab `storage` event — which never fires in the tab that made the
 * write. Dispatching a synthetic `storage` event reuses those exact
 * listeners, so a cloud merge takes effect instead of being clobbered by
 * the next save() from a stale cache.
 */
export function notifyExternalWrite(key) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  } catch {
    /* noop — StorageEvent constructor unsupported */
  }
}
