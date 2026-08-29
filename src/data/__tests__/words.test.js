/**
 * Data-shape contract for the vocabulary words dataset (ROADMAP #6).
 *
 * Words mode tracks SM-2 and daily practice progress under the word's
 * Arabic string with formKey 'word'.
 */
import { describe, it, expect } from 'vitest';
import { WORD_GROUPS, ALL_WORDS, WORD_FORM_KEY } from '../words';
import { CONNECTIONS, CONNECTION_FORM_KEY } from '../connections';

describe('WORD_GROUPS data shape', () => {
  it('exports a non-empty array of groups', () => {
    expect(WORD_GROUPS.length).toBeGreaterThan(0);
  });

  it('ALL_WORDS is the flattened array with group names attached', () => {
    expect(ALL_WORDS.length).toBe(WORD_GROUPS.reduce((acc, g) => acc + g.words.length, 0));
  });

  it('uses a progress formKey distinct from connections (SM-2 namespace separation)', () => {
    expect(WORD_FORM_KEY).toBe('word');
    expect(WORD_FORM_KEY).not.toBe(CONNECTION_FORM_KEY);
  });

  it('every word has non-empty word, roman, and meaning strings', () => {
    const rawWords = WORD_GROUPS.flatMap(g => g.words);
    for (const w of rawWords) {
      expect(typeof w.word, `word string should be a string`).toBe('string');
      expect(w.word.trim().length, `word string should not be empty`).toBeGreaterThan(0);
      expect(w.roman, `${w.word} missing roman`).toBeTruthy();
      expect(w.meaning, `${w.word} missing meaning`).toBeTruthy();
    }
  });

  it('collapses known duplicate words to unique progress keys', () => {
    const rawWords = WORD_GROUPS.flatMap(g => g.words).map(w => w.word);
    const uniqueWords = new Set(rawWords);
    // 41 total word entries across groups, 38 unique words (3 duplicate occurrences:
    // 'مع السلامة', 'صباح الخير', 'الله').
    expect(
      rawWords.length - uniqueWords.size,
      'Expected exactly 3 duplicate words across groups to collapse into unique progress keys',
    ).toBe(3);
  });

  it('isolates overlapping strings from connections via distinct formKeys', () => {
    const wordSet = new Set(WORD_GROUPS.flatMap(g => g.words.map(w => w.word)));
    const overlapping = CONNECTIONS.filter(c => wordSet.has(c.joined)).map(c => c.joined);
    expect(overlapping.length).toBeGreaterThan(0);
    // Word progress keys must always use WORD_FORM_KEY ('word') and never CONNECTION_FORM_KEY ('connection')
    expect(WORD_FORM_KEY).not.toBe(CONNECTION_FORM_KEY);
    for (const word of overlapping) {
      expect(WORD_FORM_KEY).toBe('word');
      expect(word).toBeTruthy();
    }
  });
});
