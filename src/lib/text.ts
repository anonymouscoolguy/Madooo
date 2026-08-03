/**
 * Wording that depends on a number.
 *
 * Its own module rather than a corner of [`verdicts.ts`](./verdicts.ts), because
 * nothing here knows what a judgement is — this is English, and the next screen
 * that counts something will want it too.
 */

/**
 * The right form of a noun for a count. `plural(1, 'note')` is `'note'`;
 * `plural(0, 'note')` is `'notes'`, because English pluralises zero.
 *
 * It returns the **noun alone**, not `'1 note'`, and that is what the callers
 * need: `foundations.md`'s rule is that a number you can add up is monospaced, so
 * the numeral is wrapped in its own span and cannot come back glued to the word.
 *
 * Regular plurals only — an `-s` on the end. Every noun this app counts is one
 * (verdict, note, match), and a table of exceptions with no entries in it would
 * be a promise the code does not keep.
 */
export function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`
}
