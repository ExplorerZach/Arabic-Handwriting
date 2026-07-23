/**
 * Progress tracking — persisted in localStorage under 'arabic_progress'.
 *
 * Shape:
 * {
 *   [letterName]: {          // e.g. "Alef"
 *     [formKey]: {           // e.g. "isolated"
 *       practiced: true,     // has the user drawn on this form?
 *       practiceCount: 3,    // total times practiced
 *       lastPracticed: null, // YYYY-MM-DD of most recent drawing (non-AI path)
 *       score: 4,            // latest AI score 1–5
 *       // SM-2 spaced repetition fields (AI path only):
 *       interval: 1,          // days until next review (1 = tomorrow)
 *       easeFactor: 2.5,     // SM-2 ease factor (min 1.3)
 *       lastReview: null,    // YYYY-MM-DD (local date) of last AI review, or null
 *       failedSinceLastPass: true, // transient flag — item stays due same-session on SM-2 fail
 *       snoozedUntil: null,  // YYYY-MM-DD — hides item from due list until this date passes
 *     }
 *   }
 * }
 */

import { recordPracticeDate } from './analytics.js';

const STORAGE_KEY = 'arabic_progress';

// Thresholds for non-AI scheduling fallbacks
const RECENCY_DAYS = 3;        // option 4: days between practices before re-surfacing
const GRADUATION_THRESHOLD = 5; // option 5: drawings before interval starts growing
const GRADUATION_STEP = 3;     // option 5: days added per graduation tier

// Days a snoozed letter+form stays hidden from the due list.
export const SNOOZE_DAYS = 3;

// ─── In-memory cache ──────────────────────────────────────
// localStorage.getItem + JSON.parse is cheap individually but called
// dozens of times per render. Cache the parsed object and invalidate
// on write; re-sync via the `storage` event for other-tab edits.

let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    cache = {};
  }
  return cache;
}

function save(data) {
  cache = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

// ─── Date helpers ─────────────────────────────────────────
// SM-2 scheduling uses local calendar dates (not UTC) so a review due
// "today" always surfaces on the user's local Wall-clock day.

export function todayLocal() {
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

function addDaysLocal(dateStr, days) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── One-time migration for renamed letters ──────────────
// See src/data/letters.js: ح (pharyngeal Hāʾ) and ط (emphatic Ṭāʾ) used
// to collide with ه and ت under `Ha`/`Ta`. Progress written before the
// rename sits under the old names; copy it onto the new names so no
// user progress is lost. Copy both directions since we can't tell from
// storage which letter the practice belonged to — better to over-credit
// than to zero anyone out.
function migrate() {
  const data = load();
  let changed = false;
  if (data.Ha && !data.Hha) {
    data.Hha = JSON.parse(JSON.stringify(data.Ha));
    changed = true;
  }
  if (data.Ta && !data.Tta) {
    data.Tta = JSON.parse(JSON.stringify(data.Ta));
    changed = true;
  }
  if (changed) save(data);
}
migrate();

// ─── Public API ──────────────────────────────────────────

/** Mark a letter+form as practiced and increment the count. */
export function markPracticed(letterName, formKey) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  const entry = data[letterName][formKey] || { practiced: false, practiceCount: 0 };
  entry.practiced = true;
  entry.practiceCount = (entry.practiceCount || 0) + 1;
  entry.lastPracticed = todayLocal();
  data[letterName][formKey] = entry;
  save(data);
  recordPracticeDate();
  return data;
}

/** Get the full progress map. */
export function getProgress() {
  return load();
}

/**
 * Returns true if every form of a letter has been practiced at least once.
 * Pass the letter's formKeys array so non-joiners (2 forms) are handled correctly.
 */
export function isLetterComplete(letterName, formKeys) {
  const data = load();
  const letterData = data[letterName] || {};
  return formKeys.every((k) => letterData[k]?.practiced);
}

/** Returns true if any form of the letter has been practiced. */
export function isLetterStarted(letterName) {
  const data = load();
  const letterData = data[letterName] || {};
  return Object.values(letterData).some((v) => v?.practiced);
}

/** Count how many letters have been fully completed (batched — one load()). */
export function countCompleted(letters) {
  const data = load();
  return letters.filter((l) => {
    const letterData = data[l.name] || {};
    return Object.keys(l.forms).every((k) => letterData[k]?.practiced);
  }).length;
}

/**
 * Build a { [letterName]: { started, complete } } summary in one pass.
 * Used by the 28-button alphabet row to avoid 56 individual load() calls.
 */
export function getProgressSummary(letters) {
  const data = load();
  const summary = {};
  for (const l of letters) {
    const letterData = data[l.name] || {};
    const formKeys = Object.keys(l.forms);
    const started = formKeys.some((k) => letterData[k]?.practiced);
    const complete = formKeys.every((k) => letterData[k]?.practiced);
    summary[l.name] = { started, complete };
  }
  return summary;
}

/** Store an AI score (1–5) for a letter+form. Keeps the latest score. */
export function setScore(letterName, formKey, score) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  data[letterName][formKey].score = Math.max(1, Math.min(5, score));
  save(data);
  return data;
}

/** Get the stored score for a letter+form, or null if none. */
export function getScore(letterName, formKey) {
  const data = load();
  return data[letterName]?.[formKey]?.score ?? null;
}

