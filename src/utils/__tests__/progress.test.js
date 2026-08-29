import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../analytics.js', () => ({
  recordPracticeDate: vi.fn(),
}));

const testLetter = {
  name: 'Alef',
  forms: { isolated: 'ا', final: 'ا' },
};

const LETTERS = [testLetter];

let progress;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  progress = await import('../progress.js');
});

describe('todayLocal', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = progress.todayLocal();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('markPracticed', () => {
  it('sets practiced true and increments count', () => {
    progress.markPracticed('Alef', 'isolated');
    const p = progress.getProgress();
    expect(p.Alef.isolated.practiced).toBe(true);
    expect(p.Alef.isolated.practiceCount).toBe(1);
  });

  it('increments on subsequent practices', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'isolated');
    const p = progress.getProgress();
    expect(p.Alef.isolated.practiceCount).toBe(2);
  });
});

describe('setScore / getScore', () => {
  it('stores and retrieves a score', () => {
    progress.setScore('Alef', 'isolated', 4);
    expect(progress.getScore('Alef', 'isolated')).toBe(4);
  });

  it('clamps score to 1-5', () => {
    progress.setScore('Alef', 'isolated', 0);
    expect(progress.getScore('Alef', 'isolated')).toBe(1);

    progress.setScore('Alef', 'final', 10);
    expect(progress.getScore('Alef', 'final')).toBe(5);
  });

  it('returns null for unscored item', () => {
    expect(progress.getScore('Alef', 'isolated')).toBeNull();
  });
});

describe('isLetterComplete / isLetterStarted', () => {
  it('complete when all forms practiced', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'final');
    expect(progress.isLetterComplete('Alef', ['isolated', 'final'])).toBe(true);
  });

  it('not complete when only some forms practiced', () => {
    progress.markPracticed('Alef', 'isolated');
    expect(progress.isLetterComplete('Alef', ['isolated', 'final'])).toBe(false);
  });

  it('started when any form practiced', () => {
    progress.markPracticed('Alef', 'isolated');
    expect(progress.isLetterStarted('Alef')).toBe(true);
  });

  it('not started when nothing practiced', () => {
    expect(progress.isLetterStarted('Alef')).toBe(false);
  });
});

describe('countCompleted', () => {
  it('counts fully completed letters', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.markPracticed('Alef', 'final');
    expect(progress.countCompleted(LETTERS)).toBe(1);
  });

  it('counts zero when nothing practiced', () => {
    expect(progress.countCompleted(LETTERS)).toBe(0);
  });
});

describe('getProgressSummary', () => {
  it('returns started/complete per letter', () => {
    progress.markPracticed('Alef', 'isolated');
    const summary = progress.getProgressSummary(LETTERS);
    expect(summary.Alef).toEqual({ started: true, complete: false });
  });
});

describe('updateSR (SM-2)', () => {
  it('score 1 resets interval and sets failed flag', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.setScore('Alef', 'isolated', 3);
    const entry = progress.updateSR('Alef', 'isolated', 1);
    expect(entry.interval).toBe(1);
    expect(entry.failedSinceLastPass).toBe(true);
  });

  it('score 3+ grows interval and clears failure flag', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.setScore('Alef', 'isolated', 3);
    let entry = progress.updateSR('Alef', 'isolated', 3);
    expect(entry.interval).toBe(6);

    entry = progress.updateSR('Alef', 'isolated', 4);
    expect(entry.interval).toBeGreaterThan(6);
    expect(entry.failedSinceLastPass).toBeUndefined();
  });

  it('ease factor never goes below 1.3', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.setScore('Alef', 'isolated', 3);
    for (let i = 0; i < 20; i++) {
      progress.updateSR('Alef', 'isolated', 1);
    }
    const entry = progress.getProgress().Alef.isolated;
    expect(entry.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('getDueLetters', () => {
  it('returns empty when nothing practiced', () => {
    const due = progress.getDueLetters(LETTERS);
    expect(due).toHaveLength(0);
  });

  it('returns due for items with failedSinceLastPass flag', () => {
    progress.markPracticed('Alef', 'isolated');
    progress.updateSR('Alef', 'isolated', 1);
    const due = progress.getDueLetters(LETTERS);
    expect(due.length).toBeGreaterThanOrEqual(1);
    expect(due[0].formKey).toBe('isolated');
  });

  it('returns due for items past recency period', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 4);
    const oldStr = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;
    localStorage.setItem(
      'arabic_progress',
      JSON.stringify({
        Alef: {
          isolated: { practiced: true, practiceCount: 1, lastPracticed: oldStr },
          final: { practiced: true, practiceCount: 1, lastPracticed: oldStr },
        },
      }),
    );
    vi.resetModules();
    progress = await import('../progress.js');
    const due = progress.getDueLetters(LETTERS);
    expect(due.length).toBeGreaterThanOrEqual(1);
  });

  it('returns due for word items after practice and AI-fail SM-2 update', () => {
    progress.markPracticed('سلام', 'word');
    progress.updateSR('سلام', 'word', 1);
    const wordItem = { name: 'سلام', forms: { word: 'سلام' } };
    const due = progress.getDueLetters([wordItem]);
    expect(due).toHaveLength(1);
    expect(due[0]).toEqual({
      letterName: 'سلام',
      letterChar: 'سلام',
      formKey: 'word',
    });
  });
});
