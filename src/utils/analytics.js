/**
 * Analytics utilities for streak tracking, score distribution, heatmaps,
 * weakness analysis, and progress-over-time computation.
 *
 * Reads from arabic_progress and arabic_practice_dates (new localStorage key).
 */

const DATES_KEY = 'arabic_practice_dates';

// ─── localStorage helpers ─────────────────────────────────

function loadDates() {
  try {
    return JSON.parse(localStorage.getItem(DATES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDates(data) {
  localStorage.setItem(DATES_KEY, JSON.stringify(data));
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Public API ──────────────────────────────────────────

/** Record that the user practiced today (idempotent per date). */
export function recordPracticeDate() {
  const data = loadDates();
  const today = todayLocal();
  if (!data[today]) data[today] = { sessions: 0 };
  data[today].sessions += 1;
  saveDates(data);
  return data;
}

/** Get { current: number, longest: number } streaks. */
export function getStreaks() {
  const data = loadDates();
  const dates = Object.keys(data).sort();
  if (!dates.length) return { current: 0, longest: 0 };

  let current = 0;
  let longest = 0;
  let run = 0;

  const today = todayLocal();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  // Count current streak from today backwards
  let check = today;
  while (data[check]) {
    current++;
    const d = new Date(check);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    check = `${y}-${m}-${day}`;
  }

  // If no practice today, check if yesterday had practice
  if (current === 0 && data[yesterday]) {
    current = 1;
    check = yesterday;
    while (true) {
      const d = new Date(check);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const prev = `${y}-${m}-${day}`;
      if (data[prev]) {
        current++;
        check = prev;
      } else {
        break;
      }
    }
  }

  // Longest streak across all history
  for (const date of dates) {
    if (run === 0) {
      run = 1;
    } else {
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const py = prev.getFullYear();
      const pm = String(prev.getMonth() + 1).padStart(2, '0');
      const pd = String(prev.getDate()).padStart(2, '0');
      const prevStr = `${py}-${pm}-${pd}`;
      if (dates.includes(prevStr)) {
        run++;
      } else {
        run = 1;
      }
    }
    if (run > longest) longest = run;
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
 * Get cumulative completion over last N days.
 * Returns array of { date, cumulativeCompleted }.
 */
export function getProgressOverTime(LETTERS, progress, days = 30) {
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    let completed = 0;
    for (const letter of LETTERS) {
      const letterData = progress[letter.name] || {};
      const allPracticed = Object.keys(letter.forms).every(
        (k) => letterData[k]?.practiced
      );
      if (allPracticed) completed++;
    }
    result.push({ date: dateStr, label: `${m}-${day}`, completed });
  }
  return result;
}

/** Total number of practice sessions recorded across all dates. */
export function getTotalSessions() {
  const data = loadDates();
  return Object.values(data).reduce((sum, d) => sum + (d.sessions || 0), 0);
}
