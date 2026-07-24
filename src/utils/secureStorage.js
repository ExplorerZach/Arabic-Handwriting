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
