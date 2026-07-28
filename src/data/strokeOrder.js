/**
 * Stroke order data for each Arabic letter (isolated form).
 *
 * Each letter has an array of strokes. Each stroke is an array of { x, y }
 * points normalized to a 0–100 coordinate space (origin top-left).
 * The animation system will scale these to the actual canvas size.
 *
 * Direction arrows and stroke numbers help learners understand the flow.
 * Arabic is written right-to-left, so most strokes start from the right.
 *
 * Note: These are simplified pedagogical strokes, not precise font outlines.
 * They show the general direction and order a beginner should follow.
 */

const STROKE_DATA = {
  ا: {
    // Alef — single vertical stroke, top to bottom
    strokes: [
      [
        { x: 50, y: 20 },
        { x: 50, y: 25 },
        { x: 49, y: 35 },
        { x: 48, y: 50 },
        { x: 47, y: 65 },
        { x: 46, y: 80 },
      ],
    ],
    dots: [],
  },
  ب: {
    // Ba — horizontal base right-to-left, then dot below
    strokes: [
      [
        { x: 80, y: 45 },
        { x: 70, y: 48 },
        { x: 55, y: 50 },
        { x: 40, y: 50 },
        { x: 28, y: 48 },
        { x: 22, y: 42 },
        { x: 20, y: 35 },
      ],
    ],
    dots: [{ x: 50, y: 62, below: true }],
  },
  ت: {
    // Ta — same base as Ba, two dots above
    strokes: [
      [
        { x: 80, y: 50 },
        { x: 70, y: 53 },
        { x: 55, y: 55 },
        { x: 40, y: 55 },
        { x: 28, y: 52 },
        { x: 22, y: 46 },
        { x: 20, y: 38 },
      ],
    ],
    dots: [
      { x: 44, y: 35 },
      { x: 56, y: 35 },
    ],
  },
  ث: {
    // Tha — same base, three dots above in triangle
    strokes: [
      [
        { x: 80, y: 55 },
        { x: 70, y: 58 },
        { x: 55, y: 60 },
        { x: 40, y: 60 },
        { x: 28, y: 57 },
        { x: 22, y: 50 },
        { x: 20, y: 42 },
      ],
    ],
    dots: [
      { x: 42, y: 38 },
      { x: 58, y: 38 },
      { x: 50, y: 28 },
    ],
  },
  ج: {
    // Jim — hook curves right then sweeps under, dot below
    strokes: [
      [
        { x: 60, y: 25 },
        { x: 65, y: 30 },
        { x: 68, y: 40 },
        { x: 65, y: 52 },
        { x: 55, y: 60 },
        { x: 40, y: 65 },
        { x: 30, y: 68 },
        { x: 25, y: 72 },
        { x: 28, y: 78 },
      ],
    ],
    dots: [{ x: 48, y: 50, below: true }],
  },
  ح: {
    // Ha (haa) — same hook, no dots
    strokes: [
      [
        { x: 60, y: 25 },
        { x: 65, y: 30 },
        { x: 68, y: 40 },
        { x: 65, y: 52 },
        { x: 55, y: 60 },
        { x: 40, y: 65 },
        { x: 30, y: 68 },
        { x: 25, y: 72 },
        { x: 28, y: 78 },
      ],
    ],
    dots: [],
  },
  خ: {
    // Kha — hook + dot above
    strokes: [
      [
        { x: 60, y: 30 },
        { x: 65, y: 35 },
        { x: 68, y: 45 },
        { x: 65, y: 55 },
        { x: 55, y: 63 },
        { x: 40, y: 68 },
        { x: 30, y: 71 },
        { x: 25, y: 75 },
        { x: 28, y: 80 },
      ],
    ],
    dots: [{ x: 55, y: 20 }],
  },
  د: {
    // Dal — angular wedge
    strokes: [
      [
        { x: 55, y: 30 },
        { x: 58, y: 35 },
        { x: 60, y: 45 },
        { x: 55, y: 55 },
        { x: 45, y: 58 },
        { x: 35, y: 55 },
      ],
    ],
    dots: [],
  },
  ذ: {
    // Dhal — wedge + dot above
    strokes: [
      [
        { x: 55, y: 35 },
        { x: 58, y: 40 },
        { x: 60, y: 50 },
        { x: 55, y: 60 },
        { x: 45, y: 63 },
        { x: 35, y: 60 },
      ],
    ],
    dots: [{ x: 55, y: 25 }],
  },
  ر: {
    // Ra — gentle curve swooping right
    strokes: [
      [
        { x: 55, y: 35 },
        { x: 52, y: 45 },
        { x: 48, y: 55 },
        { x: 42, y: 65 },
        { x: 35, y: 72 },
        { x: 30, y: 75 },
      ],
    ],
    dots: [],
  },
  ز: {
    // Zay — same curve + dot above
    strokes: [
      [
        { x: 55, y: 40 },
        { x: 52, y: 50 },
        { x: 48, y: 58 },
        { x: 42, y: 68 },
        { x: 35, y: 75 },
        { x: 30, y: 78 },
      ],
    ],
    dots: [{ x: 52, y: 30 }],
  },
  س: {
    // Sin — three small waves
    strokes: [
      [
        { x: 85, y: 50 },
        { x: 78, y: 48 },
        { x: 72, y: 52 },
        { x: 66, y: 48 },
        { x: 60, y: 52 },
        { x: 54, y: 48 },
        { x: 46, y: 50 },
        { x: 36, y: 55 },
        { x: 28, y: 65 },
        { x: 25, y: 75 },
      ],
    ],
    dots: [],
  },
  ش: {
    // Shin — three waves + three dots above
    strokes: [
      [
        { x: 85, y: 55 },
        { x: 78, y: 52 },
        { x: 72, y: 56 },
        { x: 66, y: 52 },
        { x: 60, y: 56 },
        { x: 54, y: 52 },
        { x: 46, y: 55 },
        { x: 36, y: 60 },
        { x: 28, y: 70 },
        { x: 25, y: 78 },
      ],
    ],
    dots: [
      { x: 60, y: 38 },
      { x: 72, y: 38 },
      { x: 66, y: 28 },
    ],
  },
  ص: {
    // Sad — round head + long tail
    strokes: [
      [
        { x: 75, y: 45 },
        { x: 70, y: 40 },
        { x: 62, y: 38 },
        { x: 55, y: 40 },
        { x: 52, y: 48 },
        { x: 55, y: 55 },
        { x: 62, y: 55 },
        { x: 68, y: 52 },
      ],
      [
        { x: 52, y: 50 },
        { x: 42, y: 55 },
        { x: 32, y: 62 },
        { x: 25, y: 72 },
        { x: 22, y: 80 },
      ],
    ],
    dots: [],
  },
  ض: {
    // Dad — same as Sad + dot above
    strokes: [
      [
        { x: 75, y: 48 },
        { x: 70, y: 43 },
        { x: 62, y: 41 },
        { x: 55, y: 43 },
        { x: 52, y: 51 },
        { x: 55, y: 58 },
        { x: 62, y: 58 },
        { x: 68, y: 55 },
      ],
      [
        { x: 52, y: 53 },
        { x: 42, y: 58 },
        { x: 32, y: 65 },
        { x: 25, y: 75 },
        { x: 22, y: 82 },
      ],
    ],
    dots: [{ x: 62, y: 30 }],
  },
  ط: {
    // Ta (taa) — oval loop + vertical stroke
    strokes: [
      [
        { x: 75, y: 50 },
        { x: 68, y: 45 },
        { x: 55, y: 42 },
        { x: 42, y: 45 },
        { x: 35, y: 52 },
        { x: 38, y: 60 },
        { x: 48, y: 62 },
        { x: 60, y: 58 },
        { x: 68, y: 52 },
      ],
      [
        { x: 55, y: 25 },
        { x: 55, y: 30 },
        { x: 55, y: 38 },
        { x: 55, y: 42 },
      ],
    ],
    dots: [],
  },
  ظ: {
    // Dha — oval loop + vertical + dot above
    strokes: [
      [
        { x: 75, y: 52 },
        { x: 68, y: 47 },
        { x: 55, y: 44 },
        { x: 42, y: 47 },
        { x: 35, y: 54 },
        { x: 38, y: 62 },
        { x: 48, y: 64 },
        { x: 60, y: 60 },
        { x: 68, y: 54 },
      ],
      [
        { x: 55, y: 28 },
        { x: 55, y: 33 },
        { x: 55, y: 40 },
        { x: 55, y: 44 },
      ],
    ],
    dots: [{ x: 60, y: 20 }],
  },
  ع: {
    // Ain — open comma loop
    strokes: [
      [
        { x: 55, y: 25 },
        { x: 60, y: 32 },
        { x: 62, y: 40 },
        { x: 58, y: 48 },
        { x: 50, y: 52 },
        { x: 42, y: 58 },
        { x: 36, y: 68 },
        { x: 34, y: 78 },
      ],
    ],
    dots: [],
  },
  غ: {
    // Ghain — same as Ain + dot above
    strokes: [
      [
        { x: 55, y: 30 },
        { x: 60, y: 37 },
        { x: 62, y: 45 },
        { x: 58, y: 53 },
        { x: 50, y: 57 },
        { x: 42, y: 63 },
        { x: 36, y: 72 },
        { x: 34, y: 80 },
      ],
    ],
    dots: [{ x: 58, y: 20 }],
  },
  ف: {
    // Fa — circle + tail + dot above
    strokes: [
      [
        { x: 70, y: 42 },
        { x: 65, y: 38 },
        { x: 58, y: 38 },
        { x: 55, y: 42 },
        { x: 58, y: 48 },
        { x: 65, y: 48 },
        { x: 68, y: 44 },
      ],
      [
        { x: 55, y: 45 },
        { x: 45, y: 50 },
        { x: 35, y: 55 },
        { x: 28, y: 60 },
      ],
    ],
    dots: [{ x: 62, y: 28 }],
  },
  ق: {
    // Qaf — deeper bowl + two dots above
    strokes: [
      [
        { x: 72, y: 42 },
        { x: 65, y: 38 },
        { x: 55, y: 36 },
        { x: 45, y: 40 },
        { x: 42, y: 50 },
        { x: 48, y: 58 },
        { x: 58, y: 60 },
        { x: 65, y: 55 },
      ],
      [
        { x: 48, y: 55 },
        { x: 42, y: 65 },
        { x: 38, y: 75 },
        { x: 36, y: 82 },
      ],
    ],
    dots: [
      { x: 52, y: 26 },
      { x: 62, y: 26 },
    ],
  },
  ك: {
    // Kaf — tooth shape + accent
    strokes: [
      [
        { x: 70, y: 35 },
        { x: 65, y: 40 },
        { x: 58, y: 48 },
        { x: 50, y: 55 },
        { x: 42, y: 58 },
        { x: 35, y: 56 },
        { x: 32, y: 50 },
      ],
      [
        { x: 55, y: 30 },
        { x: 48, y: 28 },
        { x: 42, y: 32 },
      ],
    ],
    dots: [],
  },
  ل: {
    // Lam — tall hook
    strokes: [
      [
        { x: 55, y: 15 },
        { x: 54, y: 25 },
        { x: 52, y: 40 },
        { x: 48, y: 55 },
        { x: 42, y: 65 },
        { x: 35, y: 72 },
        { x: 30, y: 75 },
      ],
    ],
    dots: [],
  },
  م: {
    // Mim — tight circle + tail
    strokes: [
      [
        { x: 62, y: 40 },
        { x: 58, y: 36 },
        { x: 50, y: 35 },
        { x: 45, y: 40 },
        { x: 45, y: 48 },
        { x: 50, y: 52 },
        { x: 58, y: 50 },
      ],
      [
        { x: 48, y: 50 },
        { x: 45, y: 60 },
        { x: 42, y: 70 },
        { x: 40, y: 78 },
      ],
    ],
    dots: [],
  },
  ن: {
    // Nun — shallow bowl + dot above
    strokes: [
      [
        { x: 78, y: 50 },
        { x: 68, y: 53 },
        { x: 55, y: 55 },
        { x: 42, y: 53 },
        { x: 32, y: 48 },
        { x: 28, y: 40 },
      ],
    ],
    dots: [{ x: 52, y: 38 }],
  },
  ه: {
    // Ha (haa) — figure-eight loops
    strokes: [
      [
        { x: 60, y: 35 },
        { x: 55, y: 30 },
        { x: 48, y: 32 },
        { x: 45, y: 40 },
        { x: 50, y: 48 },
        { x: 58, y: 50 },
        { x: 62, y: 55 },
        { x: 58, y: 62 },
        { x: 48, y: 65 },
        { x: 42, y: 60 },
      ],
    ],
    dots: [],
  },
  و: {
    // Waw — circle + tail
    strokes: [
      [
        { x: 58, y: 35 },
        { x: 52, y: 32 },
        { x: 45, y: 35 },
        { x: 42, y: 42 },
        { x: 45, y: 50 },
        { x: 52, y: 52 },
        { x: 58, y: 48 },
      ],
      [
        { x: 50, y: 50 },
        { x: 46, y: 60 },
        { x: 42, y: 70 },
        { x: 38, y: 78 },
      ],
    ],
    dots: [],
  },
  ي: {
    // Ya — two humps + hook + two dots below
    strokes: [
      [
        { x: 80, y: 42 },
        { x: 72, y: 38 },
        { x: 65, y: 42 },
        { x: 60, y: 38 },
        { x: 52, y: 42 },
        { x: 44, y: 48 },
        { x: 38, y: 58 },
        { x: 35, y: 68 },
        { x: 38, y: 75 },
        { x: 45, y: 72 },
      ],
    ],
    dots: [
      { x: 48, y: 55, below: true },
      { x: 58, y: 55, below: true },
    ],
  },

  // ── Eastern Arabic numerals (٠–٩) ───────────────────────
  // Single-glyph digits, no positional forms. Paths approximate the
  // Amiri/Scheherazade glyph shapes in the shared 0–100 space.
  '٠': {
    // 0 (ṣifr) — small dot on the baseline
    strokes: [],
    dots: [{ x: 50, y: 50 }],
  },
  '١': {
    // 1 (wāḥid) — single vertical stroke, top to bottom
    strokes: [
      [
        { x: 50, y: 25 },
        { x: 50, y: 38 },
        { x: 50, y: 52 },
        { x: 50, y: 66 },
        { x: 50, y: 78 },
      ],
    ],
    dots: [],
  },
  '٢': {
    // 2 (ithnān) — small hook opening up-right
    strokes: [
      [
        { x: 35, y: 40 },
        { x: 42, y: 35 },
        { x: 50, y: 38 },
        { x: 54, y: 48 },
        { x: 56, y: 60 },
        { x: 58, y: 70 },
      ],
    ],
    dots: [],
  },
  '٣': {
    // 3 (thalātha) — three connected humps along the top
    strokes: [
      [
        { x: 30, y: 38 },
        { x: 34, y: 30 },
        { x: 38, y: 38 },
        { x: 44, y: 30 },
        { x: 50, y: 38 },
        { x: 56, y: 30 },
        { x: 60, y: 38 },
        { x: 58, y: 55 },
        { x: 55, y: 68 },
      ],
    ],
    dots: [],
  },
  '٤': {
    // 4 (arbaʿa) — reversed-3 curl
    strokes: [
      [
        { x: 60, y: 30 },
        { x: 48, y: 30 },
        { x: 40, y: 38 },
        { x: 46, y: 46 },
        { x: 56, y: 50 },
        { x: 48, y: 58 },
        { x: 38, y: 62 },
        { x: 42, y: 72 },
        { x: 54, y: 74 },
      ],
    ],
    dots: [],
  },
  '٥': {
    // 5 (khamsa) — small heart-shaped loop, open at top
    strokes: [
      [
        { x: 42, y: 40 },
        { x: 36, y: 48 },
        { x: 38, y: 58 },
        { x: 48, y: 64 },
        { x: 60, y: 60 },
        { x: 64, y: 50 },
        { x: 58, y: 42 },
        { x: 50, y: 42 },
      ],
    ],
    dots: [],
  },
  '٦': {
    // 6 (sitta) — diagonal stroke down to a small base
    strokes: [
      [
        { x: 58, y: 32 },
        { x: 54, y: 42 },
        { x: 48, y: 54 },
        { x: 42, y: 66 },
        { x: 40, y: 74 },
      ],
    ],
    dots: [],
  },
  '٧': {
    // 7 (sabʿa) — upward V (checkmark opening to the top)
    strokes: [
      [
        { x: 36, y: 32 },
        { x: 44, y: 50 },
        { x: 50, y: 66 },
        { x: 56, y: 50 },
        { x: 64, y: 32 },
      ],
    ],
    dots: [],
  },
  '٨': {
    // 8 (thamāniya) — inverted V opening downward
    strokes: [
      [
        { x: 36, y: 70 },
        { x: 44, y: 52 },
        { x: 50, y: 36 },
        { x: 56, y: 52 },
        { x: 64, y: 70 },
      ],
    ],
    dots: [],
  },
  '٩': {
    // 9 (tisʿa) — loop on top with a straight descending tail
    strokes: [
      [
        { x: 56, y: 38 },
        { x: 48, y: 34 },
        { x: 42, y: 40 },
        { x: 44, y: 48 },
        { x: 52, y: 50 },
        { x: 58, y: 44 },
      ],
      [
        { x: 56, y: 46 },
        { x: 55, y: 58 },
        { x: 54, y: 70 },
        { x: 53, y: 78 },
      ],
    ],
    dots: [],
  },

  // Diacritics
  '◌َ': {
    // Fatha
    strokes: [
      [
        { x: 60, y: 20 },
        { x: 40, y: 30 },
      ],
    ],
    dots: [],
  },
  '◌ِ': {
    // Kasra
    strokes: [
      [
        { x: 60, y: 70 },
        { x: 40, y: 80 },
      ],
    ],
    dots: [],
  },
  '◌ُ': {
    // Damma
    strokes: [
      [
        { x: 45, y: 25 },
        { x: 50, y: 20 },
        { x: 55, y: 25 },
        { x: 50, y: 30 },
        { x: 45, y: 25 },
        { x: 40, y: 35 },
      ],
    ],
    dots: [],
  },
  '◌ْ': {
    // Sukun
    strokes: [
      [
        { x: 50, y: 20 },
        { x: 55, y: 25 },
        { x: 50, y: 30 },
        { x: 45, y: 25 },
        { x: 50, y: 20 },
      ],
    ],
    dots: [],
  },
  '◌ّ': {
    // Shadda
    strokes: [
      [
        { x: 60, y: 20 },
        { x: 55, y: 30 },
        { x: 50, y: 20 },
        { x: 45, y: 30 },
        { x: 40, y: 20 },
      ],
    ],
    dots: [],
  },
  '◌ً': {
    // Fathatan
    strokes: [
      [
        { x: 60, y: 15 },
        { x: 40, y: 25 },
      ],
      [
        { x: 60, y: 25 },
        { x: 40, y: 35 },
      ],
    ],
    dots: [],
  },
  '◌ٍ': {
    // Kasratan
    strokes: [
      [
        { x: 60, y: 65 },
        { x: 40, y: 75 },
      ],
      [
        { x: 60, y: 75 },
        { x: 40, y: 85 },
      ],
    ],
    dots: [],
  },
  '◌ٌ': {
    // Dammatan
    strokes: [
      [
        { x: 55, y: 20 },
        { x: 60, y: 15 },
        { x: 65, y: 20 },
        { x: 60, y: 25 },
        { x: 55, y: 20 },
        { x: 50, y: 30 },
      ],
      [
        { x: 40, y: 20 },
        { x: 45, y: 15 },
        { x: 50, y: 20 },
        { x: 45, y: 25 },
        { x: 40, y: 20 },
        { x: 35, y: 30 },
      ],
    ],
    dots: [],
  },
};

export default STROKE_DATA;
