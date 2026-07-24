/**
 * Analytics utilities for streak tracking, score distribution, heatmaps,
 * weakness analysis, and progress-over-time computation.
 *
 * Reads from arabic_progress and arabic_practice_dates (new localStorage key).
 *
 * All date math uses LOCAL calendar days. `new Date("YYYY-MM-DD")` parses as
 * UTC midnight, so mixing that with `.getFullYear()/getMonth()/getDate()`
 * (which read local components) produces off-by-one days in every timezone
 * west of UTC. Use `parseLocalDate()` / `addDaysLocal()` instead.
 */

import { hasFreezeAvailable, consumeFreeze, getFrozenDates } from './freezes.js';
import { getItem, setItem } from './storage.js';

const DATES_KEY = 'arabic_practice_dates';

// ─── In-memory cache ─────────────────────────────────────
// The stats tab calls loadDates() 3+ times per render; cache the parsed
// object and invalidate on same-tab writes and cross-tab `storage` events.

let datesCache = null;

// ─── localStorage helpers ─────────────────────────────────

function loadDates() {
  if (datesCache !== null) return datesCache;
  try {
    datesCache = JSON.parse(getItem(DATES_KEY) || '{}');
  } catch {
    datesCache = {};
  }
  return datesCache;
}

function saveDates(data) {
  datesCache = data;
  setItem(DATES_KEY, JSON.stringify(data));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DATES_KEY) datesCache = null;
  });
}

// ─── Local-date helpers ───────────────────────────────────

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysLocal(dateStr, days) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocal(d);
}

// ─── Public API ──────────────────────────────────────────

/**
 * Record one completed AI-feedback session on today's date.
 * Increments the per-day `sessions` counter.
 * Called from progress.markPracticed (i.e. after a scored AI response).
 */
export function recordPracticeDate() {
  const data = loadDates();
  const today = todayLocal();
  if (!data[today]) data[today] = { sessions: 0 };
  data[today].sessions += 1;
  saveDates(data);
  return data;
}

/**
 * Mark today as an active practice day (idempotent; no session increment).
 * Called whenever the user actually draws, regardless of mode or AI key.
 * This is what powers the streak counter — so words-mode and no-key users
 * who never invoke AI feedback still accrue daily streaks.
 * Returns true if today was newly added (caller can bump progressVersion
 * to refresh Stats-tab memoized derivations).
 */
export function markDayActive() {
  const data = loadDates();
  const today = todayLocal();
  if (data[today]) return false;
  data[today] = { sessions: 0 };
  saveDates(data);
  // Reconcile freezes now that today's practice is recorded — this is the
  // single write-time trigger that consumes freezes for one-day gaps.
  reconcileFreezes();
  return true;
}

/**
 * Walk the practice history and consume one freeze per month for any
 * one-day gap between consecutive practice days. Idempotent — re-runs
 * (React StrictMode, memo recompute) don't double-consume.
 *
 * This is the ONLY place freezes are consumed, and it runs at practice
 * time (via markDayActive), never at view time. Previously getStreaks()
 * consumed freezes as a side effect of the Stats-tab useMemo, which
 * meant merely opening the Stats page spent your monthly freeze.
 */
function reconcileFreezes() {
  const data = loadDates();
  const dates = Object.keys(data).sort();
  if (dates.length < 2) return;

  const frozenSet = new Set(getFrozenDates());

  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const curr = dates[i];
    const expected = addDaysLocal(prev, 1);
    if (curr === expected) continue; // consecutive, no gap

    // Gap between prev and curr. Only a one-day gap is bridgeable.
    const gapDay = addDaysLocal(prev, 1);
    const dayAfterGap = addDaysLocal(gapDay, 1);
    if (dayAfterGap !== curr || frozenSet.has(gapDay)) continue;

    const monthStr = gapDay.slice(0, 7);
    if (hasFreezeAvailable(monthStr)) {
      consumeFreeze(gapDay);
      frozenSet.add(gapDay);
    }
  }
}

