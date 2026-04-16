/**
 * Progress tracking — persisted in localStorage under 'arabic_progress'.
 *
 * Shape:
 * {
 *   [letterName]: {          // e.g. "Alef"
 *     [formKey]: {           // e.g. "isolated"
 *       practiced: true,     // has the user drawn on this form?
 *       practiceCount: 3,    // total times practiced
 *       score: 4,            // latest AI score 1–5
 *       // SM-2 spaced repetition fields:
 *       interval: 1,          // days until next review (1 = tomorrow)
 *       easeFactor: 2.5,     // SM-2 ease factor (min 1.3)
 *       lastReview: null,    // ISO date string of last review, or null
 *     }
 *   }
 * }
 */

const STORAGE_KEY = 'arabic_progress';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Mark a letter+form as practiced and increment the count. */
export function markPracticed(letterName, formKey) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  const entry = data[letterName][formKey] || { practiced: false, practiceCount: 0 };
  entry.practiced = true;
  entry.practiceCount = (entry.practiceCount || 0) + 1;
  data[letterName][formKey] = entry;
  save(data);
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

/** Count how many letters have been fully completed. */
export function countCompleted(letters) {
  return letters.filter((l) =>
    isLetterComplete(l.name, Object.keys(l.forms))
  ).length;
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
 * Updates interval, easeFactor, and lastReview for a letter+form entry.
 * quality: 0–5 (0–2 = fail/no credit, 3–5 = pass; map from AI score 1–5).
 * Returns the updated entry.
 */
export function updateSR(letterName, formKey, quality) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) {
    data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  }
  const entry = data[letterName][formKey];

  // Map AI score 1–5 to SM-2 quality 0–5
  // score 1 → quality 0 (complete fail)
  // score 2 → quality 2 (marginal)
  // score 3 → quality 3 (good pass)
  // score 4 → quality 4 (good pass)
  // score 5 → quality 5 (perfect)
  const q = Math.max(0, Math.min(5, quality));

  let { interval = 1, easeFactor = 2.5 } = entry;

  if (q < 3) {
    // Failed review — reset to short interval
    interval = 1;
  } else {
    // SM-2: first correct → 6 days, then grow by easeFactor
    if (interval <= 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // Update ease factor: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  entry.interval = interval;
  entry.easeFactor = easeFactor;
  entry.lastReview = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  save(data);
  return entry;
}

/**
 * Returns an array of { letterName, formKey, entry } for all letter+form combos
 * that are due for review today (lastReview + interval <= today, or never reviewed).
 */
export function getDueLetters(LETTERS) {
  const data = load();
  const today = new Date().toISOString().split('T')[0];
  const due = [];

  for (const letter of LETTERS) {
    for (const [formKey] of Object.entries(letter.forms)) {
      const stored = data[letter.name]?.[formKey];
      if (!stored?.practiced) continue; // skip never-practiced

      if (!stored.lastReview) {
        // Never reviewed — always due
        due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
        continue;
      }

      const nextDate = new Date(stored.lastReview);
      nextDate.setDate(nextDate.getDate() + (stored.interval || 1));
      const nextReview = nextDate.toISOString().split('T')[0];
      if (nextReview <= today) {
        due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
      }
    }
  }

  return due;
}
