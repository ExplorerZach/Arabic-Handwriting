/**
 * Progress backup — export/import all client-side learning data as JSON.
 *
 * Everything in this app is localStorage-only with no backend, so a cleared
 * browser means total data loss. This lets a user download a JSON snapshot
 * and restore it later (or move it to another device).
 *
 * The API key (`openrouter_key`) is deliberately NOT exported: it's a secret
 * that shouldn't end up in a file the user emails to themselves or syncs to
 * cloud storage. Everything else (progress, feedback history, practice dates,
 * and UI preferences) is fair game.
 */

import { getItem, setItem, removeItem } from './storage.js';

// Keys included in a backup. Order is cosmetic. `openrouter_key` is excluded
// on purpose (see module comment).
export const BACKUP_KEYS = [
  'arabic_progress',
  'arabic_feedback_history',
  'arabic_practice_dates',
  'arabic_freezes',
  'arabic_freezes_v2',
  'arabic_xp',
  'arabic_achievements',
  'arabic_decks',
  'openrouter_model',
  'brushScale',
  'templateScale',
  'lessonMode',
  'app_locale',
  'app_darkMode',
  'app_theme',
  'brush_pack',
  'calligraphy_style',
  'daily_goal',
  'ai_consent',
  'reduce_motion',
  'high_contrast',
  'sound_enabled',
];

// Keys that are device/account-specific and must NOT be exported (a sync
// timestamp or last-user-id is meaningless on another machine), but SHOULD be
// removed by a full wipe. `_lastSyncTime`/`_syncDirty`/`sync_last_user_id`
// come from sync.js; `last_daily_reminder` from notifications.js.
const WIPE_ONLY_KEYS = ['_lastSyncTime', '_syncDirty', 'sync_last_user_id', 'last_daily_reminder'];

const FORMAT = 'arabic-handwriting-backup';
const VERSION = 1;

/** Build the backup object from current localStorage. */
export function buildBackup() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const raw = getItem(key);
    if (raw === null) continue;
    data[key] = raw;
  }
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Trigger a download of the current progress as a timestamped JSON file. */
export function exportBackup() {
  const backup = buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const a = document.createElement('a');
  a.href = url;
  a.download = `arabic-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Strip HTML tags and common event-handler patterns from a string so that
 * user-controlled values from a malicious backup file cannot inject XSS.
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Validate and apply a parsed backup object to localStorage.
 *
 * Returns { ok: true, imported: N } on success, or { ok: false, error }
 * on a malformed file. Caller is responsible for reloading the page so the
 * in-memory caches (progress.js / history.js / analytics.js) re-read fresh
 * data — far simpler and more robust than threading cache-invalidation
 * across every module.
 */
export function applyBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'invalid' };
  }
  if (parsed.format !== FORMAT || typeof parsed.data !== 'object' || parsed.data === null) {
    return { ok: false, error: 'format' };
  }
  let imported = 0;
  for (const key of BACKUP_KEYS) {
    const val = parsed.data[key];
    if (typeof val !== 'string') continue;
    setItem(key, sanitizeString(val));
    imported++;
  }
  return { ok: true, imported };
}

/** Wipe all app data from storage (GDPR Art. 17 right to deletion). */
export function wipeAllData() {
  let removed = 0;
  for (const key of [...BACKUP_KEYS, ...WIPE_ONLY_KEYS]) {
    removeItem(key);
    removed++;
  }
  try {
    sessionStorage.removeItem('openrouter_enc_key');
  } catch {
    /* noop */
  }
  return removed;
}

/** Read a File (from an <input type=file>) and apply it as a backup. */
export async function importBackupFile(file) {
  let text;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'read' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'parse' };
  }
  return applyBackup(parsed);
}
