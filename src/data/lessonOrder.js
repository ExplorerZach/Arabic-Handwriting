/**
 * Lesson order — groups Arabic letters by shape family for structured learning.
 *
 * Each group contains letters that share a common base shape, differing mainly
 * in dot count/placement. Learning them together reinforces muscle memory for
 * the shared stroke pattern before moving to a new shape.
 *
 * The array order is the recommended teaching sequence: simple strokes first
 * (Alef, Ba-family) → hooks → loops → complex shapes.
 *
 * `nameKey` / `descKey` reference entries in `src/locales/index.js` so both
 * the group title and its description are translated at render time.
 */

export const LESSON_GROUPS = [
  { nameKey: 'lessonAlefName',    descKey: 'lessonAlefDesc',    letters: ['ا'] },
  { nameKey: 'lessonBaName',      descKey: 'lessonBaDesc',      letters: ['ب', 'ت', 'ث'] },
  { nameKey: 'lessonJimName',     descKey: 'lessonJimDesc',     letters: ['ج', 'ح', 'خ'] },
  { nameKey: 'lessonDalName',     descKey: 'lessonDalDesc',     letters: ['د', 'ذ'] },
  { nameKey: 'lessonRaName',      descKey: 'lessonRaDesc',      letters: ['ر', 'ز'] },
  { nameKey: 'lessonSinName',     descKey: 'lessonSinDesc',     letters: ['س', 'ش'] },
  { nameKey: 'lessonSadName',     descKey: 'lessonSadDesc',     letters: ['ص', 'ض'] },
  { nameKey: 'lessonTaEmphName',  descKey: 'lessonTaEmphDesc',  letters: ['ط', 'ظ'] },
  { nameKey: 'lessonAinName',     descKey: 'lessonAinDesc',     letters: ['ع', 'غ'] },
  { nameKey: 'lessonFaName',      descKey: 'lessonFaDesc',      letters: ['ف', 'ق'] },
  { nameKey: 'lessonKafName',     descKey: 'lessonKafDesc',     letters: ['ك'] },
  { nameKey: 'lessonLamName',     descKey: 'lessonLamDesc',     letters: ['ل'] },
  { nameKey: 'lessonMimName',     descKey: 'lessonMimDesc',     letters: ['م'] },
  { nameKey: 'lessonNunName',     descKey: 'lessonNunDesc',     letters: ['ن'] },
  { nameKey: 'lessonHaSoftName',  descKey: 'lessonHaSoftDesc',  letters: ['ه'] },
  { nameKey: 'lessonWawName',     descKey: 'lessonWawDesc',     letters: ['و'] },
  { nameKey: 'lessonYaName',      descKey: 'lessonYaDesc',      letters: ['ي'] },
];

/**
 * Flat list of letter characters in lesson order.
 * Used to map lesson index → letter character → LETTERS array index.
 */
export const LESSON_ORDER = LESSON_GROUPS.flatMap((g) => g.letters);

/**
 * Get the group index and position within that group for a given lesson index.
 */
export function getLessonGroup(lessonIndex) {
  let offset = 0;
  for (let i = 0; i < LESSON_GROUPS.length; i++) {
    const group = LESSON_GROUPS[i];
    if (lessonIndex < offset + group.letters.length) {
      return { group, groupIndex: i, positionInGroup: lessonIndex - offset };
    }
    offset += group.letters.length;
  }
  return { group: LESSON_GROUPS[0], groupIndex: 0, positionInGroup: 0 };
}
