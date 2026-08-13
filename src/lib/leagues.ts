/**
 * A league's identity outside the database: the slug that names it in the URL —
 * `/fixtures?league=primeira-liga` — the cookie that remembers which one was
 * last chosen, and the flag that marks it on screen. The only place any of those
 * vocabularies is written down.
 *
 * Pure, like [`diary-filters.ts`](./diary-filters.ts) and
 * [`verdicts.ts`](./verdicts.ts), and for the same reason: `parseLeagueScope`
 * reads an untrusted URL parameter, which is exactly the sort of decision worth
 * a test, and a test must be able to import this without Prisma in the loop.
 * Purity is load-bearing a second way now — [`proxy.ts`](../proxy.ts) imports
 * from here, and the proxy runs before any rendering does.
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
 * A slug's *shape*, which is all anything can check without the database.
 *
 * Validation of a league splits in two, and this is the half that is pure:
 * shape here, existence on arrival, where `parseLeagueScope` falls back to a
 * real league for a slug it does not recognise. `back.ts` needs the first half
 * to rebuild a "Back to fixtures" href without echoing its input, and `proxy.ts`
 * needs it to refuse writing an arbitrary query parameter into a cookie. It
 * lives here rather than in either of them because this file owns league
 * identity, and because a third copy of one regexp is exactly the drift a shared
 * vocabulary exists to prevent.
 *
 * Bounded as well as charset-checked: `leagueSlug` can only ever produce this
 * alphabet, and 64 characters is far beyond any competition's name.
 */
const SLUG = /^[a-z0-9-]{1,64}$/

export function isLeagueSlug(value: string): boolean {
  return SLUG.test(value)
}

/**
 * The cookie holding the league last chosen on `/fixtures`.
 *
 * **The app's third store, and the rule that admits it: a preference the server
 * must know *before* it renders lives in a cookie.** A league is a location on
 * this screen — it decides what the server queried — so its *default* cannot be
 * a `localStorage` preference like the two indexes' sorts: the page would have
 * to become a client island and would paint the wrong competition first. A
 * cookie travels on the request, so the first paint is already right and the
 * page stays a server component with no JavaScript at all.
 *
 * It holds the **slug**, not an id, so there is one league vocabulary rather
 * than two — which is also what lets `parseLeagueScope` read it with no second
 * parser. Named for the `madooo-players-*` convention the `localStorage` keys
 * already follow.
 *
 * Per browser rather than per account, which is the stated cost: a phone and a
 * laptop remember separately, exactly as the sort and layout preferences do.
 */
export const LEAGUE_COOKIE = 'madooo-league'

/**
 * Which league to draw: the one the URL asked for, else the one last chosen,
 * else the first offered.
 *
 * `unknown` rather than `string` for `value`, because this is handed the raw
 * value out of `searchParams` — which is `string | string[] | undefined`, an
 * array whenever the parameter is repeated. `remembered` is a plain string
 * because a cookie has exactly one value.
 *
 * **Both are validated against the leagues the database actually returned**,
 * not merely parsed, for `parseLeague`'s reason: a slug naming a league with no
 * matches this season must fall back to a real one rather than scoping the page
 * to nothing. A stored value is as untrusted as a URL parameter and outlives
 * deploys, so the cookie gets no more credit than the address bar does — it is
 * simply consulted second. `null` only when there are no leagues at all, which
 * is the caller's empty state rather than this function's problem.
 */
export function parseLeagueScope(
  value: unknown,
  leagues: readonly LeagueOption[],
  remembered: string | null = null,
): LeagueOption | null {
  if (leagues.length === 0) return null
  const slug = Array.isArray(value) ? value[0] : value
  const named = (wanted: unknown) =>
    leagues.find((league) => leagueSlug(league.name) === wanted)
  return named(slug) ?? named(remembered) ?? leagues[0]
}

/* ------------------------------------------------------------------ flags -- */

/**
 * What a flag needs of a league, which is its country and nothing else.
 *
 * An interface rather than a bare `country: string` parameter, because a
 * league's two strings are interchangeable to the compiler: `flagClass(
 * league.name)` would type-check and then return null forever. Structural
 * typing means a `League` row, or a `LeagueTab`, satisfies this without saying
 * so.
 */
export interface LeagueIdentity {
  /** `League.country`, as API-Football spells it: "England", "Portugal", "Spain". */
  country: string
}

/**
 * The class in `globals.css` that paints a country's flag.
 *
 * Keyed on `searchKey` for `leagueSlug`'s reason — one rule for flattening a
 * name rather than two that can drift — which also means a provider recasing
 * "England" costs nothing.
 *
 * **A `Map`, not a `Record`.** `noUncheckedIndexedAccess` is off, so indexing a
 * `Record<string, string>` types as `string` and the `?? null` below would read
 * as dead code to the compiler while being very much alive at runtime. `.get`
 * is honest for free, and cannot answer a country called "toString" with a
 * function.
 */
const FLAGS = new Map([
  ['england', 'flag-gb-eng'],
  ['portugal', 'flag-pt'],
  ['spain', 'flag-es'],
])

/**
 * The flag class for a league, or `null` where we have vendored no file.
 *
 * **`null` is the whole reason this is legal against `AGENTS.md`'s first
 * constraint.** The map above names no league, no id and no season — it is
 * indexed by a value that came out of the `League` table, so it cannot be
 * consulted without a row. A fourth league needs no edit here to work: it draws
 * the pill exactly as one is drawn today. The moment the fallback became an
 * invented flag or a reserved gap, the map would be part of the price of a
 * league and the constraint would be broken.
 *
 * The unmapped case is not hypothetical. API-Football's country for the
 * Champions League is "World".
 */
export function flagClass(league: LeagueIdentity): string | null {
  return FLAGS.get(searchKey(league.country)) ?? null
}
