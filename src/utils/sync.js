/**
 * Sync utility — pushes / pulls learning data between localStorage and
 * the Supabase `user_data` table via the anon (RLS-enforced) client.
 *
 * Design notes:
 * - ALL sync operations are serialized through a module-level promise queue
 *   (`enqueue`) so the debounced auto-push, reconnect flush, and sign-in
 *   initial sync can never interleave and blind-overwrite each other.
 * - Push is an unconditional per-key upsert; pull applies remote values only
 *   when `remote.version > local._v`. Whole-blob versioning cannot merge
 *   concurrent edits from two active devices — last writer wins. Pull-before
 *   -push on sign-in / reconnect keeps that window small in practice.
 * - Scalar settings (app_locale, app_theme, ...) are stored as jsonb strings,
 *   NOT force-parsed — JSON.parse on a bare token like `en` throws, and the
 *   old `catch { parsed = {} }` silently destroyed them in the cloud.
 * - Scalar keys carry no `_v`, so `getVersion` is 0 locally and remote always
 *   wins for them on pull. Accepted: last-puller-wins for preferences.
 */

import { getItem, setItem, removeItem, notifyExternalWrite } from './storage.js';
import { getSupabase } from './supabase.js';
import { BACKUP_KEYS, sanitizeString } from './backup.js';

const LAST_SYNC_KEY = '_lastSyncTime';
const OFFLINE_DIRTY_KEY = '_syncDirty';
const SYNC_USER_KEY = 'sync_last_user_id';

// Keys that represent actual learning data (vs. UI preferences) — used to
// decide whether an account switch on a shared device needs a merge prompt.
const LEARNING_KEYS = [
  'arabic_progress',
  'arabic_feedback_history',
  'arabic_practice_dates',
  'arabic_freezes',
  'arabic_xp',
  'arabic_achievements',
  'arabic_decks',
];

// ─── Serialization queue ─────────────────────────────────
// Every cloud operation chains onto this promise. A failure never poisons
// the queue; callers still see the rejection via the returned promise.

let _queue = Promise.resolve();

function enqueue(fn) {
  const run = _queue.then(fn, fn);
  _queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// The user id whose initial pull→push has completed in this session. The
// debounced auto-push stays gated until this matches the current user, so a
// scheduled push can never race the sign-in pull and clobber newer cloud
// data with stale local data.
let _syncedUserId = null;

export function isInitialSyncDone(userId) {
  return _syncedUserId !== null && _syncedUserId === userId;
}

export function resetInitialSync() {
  _syncedUserId = null;
}

// ─── Helpers ─────────────────────────────────────────────

function getVersion(raw) {
  if (typeof raw !== 'string') return 0;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed._v === 'number' ? parsed._v : 0;
  } catch {
    return 0;
  }
}

async function getUserId(supabase) {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.user?.id ?? null;
}

// ─── Push / pull ─────────────────────────────────────────

/**
 * Push all local data to Supabase for the authenticated user.
 * Upserts each key with its current value and version.
 * On failure, flags the offline dirty marker so a later flush retries.
 * Returns the number of keys pushed (0 on failure).
 */
