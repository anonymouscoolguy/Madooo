/**
 * Everything `/teams` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 *
 * The index's counterpart to [`profile.ts`](./profile.ts), and the club-shaped
 * echo of [`players.ts`](../players.ts): a list of who exists, the user's own
 * activity read as rows to be folded, and the leagues the select offers. The
 * arithmetic stays in [`teams-index.ts`](../teams-index.ts), free of Prisma so it
 * can be tested. This module adds none of its own.
 *
 * **Clubs are read from `Match`, not from `MatchSquad`**, which is where this
 * file differs from `players.ts` rather than merely narrowing it. Two reasons,
 * and they are the same two `teamHeader` gives:
 *
 * 1. A club whose lineup was never published still played. Reading the list off
 *    squad rows would drop them from the directory entirely, where reading it off
 *    fixtures cannot.
 * 2. `Team` carries no `leagueId`. A club reaches a competition only through the
 *    matches they share, so the fixture is the only row that holds both — and
 *    taking the club and its league from one query is what makes `leagueId`
 *    non-nullable on an index row.
 *
 * Every query here is `OR`-ed across both sides of the fixture, which in Prisma's
 * `groupBy` means two calls rather than one clause: a club with no *home* match
 * is a state round-by-round hydration can produce, and it should still appear.
 * Each of those returns a club once per side, and `foldTeamRows` dedupes.
 *
 * The row shapes are declared in [`teams-index.ts`](../teams-index.ts) and
 * imported here rather than the other way round, so the fold's input and this
 * module's output cannot drift apart. `import type` is erased, so the pure module
 * stays free of Prisma.
 */

import { prisma } from '../prisma'
import type { ClubLeagueRow, ClubSeenRow } from '../teams-index'

/**
 * Which clubs played this season, and in what.
 *
 * **This is the club list**, and deriving it from the same rows that carry the
 * league is deliberate: a separate query for each would let the two disagree, and
 * the fold would have to cope with a club whose competition is unknown.
 *
 * Twenty-odd rows per side rather than the season's fixtures — `groupBy`
 * collapses them in Postgres. `_count` is not asked for, because how often a club
 * played is not a number this screen draws.
 */
export async function clubLeagues(season: number): Promise<ClubLeagueRow[]> {
  const [home, away] = await Promise.all([
    prisma.match.groupBy({ by: ['homeTeamId', 'leagueId'], where: { season } }),
    prisma.match.groupBy({ by: ['awayTeamId', 'leagueId'], where: { season } }),
  ])

  return [
    ...home.map((row) => ({ teamId: row.homeTeamId, leagueId: row.leagueId })),
    ...away.map((row) => ({ teamId: row.awayTeamId, leagueId: row.leagueId })),
  ]
}

/**
 * Who those clubs are: what `crest()` needs, and no more.
 *
 * `Team.logo` is selected nowhere, here as everywhere — it is stored so the
 * option stays open and rendered by nothing, because club badges are a trademark
 * question this project has not cleared.
 */
export async function clubIdentities(season: number) {
  return prisma.team.findMany({
    where: { OR: [{ homeMatches: { some: { season } } }, { awayMatches: { some: { season } } }] },
    select: { id: true, name: true, code: true, colour: true },
  })
}

/**
 * `teamTotals`' `watched`, for every club at once.
 *
 * The same `where` that file argues for, in two `groupBy`s rather than twenty
 * `count`s: matches of theirs the reader had something to say about, **even
 * where all of it was about the opponent**. That keeps one word to one meaning
 * across four screens now — `/fixtures` counts it whole, a player narrows it to
 * his squad rows, a club profile to its fixtures, and this narrows it to every
 * club at once.
 *
 * It needs one `some` clause where a player's needs two, for `teamTotals`'
 * reason: "this club played in this match" is a fact about `Match`'s own
 * `homeTeamId` and `awayTeamId` columns.
 *
 * Clubs seen nought times are absent rather than returned as zeroes, and the fold
 * defaults them — `playersSeen`' contract.
 */
export async function clubsSeen(season: number, userId: number): Promise<ClubSeenRow[]> {
  const watched = { season, squadEntries: { some: { judgements: { some: { userId } } } } }

  const [home, away] = await Promise.all([
    prisma.match.groupBy({ by: ['homeTeamId'], where: watched, _count: true }),
    prisma.match.groupBy({ by: ['awayTeamId'], where: watched, _count: true }),
  ])

  return [
    ...home.map((row) => ({ teamId: row.homeTeamId, count: row._count })),
    ...away.map((row) => ({ teamId: row.awayTeamId, count: row._count })),
  ]
}

/**
 * Every judgement this user wrote this season, reduced to which club it was
 * about and which player.
 *
 * `playerJudgements` widened rather than narrowed: no club in the `where`, and
 * `teamId` selected alongside `playerId`.
 *
 * **Rows rather than counts, and here the reason is the player id rather than
 * Prisma's.** A judgement *can* be grouped by `teamId`, unlike by `playerId`,
 * because `MatchSquad.teamId` is a column on the row Prisma can reach — but
 * "how many of their players have you judged" needs the ids themselves to count
 * distinctly, and no `groupBy` returns those. One query and a fold rather than
 * two shapes to keep in step.
 *
 * Bounded by how much one person has typed in one season, which is the same bound
 * the diary runs on.
 */
export async function clubJudgements(season: number, userId: number) {
  return prisma.judgement.findMany({
    where: { userId, matchSquad: { match: { season } } },
    select: { tag: true, matchSquad: { select: { teamId: true, playerId: true } } },
  })
}

/**
 * The competitions the league select offers.
 *
 * Deliberately **not** `leaguesInSeason` from [`players.ts`](../players.ts),
 * whose extra `squadEntries: { some: {} }` clause asks for leagues with published
 * lineups. That is the right question for a list of players, who only exist as
 * squad rows, and the wrong one here: it would leave a league holding clubs on
 * this list that the select could not narrow to, and `parseLeague` would then
 * silently discard a perfectly valid stored preference.
 *
 * The set matches `clubLeagues` exactly, which is what that guarantee needs.
 */
export async function leaguesWithMatches(season: number) {
  return prisma.league.findMany({
    where: { matches: { some: { season } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}
