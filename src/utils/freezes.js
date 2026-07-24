/**
 * Streak freeze storage — persisted in localStorage under 'arabic_freezes'.
 *
 * Shape:
 * { frozenDates: ["YYYY-MM-DD", ...] }  // days a freeze was consumed to bridge
 *
 * One freeze per calendar month: a freeze is available for month `YYYY-MM`
 * if no frozen date in the list starts with that prefix. Use-it-or-lose-it:
 * at most one frozen day per month, never rolls over.
 */

import { getItem, setItem } from './storage.js';

const STORAGE_KEY = 'arabic_freezes';
const MIGRATION_KEY = 'arabic_freezes_v2';

// ─── In-memory cache ──────────────────────────────────────
// Match the pattern in progress.js / analytics.js: cache the parsed object,
// invalidate on write and on cross-tab `storage` events.

let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(getItem(STORAGE_KEY) || '{"frozenDates":[]}');
  } catch {
    cache = { frozenDates: [] };
  }
  if (!cache || !Array.isArray(cache.frozenDates)) cache = { frozenDates: [] };
  return cache;
}

function save(data) {
  cache = data;
  setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── One-time migration ───────────────────────────────────
// Older code consumed freezes inside getStreaks() (a read-only Stats-tab
// useMemo), so frozen dates were persisted merely by viewing the Stats
// page. Clear those view-consumed entries once; reconcileFreezes() in
// analytics.js re-establishes legitimate bridges on the next practice.
if (typeof window !== 'undefined') {
  if (!getItem(MIGRATION_KEY)) {
    setItem(STORAGE_KEY, JSON.stringify({ frozenDates: [] }));
    cache = { frozenDates: [] };
    setItem(MIGRATION_KEY, '1');
  }
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

// ─── Local-date helper ────────────────────────────────────
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Public API ───────────────────────────────────────────

/** True if no freeze has been consumed in the given month (YYYY-MM). */
export function hasFreezeAvailable(monthStr) {
  const { frozenDates } = load();
  return !frozenDates.some((d) => typeof d === 'string' && d.startsWith(monthStr));
}

/**
 * Consume one freeze for the given date's month. Idempotent: adding the same
 * date twice is a no-op so re-runs (React StrictMode, memo recompute) don't
 * double-consume.
 */
export function consumeFreeze(dateStr) {
  const data = load();
  if (!data.frozenDates.includes(dateStr)) {
    data.frozenDates.push(dateStr);
    save(data);
  }
}

/** Read-only access to the frozen dates (defensive copy). */
export function getFrozenDates() {
  return [...load().frozenDates];
}

/**
 * Current-month freeze status for the Stats indicator.
 * Returns { availableThisMonth: bool, usedThisMonth: number, frozenDates: string[] }.
 */
export function getFreezeStatus() {
  const monthStr = todayLocal().slice(0, 7);
  const frozenDates = getFrozenDates();
  const usedThisMonth = frozenDates.filter(
    (d) => typeof d === 'string' && d.startsWith(monthStr)
  ).length;
  return {
    availableThisMonth: usedThisMonth === 0,
    usedThisMonth,
    frozenDates,
  };
}
