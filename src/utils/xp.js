/**
 * XP & levels — persisted in localStorage under 'arabic_xp'.
 *
 * Shape: { total: <number> }
 *
 * XP is awarded at the call sites in PracticeView (draw, AI score, review),
 * never inside progress.js — keeping progress storage decoupled from XP.
 * Level is derived from total XP via a quadratic curve:
 *   xpForLevel(L) = 50 * (L-1) * L   (cumulative XP to reach level L)
 * so each level costs 100*(L-1) more XP than the last
 * (L2 needs +100, L3 +200, L4 +300 …). With ~175 XP/day from 5 scored
 * practices, level 5 (~1000 XP) takes ~6 days, level 10 (~4500) ~26 days.
 *
 * Follows the same in-memory cache + storage-event pattern as freezes.js /
 * progress.js: localStorage.getItem + JSON.parse is cheap individually but
 * called many times per render, so cache and invalidate on write and on
 * cross-tab `storage` events.
 */

import { getItem, setItem } from './storage.js';

const STORAGE_KEY = 'arabic_xp';

// ─── In-memory cache ──────────────────────────────────────
let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    const parsed = JSON.parse(getItem(STORAGE_KEY) || '{"total":0}');
    cache = { total: Number(parsed?.total) || 0 };
  } catch {
    cache = { total: 0 };
  }
  return cache;
}

function save(data) {
  cache = data;
  setItem(STORAGE_KEY, JSON.stringify(data));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

// ─── Level curve ──────────────────────────────────────────
// Cumulative XP required to REACH level L (level 1 starts at 0 XP).
function xpForLevel(level) {
  return 50 * (level - 1) * level;
}

/**
 * Derive level info from a total XP value.
 * Returns { level, xpIntoLevel, xpForNextLevel, progressPct, totalXp }.
 *   level            — current level (>= 1)
 *   xpIntoLevel      — XP earned since reaching the current level
 *   xpForNextLevel   — XP needed to advance from current to next level
 *   progressPct      — 0..1 fraction toward the next level
 *   totalXp          — the input total (echoed for convenience)
 */
export function getLevelInfo(totalXp) {
  const total = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  while (xpForLevel(level + 1) <= total) level++;
  const xpBase = xpForLevel(level);
  const xpNext = xpForLevel(level + 1);
  const xpIntoLevel = total - xpBase;
  const xpForNextLevel = xpNext - xpBase;
  const progressPct = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0;
  return { level, xpIntoLevel, xpForNextLevel, progressPct, totalXp: total };
}

// ─── Public API ───────────────────────────────────────────

/** Current total XP (reads from cache). */
export function getXPTotal() {
  return load().total;
}

/**
 * Award XP and persist. Clamps to non-negative integers. Returns
 * { awarded, total } — `awarded` is 0 when nothing was gained, so callers
 * can skip showing a "+0 XP" toast for score-1 attempts.
 *
 * `reason` is an opaque string reserved for future analytics; not used today
 * but recorded in the call sites for readability.
 */
export function awardXP(amount, _reason) {
  const gain = Math.max(0, Math.floor(amount || 0));
  if (gain === 0) return { awarded: 0, total: load().total };
  const data = load();
  data.total += gain;
  save(data);
  return { awarded: gain, total: data.total };
}

// ─── Award table ──────────────────────────────────────────
// Centralized so the call sites in PracticeView stay readable and the
// numbers are tunable in one place.
export const XP_AWARDS = {
  PRACTICE: 10,                                // drew a letter/number/diacritic
  SCORE: { 1: 0, 2: 5, 3: 15, 4: 25, 5: 40 },  // AI score bonus (1..5)
  REVIEW_ON_TIME: 15,                          // reviewed a due item on its due date
  REVIEW_SELF: 10,                             // self-assessed review (no AI)
};
