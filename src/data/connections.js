/**
 * Connected-writing drills (ROADMAP #9).
 *
 * Each entry is a short 2–3 letter join the learner writes as ONE connected
 * string — the exact skill isolated-glyph practice doesn't build. The `joined`
 * string is the pre-joined prompt/watermark/progress key; the font shapes it
 * automatically (same mechanism as words.js).
 *
 * Ordered pedagogically by join pattern:
 * - 'basic' — 2-letter joins exercising initial→final transitions
 * - 'medial' — 3-letter joins where the middle letter sits in medial form
 * - 'nonjoiner' — joins ending in a non-joining letter (ا د ذ ر ز و)
 *
 * Every entry holds the ordered `letters` array, the `joined` string,
 * `roman`, `meaning`, and a `hint` describing the join to practice.
 */

export const CONNECTIONS = [
  // ─── Basic 2-letter joins ───────────────────────────────
  {
    letters: ['ب', 'ا'],
    joined: 'با',
    roman: 'bā',
    meaning: 'with',
    hint: 'Ba connects into Alef — flat base flows up into the tall stroke.',
  },
  {
    letters: ['ب', 'ي'],
    joined: 'بي',
    roman: 'bī',
    meaning: 'in / by',
    hint: 'Ba connects into Ya — one dot below, then two dots below the bowl.',
  },
  {
    letters: ['ت', 'ب'],
    joined: 'تب',
    roman: 'tab',
    meaning: 'to write',
    hint: 'Ta connects into Ba — two dots above, then one dot below.',
  },
  {
    letters: ['ث', 'ل'],
    joined: 'ثل',
    roman: 'thal',
    meaning: 'three',
    hint: 'Tha connects into Lam — three dots above, then the tall hook.',
  },
  {
    letters: ['ج', 'م'],
    joined: 'جم',
    roman: 'jam',
    meaning: 'gathering',
    hint: 'Jim connects into Mim — the hook sweeps into the tight circle.',
  },
  {
    letters: ['ح', 'ب'],
    joined: 'حب',
    roman: 'ḥubb',
    meaning: 'love',
    hint: 'Ha connects into Ba — the open hook flows into the flat base.',
  },
  {
    letters: ['خ', 'ب'],
    joined: 'خب',
    roman: 'khub',
    meaning: 'bread (start)',
    hint: 'Kha connects into Ba — one dot above, then the flat base.',
  },
  {
    letters: ['س', 'ل'],
    joined: 'سل',
    roman: 'sal',
    meaning: 'to ask',
    hint: 'Sin connects into Lam — three waves flow into the tall hook.',
  },
  {
    letters: ['ش', 'ك'],
    joined: 'شك',
    roman: 'shak',
    meaning: 'doubt',
    hint: 'Shin connects into Kaf — three dots above, then the tooth with accent.',
  },
  {
    letters: ['ص', 'ب'],
    joined: 'صب',
    roman: 'ṣab',
    meaning: 'morning (start)',
    hint: 'Sad connects into Ba — the round head flows into the flat base.',
  },
  {
    letters: ['ض', 'ر'],
    joined: 'ضر',
    roman: 'ḍar',
    meaning: 'harm',
    hint: 'Dad connects into Ra — the emphatic round head into the descending curve.',
  },
  {
    letters: ['ط', 'ب'],
    joined: 'طب',
    roman: 'ṭib',
    meaning: 'medicine',
    hint: 'Tta connects into Ba — the emphatic loop into the flat base.',
  },
  {
    letters: ['ظ', 'ه'],
    joined: 'ظه',
    roman: 'ẓah',
    meaning: 'back / noon (start)',
    hint: 'Dha connects into Ha — the emphatic oval into the figure-eight.',
  },
  {
    letters: ['ع', 'م'],
    joined: 'عم',
    roman: 'ʿam',
    meaning: 'uncle',
    hint: 'Ain connects into Mim — the open loop into the tight circle.',
  },
  {
    letters: ['غ', 'ر'],
    joined: 'غر',
    roman: 'ghar',
    meaning: 'cave',
    hint: 'Ghain connects into Ra — the open loop with dot above into the curve.',
  },
  {
    letters: ['ف', 'ت'],
    joined: 'فت',
    roman: 'fat',
    meaning: 'opening (start)',
    hint: 'Fa connects into Ta — the circle and dot above into the tooth.',
  },
  {
    letters: ['ق', 'ل'],
    joined: 'قل',
    roman: 'qal',
    meaning: 'to say',
    hint: 'Qaf connects into Lam — the deep bowl into the tall hook.',
  },
  {
    letters: ['ك', 'ت'],
    joined: 'كت',
    roman: 'kat',
    meaning: 'writing (start)',
    hint: 'Kaf connects into Ta — the tooth with accent into the tooth.',
  },
  {
    letters: ['م', 'ن'],
    joined: 'من',
    roman: 'min',
    meaning: 'from',
    hint: 'Mim connects into Nun — the circle flows into the shallow bowl.',
  },
  {
    letters: ['ن', 'ع'],
    joined: 'نع',
    roman: 'naʿ',
    meaning: 'yes (start)',
    hint: 'Nun connects into Ain — the shallow bowl into the open curve.',
  },
  {
    letters: ['ه', 'ذ'],
    joined: 'هذ',
    roman: 'hadh',
    meaning: 'this (start)',
    hint: 'Ha connects into Dhal — the figure-eight into the wedge with dot.',
  },
  {
    letters: ['ي', 'د'],
    joined: 'يد',
    roman: 'yad',
    meaning: 'hand',
    hint: 'Ya connects into Dal — the two humps into the angular wedge.',
  },

  // ─── 3-letter joins (medial form in the middle) ─────────
  {
    letters: ['ف', 'ت', 'ح'],
    joined: 'فتح',
    roman: 'fatḥ',
    meaning: 'opening / victory',
    hint: 'Fa into Ta into Ha — circle, tooth, then the open hook.',
  },
  {
    letters: ['ك', 'ت', 'ب'],
    joined: 'كتب',
    roman: 'katab',
    meaning: 'he wrote',
    hint: 'Kaf into Ta into Ba — three connected letters on one baseline.',
  },
  {
    letters: ['ه', 'ذ', 'ا'],
    joined: 'هذا',
    roman: 'hādhā',
    meaning: 'this',
    hint: 'Ha into Dhal into Alef — figure-eight, wedge, then the tall stroke.',
  },
  {
    letters: ['ج', 'م', 'ل'],
    joined: 'جمل',
    roman: 'jamal',
    meaning: 'camel',
    hint: 'Jim into Mim into Lam — hook, circle, then the tall hook.',
  },
  {
    letters: ['ض', 'ر', 'ب'],
    joined: 'ضرب',
    roman: 'ḍarab',
    meaning: 'to hit',
    hint: 'Dad into Ra into Ba — emphatic head, curve, then the flat base.',
  },

  // ─── Joins ending in a non-joiner ───────────────────────
  {
    letters: ['ل', 'ا'],
    joined: 'لا',
    roman: 'lā',
    meaning: 'no',
    hint: 'Lam into Alef — the Lam-Alef ligature, one of the most common joins.',
  },
  {
    letters: ['و', 'ص'],
    joined: 'وص',
    roman: 'waṣ',
    meaning: 'arrival (start)',
    hint: 'Waw into Sad — the circle with tail into the round head.',
  },
  {
    letters: ['م', 'ا'],
    joined: 'ما',
    roman: 'mā',
    meaning: 'what / not',
    hint: 'Mim into Alef — the circle exits into the vertical stroke.',
  },
  {
    letters: ['ن', 'و'],
    joined: 'نو',
    roman: 'naw',
    meaning: 'light (start)',
    hint: 'Nun into Waw — the shallow bowl into the circle with tail.',
  },
];

export const ALL_CONNECTIONS = CONNECTIONS;

/**
 * Progress formKey for connections. MUST stay distinct from the word
 * formKey ('word'): several joined strings (من, لا, كتب, …) are also real
 * words, so sharing a formKey would make connection and word practice
 * clobber each other's SM-2 data, due-queue entries, and analytics.
 */
export const CONNECTION_FORM_KEY = 'connection';
