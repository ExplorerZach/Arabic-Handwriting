/**
 * Feedback history — persisted in localStorage under 'arabic_feedback_history'.
 *
 * Shape:
 * {
 *   [letterName_formKey]: [   // e.g. "Alef_isolated"
 *     { text: "...", date: "2026-04-13T..." },
 *     ...
 *   ]
 * }
 *
 * Max MAX_PER_SLOT entries per letter+form slot (oldest removed first).
 */

const STORAGE_KEY = 'arabic_feedback_history';
const MAX_PER_SLOT = 5;

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

function slotKey(letterName, formKey) {
  return `${letterName}_${formKey}`;
}

/** Add a feedback entry for a letter+form. Trims to MAX_PER_SLOT. */
export function addFeedbackEntry(letterName, formKey, text) {
  const data = load();
  const key = slotKey(letterName, formKey);
  const entries = data[key] || [];
  entries.push({ text, date: new Date().toISOString() });
  // Keep only the most recent MAX_PER_SLOT entries
  data[key] = entries.slice(-MAX_PER_SLOT);
  save(data);
  return data[key];
}

/** Get all feedback entries for a letter+form, newest first. */
export function getFeedbackHistory(letterName, formKey) {
  const data = load();
  const key = slotKey(letterName, formKey);
  return (data[key] || []).slice().reverse();
}
