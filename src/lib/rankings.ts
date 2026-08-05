/**
 * The vocabulary both indexes are drawn from: their sorts, their layouts, the
 * search normaliser and the league parser.
 *
 * The same table-plus-parser shape as [`diary-filters.ts`](./diary-filters.ts)
 * and [`player-views.ts`](./player-views.ts) — one list read by the control, the
 * empty state *and* the sort, so a slug cannot exist in storage that nothing
 * knows how to apply. Pure and Prisma-free, which is what lets
 * `rankings.test.ts` cover the comparators without a database.
 *
 * **The parsers read `localStorage`, not the URL, and that is the only
 * difference from those two files.** A stored value is exactly as untrusted as a
 * query parameter — it survives deploys, it can be edited by hand in devtools,
 * and it can name a league that has since stopped playing — so every one of them
 * falls back rather than refusing.
 *
 * Shared rather than copied per screen because a club and a player are ranked on
 * the same seven numbers and offered the same five sorts. Two sort tables meant
 * to agree cannot drift apart if there is only one of them — the argument that
 * made [`player-row.tsx`](../components/player-row.tsx) and
 * [`stat-tiles.tsx`](../components/stat-tiles.tsx) one component each. What stays
 * per screen is what actually differs: the storage keys, the row shape, and the
 * fold that builds it.
 */

/**
 * What a sort knows about a row, whether that row is a player or a club.
 *
 * Structural, so the comparators are generic over it and a test can build one by
 * hand without naming a query. The seven numbers happen to describe both: a club
 * has been judged so many times, has been given so many MVPs, and has been seen
 * in so many matches, exactly as a player has.
 */
export interface Ranking {
  id: number
  name: string
  /** Every judgement, tag or note. The "Most judged" key. */
  total: number
  mvps: number
  standouts: number
  flops: number
  /** Matches in which the user recorded something — a player's, or a club's. */
  seen: number
}

/* ----------------------------------------------------------------- layout -- */

export type Layout = 'list' | 'grid'

const LAYOUTS: readonly Layout[] = ['list', 'grid']

/** The stored layout, defaulting to the list — which is what the design draws first. */
export function parseLayout(raw: string | null): Layout {
  return LAYOUTS.find((layout) => layout === raw) ?? LAYOUTS[0]
}

/* ------------------------------------------------------------------ sorts -- */

/**
 * Names are compared through one explicit collator, never a bare
 * `localeCompare`.
 *
 * `compareSquadEntries` gets away with the bare call because it only ever runs
 * on the server. This one runs **twice** — once during SSR under Node's ICU
 * default, and again in the browser under whatever locale the reader has — and
 * two different orderings of one array is a hydration mismatch, not a cosmetic
 * difference. Pinning the locale makes both runs agree.
 *
 * It also sorts "Álvarez" beside "Alvarez" rather than after "Zirkzee", which a
 * codepoint comparison would not: a Premier League roster is full of diacritics,
 * and so is a list of clubs once it reaches La Liga.
 */
const NAMES = new Intl.Collator('en')

export interface Sort {
  /** What is stored: `madooo-players-sort` = `most-mvps`. */
  slug: string
  label: string
  compare: (a: Ranking, b: Ranking) => number
}

/** Highest first, and `by` is read off the row rather than named per comparator. */
function descending(by: (row: Ranking) => number) {
  return (a: Ranking, b: Ranking) => by(b) - by(a)
}

/**
 * Every comparator is a **total order**, and on the players index that matters
 * more than anywhere else in the app: the list is every player in the league, so
 * several hundred of them sit at zero on whichever key is leading. A chain that
 * ran out of tiebreakers would leave those hundreds in whatever order the
 * previous sort happened to leave them, and the tail would reshuffle every time
 * the reader switched sort and switched back.
 *
 * So each chain ends in `id`, which is unique. `seen` sits second in all four
 * numeric chains, and it is the one worth arguing for: among the zeroes it
 * floats the players — or the clubs — you actually watched above the ones you
 * never saw, which is the only distinction left down there.
 */
function chain(...comparators: ((a: Ranking, b: Ranking) => number)[]) {
  return (a: Ranking, b: Ranking) => {
    for (const comparator of comparators) {
      const order = comparator(a, b)
      if (order !== 0) return order
    }
    return 0
  }
}

