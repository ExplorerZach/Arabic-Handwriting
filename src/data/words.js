/**
 * Common Arabic words and ligature combinations for practice.
 *
 * Organized by difficulty:
 * - 'basic' — 2–3 letter combinations, common ligatures
 * - 'common' — everyday words beginners should know
 * - 'phrases' — short phrases for advanced practice
 */

export const WORD_GROUPS = [
  {
    name: 'Basic Ligatures',
    description: 'Common 2–3 letter combinations',
    words: [
      { word: 'لا', roman: 'lā', meaning: 'no', hint: 'The Lam-Alef ligature — one of the most common in Arabic.' },
      { word: 'بر', roman: 'br', meaning: 'land/righteousness', hint: 'Ba connects into Ra — practice the join from flat base to curve.' },
      { word: 'من', roman: 'min', meaning: 'from/who', hint: 'Mim connects into Nun — circle flows into shallow bowl.' },
      { word: 'في', roman: 'fī', meaning: 'in', hint: 'Fa connects into Ya — dot above then dots below.' },
      { word: 'ان', roman: 'an', meaning: 'that', hint: 'Alef stands alone, Nun follows — non-joiner to joiner.' },
      { word: 'ما', roman: 'mā', meaning: 'what/not', hint: 'Mim connects into Alef — circle exits into vertical.' },
    ],
  },
  {
    name: 'Common Words',
    description: 'Everyday vocabulary',
    words: [
      { word: 'كتب', roman: 'kataba', meaning: 'he wrote', hint: 'Three connected letters — Kaf to Ta to Ba.' },
      { word: 'بسم', roman: 'bism', meaning: 'in the name of', hint: 'Ba to Sin to Mim — flat base flows into waves then circle.' },
      { word: 'الله', roman: 'Allāh', meaning: 'God', hint: 'Alef Lam-Lam Ha — the most sacred word in Arabic calligraphy.' },
      { word: 'سلام', roman: 'salām', meaning: 'peace', hint: 'Sin to Lam to Alef to Mim — flowing waves into tall strokes.' },
      { word: 'نور', roman: 'nūr', meaning: 'light', hint: 'Nun to Waw to Ra — bowl into circle into curve.' },
      { word: 'قلب', roman: 'qalb', meaning: 'heart', hint: 'Qaf to Lam to Ba — deep bowl, tall hook, flat base.' },
      { word: 'كلمة', roman: 'kalima', meaning: 'word', hint: 'Kaf to Lam to Mim to Ta Marbuta.' },
      { word: 'حب', roman: 'ḥubb', meaning: 'love', hint: 'Ha to Ba — hook into flat base.' },
    ],
  },
  {
    name: 'Short Phrases',
    description: 'Practice connected writing flow',
    words: [
      { word: 'مع السلامة', roman: 'maʿ as-salāma', meaning: 'goodbye', hint: 'Two words — practice spacing between word groups.' },
      { word: 'ان شاء الله', roman: 'in shāʾ Allāh', meaning: 'God willing', hint: 'Three words — common phrase in daily speech.' },
      { word: 'الحمد لله', roman: 'al-ḥamdu lillāh', meaning: 'praise be to God', hint: 'Two words — practice the definite article al-.' },
      { word: 'صباح الخير', roman: 'ṣabāḥ al-khayr', meaning: 'good morning', hint: 'Two words with the definite article connecting them.' },
    ],
  },
];

/** Flat list of all words for easy indexing */
export const ALL_WORDS = WORD_GROUPS.flatMap((g) =>
  g.words.map((w) => ({ ...w, group: g.name }))
);