/**
 * SM-2 spaced repetition algorithm.
 * Callers pass the raw AI score 1–5; we remap it to SM-2 quality 0–5 so
 * a score of 1 (unrecognizable) counts as a genuine failure (q=0) with
 * the harsher ease-factor penalty that implies. Returns the updated entry.
 *
 * On failure (q<3) we set a `failedSinceLastPass` flag so the item stays
 * due within the same session — classic SM-2 re-shows failed cards until
 * the user gets it right, rather than hiding them until tomorrow.
 */
export function updateSR(letterName, formKey, aiScore) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) {
    data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  }
  const entry = data[letterName][formKey];

  // Map AI score 1–5 to SM-2 quality 0–5:
  //   1 → 0 (complete fail)    2 → 2 (marginal)
  //   3 → 3 (pass)             4 → 4 (good)        5 → 5 (perfect)
  const clamped = Math.max(1, Math.min(5, aiScore));
  const q = clamped === 1 ? 0 : clamped;

  let { interval = 1, easeFactor = 2.5 } = entry;

  if (q < 3) {
    // Failed review — reset to short interval and flag for same-session retry
    interval = 1;
    entry.failedSinceLastPass = true;
  } else {
    // SM-2: first correct → 6 days, then grow by easeFactor
    if (interval <= 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    // Passed — clear any lingering failure flag from prior attempts today
    if (entry.failedSinceLastPass) delete entry.failedSinceLastPass;
  }

  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  entry.interval = interval;
  entry.easeFactor = easeFactor;
  entry.lastReview = todayLocal();

  save(data);
  return entry;
}

/**
 * Snooze a single letter+form so it drops out of the due list for a few
 * days without touching its SM-2 mastery data (interval/easeFactor/score/
 * lastReview are untouched — fully reversible, just hides it temporarily).
 */
export function snoozeDue(letterName, formKey, days = SNOOZE_DAYS) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) {
    data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  }
  data[letterName][formKey].snoozedUntil = addDaysLocal(todayLocal(), days);
  save(data);
  return data;
}

/**
 * Snooze every item in a due-items list (e.g. the whole "Due for Review"
 * queue) in a single load/save transaction.
 */
export function snoozeAllDue(dueItems, days = SNOOZE_DAYS) {
  const data = load();
  const until = addDaysLocal(todayLocal(), days);
  for (const { letterName, formKey } of dueItems) {
    if (!data[letterName]) data[letterName] = {};
    if (!data[letterName][formKey]) {
      data[letterName][formKey] = { practiced: false, practiceCount: 0 };
    }
    data[letterName][formKey].snoozedUntil = until;
  }
  save(data);
  return data;
}

/**
 * Returns an array of { letterName, letterChar, formKey } for all letter+form
 * combos that are due for review today (lastReview + interval <= today, or
 * never reviewed). Dates are compared in local calendar days.
 */
export function getDueLetters(LETTERS) {
  const data = load();
  const today = todayLocal();
  const due = [];

  for (const letter of LETTERS) {
    for (const [formKey] of Object.entries(letter.forms)) {
      const stored = data[letter.name]?.[formKey];
      if (!stored?.practiced) continue;

      // Snoozed items are hidden regardless of any other due condition
      // until their snooze period expires.
      if (stored.snoozedUntil && stored.snoozedUntil > today) continue;

      // Items the user failed earlier today stay due — classic SM-2
      // re-shows them until they pass.
      if (stored.failedSinceLastPass) {
        due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
        continue;
      }

      if (stored.lastReview) {
        // AI has scored this item — use SM-2 interval exclusively
        const nextReview = addDaysLocal(stored.lastReview, Math.max(1, stored.interval || 1));
        if (nextReview <= today) {
          due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
        }
      } else {
        // No AI score yet — apply non-AI fallbacks (options 4 & 5)
        const count = stored.practiceCount || 0;
        const lp = stored.lastPracticed;
        if (!lp) {
          // Practiced today for the first time — immediately due
          due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
        } else if (count >= GRADUATION_THRESHOLD) {
          // Option 5: interval grows with practice count
          const syntheticInterval = Math.floor(count / GRADUATION_THRESHOLD) * GRADUATION_STEP;
          const nextDue = addDaysLocal(lp, syntheticInterval);
          if (nextDue <= today) {
            due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
          }
        } else {
          // Option 4: simple recency — due again after RECENCY_DAYS
          const nextDue = addDaysLocal(lp, RECENCY_DAYS);
          if (nextDue <= today) {
            due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
          }
        }
      }
    }
  }

  return due;
}

/**
 * Was this letter+form reviewed on or before its due date? Called BEFORE
 * updateSR (which overwrites lastReview to today), so it sees the previous
 * review's due date. An item never reviewed (no lastReview) counts as
 * on-time — the first review is never "late". Used by the XP award path
 * to decide whether to grant the REVIEW_ON_TIME bonus.
 */
export function isReviewOnTime(letterName, formKey) {
  const data = load();
  const entry = data[letterName]?.[formKey];
  if (!entry || !entry.lastReview) return true;
  const interval = Math.max(1, entry.interval || 1);
  const dueDate = addDaysLocal(entry.lastReview, interval);
  return dueDate >= todayLocal();
}
