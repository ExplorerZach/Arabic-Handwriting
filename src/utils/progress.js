/**
 * Progress tracking — persisted in localStorage under 'arabic_progress'.
 *
 * Shape:
 * {
 *   [letterName]: {          // e.g. "Alef"
 *     [formKey]: {           // e.g. "isolated"
 *       practiced: true,     // has the user drawn on this form?
 *       practiceCount: 3,    // total times practiced
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
