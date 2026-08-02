/**
 * Achievements / badges — persisted in localStorage under 'arabic_achievements'.
 *
 * Shape: { [achievementId]: 'YYYY-MM-DD' }  // local date the badge was earned
 * (plus the standard `_v` version field used by every data module).
 *
 * Detection is a pure read of live progress/analytics data at award time —
 * badges are awarded lazily whenever `checkAndAward` runs (once per
 * progressVersion bump from the useAchievements hook), so legacy users who
 * already qualify instantly unlock past achievements without any backfill.
 *
 * Follows the same in-memory cache + storage-event pattern as xp.js /
 * progress.js: localStorage.getItem + JSON.parse is cheap individually but
 * called many times per render, so cache and invalidate on write and on
 * cross-tab `storage` events.
 */

import { getItem, setItem } from './storage.js';
import { getProgress, countCompleted, isLetterStarted, todayLocal } from './progress.js';
import { getScoreDistribution, getStreaks, getTotalSessions } from './analytics.js';

const STORAGE_KEY = 'arabic_achievements';

// ─── Achievement definitions ─────────────────────────────
// Ordered: award order + the order the UI iterates them.
export const ACHIEVEMENTS = [
  { id: 'first_stroke', icon: '✍️', nameKey: 'achFirstStrokeName', descKey: 'achFirstStrokeDesc' },
  {
    id: 'first_mastered',
    icon: '🏆',
    nameKey: 'achFirstMasteredName',
    descKey: 'achFirstMasteredDesc',
  },
  {
    id: 'perfect_score',
    icon: '🌟',
    nameKey: 'achPerfectScoreName',
    descKey: 'achPerfectScoreDesc',
  },
  { id: 'streak_7', icon: '🔥', nameKey: 'achStreak7Name', descKey: 'achStreak7Desc' },
  { id: 'all_started', icon: '🚀', nameKey: 'achAllStartedName', descKey: 'achAllStartedDesc' },
  {
    id: 'all_mastered',
    icon: '👑',
    nameKey: 'achAllMasteredName',
    descKey: 'achAllMasteredDesc',
  },
  { id: 'streak_30', icon: '⚡', nameKey: 'achStreak30Name', descKey: 'achStreak30Desc' },
  {
    id: 'sessions_100',
    icon: '📈',
    nameKey: 'achSessions100Name',
    descKey: 'achSessions100Desc',
  },
];

// ─── In-memory cache ──────────────────────────────────────
let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(getItem(STORAGE_KEY) || '{}');
  } catch {
    cache = {};
  }
  if (cache._v === undefined) {
    cache._v = 1;
    setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  return cache;
}

function save(data) {
  data._v = (data._v || 0) + 1;
  cache = data;
  setItem(STORAGE_KEY, JSON.stringify(data));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

// ─── Public API ───────────────────────────────────────────

/** Map of earned achievement id → 'YYYY-MM-DD'. Empty object when none. */
export function getEarnedAchievements() {
  const data = load();
  const earned = {};
  for (const { id } of ACHIEVEMENTS) {
    if (data[id]) earned[id] = data[id];
  }
  return earned;
}

/**
 * Detect newly-earned achievements from live progress/analytics data.
 * Pure detection + ONE storage write (only when something is new).
 * Returns the array of newly earned defs in ACHIEVEMENTS order; empty when
 * nothing new. Idempotent — already-earned ids are never re-awarded.
 */
export function checkAndAward({ LETTERS }) {
  const letters = Array.isArray(LETTERS) ? LETTERS : [];
  const data = load();
  const earned = getEarnedAchievements();

  const progress = getProgress();
  const completed = countCompleted(letters);
  const scoreDist = getScoreDistribution(progress);
  const streaks = getStreaks();

  const newly = [];
  for (const def of ACHIEVEMENTS) {
    if (earned[def.id]) continue; // never double-award
    let qualifies = false;
    switch (def.id) {
      case 'first_stroke':
        qualifies = letters.some(l => isLetterStarted(l.name));
        break;
      case 'first_mastered':
        qualifies = completed >= 1;
        break;
      case 'perfect_score':
        qualifies = (scoreDist[5] || 0) > 0;
        break;
      case 'streak_7':
        qualifies = streaks.current >= 7;
        break;
      case 'all_started':
        qualifies = letters.every(l => isLetterStarted(l.name));
        break;
      case 'all_mastered':
        qualifies = completed >= 28;
        break;
      case 'streak_30':
        qualifies = streaks.longest >= 30;
        break;
      case 'sessions_100':
        qualifies = getTotalSessions() >= 100;
        break;
      default:
        break;
    }
    if (qualifies) {
      data[def.id] = todayLocal();
      newly.push(def);
    }
  }

  if (newly.length > 0) save(data);
  return newly;
}
