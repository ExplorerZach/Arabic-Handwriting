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

  it('returns a legacy flat { strokes, dots } entry as-is for any form', () => {
    const legacy = { strokes: [[{ x: 1, y: 2 }]], dots: [] };
    expect(resolveStrokeData(legacy, 'isolated')).toBe(legacy);
    expect(resolveStrokeData(legacy, 'initial')).toBe(legacy);
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

  it('is false while a positional form is unauthored (rollout gate)', () => {
    // ب (Ba) offers initial/medial/final forms in the app, but only isolated
    // strokes are authored yet — Show Me must hide for these.
    expect(resolveShowMeAvailable(STROKE_DATA['ب'], 'initial')).toBe(false);
    expect(resolveShowMeAvailable(STROKE_DATA['ب'], 'medial')).toBe(false);
    expect(resolveShowMeAvailable(STROKE_DATA['ب'], 'final')).toBe(false);
  });
});

describe('STROKE_DATA nested shape', () => {
  it('nests the isolated form for every letter under `isolated`', () => {
    for (const key of Object.keys(STROKE_DATA)) {
      const iso = STROKE_DATA[key]?.isolated;
      expect(iso, `${key} should have an isolated entry`).toBeDefined();
      expect(Array.isArray(iso.strokes)).toBe(true);
      expect(Array.isArray(iso.dots)).toBe(true);
    }
  });
});
