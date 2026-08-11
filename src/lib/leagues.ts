/**
 * The league in the URL — `/fixtures?league=primeira-liga` — and the only place
 * that vocabulary is written down.
 *
 * Pure, like [`diary-filters.ts`](./diary-filters.ts) and
 * [`verdicts.ts`](./verdicts.ts), and for the same reason: `parseLeagueScope`
 * reads an untrusted URL parameter, which is exactly the sort of decision worth
 * a test, and a test must be able to import this without Prisma in the loop.
 *
 * **Why a slug rather than an id.** Three candidates, and the existing
 * conventions rule out two of them:
 *
 *   - `League.id` is our own autoincrement, assigned in sync order. It is not
 *     stable across Neon branches, so a bookmarked URL could name one
 *     competition on a laptop and another in production. (`parseLeague` in
 *     [`rankings.ts`](./rankings.ts) does use the id — but in `localStorage`,
 *     which never crosses a machine.)
 *   - `apiFootballId` is the provider's vocabulary, and
 *     [`matchday-pager.tsx`](../components/matchday-pager.tsx) keeps that out of
 *     our addresses deliberately — the same boundary the sync draws, applied to
 *     the address bar. It is also meaningless to a reader.
 *
 * The slug is derived from the name and never written down, which is the rule
 * `leaguesInSeason` and `parseLeague` already state for league identity. Its two
 * risks are cheap: a provider rename, or two leagues sharing a name, both
 * degrade to "the parser does not recognise it, so the page opens on the default
 * league" — how `parseFilter` and `backLink` already treat unrecognised input.
 */

import { searchKey, type LeagueOption } from './rankings'

/**
 * "Primeira Liga" → `primeira-liga`.
 *
 * Built on `searchKey`, which is the app's one rule for flattening a name —
 * lower-cased and stripped of the diacritics a UK keyboard cannot produce. One
 * normalisation rule with two uses rather than two that can drift: it is what
 * makes "Primera División" come out as `primera-division` rather than as
 * something no one can type.
 */
export function leagueSlug(name: string): string {
  return searchKey(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Which league the URL asked for, defaulting to the first offered.
 *
 * `unknown` rather than `string`, because this is handed the raw value out of
 * `searchParams` — which is `string | string[] | undefined`, an array whenever
 * the parameter is repeated.
 *
 * **Validated against the leagues the database actually returned**, not merely
 * parsed, for `parseLeague`'s reason: a slug naming a league with no matches
 * this season must fall back to a real one rather than scoping the page to
 * nothing. `null` only when there are no leagues at all, which is the caller's
 * empty state rather than this function's problem.
 */
export function parseLeagueScope(
  value: unknown,
  leagues: readonly LeagueOption[],
): LeagueOption | null {
  if (leagues.length === 0) return null
  const slug = Array.isArray(value) ? value[0] : value
  return leagues.find((league) => leagueSlug(league.name) === slug) ?? leagues[0]
}
