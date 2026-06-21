/**
 * Arabic Diacritics (Harakat) — essential vowel marks and symbols used to
 * guide pronunciation in Arabic text. Since diacritics do not stand alone,
 * we display them relative to a dotted circle placeholder (◌).
 */

export const DIACRITICS = [
  { letter: '◌َ', name: 'DiacriticFatha', roman: 'Fatha / a', hint: 'A short diagonal stroke above the letter, from top-right to bottom-left.' },
  { letter: '◌ِ', name: 'DiacriticKasra', roman: 'Kasra / i', hint: 'A short diagonal stroke below the letter, from top-right to bottom-left.' },
  { letter: '◌ُ', name: 'DiacriticDamma', roman: 'Damma / u', hint: 'A small loop above the letter, like a tiny waw, tail pointing left.' },
  { letter: '◌ْ', name: 'DiacriticSukun', roman: 'Sukun', hint: 'A small circle above the letter, indicating no vowel.' },
  { letter: '◌ّ', name: 'DiacriticShadda', roman: 'Shadda', hint: 'A small "w" shape above the letter, drawn from right to left.' },
  { letter: '◌ً', name: 'DiacriticFathatan', roman: 'Fathatan / an', hint: 'Two short diagonal strokes above the letter (tanwin).' },
  { letter: '◌ٍ', name: 'DiacriticKasratan', roman: 'Kasratan / in', hint: 'Two short diagonal strokes below the letter (tanwin).' },
  { letter: '◌ٌ', name: 'DiacriticDammatan', roman: 'Dammatan / un', hint: 'Two small loops above the letter (tanwin).' },
].map((entry) => ({ ...entry, forms: { isolated: entry.letter }, isDiacritic: true }));
