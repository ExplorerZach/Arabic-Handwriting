/**
 * Data-shape contract for the connected-writing drills dataset (ROADMAP #9).
 *
 * Each connection must be a 2–3 letter join whose `joined` string is exactly
 * the concatenation of its `letters` array (the font shapes it), uses only
 * real Arabic letters, and carries a unique key (joined string) plus the
 * roman/meaning/hint metadata the UI renders.
 */
import { describe, it, expect } from 'vitest';
import { CONNECTIONS, ALL_CONNECTIONS } from '../connections';
import { LETTERS } from '../letters';

const LETTER_SET = new Set(LETTERS.map(l => l.letter));

describe('CONNECTIONS data shape', () => {
  it('exports a non-empty array', () => {
    expect(CONNECTIONS.length).toBeGreaterThan(0);
  });

  it('ALL_CONNECTIONS is the flattened array', () => {
    expect(ALL_CONNECTIONS).toEqual(CONNECTIONS);
  });

  it('every connection has 2–3 letters', () => {
    for (const c of CONNECTIONS) {
      expect(c.letters.length, `${c.joined} should have 2-3 letters`).toBeGreaterThanOrEqual(2);
      expect(c.letters.length, `${c.joined} should have at most 3 letters`).toBeLessThanOrEqual(3);
    }
  });

  it('joined is exactly the concatenation of letters', () => {
    for (const c of CONNECTIONS) {
      expect(c.joined, `${c.joined} must equal letters joined`).toBe(c.letters.join(''));
      expect(c.joined.length).toBe(c.letters.length);
    }
  });

  it('every letter is a real Arabic letter', () => {
    for (const c of CONNECTIONS) {
      for (const ch of c.letters) {
        expect(LETTER_SET.has(ch), `${ch} in ${c.joined} is not a real letter`).toBe(true);
      }
    }
  });

  it('every connection has roman and meaning', () => {
    for (const c of CONNECTIONS) {
      expect(c.roman, `${c.joined} missing roman`).toBeTruthy();
      expect(c.meaning, `${c.joined} missing meaning`).toBeTruthy();
    }
  });

  it('joined strings are unique (progress keys must not collide)', () => {
    const keys = CONNECTIONS.map(c => c.joined);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
