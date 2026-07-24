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
