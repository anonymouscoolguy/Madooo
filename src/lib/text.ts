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

/**
 * The shape a scoreline needs, rather than Prisma's `Match`.
 *
 * Structural, like `TeamIdentity` and `Judgeable`, so a row selected by any of
 * the query modules satisfies it without being named here — and so this stays
 * testable with a plain object.
 */
export interface Scored {
  homeGoals: number | null
  awayGoals: number | null
  homeTeam: { name: string }
  awayTeam: { name: string }
}

/**
 * `Chelsea 1–1 Arsenal`, or `Chelsea v Arsenal` when there is no result.
 *
 * **A null goal count means no result was recorded, not a goalless draw** — the
 * reading `FixtureCard` and the match page both take, and the reason this is a
 * function rather than a template literal at each call site. A fixture is in the
 * database from the moment it is scheduled, so most of a season is null for most
 * of a season.
 *
 * An en dash between the goals, not a hyphen, and the same character the match
 * page's own heading uses.
 */
/**
 * The two clubs and nothing between them.
 *
 * Its own function because two callers want it for reasons that are not "there
 * is no score yet": a match being played has a score the page deliberately does
 * not state, and one that never kicked off has none to state.
 */
export function fixtureName(match: Pick<Scored, 'homeTeam' | 'awayTeam'>): string {
  return `${match.homeTeam.name} v ${match.awayTeam.name}`
}

export function scoreline(match: Scored): string {
  const { homeGoals, awayGoals } = match

  if (homeGoals === null || awayGoals === null) return fixtureName(match)
  return `${match.homeTeam.name} ${homeGoals}–${awayGoals} ${match.awayTeam.name}`
}