export async function pushToCloud() {
  const supabase = getSupabase();
  const userId = await getUserId(supabase);
  if (!userId) return 0;

  const now = new Date().toISOString();
  const rows = [];
  for (const key of BACKUP_KEYS) {
    const raw = getItem(key);
    if (raw === null) continue;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      // Plain-string scalar (app_locale, app_theme, brush_pack, ...).
      // Store it as a jsonb string so pull can restore it verbatim —
      // the old `parsed = {}` fallback corrupted these to empty objects.
      value = raw;
    }
    rows.push({
      user_id: userId,
      key,
      value,
      version: getVersion(raw) || 1,
      updated_at: now,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from('user_data').upsert(rows, {
    onConflict: 'user_id,key',
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[sync] push failed:', error?.message || error);
    markDirty();
    return 0;
  }

  clearDirty();
  setLastSyncTime(now);
  return rows.length;
}

/**
 * Pull remote data from Supabase and merge into localStorage.
 * Remote-wins on version compare (remote.version > local._v).
 * Every applied key fires a synthetic `storage` event so the data modules'
 * in-memory caches invalidate — without this, the next local save() would
 * write from a stale cache and clobber everything the pull just merged.
 * Returns { ok, pulled, applied, skipped }.
 */
export async function pullFromCloud() {
  const empty = { ok: false, pulled: 0, applied: 0, skipped: 0 };
  const supabase = getSupabase();
  const userId = await getUserId(supabase);
  if (!userId) return empty;

  const { data: rows, error } = await supabase
    .from('user_data')
    .select('key, value, version')
    .eq('user_id', userId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[sync] pull failed:', error?.message || error);
    return empty;
  }

  let applied = 0;
  let skipped = 0;

  for (const row of rows || []) {
    if (!BACKUP_KEYS.includes(row.key)) continue;
    const localRaw = getItem(row.key);
    const localVersion = localRaw === null ? 0 : getVersion(localRaw);
    const remoteVersion = row.version || 0;

    if (remoteVersion > localVersion) {
      // jsonb scalars come back as JS strings — restore them verbatim;
      // objects/booleans/numbers round-trip through JSON.stringify.
      const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
      setItem(row.key, sanitizeString(raw));
      notifyExternalWrite(row.key);
      applied++;
    } else {
      skipped++;
    }
  }

  setLastSyncTime(new Date().toISOString());
  return { ok: true, pulled: (rows || []).length, applied, skipped };
}

// ─── Orchestration ───────────────────────────────────────

/** Debounced auto-push entry point — serialized behind any in-flight sync. */
export function syncNow() {
  return enqueue(() => pushToCloud());
}

/**
 * Full sign-in sync, serialized: pull remote into local, then (optionally)
 * push the merged result back. Skipping the push leg is how the
 * "discard local data" account-switch path avoids uploading the previous
 * account's progress into the new account.
 *
 * If the pull fails (offline, transient error), the push is skipped (a
 * blind push could overwrite newer cloud data), the dirty flag is set, and
 * `_syncedUserId` stays unset so callers know to retry the full sync on
 * reconnect instead of a bare push.
 */
export function initialSync(userId, { pushLocal = true } = {}) {
  return enqueue(async () => {
    const res = await pullFromCloud();
    if (!res.ok) {
      markDirty();
      return res;
    }
    if (pushLocal) await pushToCloud();
    _syncedUserId = userId;
    setLastSyncUserId(userId);
    return res;
  });
}

/**
 * Delete every cloud row for the current user (GDPR right-to-deletion
 * companion to the local wipe). Requires the DELETE RLS policy on
 * user_data. Returns true on success; false when signed out or on error
 * (offline wipe leaves cloud rows — they will re-apply on next sign-in;
 * the user should wipe again while online to fully erase).
 */
export async function deleteCloudData() {
  const supabase = getSupabase();
  const userId = await getUserId(supabase);
  if (!userId) return false;
  const { error } = await supabase.from('user_data').delete().eq('user_id', userId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[sync] cloud delete failed:', error?.message || error);
    return false;
  }
  return true;
}

// ─── Account-switch detection ────────────────────────────

export function getLastSyncUserId() {
  return getItem(SYNC_USER_KEY);
}

export function setLastSyncUserId(userId) {
  setItem(SYNC_USER_KEY, userId);
}

/** True when this device holds learning data worth prompting about. */
export function hasLocalLearningData() {
  return LEARNING_KEYS.some(k => getItem(k) !== null);
}

/**
 * Remove all syncable local data (account-switch "discard local" path).
 * Notifies each module cache so the UI drops the old data immediately.
 */
export function clearSyncableData() {
  for (const key of BACKUP_KEYS) {
    removeItem(key);
    notifyExternalWrite(key);
  }
}

// ─── Bookkeeping ─────────────────────────────────────────

export function getLastSyncTime() {
  return getItem(LAST_SYNC_KEY);
}

export function setLastSyncTime(date) {
  setItem(LAST_SYNC_KEY, date);
}

export function markDirty() {
  sessionStorage.setItem(OFFLINE_DIRTY_KEY, '1');
}

export function isDirty() {
  return sessionStorage.getItem(OFFLINE_DIRTY_KEY) === '1';
}

export function clearDirty() {
  sessionStorage.removeItem(OFFLINE_DIRTY_KEY);
}