const byName = (a: Ranking, b: Ranking) => NAMES.compare(a.name, b.name)
const byId = (a: Ranking, b: Ranking) => a.id - b.id
const byTotal = descending((row) => row.total)
const bySeen = descending((row) => row.seen)

/**
 * In the order the design draws them, and "Most judged" is first because it is
 * the default — `parseSort` falls back to index 0, so this order is load-bearing
 * rather than cosmetic.
 *
 * It is also the reason neither index needs a separate "the ones I have judged"
 * view: sorting by what you have written puts what you care about at the top of
 * a list that is otherwise the whole competition.
 */
export const SORTS: readonly Sort[] = [
  {
    slug: 'most-judged',
    label: 'Most judged',
    compare: chain(byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-mvps',
    label: 'Most MVPs',
    compare: chain(descending((row) => row.mvps), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-standouts',
    label: 'Most standouts',
    compare: chain(descending((row) => row.standouts), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-flops',
    label: 'Most flops',
    compare: chain(descending((row) => row.flops), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'name',
    label: 'Names A-Z',
    compare: chain(byName, byId),
  },
]

/** The stored sort, defaulting to Most judged. */
export function parseSort(raw: string | null): Sort {
  return SORTS.find((sort) => sort.slug === raw) ?? SORTS[0]
}

/* ---------------------------------------------------------------- leagues -- */

/** What the league select needs of a league, and what `parseLeague` validates against. */
export interface LeagueOption {
  id: number
  name: string
}

/** What is stored for "All leagues", and the value of the select's first option. */
export const ALL_LEAGUES = 'all'

/**
 * Which league id was stored, or `null` for all of them.
 *
 * **Validated against the leagues actually found**, not merely parsed as a
 * number. Nothing is written down about which leagues exist — hardcoding either
 * "Premier League" or an id would put a literal in product code, and
 * `League.id` is our own autoincrement while `39` is API-Football's id crossing
 * the sync boundary. So the caller passes what the database returned, and a
 * stored id naming a league that is no longer being played falls back to all
 * rather than filtering the list to nothing.
 */
export function parseLeague(raw: string | null, leagues: readonly LeagueOption[]): number | null {
  if (raw === null || raw === ALL_LEAGUES) return null
  const id = Number(raw)
  if (!Number.isInteger(id)) return null
  return leagues.some((league) => league.id === id) ? id : null
}

/* ----------------------------------------------------------------- search -- */

/**
 * A name flattened for searching: lower-cased, and stripped of the diacritics a
 * UK keyboard cannot produce.
 *
 * `NFD` splits "é" into "e" plus a combining accent, and the range erases the
 * combining marks — so "moises" finds Moisés Caicedo, "alvarez" finds Julián
 * Álvarez and "atletico" finds Atlético Madrid. Without it the search box is
 * broken for a large minority of a Premier League roster, which is the half of
 * the list a reader is least likely to be able to spell.
 */
export function searchKey(name: string): string {
  // The escape rather than the literal characters: a combining-mark range typed
  // into source is invisible in every editor and unreviewable in a diff.
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Substring, not prefix: "caicedo" has to find Moisés Caicedo, because a surname
 * is what a reader knows. An empty or whitespace-only query matches everything,
 * which is what makes clearing the box restore the list.
 */
export function matchesSearch(key: string, query: string): boolean {
  const needle = searchKey(query).trim()
  return needle === '' || key.includes(needle)
}

/* ------------------------------------------------------------------ rows -- */

/**
 * What the search box and the league select need of a row, whatever else it
 * carries. `key` is `searchKey(name)`, computed once at fold time rather than on
 * every keystroke.
 */
export interface Filterable {
  key: string
  leagueId: number
}

/**
 * The search box and the league select, applied together.
 *
 * Generic over the row rather than duplicated per index: the two screens filter
 * on exactly these two fields and differ only in what else the row holds.
 *
 * Filtering before sorting rather than after: the comparator is the expensive
 * half, and on a typed query it usually has a tenth as much to do this way.
 */
export function filterRows<Row extends Filterable>(
  rows: readonly Row[],
  query: string,
  leagueId: number | null,
): Row[] {
  return rows.filter(
    (row) => (leagueId === null || row.leagueId === leagueId) && matchesSearch(row.key, query),
  )
}
