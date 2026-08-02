/**
 * Reading API-Football's round strings.
 *
 * `Match.round` holds the provider's own label, `"Regular Season - 1"`, because
 * that is what the fixture list carries and inventing a column for the number
 * would mean two sources for one fact. Everything that needs to order or display
 * a round parses it here.
 *
 * This module exists **so that pages do not import `sync.ts`**. `roundLabel`
 * started life there, but `sync.ts` imports the API-Football client, and
 * constraint #2 in AGENTS.md says nothing reachable from a page render may
 * appear in that file's import graph. Both sides depend on this module instead;
 * nothing depends outwards on the sync.
 */

/** `"Regular Season - 1"` and `"1"` both mean the same round. */
export function roundLabel(round: string): string {
  return /^\d+$/.test(round.trim()) ? `Regular Season - ${round.trim()}` : round
}

/**
 * The matchday number inside a round label, or `null` for a round that has no
 * number — a knockout tie in some future competition, say.
 *
 * Null rather than 0 or NaN so that callers have to decide what an unnumbered
 * round means to them, instead of silently sorting it to the front.
 */
export function roundNumber(round: string): number | null {
  const match = /(\d+)\s*$/.exec(round.trim())
  return match === null ? null : Number(match[1])
}

/** What the pager shows: `"Regular Season - 6"` → `"Matchday 6"`. */
export function roundDisplay(round: string): string {
  const number = roundNumber(round)
  return number === null ? round : `Matchday ${number}`
}

/**
 * Order rounds the way a season runs. Unnumbered rounds sort last, in the order
 * the provider gave them, rather than being dropped — the fixture list is the
 * calendar, and a round we cannot label is still a round that exists.
 */
export function compareRounds(a: string, b: string): number {
  const left = roundNumber(a)
  const right = roundNumber(b)
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}