/** Get { current: number, longest: number } streaks (both in local-calendar days). */
export function getStreaks() {
  const data = loadDates();
  const frozenDates = getFrozenDates();
  const practiceSet = new Set(Object.keys(data));
  const frozenSet = new Set(frozenDates);
  const merged = new Set([...practiceSet, ...frozenSet]);

  if (merged.size === 0) return { current: 0, longest: 0 };

  const today = todayLocal();
  const yesterday = addDaysLocal(today, -1);

  // ── Current streak: walk backwards from today (or yesterday, if the
  // user hasn't practiced yet today but did yesterday, so we don't
  // penalize them for being mid-day). Gaps are bridged only by frozen
  // dates already persisted by reconcileFreezes() at practice time —
  // getStreaks is a pure read with no side effects.
  let current = 0;
  let anchor = null;
  if (merged.has(today)) {
    anchor = today;
  } else if (merged.has(yesterday)) {
    anchor = yesterday;
  }

  if (anchor) {
    let cursor = anchor;
    for (;;) {
      if (merged.has(cursor)) {
        current++;
        cursor = addDaysLocal(cursor, -1);
      } else {
        break;
      }
    }
  }

  // ── Longest streak: sort all active days (practice + frozen) ascending,
  // track runs. Frozen days count toward longest too, since the streak
  // was preserved through them.
  const sorted = [...merged].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const date of sorted) {
    if (prev === null) {
      run = 1;
    } else {
      const expected = addDaysLocal(prev, 1);
      run = date === expected ? run + 1 : 1;
    }
    if (run > longest) longest = run;
    prev = date;
  }

  return { current, longest };
}

/** Get count of AI score (1-5) distribution from progress data. */
export function getScoreDistribution(progress) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const letterData of Object.values(progress)) {
    for (const formData of Object.values(letterData)) {
      if (formData.score && dist[formData.score] !== undefined) {
        dist[formData.score]++;
      }
    }
  }
  return dist;
}

/**
 * Get weakness analysis: lowest-scoring letter+forms.
 * Returns array sorted by avg score ascending, capped at 5 items.
 */
export function getWeaknesses(LETTERS, progress) {
  const items = [];
  for (const letter of LETTERS) {
    for (const [formKey, char] of Object.entries(letter.forms)) {
      const score = progress[letter.name]?.[formKey]?.score ?? null;
      if (score !== null) {
        items.push({
          letterName: letter.name,
          letterChar: char,
          formKey,
          score,
        });
      }
    }
  }
  items.sort((a, b) => a.score - b.score);
  return items.slice(0, 5);
}

/**
 * Get practice heatmap data: practiceCount per letter name.
 */
export function getPracticeHeatmap(LETTERS, progress) {
  const heatmap = {};
  for (const letter of LETTERS) {
    let total = 0;
    for (const formKey of Object.keys(letter.forms)) {
      total += progress[letter.name]?.[formKey]?.practiceCount || 0;
    }
    heatmap[letter.name] = total;
  }
  const max = Math.max(1, ...Object.values(heatmap));
  return { heatmap, max };
}

/**
 * Practice activity over the last N local-calendar days.
 * Returns [{ date: 'YYYY-MM-DD', label: 'MM-DD', sessions: n, practiced: bool }].
 *
 * This reports real historical practice (from arabic_practice_dates) rather
 * than projecting today's completion count backwards.
 */
export function getProgressOverTime(_LETTERS, _progress, days = 30) {
  const data = loadDates();
  const frozenSet = new Set(getFrozenDates());
  const today = todayLocal();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = addDaysLocal(today, -i);
    const [, m, d] = dateStr.split('-');
    const entry = data[dateStr];
    const frozen = frozenSet.has(dateStr);
    result.push({
      date: dateStr,
      label: `${m}-${d}`,
      sessions: entry?.sessions || 0,
      practiced: !!entry || frozen,
      frozen,
    });
  }
  return result;
}

/** Total number of practice sessions recorded across all dates. */
export function getTotalSessions() {
  const data = loadDates();
  return Object.values(data).reduce((sum, d) => sum + (d.sessions || 0), 0);
}
