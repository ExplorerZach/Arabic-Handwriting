/**
 * Lesson order — groups Arabic letters by shape family for structured learning.
 *
 * Each group contains letters that share a common base shape, differing mainly
 * in dot count/placement. Learning them together reinforces muscle memory for
 * the shared stroke pattern before moving to a new shape.
 *
 * The array order is the recommended teaching sequence: simple strokes first
 * (Alef, Ba-family) → hooks → loops → complex shapes.
 */

export const LESSON_GROUPS = [
  {
    name: 'Alef',
    description: 'Single vertical stroke',
    letters: ['ا'],
  },
  {
    name: 'Ba / Ta / Tha',
    description: 'Flat baseline, dots vary',
    letters: ['ب', 'ت', 'ث'],
  },
  {
    name: 'Jim / Ha / Kha',
    description: 'Hooked bowl shape',
    letters: ['ج', 'ح', 'خ'],
  },
  {
    name: 'Dal / Dhal',
    description: 'Angular wedge',
    letters: ['د', 'ذ'],
  },
  {
    name: 'Ra / Zay',
    description: 'Gentle descending curve',
    letters: ['ر', 'ز'],
  },
  {
    name: 'Sin / Shin',
    description: 'Three-wave baseline',
    letters: ['س', 'ش'],
  },
  {
    name: 'Sad / Dad',
    description: 'Round head, long tail',
    letters: ['ص', 'ض'],
  },
  {
    name: 'Ta / Dha',
    description: 'Oval loop with upright stroke',
    letters: ['ط', 'ظ'],
  },
  {
    name: 'Ain / Ghain',
    description: 'Open comma loop',
    letters: ['ع', 'غ'],
  },
  {
    name: 'Fa / Qaf',
    description: 'Circle with tail',
    letters: ['ف', 'ق'],
  },
  {
    name: 'Kaf',
    description: 'Tooth shape with accent',
    letters: ['ك'],
  },
  {
    name: 'Lam',
    description: 'Tall hook',
    letters: ['ل'],
  },
  {
    name: 'Mim',
    description: 'Tight circle with tail',
    letters: ['م'],
  },
  {
    name: 'Nun',
    description: 'Shallow bowl',
    letters: ['ن'],
  },
  {
    name: 'Ha',
    description: 'Figure-eight loops',
    letters: ['ه'],
  },
  {
    name: 'Waw',
    description: 'Circle with descending tail',
    letters: ['و'],
  },
  {
    name: 'Ya',
    description: 'Two humps with hook',
    letters: ['ي'],
  },
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
