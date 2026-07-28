/**
 * Eastern Arabic numerals (٠–٩), the digits used across much of the Arabic-
 * speaking world. Unlike letters, numerals have no positional forms — they are
 * always written the same way — so each entry exposes a single `isolated` form.
 *
 * The `forms: { isolated }` shape mirrors a non-joining letter so the existing
 * progress / SM-2 / heatmap helpers (which key off letter.name + form keys)
 * work for numerals without special-casing.
 *
 * NOTE on names: `name` is the storage key inside `arabic_progress`. We prefix
 * with "Num" so a numeral can never collide with a letter name (e.g. a future
 * letter romanized "Five" is impossible, but the prefix keeps the namespaces
 * cleanly separated regardless).
 *
 * Digit order is written left-to-right here for code readability, but the
 * numerals themselves render identically in either direction.
 */

export const NUMBERS = [
  {
    letter: '٠',
    name: 'Num0',
    roman: '0 / ṣifr',
    hint: 'A small dot or tiny circle on the baseline.',
  },
  {
    letter: '١',
    name: 'Num1',
    roman: '1 / wāḥid',
    hint: 'A single vertical stroke, top to bottom.',
  },
  {
    letter: '٢',
    name: 'Num2',
    roman: '2 / ithnān',
    hint: 'A small hook or check, like a tilted V opening up-right.',
  },
  {
    letter: '٣',
    name: 'Num3',
    roman: '3 / thalātha',
    hint: 'Three connected humps along the top, like a small crown.',
  },
  {
    letter: '٤',
    name: 'Num4',
    roman: '4 / arbaʿa',
    hint: 'A backwards-3 shape, or a curl resembling a reversed ٣.',
  },
  {
    letter: '٥',
    name: 'Num5',
    roman: '5 / khamsa',
    hint: 'A small heart-shaped loop, like an empty circle pinched at the top.',
  },
  {
    letter: '٦',
    name: 'Num6',
    roman: '6 / sitta',
    hint: 'A straight diagonal stroke down to a small base — resembles a Latin 7.',
  },
  {
    letter: '٧',
    name: 'Num7',
    roman: '7 / sabʿa',
    hint: 'An upward V, like a checkmark opening to the top.',
  },
  {
    letter: '٨',
    name: 'Num8',
    roman: '8 / thamāniya',
    hint: 'An inverted V or upside-down ٧, opening downward.',
  },
  {
    letter: '٩',
    name: 'Num9',
    roman: '9 / tisʿa',
    hint: 'A small loop on top with a tail descending straight down — like a Latin 9.',
  },
].map(entry => ({ ...entry, forms: { isolated: entry.letter }, isNumber: true }));
