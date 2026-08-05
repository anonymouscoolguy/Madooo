/**
 * What the teams index adds to the shared vocabulary: the keys its three
 * controls are remembered under, and the arithmetic behind every row.
 *
 * The mirror of [`players-index.ts`](./players-index.ts), and for the same
 * division of labour — the sorts, the layouts, the search normaliser and the
 * league parser are in [`rankings.ts`](./rankings.ts), because a club is ranked
 * on the same seven numbers as a player.
 *
 * Pure and Prisma-free, which is what lets `teams-index.test.ts` cover the fold
 * without a database. The shapes the queries return are declared here
 * structurally and imported *by* [`teams/directory.ts`](./teams/directory.ts),
 * so the two cannot describe the same row differently.
 */

import { searchKey, type Ranking } from './rankings'

/* ---------------------------------------------------------------- storage -- */

/**
 * Its own trio rather than the players index's.
 *
 * The two lists are narrowed and sorted independently: a reader who wants clubs
 * as cards has said nothing about how they want six hundred players drawn, and
 * "Most flops" over twenty clubs is a different question from "Most flops" over a
 * roster. Sharing the keys would make each screen silently reconfigure the other.
 *
 * Three keys rather than one blob, and prefixed, for the reasons
 * `players-index.ts` sets out.
 */
export const TEAMS_LEAGUE_KEY = 'madooo-teams-league'
export const TEAMS_SORT_KEY = 'madooo-teams-sort'
export const TEAMS_LAYOUT_KEY = 'madooo-teams-layout'

/* ----------------------------------------------------------- query shapes -- */

/** What `clubLeagues` returns: one club and the competition it played in. */
export interface ClubLeagueRow {
  teamId: number
  leagueId: number
}

/** What `clubIdentities` returns — what `crest()` needs, and no more. */
export interface ClubIdentityRow {
  id: number
  name: string
  code: string | null
  colour: string | null
}

/** What `clubsSeen` returns, one row per club per side of the fixture. */
export interface ClubSeenRow {
  teamId: number
  count: number
}

/** What `clubJudgements` returns — one row per judgement, tag possibly absent. */
export interface TeamJudgementRow {
  tag: string | null
  matchSquad: { teamId: number; playerId: number }
}

/* ------------------------------------------------------------------- rows -- */

/**
 * A club as drawn: a ranking, plus everything the markup needs but never sorts
 * on.
 *
 * `leagueId` is not nullable, and that is a fact about the query rather than an
 * optimism: the club list *is* `clubLeagues`, so a club that reaches this row
 * necessarily came from a fixture and a fixture necessarily has a competition.
 * The profile's own header has to cope with a club having neither, because it is
 * reached by typing a URL; this list cannot contain such a club at all.
 *
 * `league` is the name, and it *is* nullable — the id came from a fixture but the
 * name is joined from the select's own options, and a mismatch should draw
 * nothing rather than a wrong competition.
 *
 * The three identity fields satisfy `TeamIdentity` structurally, so a row can be
 * handed straight to `CrestChip` without conversion.
 */
export interface TeamIndexRow extends Ranking {
  /** `searchKey(name)`, computed once at fold time rather than on every keystroke. */
  key: string
  code: string | null
  colour: string | null
  leagueId: number
  league: string | null
  /**
   * How many *distinct* players of theirs the reader has judged — the drawing's
   * "3 players" column. Not a count of judgements: judging Saka three times over
   * three matches is one player, and the row already carries the judgement count
   * as `total`.
   */
  players: number
}

/**
 * What the select offers, which is also where a league's name comes from.
 * Structurally `LeagueOption`, named here so the fold's signature reads.
 */
interface LeagueRow {
  id: number
  name: string
}

interface Tally {
  total: number
  mvps: number
  standouts: number
  flops: number
  /** The ids themselves, because "how many players" has to count them distinctly. */
  players: Set<number>
}

/**
 * Four query results into one array of rows.
 *
 * Pure, so the arithmetic behind twenty split bars is testable without a
 * database — the same reason `foldPlayerRows` and `verdictSplit` sit where they
 * do.
 *
 * **A club missing from `seen` or from `judgements` is not missing from the
 * result.** Both are the user's own activity, and on a fresh diary no club has
 * any: the list is the competition, not the diary. So the fold starts from
 * `clubs` — which is who played — and defaults every tally to zero. Getting this
 * backwards would silently make the screen a diary again, which is the mistake
 * 7.3 names and 7.4 repeats.
 *
 * A note-only judgement (`tag: null`) counts toward `total`, toward the distinct
 * player count, and toward none of the three tags — `foldPlayerRows`' rule, so
 * that "Most judged" means the same thing on both screens.
 */
export function foldTeamRows(
  clubs: readonly ClubLeagueRow[],
  identities: readonly ClubIdentityRow[],
  leagues: readonly LeagueRow[],
  seen: readonly ClubSeenRow[],
  judgements: readonly TeamJudgementRow[],
): TeamIndexRow[] {
  const identityById = new Map(identities.map((club) => [club.id, club]))
  const leagueName = new Map(leagues.map((league) => [league.id, league.name]))

  // Summed rather than set: `clubsSeen` groups each side of the fixture
  // separately, so a club that both hosted and visited a watched match arrives
  // twice and the two halves are both real.
  const seenByTeam = new Map<number, number>()
  for (const row of seen) {
    seenByTeam.set(row.teamId, (seenByTeam.get(row.teamId) ?? 0) + row.count)
  }

  const tallies = new Map<number, Tally>()
  for (const judgement of judgements) {
    const { teamId, playerId } = judgement.matchSquad
    let tally = tallies.get(teamId)
    if (tally === undefined) {
      tally = { total: 0, mvps: 0, standouts: 0, flops: 0, players: new Set() }
      tallies.set(teamId, tally)
    }
    tally.total += 1
    tally.players.add(playerId)
    if (judgement.tag === 'MVP') tally.mvps += 1
    else if (judgement.tag === 'STANDOUT') tally.standouts += 1
    else if (judgement.tag === 'FLOP') tally.flops += 1
  }

  const rows: TeamIndexRow[] = []
  const drawn = new Set<number>()

  for (const club of clubs) {
    // `clubLeagues` returns a club once per side of the fixture, so most arrive
    // twice. First league wins — a club playing two competitions in one season is
    // unreachable while syncing is league-scoped, and if it ever happens the
    // directory should name one rather than list the club twice.
    if (drawn.has(club.teamId)) continue

    const identity = identityById.get(club.teamId)
    // Unreachable: both queries ask the same question of the same season. A miss
    // means they disagreed, and a club with no name and no colour is worse to
    // draw than to omit.
    if (identity === undefined) continue

    drawn.add(club.teamId)
    const tally = tallies.get(club.teamId)

    rows.push({
      id: identity.id,
      name: identity.name,
      key: searchKey(identity.name),
      code: identity.code,
      colour: identity.colour,
      leagueId: club.leagueId,
      league: leagueName.get(club.leagueId) ?? null,
      seen: seenByTeam.get(club.teamId) ?? 0,
      total: tally?.total ?? 0,
      mvps: tally?.mvps ?? 0,
      standouts: tally?.standouts ?? 0,
      flops: tally?.flops ?? 0,
      players: tally?.players.size ?? 0,
    })
  }

  return rows
}
