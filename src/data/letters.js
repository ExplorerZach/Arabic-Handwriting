/** Arabic tatweel (kashida) — used to build connected letter forms */
const TATWEEL = 'ـ';

/** Letters that only join to the right (no left connection) */
const NON_JOINERS = new Set(['ا', 'د', 'ذ', 'ر', 'ز', 'و']);

/**
 * Generate the positional forms for a letter.
 * Non-joining letters get only isolated + final; others get all four.
 */
function generateForms(letter) {
  if (NON_JOINERS.has(letter)) {
    return { isolated: letter, final: TATWEEL + letter };
  }
  return {
    isolated: letter,
    initial: letter + TATWEEL,
    medial: TATWEEL + letter + TATWEEL,
    final: TATWEEL + letter,
  };
}

/**
 * The 28 Arabic letters with metadata and generated positional forms.
 *
 * NOTE on names: four letters share romanizations that would collide in
 * progress/history storage (keyed by `name`). To prevent data corruption we
 * use distinct English names for the collided pairs:
 *   ح (ḥāʾ, pharyngeal)  → "Hha"   ≠   ه (hāʾ)      → "Ha"
 *   ط (ṭāʾ, emphatic)    → "Tta"   ≠   ت (tāʾ)      → "Ta"
 * progress.js migrates pre-existing "Ha"/"Ta" data to the new names.
 */
export const LETTERS = [
  { letter: 'ا', name: 'Alef', roman: 'a / ā', hint: 'One tall vertical stroke, slightly slanted right.', nonJoiner: true },
  { letter: 'ب', name: 'Ba', roman: 'b', hint: 'Flat horizontal base, one dot below center.' },
  { letter: 'ت', name: 'Ta', roman: 't', hint: 'Same base as Ba — two dots above.' },
  { letter: 'ث', name: 'Tha', roman: 'th', hint: 'Same base — three dots above in a triangle.' },
  { letter: 'ج', name: 'Jim', roman: 'j', hint: 'Hook curves right then sweeps under, one dot below.' },
  { letter: 'ح', name: 'Hha', roman: 'ḥ', hint: 'Same hook shape as Jim — no dots.' },
  { letter: 'خ', name: 'Kha', roman: 'kh', hint: 'Same hook — one dot above.' },
  { letter: 'د', name: 'Dal', roman: 'd', hint: 'Angular wedge, like a right-angled hook.', nonJoiner: true },
  { letter: 'ذ', name: 'Dhal', roman: 'dh', hint: 'Same as Dal with one dot above.', nonJoiner: true },
  { letter: 'ر', name: 'Ra', roman: 'r', hint: 'Gentle curve swooping down to the right.', nonJoiner: true },
  { letter: 'ز', name: 'Zay', roman: 'z', hint: 'Same curve as Ra — one dot above.', nonJoiner: true },
  { letter: 'س', name: 'Sin', roman: 's', hint: 'Three small waves along the baseline.' },
  { letter: 'ش', name: 'Shin', roman: 'sh', hint: 'Same three waves — three dots above.' },
  { letter: 'ص', name: 'Sad', roman: 'ṣ', hint: 'Round head on the left, long tail sweeping right.' },
  { letter: 'ض', name: 'Dad', roman: 'ḍ', hint: 'Same as Sad — one dot above the head.' },
  { letter: 'ط', name: 'Tta', roman: 'ṭ', hint: 'Oval loop with a tall vertical stroke inside.' },
  { letter: 'ظ', name: 'Dha', roman: 'ẓ', hint: 'Same oval + stroke — one dot above.' },
  { letter: 'ع', name: 'Ain', roman: 'ʿ', hint: 'Open comma-like loop, tail curves down.' },
  { letter: 'غ', name: 'Ghain', roman: 'gh', hint: 'Same as Ain — one dot above.' },
  { letter: 'ف', name: 'Fa', roman: 'f', hint: 'Circle on the left, tail sweeping right, dot above.' },
  { letter: 'ق', name: 'Qaf', roman: 'q', hint: 'Deeper bowl than Fa — two dots above.' },
  { letter: 'ك', name: 'Kaf', roman: 'k', hint: 'Tooth-like shape with a diagonal accent stroke.' },
  { letter: 'ل', name: 'Lam', roman: 'l', hint: 'Tall hook curving left at top, sweeping right.' },
  { letter: 'م', name: 'Mim', roman: 'm', hint: 'Small tight circle with a descending tail.' },
  { letter: 'ن', name: 'Nun', roman: 'n', hint: 'Shallow bowl — one dot above.' },
  { letter: 'ه', name: 'Ha', roman: 'h', hint: 'Figure-eight-like loops — no dots.' },
  { letter: 'و', name: 'Waw', roman: 'w / ū', hint: 'Circle on the right, tail curves down-left.', nonJoiner: true },
  { letter: 'ي', name: 'Ya', roman: 'y / ī', hint: 'Two humps, tail hooks under with two dots below.' },
].map((entry) => ({ ...entry, forms: generateForms(entry.letter) }));
