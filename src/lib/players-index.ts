/**
 * The players index's vocabulary: its sorts, its layouts, the keys they are
 * remembered under, and the arithmetic behind every row.
 *
 * The same table-plus-parser shape as [`diary-filters.ts`](./diary-filters.ts)
 * and [`player-views.ts`](./player-views.ts) — one list read by the control, the
 * empty state *and* the sort, so a slug cannot exist in storage that nothing
 * knows how to apply. Pure and Prisma-free, which is what lets `players-index.test.ts`
 * cover the comparators without a database.
 *
 * **The parsers read `localStorage`, not the URL, and that is the only
 * difference from those two files.** A stored value is exactly as untrusted as a
 * query parameter — it survives deploys, it can be edited by hand in devtools,
 * and it can name a league that has since stopped having squads — so every one
 * of them falls back rather than refusing.
 */

/**
 * What the index knows about one player. Structural, so the comparators are
 * generic over it and a test can build one by hand without naming a query.
 */
export interface PlayerRanking {
  id: number
  name: string
  /** Every judgement on him, tag or note. The "Most judged" key. */
  total: number
  mvps: number
  standouts: number
  flops: number
  /** Matches he was in the squad for, in which the user recorded something. */
  seen: number
}

/* ---------------------------------------------------------------- storage -- */

/**
 * Three keys rather than one JSON blob under a single key.
 *
 * A blob would have to be parsed, version-checked and re-serialised on every
 * write, and one unreadable character in it would lose all three preferences at
 * once. Three independent strings degrade one at a time, and each is validated
 * by its own parser below.
 *
 * Prefixed the same way as `THEME_STORAGE_KEY`, because `localStorage` is shared
 * across everything served from one origin.
 */
export const PLAYERS_LEAGUE_KEY = 'madooo-players-league'
export const PLAYERS_SORT_KEY = 'madooo-players-sort'
export const PLAYERS_LAYOUT_KEY = 'madooo-players-layout'

/* ----------------------------------------------------------------- layout -- */

export type PlayerLayout = 'list' | 'grid'

const LAYOUTS: readonly PlayerLayout[] = ['list', 'grid']

