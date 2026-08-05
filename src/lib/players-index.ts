/**
 * What the players index adds to the shared vocabulary: the keys its three
 * controls are remembered under, and the arithmetic behind every row.
 *
 * The sorts, the layouts, the search normaliser and the league parser are in
 * [`rankings.ts`](./rankings.ts), because the teams index is ranked on the same
 * numbers and offered the same five sorts. What is here is what is genuinely
 * about players: the shape of a row, and the fold that builds one out of three
 * query results.
 *
 * Pure and Prisma-free, which is what lets `players-index.test.ts` cover the fold
 * without a database.
 */

import { searchKey, type Ranking } from './rankings'

/* ---------------------------------------------------------------- storage -- */

/**
 * Three keys rather than one JSON blob under a single key.
 *
 * A blob would have to be parsed, version-checked and re-serialised on every
 * write, and one unreadable character in it would lose all three preferences at
 * once. Three independent strings degrade one at a time, and each is validated
 * by its own parser in `rankings.ts`.
 *
 * Prefixed the same way as `THEME_STORAGE_KEY`, because `localStorage` is shared
 * across everything served from one origin. The teams index keeps its own trio
 * under `madooo-teams-*`: the two lists are narrowed and sorted independently,
 * and a reader who wants clubs as cards has said nothing about players.
 */
export const PLAYERS_LEAGUE_KEY = 'madooo-players-league'
export const PLAYERS_SORT_KEY = 'madooo-players-sort'
export const PLAYERS_LAYOUT_KEY = 'madooo-players-layout'

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
export interface PlayerIndexRow extends Ranking {
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
