import { isTauri } from './env';
import { getItem, setItem, removeItem } from './storage';

const KEY_NAME = 'openrouter_key';
const SESSION_KEY = 'openrouter_enc_key';
const VAULT_NAME = 'arabic-script-vault';
const SECRET_NAME = 'api-key';

const IDB_NAME = 'arabic-handwriting-secure';
const IDB_STORE = 'keystore';
const IDB_KEY_ID = 'openrouter-aes-gcm';

let _encoder = null;
let _decoder = null;

function encoder() {
  if (!_encoder) _encoder = new TextEncoder();
  return _encoder;
}

function decoder() {
  if (!_decoder) _decoder = new TextDecoder();
  return _decoder;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ─── Web key management ──────────────────────────────────
// The API key is AES-GCM encrypted at rest. The AES key lives in IndexedDB
// as a NON-EXTRACTABLE CryptoKey: it persists across sessions (the old
// sessionStorage JWK died on tab close, orphaning the ciphertext and
// forcing key re-entry every session) and its raw bytes can never be read
// back out through the Web Crypto API. An XSS payload running full JS in
// the page could still call decrypt through these same functions — client
// side at-rest encryption can't defend against that — but a casual dump of
// storage no longer yields the key or the plaintext.
//
// Fallback: if IndexedDB is unavailable (some private-browsing modes), use
// a per-session key in sessionStorage (previous behavior — ciphertext
// becomes undecryptable after the tab closes, key must be re-entered).

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, id, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(value, id);
  });
}

function idbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).delete(id);
  });
}

async function getOrCreatePersistentKey() {
  const db = await openIdb();
  let key = await idbGet(db, IDB_KEY_ID);
  if (!key) {
    key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable — raw bytes never leave the crypto module
      ['encrypt', 'decrypt'],
    );
    await idbPut(db, IDB_KEY_ID, key);
  }
  return key;
}

async function createSessionKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(jwk));
  return key;
}

async function getSessionKey() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw);
    return await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/** Persistent key when IDB works, per-session fallback otherwise. */
async function getOrCreateKey() {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await getOrCreatePersistentKey();
    } catch {
      /* fall through to session key */
    }
  }
  return (await getSessionKey()) ?? createSessionKey();
}

async function encryptWeb(plain) {
  const aesKey = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder().encode(plain),
  );
  const blob = JSON.stringify({
    iv: bytesToHex(iv),
    data: bytesToHex(new Uint8Array(ciphertext)),
  });
  setItem(KEY_NAME, blob);
}

async function decryptWeb() {
  const stored = getItem(KEY_NAME);
  if (!stored) return '';

  if (stored.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return '';
    }
    const { iv, data } = parsed;
    // Try every key we might have used: the legacy per-session JWK (same
    // tab that wrote it) and the persistent IndexedDB key.
    const candidates = [];
    const sessionKey = await getSessionKey();
    if (sessionKey) candidates.push(sessionKey);
    if (typeof indexedDB !== 'undefined') {
      try {
        candidates.push(await getOrCreatePersistentKey());
      } catch {
        /* IDB unavailable — session key was the only hope */
      }
    }
    for (const key of candidates) {
      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: hexToBytes(iv) },
          key,
          hexToBytes(data),
        );
        return decoder().decode(decrypted);
      } catch {
        /* wrong key — try the next candidate */
      }
    }
    return '';
  }

  // Legacy plaintext key — migrate transparently in the background
  encryptWeb(stored).catch(() => {});
  return stored;
}

export async function getApiKey() {
  if (!isTauri) return decryptWeb();
  try {
    const { Client } = await import('@tauri-apps/plugin-stronghold');
    const client = new Client(VAULT_NAME);
    const store = client.getStore();
    const payload = await store.get(SECRET_NAME);
    if (!payload) return '';
    return decoder().decode(payload);
  } catch {
    return '';
  }
}

export async function setApiKey(key) {
  if (!isTauri) {
    await encryptWeb(key);
    return;
  }
  const { Client } = await import('@tauri-apps/plugin-stronghold');
  const client = new Client(VAULT_NAME);
  const store = client.getStore();
  await store.insert(SECRET_NAME, encoder().encode(key));
  await client.save();
}

export async function removeApiKey() {
  if (!isTauri) {
    removeItem(KEY_NAME);
    sessionStorage.removeItem(SESSION_KEY);
    if (typeof indexedDB !== 'undefined') {
      try {
        idbDelete(await openIdb(), IDB_KEY_ID);
      } catch {
        /* noop */
      }
    }
    return;
  }
  const { Client } = await import('@tauri-apps/plugin-stronghold');
  const client = new Client(VAULT_NAME);
  const store = client.getStore();
  await store.remove(SECRET_NAME);
  await client.save();
}
