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

const _STROKE_DATA_FORMS = {
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
    // Ba — flat horizontal base, right lip curls down, left tail curls up.
    // Isolated: enter top-right (95, 30), sweep right-to-left along the hull
    // at y≈50, ride through the left tail rising to (0, 35), then over the top
    // edge to close the bowl, one dot below center.
    isolated: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 44 },
          { x: 73, y: 50 },
          { x: 45, y: 52 },
          { x: 20, y: 52 },
          { x: 8, y: 52 },
          { x: 2, y: 46 },
          { x: 1, y: 36 },
        ],
        [
          { x: 1, y: 36 },
          { x: 4, y: 24 },
          { x: 14, y: 12 },
          { x: 32, y: 6 },
          { x: 50, y: 8 },
        ],
      ],
      dots: [{ x: 53, y: 90 }],
    },
    // Initial (بـ): tatweel extends the right side. Enter from the right
    // connector tail, sweep along the baseline to the left wall, then arc
    // over the top back toward the right.
    initial: {
      strokes: [
        [
          { x: 95, y: 50 },
          { x: 88, y: 52 },
          { x: 74, y: 52 },
          { x: 50, y: 52 },
          { x: 25, y: 52 },
          { x: 8, y: 52 },
          { x: 2, y: 46 },
          { x: 1, y: 36 },
        ],
        [
          { x: 1, y: 36 },
          { x: 4, y: 24 },
          { x: 14, y: 12 },
          { x: 32, y: 6 },
          { x: 50, y: 8 },
          { x: 66, y: 12 },
          { x: 72, y: 24 },
        ],
      ],
      dots: [{ x: 40, y: 90 }],
    },
    // Medial (ـبـ): tatweel on both sides. Enter from the right connector,
    // sweep through the baseline to the left connector, up the left wall,
    // then arc over the top back to the right.
    medial: {
      strokes: [
        [
          { x: 95, y: 50 },
          { x: 88, y: 52 },
          { x: 75, y: 52 },
          { x: 50, y: 52 },
          { x: 28, y: 52 },
          { x: 12, y: 52 },
          { x: 2, y: 50 },
        ],
        [
          { x: 2, y: 50 },
          { x: 4, y: 36 },
          { x: 4, y: 24 },
          { x: 14, y: 12 },
          { x: 32, y: 6 },
          { x: 50, y: 8 },
          { x: 66, y: 12 },
          { x: 75, y: 24 },
        ],
      ],
      dots: [{ x: 52, y: 90 }],
    },
    // Final (ـب): tatweel extends the left side. Enter from the top-right,
    // sweep along the baseline to the left connector tail, up the left wall,
    // then arc over the top back toward the right.
    final: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 44 },
          { x: 75, y: 50 },
          { x: 55, y: 52 },
          { x: 35, y: 52 },
          { x: 20, y: 52 },
          { x: 8, y: 52 },
          { x: 2, y: 50 },
        ],
        [
          { x: 2, y: 50 },
          { x: 4, y: 36 },
          { x: 4, y: 24 },
          { x: 14, y: 12 },
          { x: 32, y: 6 },
          { x: 50, y: 8 },
          { x: 66, y: 12 },
        ],
      ],
      dots: [{ x: 65, y: 90 }],
    },
  },
  ت: {
    // Ta — Ba base lifted ~15px up so the two dots sit above it.
    // Positional forms: same bowl shape with tatweel connectors, dots above.
    isolated: {
      strokes: [
        [
          { x: 95, y: 52 },
          { x: 85, y: 72 },
          { x: 70, y: 84 },
          { x: 48, y: 88 },
          { x: 24, y: 88 },
          { x: 10, y: 86 },
          { x: 3, y: 78 },
          { x: 2, y: 64 },
        ],
        [
          { x: 2, y: 64 },
          { x: 6, y: 48 },
          { x: 18, y: 38 },
          { x: 36, y: 32 },
          { x: 50, y: 36 },
        ],
      ],
      dots: [
        { x: 42, y: 12 },
        { x: 56, y: 16 },
      ],
    },
    // Initial (تـ): enter from right connector, sweep baseline left, arc over top.
    initial: {
      strokes: [
        [
          { x: 95, y: 52 },
          { x: 88, y: 64 },
          { x: 75, y: 72 },
          { x: 50, y: 76 },
          { x: 25, y: 76 },
          { x: 8, y: 76 },
          { x: 2, y: 68 },
          { x: 1, y: 56 },
        ],
        [
          { x: 1, y: 56 },
          { x: 3, y: 44 },
          { x: 3, y: 32 },
          { x: 10, y: 24 },
          { x: 25, y: 18 },
          { x: 45, y: 16 },
          { x: 60, y: 18 },
          { x: 70, y: 24 },
        ],
      ],
      dots: [{ x: 42, y: 10 }],
    },
    // Medial (ـتـ): connectors both sides, sweep through baseline, arc over top.
    medial: {
      strokes: [
        [
          { x: 95, y: 52 },
          { x: 88, y: 64 },
          { x: 75, y: 72 },
          { x: 50, y: 76 },
          { x: 25, y: 76 },
          { x: 12, y: 76 },
          { x: 2, y: 68 },
        ],
        [
          { x: 2, y: 68 },
          { x: 4, y: 44 },
          { x: 4, y: 32 },
          { x: 12, y: 24 },
          { x: 28, y: 18 },
          { x: 48, y: 16 },
          { x: 66, y: 18 },
          { x: 75, y: 24 },
        ],
      ],
      dots: [{ x: 52, y: 10 }],
    },
    // Final (ـت): enter top-right, sweep to left connector, arc over top.
    final: {
      strokes: [
        [
          { x: 95, y: 30 },
          { x: 88, y: 46 },
          { x: 75, y: 60 },
          { x: 55, y: 72 },
          { x: 35, y: 76 },
          { x: 20, y: 76 },
          { x: 8, y: 76 },
          { x: 2, y: 68 },
        ],
        [
          { x: 2, y: 68 },
          { x: 4, y: 44 },
          { x: 4, y: 32 },
          { x: 12, y: 24 },
          { x: 28, y: 18 },
          { x: 48, y: 16 },
          { x: 66, y: 18 },
        ],
      ],
      dots: [{ x: 62, y: 10 }],
    },
  },
  ث: {
    // Tha — Ba base lifted, three dots above in triangle. Same positional bowl shape.
    isolated: {
      strokes: [
        [
          { x: 95, y: 60 },
          { x: 85, y: 78 },
          { x: 70, y: 88 },
          { x: 48, y: 91 },
          { x: 24, y: 91 },
          { x: 10, y: 89 },
          { x: 4, y: 82 },
          { x: 2, y: 70 },
        ],
        [
          { x: 2, y: 70 },
          { x: 7, y: 56 },
          { x: 18, y: 46 },
          { x: 36, y: 41 },
          { x: 50, y: 45 },
        ],
      ],
      dots: [
        { x: 40, y: 8 },
        { x: 56, y: 12 },
        { x: 48, y: 30 },
      ],
    },
    // Initial (ثـ): enter from right connector, sweep baseline left, arc over top.
    initial: {
      strokes: [
        [
          { x: 95, y: 52 },
          { x: 88, y: 64 },
          { x: 75, y: 72 },
          { x: 50, y: 76 },
          { x: 25, y: 76 },
          { x: 8, y: 76 },
          { x: 2, y: 68 },
          { x: 1, y: 56 },
        ],
        [
          { x: 1, y: 56 },
          { x: 3, y: 44 },
          { x: 3, y: 32 },
          { x: 10, y: 24 },
          { x: 25, y: 18 },
          { x: 45, y: 16 },
          { x: 60, y: 18 },
          { x: 70, y: 24 },
        ],
      ],
      dots: [{ x: 35, y: 10 }],
    },
    // Medial (ـثـ): connectors both sides, sweep through baseline, arc over top.
    medial: {
      strokes: [
        [
          { x: 95, y: 52 },
          { x: 88, y: 64 },
          { x: 75, y: 72 },
          { x: 50, y: 76 },
          { x: 25, y: 76 },
          { x: 12, y: 76 },
          { x: 2, y: 68 },
        ],
        [
          { x: 2, y: 68 },
          { x: 4, y: 44 },
          { x: 4, y: 32 },
          { x: 12, y: 24 },
          { x: 28, y: 18 },
          { x: 48, y: 16 },
          { x: 66, y: 18 },
          { x: 75, y: 24 },
        ],
      ],
      dots: [{ x: 48, y: 10 }],
    },
    // Final (ـث): enter top-right, sweep to left connector, arc over top.
    final: {
      strokes: [
        [
          { x: 95, y: 30 },
          { x: 88, y: 46 },
          { x: 75, y: 60 },
          { x: 55, y: 72 },
          { x: 35, y: 76 },
          { x: 20, y: 76 },
          { x: 8, y: 76 },
          { x: 2, y: 68 },
        ],
        [
          { x: 2, y: 68 },
          { x: 4, y: 44 },
          { x: 4, y: 32 },
          { x: 12, y: 24 },
          { x: 28, y: 18 },
          { x: 48, y: 16 },
          { x: 66, y: 18 },
        ],
      ],
      dots: [{ x: 61, y: 10 }],
    },
  },
  ج: {
    // Jim — hook shape: top bowl, left descender, bottom sweep right. One dot inside.
    isolated: {
      strokes: [
        [
          { x: 95, y: 10 },
          { x: 70, y: 12 },
          { x: 48, y: 14 },
          { x: 32, y: 18 },
          { x: 22, y: 26 },
          { x: 14, y: 34 },
          { x: 8, y: 42 },
          { x: 4, y: 52 },
          { x: 3, y: 62 },
          { x: 5, y: 72 },
          { x: 12, y: 80 },
          { x: 14, y: 84 },
        ],
        [
          { x: 14, y: 84 },
          { x: 30, y: 90 },
          { x: 48, y: 92 },
          { x: 66, y: 92 },
          { x: 82, y: 91 },
          { x: 94, y: 90 },
        ],
      ],
      dots: [{ x: 48, y: 54 }],
    },
    // Initial (جـ): enter from right connector, hook bowl, down centerline, sweep right.
    initial: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 20 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 30, y: 8 },
          { x: 15, y: 16 },
          { x: 12, y: 28 },
          { x: 10, y: 42 },
          { x: 7, y: 56 },
          { x: 4, y: 68 },
        ],
        [
          { x: 4, y: 68 },
          { x: 4, y: 78 },
          { x: 8, y: 88 },
          { x: 18, y: 94 },
          { x: 35, y: 96 },
          { x: 55, y: 95 },
          { x: 72, y: 92 },
          { x: 85, y: 88 },
        ],
      ],
      dots: [{ x: 41, y: 54 }],
    },
    // Medial (ـجـ): connectors both sides, hook bowl, down centerline, sweep right.
    medial: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 20 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 35, y: 8 },
          { x: 20, y: 16 },
          { x: 15, y: 28 },
          { x: 12, y: 42 },
          { x: 10, y: 56 },
          { x: 8, y: 68 },
        ],
        [
          { x: 8, y: 68 },
          { x: 10, y: 78 },
          { x: 14, y: 88 },
          { x: 22, y: 94 },
          { x: 35, y: 96 },
          { x: 55, y: 95 },
          { x: 75, y: 92 },
          { x: 90, y: 88 },
        ],
      ],
      dots: [{ x: 56, y: 54 }],
    },
    // Final (ـج): enter top, hook bowl, down centerline, sweep right to tail.
    final: {
      strokes: [
        [
          { x: 95, y: 8 },
          { x: 87, y: 16 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 35, y: 8 },
          { x: 20, y: 16 },
          { x: 18, y: 28 },
          { x: 16, y: 42 },
          { x: 14, y: 56 },
          { x: 12, y: 68 },
        ],
        [
          { x: 12, y: 68 },
          { x: 14, y: 78 },
          { x: 18, y: 88 },
          { x: 26, y: 94 },
          { x: 40, y: 96 },
          { x: 58, y: 95 },
          { x: 75, y: 92 },
          { x: 90, y: 88 },
          { x: 98, y: 92 },
        ],
      ],
      dots: [{ x: 62, y: 54 }],
    },
  },
  ح: {
    // Hha — same hook as Jim, no dot.
    isolated: {
      strokes: [
        [
          { x: 95, y: 10 },
          { x: 70, y: 12 },
          { x: 48, y: 14 },
          { x: 32, y: 18 },
          { x: 22, y: 26 },
          { x: 14, y: 34 },
          { x: 8, y: 42 },
          { x: 4, y: 52 },
          { x: 3, y: 62 },
          { x: 5, y: 72 },
          { x: 12, y: 80 },
          { x: 14, y: 84 },
        ],
        [
          { x: 14, y: 84 },
          { x: 30, y: 90 },
          { x: 48, y: 92 },
          { x: 66, y: 92 },
          { x: 82, y: 91 },
          { x: 94, y: 90 },
        ],
      ],
      dots: [],
    },
    // Initial (حـ): same as Jim initial, no dot.
    initial: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 20 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 30, y: 8 },
          { x: 15, y: 16 },
          { x: 12, y: 28 },
          { x: 10, y: 42 },
          { x: 7, y: 56 },
          { x: 4, y: 68 },
        ],
        [
          { x: 4, y: 68 },
          { x: 4, y: 78 },
          { x: 8, y: 88 },
          { x: 18, y: 94 },
          { x: 35, y: 96 },
          { x: 55, y: 95 },
          { x: 72, y: 92 },
          { x: 85, y: 88 },
        ],
      ],
      dots: [],
    },
    // Medial (ـحـ): same as Jim medial, no dot.
    medial: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 88, y: 20 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 35, y: 8 },
          { x: 20, y: 16 },
          { x: 15, y: 28 },
          { x: 12, y: 42 },
          { x: 10, y: 56 },
          { x: 8, y: 68 },
        ],
        [
          { x: 8, y: 68 },
          { x: 10, y: 78 },
          { x: 14, y: 88 },
          { x: 22, y: 94 },
          { x: 35, y: 96 },
          { x: 55, y: 95 },
          { x: 75, y: 92 },
          { x: 90, y: 88 },
        ],
      ],
      dots: [],
    },
    // Final (ـح): same as Jim final, no dot.
    final: {
      strokes: [
        [
          { x: 95, y: 8 },
          { x: 87, y: 16 },
          { x: 75, y: 10 },
          { x: 55, y: 6 },
          { x: 35, y: 8 },
          { x: 20, y: 16 },
          { x: 18, y: 28 },
          { x: 16, y: 42 },
          { x: 14, y: 56 },
          { x: 12, y: 68 },
        ],
        [
          { x: 12, y: 68 },
          { x: 14, y: 78 },
          { x: 18, y: 88 },
          { x: 26, y: 94 },
          { x: 40, y: 96 },
          { x: 58, y: 95 },
          { x: 75, y: 92 },
          { x: 90, y: 88 },
          { x: 98, y: 92 },
        ],
      ],
      dots: [],
    },
  },
  خ: {
    // Kha — same hook as Jim, one dot above (taller glyph).
    isolated: {
      strokes: [
        [
          { x: 95, y: 30 },
          { x: 70, y: 31 },
          { x: 48, y: 32 },
          { x: 32, y: 34 },
          { x: 22, y: 38 },
          { x: 14, y: 44 },
          { x: 8, y: 52 },
          { x: 4, y: 62 },
          { x: 3, y: 70 },
          { x: 6, y: 78 },
          { x: 13, y: 84 },
          { x: 15, y: 87 },
        ],
        [
          { x: 15, y: 87 },
          { x: 30, y: 90 },
          { x: 48, y: 92 },
          { x: 66, y: 93 },
          { x: 82, y: 93 },
          { x: 92, y: 92 },
        ],
      ],
      dots: [{ x: 41, y: 6 }],
    },
    // Initial (خـ): same body as Jim, dot above (taller bbox).
    initial: {
      strokes: [
        [
          { x: 95, y: 48 },
          { x: 88, y: 38 },
          { x: 75, y: 28 },
          { x: 55, y: 24 },
          { x: 30, y: 26 },
          { x: 15, y: 34 },
          { x: 12, y: 46 },
          { x: 10, y: 58 },
          { x: 7, y: 70 },
          { x: 4, y: 82 },
        ],
        [
          { x: 4, y: 82 },
          { x: 4, y: 90 },
          { x: 8, y: 96 },
          { x: 18, y: 100 },
          { x: 35, y: 100 },
          { x: 55, y: 99 },
          { x: 72, y: 96 },
          { x: 85, y: 92 },
        ],
      ],
      dots: [{ x: 35, y: 6 }],
    },
    // Medial (ـخـ): same body as Jim medial, dot above.
    medial: {
      strokes: [
        [
          { x: 95, y: 48 },
          { x: 88, y: 38 },
          { x: 75, y: 28 },
          { x: 55, y: 24 },
          { x: 35, y: 26 },
          { x: 20, y: 34 },
          { x: 15, y: 46 },
          { x: 12, y: 58 },
          { x: 10, y: 70 },
          { x: 8, y: 82 },
        ],
        [
          { x: 8, y: 82 },
          { x: 10, y: 90 },
          { x: 14, y: 96 },
          { x: 22, y: 100 },
          { x: 35, y: 100 },
          { x: 55, y: 99 },
          { x: 75, y: 96 },
          { x: 90, y: 92 },
        ],
      ],
      dots: [{ x: 51, y: 6 }],
    },
    // Final (ـخ): same body as Jim final, dot above.
    final: {
      strokes: [
        [
          { x: 95, y: 28 },
          { x: 87, y: 34 },
          { x: 75, y: 28 },
          { x: 55, y: 24 },
          { x: 35, y: 26 },
          { x: 20, y: 34 },
          { x: 18, y: 46 },
          { x: 16, y: 58 },
          { x: 14, y: 70 },
          { x: 12, y: 82 },
        ],
        [
          { x: 12, y: 82 },
          { x: 14, y: 90 },
          { x: 18, y: 96 },
          { x: 26, y: 100 },
          { x: 40, y: 100 },
          { x: 58, y: 99 },
          { x: 75, y: 96 },
          { x: 90, y: 92 },
          { x: 98, y: 96 },
        ],
      ],
      dots: [{ x: 57, y: 6 }],
    },
  },
  د: {
    strokes: [
      [
        { x: 50, y: 15 },
        { x: 62, y: 22 },
        { x: 75, y: 32 },
        { x: 88, y: 45 },
        { x: 95, y: 58 },
        { x: 95, y: 70 },
        { x: 90, y: 78 },
      ],
      [
        { x: 90, y: 78 },
        { x: 70, y: 85 },
        { x: 50, y: 88 },
        { x: 30, y: 88 },
        { x: 10, y: 85 },
        { x: 3, y: 80 },
      ],
    ],
    dots: [],
  },
  ذ: {
    strokes: [
      [
        { x: 70, y: 45 },
        { x: 80, y: 52 },
        { x: 88, y: 60 },
        { x: 94, y: 68 },
        { x: 95, y: 80 },
        { x: 90, y: 86 },
      ],
      [
        { x: 90, y: 86 },
        { x: 70, y: 90 },
        { x: 50, y: 92 },
        { x: 30, y: 93 },
        { x: 12, y: 92 },
        { x: 5, y: 88 },
      ],
    ],
    dots: [{ x: 42, y: 9 }],
  },
  ر: {
    strokes: [
      [
        { x: 82, y: 15 },
        { x: 90, y: 30 },
        { x: 94, y: 45 },
        { x: 90, y: 60 },
        { x: 82, y: 70 },
        { x: 70, y: 78 },
        { x: 52, y: 84 },
        { x: 32, y: 88 },
        { x: 12, y: 90 },
      ],
    ],
    dots: [],
  },
  ز: {
    strokes: [
      [
        { x: 84, y: 50 },
        { x: 90, y: 60 },
        { x: 94, y: 70 },
        { x: 88, y: 80 },
        { x: 74, y: 86 },
        { x: 58, y: 90 },
        { x: 40, y: 93 },
        { x: 22, y: 96 },
      ],
    ],
    dots: [{ x: 58, y: 8 }],
  },
  س: {
    strokes: [
      [
        { x: 97, y: 18 },
        { x: 90, y: 22 },
        { x: 82, y: 25 },
        { x: 72, y: 27 },
        { x: 62, y: 26 },
        { x: 57, y: 30 },
        { x: 58, y: 40 },
        { x: 60, y: 50 },
        { x: 60, y: 62 },
        { x: 58, y: 72 },
        { x: 50, y: 80 },
        { x: 55, y: 86 },
        { x: 48, y: 90 },
        { x: 35, y: 90 },
        { x: 22, y: 88 },
        { x: 12, y: 85 },
        { x: 5, y: 80 },
        { x: 2, y: 72 },
        { x: 3, y: 60 },
        { x: 4, y: 50 },
        { x: 6, y: 42 },
        { x: 10, y: 33 },
      ],
    ],
    dots: [],
  },
  ش: {
    strokes: [
      [
        { x: 97, y: 52 },
        { x: 90, y: 55 },
        { x: 82, y: 58 },
        { x: 72, y: 60 },
        { x: 62, y: 60 },
        { x: 59, y: 63 },
        { x: 60, y: 70 },
        { x: 60, y: 78 },
        { x: 58, y: 84 },
        { x: 52, y: 88 },
        { x: 42, y: 89 },
        { x: 30, y: 89 },
        { x: 20, y: 89 },
        { x: 12, y: 88 },
        { x: 5, y: 84 },
        { x: 2, y: 77 },
        { x: 3, y: 68 },
        { x: 5, y: 61 },
        { x: 7, y: 57 },
      ],
    ],
    dots: [
      { x: 70, y: 4 },
      { x: 62, y: 15 },
      { x: 78, y: 15 },
    ],
  },
  ص: {
    strokes: [
      [
        { x: 78, y: 12 },
        { x: 88, y: 16 },
        { x: 95, y: 22 },
        { x: 98, y: 32 },
        { x: 94, y: 40 },
        { x: 86, y: 44 },
        { x: 78, y: 44 },
        { x: 72, y: 38 },
        { x: 72, y: 30 },
        { x: 76, y: 24 },
      ],
      [
        { x: 80, y: 48 },
        { x: 68, y: 52 },
        { x: 54, y: 52 },
        { x: 48, y: 48 },
        { x: 40, y: 44 },
        { x: 30, y: 40 },
        { x: 20, y: 36 },
        { x: 12, y: 33 },
        { x: 7, y: 35 },
        { x: 4, y: 42 },
        { x: 3, y: 52 },
        { x: 3, y: 62 },
        { x: 5, y: 72 },
        { x: 10, y: 82 },
        { x: 18, y: 88 },
        { x: 28, y: 90 },
        { x: 38, y: 89 },
        { x: 46, y: 84 },
        { x: 50, y: 74 },
      ],
    ],
    dots: [],
  },
  ض: {
    strokes: [
      [
        { x: 78, y: 36 },
        { x: 88, y: 40 },
        { x: 95, y: 46 },
        { x: 98, y: 56 },
        { x: 94, y: 64 },
        { x: 86, y: 68 },
        { x: 78, y: 68 },
        { x: 72, y: 62 },
        { x: 72, y: 54 },
        { x: 76, y: 48 },
      ],
      [
        { x: 80, y: 72 },
        { x: 68, y: 76 },
        { x: 54, y: 76 },
        { x: 48, y: 71 },
        { x: 40, y: 67 },
        { x: 30, y: 62 },
        { x: 20, y: 57 },
        { x: 12, y: 51 },
        { x: 7, y: 51 },
        { x: 4, y: 58 },
        { x: 3, y: 68 },
        { x: 3, y: 80 },
        { x: 5, y: 90 },
        { x: 12, y: 95 },
        { x: 22, y: 97 },
        { x: 32, y: 96 },
        { x: 48, y: 82 },
      ],
    ],
    dots: [{ x: 70, y: 7 }],
  },
  ط: {
    strokes: [
      [
        { x: 78, y: 58 },
        { x: 62, y: 58 },
        { x: 44, y: 58 },
        { x: 26, y: 59 },
        { x: 12, y: 60 },
        { x: 5, y: 66 },
        { x: 3, y: 76 },
        { x: 5, y: 86 },
        { x: 12, y: 94 },
        { x: 24, y: 99 },
        { x: 40, y: 100 },
        { x: 58, y: 99 },
        { x: 74, y: 95 },
        { x: 86, y: 88 },
        { x: 90, y: 78 },
        { x: 87, y: 66 },
        { x: 80, y: 58 },
      ],
      [
        { x: 40, y: 56 },
        { x: 40, y: 42 },
        { x: 39, y: 28 },
        { x: 38, y: 14 },
        { x: 38, y: 4 },
      ],
    ],
    dots: [],
  },
  ظ: {
    strokes: [
      [
        { x: 78, y: 58 },
        { x: 62, y: 58 },
        { x: 44, y: 58 },
        { x: 26, y: 59 },
        { x: 12, y: 60 },
        { x: 5, y: 66 },
        { x: 3, y: 76 },
        { x: 5, y: 86 },
        { x: 12, y: 94 },
        { x: 24, y: 99 },
        { x: 40, y: 100 },
        { x: 58, y: 99 },
        { x: 74, y: 95 },
        { x: 86, y: 88 },
        { x: 90, y: 78 },
        { x: 87, y: 66 },
        { x: 80, y: 58 },
      ],
      [
        { x: 40, y: 56 },
        { x: 40, y: 42 },
        { x: 39, y: 28 },
        { x: 38, y: 14 },
        { x: 38, y: 4 },
      ],
    ],
    dots: [{ x: 76, y: 32 }],
  },
  ع: {
    strokes: [
      [
        { x: 28, y: 2 },
        { x: 30, y: 8 },
        { x: 32, y: 12 },
        { x: 28, y: 18 },
        { x: 40, y: 22 },
        { x: 48, y: 26 },
        { x: 32, y: 28 },
        { x: 24, y: 32 },
        { x: 20, y: 38 },
      ],
      [
        { x: 16, y: 42 },
        { x: 11, y: 50 },
        { x: 6, y: 58 },
        { x: 4, y: 66 },
        { x: 3, y: 72 },
        { x: 5, y: 78 },
        { x: 10, y: 83 },
        { x: 18, y: 86 },
        { x: 30, y: 88 },
      ],
      [
        { x: 30, y: 88 },
        { x: 45, y: 90 },
        { x: 60, y: 90 },
        { x: 75, y: 90 },
        { x: 90, y: 90 },
      ],
    ],
    dots: [],
  },
  غ: {
    strokes: [
      [
        { x: 27, y: 20 },
        { x: 28, y: 24 },
        { x: 30, y: 28 },
        { x: 28, y: 33 },
        { x: 40, y: 36 },
        { x: 48, y: 40 },
        { x: 30, y: 44 },
      ],
      [
        { x: 18, y: 48 },
        { x: 12, y: 56 },
        { x: 6, y: 64 },
        { x: 3, y: 70 },
        { x: 3, y: 76 },
        { x: 6, y: 82 },
        { x: 12, y: 86 },
        { x: 22, y: 90 },
      ],
      [
        { x: 22, y: 90 },
        { x: 38, y: 92 },
        { x: 55, y: 92 },
        { x: 72, y: 92 },
        { x: 88, y: 92 },
      ],
    ],
    dots: [{ x: 18, y: 6 }],
  },
  ف: {
    strokes: [
      [
        { x: 66, y: 2 },
        { x: 68, y: 10 },
        { x: 65, y: 18 },
        { x: 70, y: 28 },
        { x: 80, y: 36 },
        { x: 90, y: 50 },
        { x: 96, y: 60 },
        { x: 88, y: 66 },
        { x: 78, y: 60 },
        { x: 74, y: 50 },
        { x: 78, y: 40 },
        { x: 88, y: 40 },
      ],
      [
        { x: 76, y: 62 },
        { x: 60, y: 68 },
        { x: 40, y: 72 },
        { x: 22, y: 74 },
        { x: 8, y: 72 },
        { x: 3, y: 66 },
        { x: 3, y: 72 },
        { x: 8, y: 80 },
        { x: 18, y: 86 },
        { x: 32, y: 88 },
        { x: 48, y: 89 },
        { x: 62, y: 88 },
        { x: 72, y: 86 },
      ],
    ],
    dots: [{ x: 66, y: 8 }],
  },
  ق: {
    strokes: [
      [
        { x: 78, y: 34 },
        { x: 88, y: 42 },
        { x: 96, y: 52 },
        { x: 96, y: 62 },
        { x: 86, y: 66 },
        { x: 73, y: 62 },
        { x: 65, y: 52 },
        { x: 66, y: 44 },
        { x: 74, y: 40 },
      ],
      [
        { x: 64, y: 58 },
        { x: 50, y: 62 },
        { x: 32, y: 66 },
        { x: 16, y: 68 },
        { x: 7, y: 72 },
        { x: 4, y: 78 },
        { x: 8, y: 84 },
        { x: 18, y: 86 },
        { x: 34, y: 87 },
        { x: 52, y: 87 },
        { x: 68, y: 86 },
        { x: 80, y: 84 },
      ],
    ],
    dots: [
      { x: 63, y: 5 },
      { x: 82, y: 5 },
    ],
  },
  ك: {
    strokes: [
      [
        { x: 83, y: 44 },
        { x: 70, y: 48 },
        { x: 55, y: 52 },
        { x: 42, y: 56 },
        { x: 30, y: 58 },
        { x: 22, y: 56 },
        { x: 26, y: 45 },
        { x: 38, y: 34 },
        { x: 42, y: 48 },
      ],
      [
        { x: 95, y: 88 },
        { x: 93, y: 62 },
        { x: 90, y: 42 },
        { x: 85, y: 18 },
        { x: 82, y: 12 },
        { x: 88, y: 30 },
      ],
      [
        { x: 95, y: 88 },
        { x: 72, y: 92 },
        { x: 50, y: 93 },
        { x: 28, y: 93 },
        { x: 8, y: 90 },
        { x: 1, y: 87 },
      ],
    ],
    dots: [],
  },
  ل: {
    strokes: [
      [
        { x: 88, y: 12 },
        { x: 90, y: 28 },
        { x: 92, y: 45 },
        { x: 94, y: 62 },
        { x: 94, y: 78 },
        { x: 88, y: 88 },
        { x: 74, y: 90 },
        { x: 55, y: 90 },
        { x: 35, y: 89 },
        { x: 15, y: 85 },
        { x: 4, y: 78 },
        { x: 6, y: 66 },
      ],
    ],
    dots: [],
  },
  م: {
    strokes: [
      [
        { x: 60, y: 12 },
        { x: 72, y: 15 },
        { x: 40, y: 18 },
        { x: 18, y: 22 },
        { x: 8, y: 30 },
        { x: 8, y: 42 },
        { x: 14, y: 52 },
        { x: 20, y: 62 },
        { x: 26, y: 72 },
        { x: 31, y: 82 },
        { x: 33, y: 90 },
      ],
    ],
    dots: [],
  },
  ن: {
    // Nun — open bowl, deep belly, single dot above.
    // Right neck at (90, 35), walk right wall down to (97, 65), then sweep the
    // bottom rim right-to-left at y≈85 through (50, 87) to left wall (4, 80),
    // up the left outer wall to (8, 55).
    strokes: [
      [
        { x: 90, y: 35 },
        { x: 95, y: 50 },
        { x: 96, y: 62 },
        { x: 92, y: 75 },
        { x: 84, y: 84 },
        { x: 68, y: 88 },
        { x: 50, y: 88 },
        { x: 32, y: 88 },
        { x: 16, y: 85 },
        { x: 5, y: 78 },
        { x: 2, y: 66 },
        { x: 5, y: 55 },
      ],
    ],
    dots: [{ x: 46, y: 9 }],
  },
  ه: {
    strokes: [
      [
        { x: 50, y: 12 },
        { x: 44, y: 22 },
        { x: 36, y: 32 },
        { x: 26, y: 42 },
        { x: 15, y: 50 },
        { x: 6, y: 58 },
        { x: 3, y: 66 },
        { x: 5, y: 74 },
        { x: 12, y: 78 },
        { x: 20, y: 78 },
        { x: 18, y: 68 },
        { x: 14, y: 60 },
      ],
      [
        { x: 20, y: 78 },
        { x: 40, y: 82 },
        { x: 58, y: 84 },
        { x: 70, y: 84 },
        { x: 80, y: 82 },
        { x: 85, y: 72 },
        { x: 86, y: 60 },
        { x: 82, y: 50 },
        { x: 74, y: 44 },
        { x: 62, y: 44 },
      ],
    ],
    dots: [],
  },
  و: {
    strokes: [
      [
        { x: 80, y: 20 },
        { x: 92, y: 28 },
        { x: 96, y: 38 },
        { x: 80, y: 44 },
        { x: 64, y: 42 },
        { x: 60, y: 30 },
        { x: 70, y: 22 },
      ],
      [
        { x: 90, y: 50 },
        { x: 88, y: 60 },
        { x: 80, y: 70 },
        { x: 68, y: 80 },
        { x: 52, y: 86 },
        { x: 36, y: 88 },
        { x: 30, y: 80 },
        { x: 38, y: 72 },
      ],
    ],
    dots: [],
  },
  ي: {
    // Ya — hook crest at top (y 0-40, x 53-100) descends to a bowl, two dots below.
    // Stroke 1 traces the hook: start at crest top-right (95, 6), arch left over
    // the top (70, 4), down the inner left (56, 25), then out along the shoulder
    // to the right wall (90, 42). Stroke 2: bowl from right lip (92, 48) sweeping
    // down-left along the hull (y 55-70) to left tip (2, 52), then back along the
    // bottom rim (y 85-92) to the center-bottom. Two dots below.
    strokes: [
      [
        { x: 95, y: 6 },
        { x: 85, y: 3 },
        { x: 70, y: 3 },
        { x: 60, y: 8 },
        { x: 55, y: 18 },
        { x: 55, y: 30 },
        { x: 62, y: 39 },
        { x: 76, y: 42 },
        { x: 90, y: 42 },
      ],
      [
        { x: 92, y: 50 },
        { x: 88, y: 58 },
        { x: 78, y: 64 },
        { x: 64, y: 66 },
        { x: 48, y: 66 },
        { x: 32, y: 64 },
        { x: 18, y: 58 },
        { x: 8, y: 52 },
        { x: 2, y: 46 },
      ],
      [
        { x: 46, y: 70 },
        { x: 52, y: 78 },
        { x: 52, y: 85 },
        { x: 44, y: 90 },
        { x: 34, y: 90 },
        { x: 26, y: 85 },
        { x: 28, y: 76 },
      ],
    ],
    dots: [
      { x: 42, y: 92 },
      { x: 57, y: 92 },
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

const FORM_KEYS = ['isolated', 'initial', 'medial', 'final'];

const isLegacyEntry = entry => !!entry && Array.isArray(entry.strokes);

/**
 * Normalize the per-letter map to `{ isolated, initial?, medial?, final? }`.
 * A legacy per-letter value `{ strokes, dots }` (isolated data only) is
 * wrapped as `{ isolated: value }`.
 */
function normalizeEntry(entry) {
  if (!entry) return undefined;
  if (isLegacyEntry(entry)) return { isolated: entry };
  return entry;
}

const STROKE_DATA = Object.fromEntries(
  Object.entries(_STROKE_DATA_FORMS).map(([k, v]) => [k, normalizeEntry(v)]),
);

/**
 * Return the { strokes, dots } for the given form, or undefined when the
 * requested form is not authored. STRICT — never falls back to `isolated`,
 * so callers (the Show Me button gate) can tell exactly which forms are safe
 * to animate.
 */
export function resolveStrokeData(entry, formKey) {
  if (!entry) return undefined;
  if (isLegacyEntry(entry)) return entry;
  return entry[formKey];
}

/**
 * True when the active form has authored stroke data (i.e. the Show Me
 * button should render and `playStrokeAnimation` is meaningful). Finds the
 * entry by letter key.
 */
export function resolveShowMeAvailable(entry, formKey) {
  return resolveStrokeData(entry, formKey) !== undefined;
}

export default STROKE_DATA;
