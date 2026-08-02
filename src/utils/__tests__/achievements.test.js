import { describe, it, expect, beforeEach, vi } from 'vitest';

// Two letters so a single fully-practiced letter does NOT trip all_started
// (which would otherwise be awarded alongside first_stroke).
const LETTERS = [
  { name: 'Alef', forms: { isolated: 'ا', final: 'ا' } },
  { name: 'Ba', forms: { isolated: 'ب', initial: 'بـ', medial: 'ـبـ', final: 'ـب' } },
];

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

// Seed the practice-dates store with N consecutive days ending today.
function seedStreakDays(n) {
  const today = localDateStr(new Date());
  const dates = {};
  for (let i = n - 1; i >= 0; i--) dates[addDays(today, -i)] = { sessions: 1 };
  localStorage.setItem('arabic_practice_dates', JSON.stringify(dates));
}

async function loadFresh() {
  vi.resetModules();
  const progress = await import('../progress.js');
  const achievements = await import('../achievements.js');
  return { progress, achievements };
}

beforeEach(() => {
  localStorage.clear();
});

describe('ACHIEVEMENTS definitions', () => {
  it('exports exactly 8 defs in the specified order', async () => {
    const { achievements } = await loadFresh();
    expect(achievements.ACHIEVEMENTS.map(a => a.id)).toEqual([
      'first_stroke',
      'first_mastered',
      'perfect_score',
      'streak_7',
      'all_started',
      'all_mastered',
      'streak_30',
      'sessions_100',
    ]);
  });

  it('every def has icon, nameKey and descKey', async () => {
    const { achievements } = await loadFresh();
    for (const def of achievements.ACHIEVEMENTS) {
      expect(typeof def.icon).toBe('string');
      expect(typeof def.nameKey).toBe('string');
      expect(typeof def.descKey).toBe('string');
    }
  });
});

describe('checkAndAward', () => {
  it('awards first_stroke + first_mastered for a letter with all forms practiced', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'final');

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).toEqual(['first_stroke', 'first_mastered']);
  });

  it('awards perfect_score when a form has a 5-star AI score', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.setScore('Alef', 'isolated', 5);

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).toContain('perfect_score');
  });

  it('does not award perfect_score for lower scores', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.setScore('Alef', 'isolated', 4);

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).not.toContain('perfect_score');
  });

  it('awards streak_7 with 7 consecutive practice days', async () => {
    seedStreakDays(7);
    const { achievements } = await loadFresh();

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).toContain('streak_7');
  });

  it('does not award streak_7 for a 6-day streak', async () => {
    seedStreakDays(6);
    const { achievements } = await loadFresh();

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).not.toContain('streak_7');
  });

  it('awards all_started when every letter has been started', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Ba', 'isolated');

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).toEqual(['first_stroke', 'all_started']);
  });

  it('awards sessions_100 after 100 recorded sessions', async () => {
    localStorage.setItem(
      'arabic_practice_dates',
      JSON.stringify({ [localDateStr(new Date())]: { sessions: 100 } }),
    );
    const { achievements } = await loadFresh();

    const newly = achievements.checkAndAward({ LETTERS });
    expect(newly.map(a => a.id)).toContain('sessions_100');
  });

  it('does not double-award on re-run (idempotent)', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'final');

    const first = achievements.checkAndAward({ LETTERS });
    expect(first.map(a => a.id)).toEqual(['first_stroke', 'first_mastered']);

    const second = achievements.checkAndAward({ LETTERS });
    expect(second).toEqual([]);
  });

  it('returns an empty array when nothing is earned', async () => {
    const { achievements } = await loadFresh();
    expect(achievements.checkAndAward({ LETTERS })).toEqual([]);
  });
});

describe('getEarnedAchievements', () => {
  it('returns an empty object when nothing is earned', async () => {
    const { achievements } = await loadFresh();
    expect(achievements.getEarnedAchievements()).toEqual({});
  });

  it('returns the stored id → YYYY-MM-DD map after awarding', async () => {
    const { progress, achievements } = await loadFresh();
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'final');
    achievements.checkAndAward({ LETTERS });

    const earned = achievements.getEarnedAchievements();
    expect(Object.keys(earned).sort()).toEqual(['first_mastered', 'first_stroke']);
    for (const date of Object.values(earned)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
