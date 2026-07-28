/**
 * Common Arabic words and ligature combinations for practice.
 *
 * Organized by difficulty:
 * - 'basic' — 2–4 letter combinations covering all 22 joiner letters
 * - 'common' — everyday words beginners should know
 * - 'phrases' — short phrases for advanced practice
 *
 * Every joiner letter (ب ت ث ج ح خ س ش ص ض ط ظ ع غ ف ق ك ل م ن ه ي)
 * has at least one forward-connection example in the Basic Ligatures group.
 */

export const WORD_GROUPS = [
  {
    name: 'Basic Ligatures',
    description: 'Common 2–4 letter combinations covering all letter connections',
    words: [
      {
        word: 'لا',
        roman: 'lā',
        meaning: 'no',
        hint: 'The Lam-Alef ligature — one of the most common in Arabic.',
      },
      {
        word: 'بر',
        roman: 'br',
        meaning: 'land/righteousness',
        hint: 'Ba connects into Ra — practice the join from flat base to curve.',
      },
      {
        word: 'من',
        roman: 'min',
        meaning: 'from/who',
        hint: 'Mim connects into Nun — circle flows into shallow bowl.',
      },
      {
        word: 'في',
        roman: 'fī',
        meaning: 'in',
        hint: 'Fa connects into Ya — dot above then dots below.',
      },
      {
        word: 'ان',
        roman: 'an',
        meaning: 'that',
        hint: 'Alef stands alone, Nun follows — non-joiner to joiner.',
      },
      {
        word: 'ما',
        roman: 'mā',
        meaning: 'what/not',
        hint: 'Mim connects into Alef — circle exits into vertical.',
      },
      {
        word: 'جمل',
        roman: 'jamal',
        meaning: 'camel',
        hint: 'Jim connects into Mim, Mim into Lam — hook flowing into circle.',
      },
      {
        word: 'خبز',
        roman: 'khubz',
        meaning: 'bread',
        hint: 'Kha connects into Ba, Ba into Zay — top dot then flat base.',
      },
      {
        word: 'ثعلب',
        roman: 'thaʿlab',
        meaning: 'fox',
        hint: 'Tha connects into Ain — three dots above into open loop.',
      },
      {
        word: 'ضرب',
        roman: 'ḍarb',
        meaning: 'to hit',
        hint: 'Dad connects into Ra — emphatic round head flows into the curve.',
      },
      {
        word: 'طبيب',
        roman: 'ṭabīb',
        meaning: 'doctor',
        hint: 'Tta connects into Ba — emphatic loop into flat base.',
      },
      {
        word: 'ظهر',
        roman: 'ẓahr',
        meaning: 'back / noon',
        hint: 'Dha connects into Ha — emphatic oval into figure-eight.',
      },
      {
        word: 'غرفة',
        roman: 'ghurfa',
        meaning: 'room',
        hint: 'Ghain connects into Ra — open loop with dot above into curve.',
      },
      {
        word: 'نعم',
        roman: 'naʿam',
        meaning: 'yes',
        hint: 'Nun connects into Ain — shallow bowl into open curve.',
      },
      {
        word: 'فتح',
        roman: 'fatḥ',
        meaning: 'opening / victory',
        hint: 'Fa connects into Ta — circle and dot above into tooth.',
      },
      {
        word: 'يسر',
        roman: 'yusr',
        meaning: 'ease',
        hint: 'Ya connects into Sin — two humps and dots below into waves.',
      },
      {
        word: 'هذا',
        roman: 'hādhā',
        meaning: 'this',
        hint: 'Ha connects into Dhal — figure-eight into wedge with dot.',
      },
    ],
  },
  {
    name: 'Common Words',
    description: 'Everyday vocabulary',
    words: [
      {
        word: 'كتب',
        roman: 'kataba',
        meaning: 'he wrote',
        hint: 'Three connected letters — Kaf to Ta to Ba.',
      },
      {
        word: 'بسم',
        roman: 'bism',
        meaning: 'in the name of',
        hint: 'Ba to Sin to Mim — flat base flows into waves then circle.',
      },
      {
        word: 'الله',
        roman: 'Allāh',
        meaning: 'God',
        hint: 'Alef Lam-Lam Ha — the most sacred word in Arabic calligraphy.',
      },
      {
        word: 'سلام',
        roman: 'salām',
        meaning: 'peace',
        hint: 'Sin to Lam to Alef to Mim — flowing waves into tall strokes.',
      },
      {
        word: 'نور',
        roman: 'nūr',
        meaning: 'light',
        hint: 'Nun to Waw to Ra — bowl into circle into curve.',
      },
      {
        word: 'قلب',
        roman: 'qalb',
        meaning: 'heart',
        hint: 'Qaf to Lam to Ba — deep bowl, tall hook, flat base.',
      },
      { word: 'كلمة', roman: 'kalima', meaning: 'word', hint: 'Kaf to Lam to Mim to Ta Marbuta.' },
      { word: 'حب', roman: 'ḥubb', meaning: 'love', hint: 'Ha to Ba — hook into flat base.' },
    ],
  },
  {
    name: 'Short Phrases',
    description: 'Practice connected writing flow',
    words: [
      {
        word: 'مع السلامة',
        roman: 'maʿ as-salāma',
        meaning: 'goodbye',
        hint: 'Two words — practice spacing between word groups.',
      },
      {
        word: 'ان شاء الله',
        roman: 'in shāʾ Allāh',
        meaning: 'God willing',
        hint: 'Three words — common phrase in daily speech.',
      },
      {
        word: 'الحمد لله',
        roman: 'al-ḥamdu lillāh',
        meaning: 'praise be to God',
        hint: 'Two words — practice the definite article al-.',
      },
      {
        word: 'صباح الخير',
        roman: 'ṣabāḥ al-khayr',
        meaning: 'good morning',
        hint: 'Two words with the definite article connecting them.',
      },
    ],
  },
  {
    name: 'Greetings',
    description: 'Common everyday greetings',
    words: [
      {
        word: 'مرحبا',
        roman: 'marḥaba',
        meaning: 'hello',
        hint: 'Universal greeting — starts with Mim.',
      },
      { word: 'أهلا', roman: 'ahlan', meaning: 'welcome', hint: 'Often paired with وسهلا.' },
      {
        word: 'صباح الخير',
        roman: 'ṣabāḥ al-khayr',
        meaning: 'good morning',
        hint: 'Morning greeting with the definite article.',
      },
      {
        word: 'مساء الخير',
        roman: 'masāʾ al-khayr',
        meaning: 'good evening',
        hint: 'Evening version of the greeting.',
      },
      { word: 'شكرا', roman: 'shukran', meaning: 'thank you', hint: 'Shin to Kaf to Ra.' },
      {
        word: 'مع السلامة',
        roman: 'maʿ as-salāma',
        meaning: 'goodbye',
        hint: 'Literally "with safety".',
      },
    ],
  },
  {
    name: 'Quranic Terms',
    description: 'Frequently occurring words',
    words: [
      { word: 'الله', roman: 'Allāh', meaning: 'God', hint: 'The definite article plus الله.' },
      {
        word: 'رب',
        roman: 'rabb',
        meaning: 'Lord / sustainer',
        hint: 'Ra to Ba — a foundational name.',
      },
      {
        word: 'رحمن',
        roman: 'raḥmān',
        meaning: 'the Merciful',
        hint: 'Ra to Ha to Mim to Alif Nun.',
      },
      {
        word: 'رحيم',
        roman: 'raḥīm',
        meaning: 'the Compassionate',
        hint: 'Closely related to Raḥmān.',
      },
      { word: 'علم', roman: 'ʿilm', meaning: 'knowledge', hint: 'Ayn to Lam to Mim.' },
      { word: 'قلم', roman: 'qalam', meaning: 'pen', hint: 'Qaf to Lam to Mim.' },
    ],
  },
];

export const ALL_WORDS = WORD_GROUPS.flatMap(g => g.words.map(w => ({ ...w, group: g.name })));
