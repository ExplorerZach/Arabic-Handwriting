const GOAL_KEY = 'daily_goal';
const DEFAULT_GOAL = 5;

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get the user's daily goal (default 5). */
export function getDailyGoal() {
  const raw = localStorage.getItem(GOAL_KEY);
  const n = raw ? parseInt(raw, 10) : DEFAULT_GOAL;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL;
}

/** Persist a new daily goal. */
export function setDailyGoal(n) {
  const value = Math.max(1, parseInt(n, 10) || DEFAULT_GOAL);
  localStorage.setItem(GOAL_KEY, String(value));
  return value;
}

/**
 * Count how many letter/form entries have lastPracticed === today.
 * `progress` is the object returned by `getProgress()`.
 */
export function getTodayProgress(progress) {
  const today = todayLocal();
  let count = 0;
  for (const forms of Object.values(progress || {})) {
    for (const entry of Object.values(forms)) {
      if (entry?.lastPracticed === today) count++;
    }
  }
  return count;
}
