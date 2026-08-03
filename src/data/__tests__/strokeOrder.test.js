/**
 * Data-shape contract for the nested stroke-order map (ROADMAP #15 Part 2).
 *
 * STROKE_DATA nests each letter's strokes/dots under positional form keys:
 *   STROKE_DATA['ب'] = { isolated: {strokes,dots}, initial, medial, final }
 *
 * `resolveStrokeData(entry, formKey)` is STRICT: it returns the authored
 * { strokes, dots } for exactly the requested form and `undefined` when that
 * form is not authored. It never falls back to `isolated`, so the Show Me
 * button gate can hide itself rather than animate an isolated path over a
 * mismatched initial/medial/final glyph during the incremental rollout.
 */
import { describe, it, expect } from 'vitest';
import STROKE_DATA, { resolveStrokeData, resolveShowMeAvailable } from '../strokeOrder';

describe('resolveStrokeData (strict)', () => {
  it('returns the isolated entry when formKey is isolated', () => {
    expect(resolveStrokeData(STROKE_DATA['ب'], 'isolated')).toEqual(STROKE_DATA['ب'].isolated);
  });

  it('returns the matching positional form when authored', () => {
    const entry = {
      isolated: { strokes: 'iso', dots: [] },
      initial: { strokes: 'init', dots: [] },
    };
    expect(resolveStrokeData(entry, 'initial')).toEqual({
      strokes: 'init',
      dots: [],
    });
  });

  it('returns a legacy flat { strokes, dots } entry only for isolated', () => {
    const legacy = { strokes: [[{ x: 1, y: 2 }]], dots: [] };
    expect(resolveStrokeData(legacy, 'isolated')).toBe(legacy);
    expect(resolveStrokeData(legacy, 'initial')).toBeUndefined();
    expect(resolveStrokeData(legacy, 'medial')).toBeUndefined();
    expect(resolveStrokeData(legacy, 'final')).toBeUndefined();
  });

  it('returns undefined for a missing entry', () => {
    expect(resolveStrokeData(undefined, 'isolated')).toBeUndefined();
  });

  it('returns undefined for an unauthored positional form (no fallback)', () => {
    const entry = { isolated: { strokes: 'iso', dots: [] } };
    expect(resolveStrokeData(entry, 'initial')).toBeUndefined();
    expect(resolveStrokeData(entry, 'final')).toBeUndefined();
  });
});

describe('resolveShowMeAvailable', () => {
  it('is true for authored isolated forms (all current letters)', () => {
    expect(resolveShowMeAvailable(STROKE_DATA['ب'], 'isolated')).toBe(true);
    // ا (Alef) is a non-joiner; only its isolated form exists.
    expect(resolveShowMeAvailable(STROKE_DATA['ا'], 'isolated')).toBe(true);
  });

  it('is true for every joining letter positional form', () => {
    for (const key of [
      'ب',
      'ت',
      'ث',
      'ج',
      'ح',
      'خ',
      'س',
      'ش',
      'ص',
      'ض',
      'ط',
      'ظ',
      'ع',
      'غ',
      'ف',
      'ق',
      'ك',
      'ل',
      'م',
      'ن',
      'ه',
      'ي',
    ]) {
      expect(resolveShowMeAvailable(STROKE_DATA[key], 'initial')).toBe(true);
      expect(resolveShowMeAvailable(STROKE_DATA[key], 'medial')).toBe(true);
      expect(resolveShowMeAvailable(STROKE_DATA[key], 'final')).toBe(true);
    }
  });

  it('is true for every non-joiner final form', () => {
    for (const key of ['ا', 'د', 'ذ', 'ر', 'ز', 'و']) {
      expect(resolveShowMeAvailable(STROKE_DATA[key], 'final')).toBe(true);
    }
  });

  it('is false for an unauthored positional form (rollout gate)', () => {
    const isolatedOnly = { isolated: { strokes: [], dots: [] } };
    expect(resolveShowMeAvailable(isolatedOnly, 'initial')).toBe(false);
    expect(resolveShowMeAvailable(isolatedOnly, 'medial')).toBe(false);
    expect(resolveShowMeAvailable(isolatedOnly, 'final')).toBe(false);
  });
});

describe('STROKE_DATA nested shape', () => {
  it('stores usable isolated stroke data for every letter', () => {
    for (const key of Object.keys(STROKE_DATA)) {
      const iso = STROKE_DATA[key]?.isolated;
      expect(iso, `${key} should have an isolated entry`).toBeDefined();
      expect(Array.isArray(iso.strokes)).toBe(true);
      expect(Array.isArray(iso.dots)).toBe(true);
    }
  });

  it('stores usable authored positional stroke data', () => {
    const requiredForms = {
      ب: ['initial', 'medial', 'final'],
      ت: ['initial', 'medial', 'final'],
      ث: ['initial', 'medial', 'final'],
      ج: ['initial', 'medial', 'final'],
      ح: ['initial', 'medial', 'final'],
      خ: ['initial', 'medial', 'final'],
      س: ['initial', 'medial', 'final'],
      ش: ['initial', 'medial', 'final'],
      ص: ['initial', 'medial', 'final'],
      ض: ['initial', 'medial', 'final'],
      ط: ['initial', 'medial', 'final'],
      ظ: ['initial', 'medial', 'final'],
      ع: ['initial', 'medial', 'final'],
      غ: ['initial', 'medial', 'final'],
      ف: ['initial', 'medial', 'final'],
      ق: ['initial', 'medial', 'final'],
      ك: ['initial', 'medial', 'final'],
      ل: ['initial', 'medial', 'final'],
      م: ['initial', 'medial', 'final'],
      ن: ['initial', 'medial', 'final'],
      ه: ['initial', 'medial', 'final'],
      ي: ['initial', 'medial', 'final'],
      ا: ['final'],
      د: ['final'],
      ذ: ['final'],
      ر: ['final'],
      ز: ['final'],
      و: ['final'],
    };

    for (const [letter, forms] of Object.entries(requiredForms)) {
      for (const form of forms) {
        const data = STROKE_DATA[letter][form];
        expect(data, `${letter} ${form} should be authored`).toBeDefined();
        expect(Array.isArray(data.strokes)).toBe(true);
        expect(Array.isArray(data.dots)).toBe(true);
        for (const stroke of data.strokes) {
          expect(Array.isArray(stroke)).toBe(true);
          for (const point of stroke) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(100);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(100);
          }
        }
        for (const dot of data.dots) {
          expect(dot.x).toBeGreaterThanOrEqual(0);
          expect(dot.x).toBeLessThanOrEqual(100);
          expect(dot.y).toBeGreaterThanOrEqual(0);
          expect(dot.y).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