/** The stored layout, defaulting to the list — which is what the design draws first. */
export function parseLayout(raw: string | null): PlayerLayout {
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
 * codepoint comparison would not: a Premier League roster is full of diacritics.
 */
const NAMES = new Intl.Collator('en')

export interface PlayerSort {
  /** What is stored: `madooo-players-sort` = `most-mvps`. */
  slug: string
  label: string
  compare: (a: PlayerRanking, b: PlayerRanking) => number
}

/** Highest first, and `by` is read off the row rather than named per comparator. */
function descending(by: (player: PlayerRanking) => number) {
  return (a: PlayerRanking, b: PlayerRanking) => by(b) - by(a)
}

/**
 * Every comparator is a **total order**, and here that matters more than
 * anywhere else in the app: the list is every player in the league, so several
 * hundred of them sit at zero on whichever key is leading. A chain that ran out
 * of tiebreakers would leave those hundreds in whatever order the previous sort
 * happened to leave them, and the tail would reshuffle every time the reader
 * switched sort and switched back.
 *
 * So each chain ends in `id`, which is unique. `seen` sits second in all four
 * numeric chains, and it is the one worth arguing for: among the zeroes it
 * floats the players you actually watched above the ones you never saw, which is
 * the only distinction left down there.
 */
function chain(...comparators: ((a: PlayerRanking, b: PlayerRanking) => number)[]) {
  return (a: PlayerRanking, b: PlayerRanking) => {
    for (const comparator of comparators) {
      const order = comparator(a, b)
      if (order !== 0) return order
    }
    return 0
  }
}

const byName = (a: PlayerRanking, b: PlayerRanking) => NAMES.compare(a.name, b.name)
const byId = (a: PlayerRanking, b: PlayerRanking) => a.id - b.id
const byTotal = descending((player) => player.total)
const bySeen = descending((player) => player.seen)

/**
 * In the order the design draws them, and "Most judged" is first because it is
 * the default — `parseSort` falls back to index 0, so this order is load-bearing
 * rather than cosmetic.
 *
 * It is also the reason the index needs no separate "your players" view: sorting
 * by what you have written puts the players you care about at the top of a list
 * that is otherwise the whole league.
 */
export const PLAYER_SORTS: readonly PlayerSort[] = [
  {
    slug: 'most-judged',
    label: 'Most judged',
    compare: chain(byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-mvps',
    label: 'Most MVPs',
    compare: chain(descending((player) => player.mvps), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-standouts',
    label: 'Most standouts',
    compare: chain(descending((player) => player.standouts), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'most-flops',
    label: 'Most flops',
    compare: chain(descending((player) => player.flops), byTotal, bySeen, byName, byId),
  },
  {
    slug: 'name',
    label: 'Names A-Z',
    compare: chain(byName, byId),
  },
]

/** The stored sort, defaulting to Most judged. */
export function parseSort(raw: string | null): PlayerSort {
  return PLAYER_SORTS.find((sort) => sort.slug === raw) ?? PLAYER_SORTS[0]
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
 * stored id naming a league that no longer has squads this season falls back to
 * all rather than filtering the list to nothing.
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
 * combining marks — so "moises" finds Moisés Caicedo and "alvarez" finds Julián
 * Álvarez. Without it the search box is broken for a large minority of a
 * Premier League roster, which is the half of the list a reader is least likely
 * to be able to spell.
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

/* ------------------------------------------------------------------- rows -- */

/**
 * A row as drawn: a ranking, plus everything the markup needs but never sorts on.
 *
 * `teamId` and `leagueId` are not nullable, and that is a fact about the query
 * rather than an optimism: `playersInSeason` selects *from* `MatchSquad`, so a
 * player who reaches this list necessarily has a club and a competition. The
 * profile's own header has to cope with their absence, because it is reached by
 * typing a URL; this list cannot contain such a player at all.
 */
export interface PlayerIndexRow extends PlayerRanking {
  /** `searchKey(name)`, computed once at fold time rather than on every keystroke. */
  key: string
  teamId: number
  leagueId: number
  shirtNumber: number | null
  /** The provider's raw letter. `positionLabel` expands it where it is drawn. */
  position: string | null
}

/** What `playersInSeason` returns, named structurally so this file imports no Prisma. */
export interface PlayerSquadRow {
  id: number
  name: string
  shirtNumber: number | null
  position: string | null
  teamId: number
  leagueId: number
}

/** What `playersSeen` returns. */
export interface SeenRow {
  playerId: number
  _count: number
}

/** What `playerJudgements` returns — one row per judgement, tag possibly absent. */
export interface JudgementRow {
  tag: string | null
  matchSquad: { playerId: number }
}

/**
 * Three query results into one array of rows.
 *
 * Pure, so the arithmetic behind several hundred split bars is testable without
 * a database — the same split [`verdict-split.ts`](./verdict-split.ts) makes,
 * and for the same reason.
 *
 * **A player missing from `seen` or from `judgements` is not missing from the
 * result.** Both of those are the user's own activity, and most players have
 * none of it: the list is the league, not the diary. So the fold starts from the
 * squad rows — which is who exists — and defaults every tally to zero. Getting
 * this backwards would silently make the screen a diary again.
 *
 * A note-only judgement (`tag: null`) counts toward `total` and toward none of
 * the three tags. That is what makes "Most judged" mean what it says: a player
 * you only ever wrote notes about is someone you have judged.
 */
export function foldPlayerRows(
  squads: readonly PlayerSquadRow[],
  seen: readonly SeenRow[],
  judgements: readonly JudgementRow[],
): PlayerIndexRow[] {
  const seenByPlayer = new Map(seen.map((row) => [row.playerId, row._count]))

  const tallies = new Map<number, { total: number; mvps: number; standouts: number; flops: number }>()
  for (const judgement of judgements) {
    const playerId = judgement.matchSquad.playerId
    let tally = tallies.get(playerId)
    if (tally === undefined) {
      tally = { total: 0, mvps: 0, standouts: 0, flops: 0 }
      tallies.set(playerId, tally)
    }
    tally.total += 1
    if (judgement.tag === 'MVP') tally.mvps += 1
    else if (judgement.tag === 'STANDOUT') tally.standouts += 1
    else if (judgement.tag === 'FLOP') tally.flops += 1
  }

  return squads.map((player) => {
    const tally = tallies.get(player.id)

    return {
      ...player,
      key: searchKey(player.name),
      seen: seenByPlayer.get(player.id) ?? 0,
      total: tally?.total ?? 0,
      mvps: tally?.mvps ?? 0,
      standouts: tally?.standouts ?? 0,
      flops: tally?.flops ?? 0,
    }
  })
}

/**
 * The search box and the league select, applied together.
 *
 * Filtering before sorting rather than after: the comparator is the expensive
 * half, and on a typed query it usually has a tenth as much to do this way.
 */
export function filterPlayers(
  players: readonly PlayerIndexRow[],
  query: string,
  leagueId: number | null,
): PlayerIndexRow[] {
  return players.filter(
    (player) =>
      (leagueId === null || player.leagueId === leagueId) && matchesSearch(player.key, query),
  )
}
