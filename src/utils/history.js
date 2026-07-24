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

import { getItem, setItem } from './storage.js';

const STORAGE_KEY = 'arabic_feedback_history';
const MAX_PER_SLOT = 5;

let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(getItem(STORAGE_KEY) || '{}');
  } catch {
    cache = {};
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

function slotKey(letterName, formKey) {
  return `${letterName}_${formKey}`;
}

// ─── One-time migration for renamed letters ─────────────
// Mirrors the migration in progress.js: ح (Hha) and ط (Tta) previously
// collided with ه/ت under "Ha"/"Ta". Copy old slot entries onto the new
// names so feedback history survives the rename.
function migrate() {
  const data = load();
  let changed = false;
  for (const key of Object.keys(data)) {
    if (key.startsWith('Ha_')) {
      const newKey = 'Hha_' + key.slice(3);
      if (!data[newKey]) {
        data[newKey] = data[key].slice();
        changed = true;
      }
    }
    if (key.startsWith('Ta_')) {
      const newKey = 'Tta_' + key.slice(3);
      if (!data[newKey]) {
        data[newKey] = data[key].slice();
        changed = true;
      }
    }
  }
  if (changed) save(data);
}
migrate();

/** Add a feedback entry for a letter+form. Trims to MAX_PER_SLOT. */
export function addFeedbackEntry(letterName, formKey, text) {
  const data = load();
  const key = slotKey(letterName, formKey);
  const entries = data[key] || [];
  entries.push({ text, date: new Date().toISOString() });
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
