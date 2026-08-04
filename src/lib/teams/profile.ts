/**
 * Everything `/teams/[id]` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 *
 * The club's counterpart to [`players.ts`](../players.ts), and deliberately the
 * same four shapes: a header, a row of tallies, the roster, and the user's own
 * activity read as rows to be folded. Where a query is one of `players.ts`'
 * narrowed by a club, the comment says which one rather than repeating its
 * reasoning.
 *
 * The arithmetic stays in [`players-index.ts`](../players-index.ts) and
 * [`verdict-split.ts`](../verdict-split.ts), both free of Prisma so they can be
 * tested. This module adds none of its own.
 */

import { prisma } from '../prisma'
import type { VerdictCounts } from '../verdict-split'

/**
 * Who this club is, and which competition it played in.
 *
 * **A club has no league column.** `League` reaches a `Team` only through the
 * matches they share, so the competition is read off one of this club's matches
 * this season — the same reading that makes a player's club a fact about a
 * match rather than a column on him.
 *
 * `OR` over both sides of the fixture rather than `homeMatches`: a club with no
 * home fixture in the data is a state the round-by-round hydration can produce,
 * and it should still draw a league.
 *
 * Both halves come back `null` for a club that exists with no match this season,
 * which is reachable by typing a URL and is the caller's empty state.
 */
export async function teamHeader(teamId: number, season: number) {
  const [team, played] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      // What `crest()` needs, and no more — `Team.logo` renders nowhere.
      select: { id: true, name: true, code: true, colour: true },
    }),
    prisma.match.findFirst({
      where: { season, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      select: { league: { select: { name: true } } },
    }),
  ])

  if (team === null) return null
  return { ...team, league: played?.league.name ?? null }
}

/**
 * The four tallies, for one club in one season.
 *
 * **`watched` counts matches, and it needs one `some` clause where
 * `playerTotals` needs two.** That asymmetry is the point rather than an
 * oversight: "this player was in the squad" can only be asked of a squad row, so
 * the player's version needs a second clause to avoid collapsing into "did the
 * user judge *him*". "This club played in this match" is a fact about `Match`'s
 * own `homeTeamId` and `awayTeamId` columns, so it sits in the same `where`
 * without ambiguity.
 *
 * Reading it off squad rows instead would quietly drop a match whose lineup was
 * never published while the opponent's was — the user recorded something, the
 * club played, and no `MatchSquad` row exists to prove it.
 *
 * So `watched` counts matches of theirs the reader had something to say about,
 * even where all of it was about the opponent. That is `/fixtures`' meaning of
 * the word narrowed to a club, which is what keeps one word to one meaning
 * across the three screens carrying it.
 */
export async function teamTotals(
  teamId: number,
  season: number,
  userId: number,
): Promise<VerdictCounts> {
  const onTheirPlayers = { userId, matchSquad: { teamId, match: { season } } }

  const [watched, mvps, standouts, flops] = await Promise.all([
    prisma.match.count({
      where: {
        season,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        squadEntries: { some: { judgements: { some: { userId } } } },
      },
    }),
    prisma.judgement.count({ where: { ...onTheirPlayers, tag: 'MVP' } }),
    prisma.judgement.count({ where: { ...onTheirPlayers, tag: 'STANDOUT' } }),
    prisma.judgement.count({ where: { ...onTheirPlayers, tag: 'FLOP' } }),
  ])

  return { watched, mvps, standouts, flops }
}

/**
 * Every player this club named in a matchday squad this season, with the shirt
 * number and position he was last named under.
 *
 * `playersInSeason` in [`players.ts`](../players.ts) narrowed by `ms."teamId"`,
 * and raw for the same reason — "the most recent row per group" is `DISTINCT ON`,
 * which Prisma cannot emit because the distinct column has to lead the
 * `ORDER BY` and the order wanted is `match.kickoff` through a relation. That
 * comment carries the full argument and the two shapes measured against the
 * database; this is the same query with a club in its `WHERE`.
 *
 * The two hazards are worth repeating because they are live in this copy too:
 * `$queryRaw` is a **tagged template**, so both values are bound parameters
 * rather than interpolation, and the generic is an **assertion, not a check** —
 * these column names are the database's own, so adding an `@map` to
 * `MatchSquad`, `Match` or `Player` breaks this silently.
 *
 * `leagueId` is selected although the club has one league, because
 * `foldPlayerRows` reads it. One number per row is cheaper than a second shape
 * for the fold to learn.
 */
export interface TeamSquadPlayer {
  id: number
  name: string
  shirtNumber: number | null
  position: string | null
  teamId: number
  leagueId: number
}

export async function teamSquad(teamId: number, season: number): Promise<TeamSquadPlayer[]> {
  return prisma.$queryRaw<TeamSquadPlayer[]>`
    SELECT DISTINCT ON (ms."playerId")
      ms."playerId" AS id,
      p."name",
      ms."shirtNumber",
      ms."position",
      ms."teamId",
      m."leagueId"
    FROM "MatchSquad" ms
    JOIN "Match" m ON m."id" = ms."matchId"
    JOIN "Player" p ON p."id" = ms."playerId"
    WHERE m."season" = ${season} AND ms."teamId" = ${teamId}
    ORDER BY ms."playerId", m."kickoff" DESC, ms."id" DESC
  `
}

/**
 * How many matches each of this club's players was *seen* in: he was in their
 * matchday squad, and the user recorded something in that match — on anybody,
 * not necessarily on him.
 *
 * `playersSeen` narrowed by `teamId`, so a player who moved mid-season is
 * counted here only for the matches he played for this club. Players seen nought
 * times are absent rather than returned as zeroes, and `foldPlayerRows` defaults
 * them.
 */
export async function teamSeen(teamId: number, season: number, userId: number) {
  return prisma.matchSquad.groupBy({
    by: ['playerId'],
    where: {
      teamId,
      match: { season, squadEntries: { some: { judgements: { some: { userId } } } } },
    },
    _count: true,
  })
}

/**
 * Every judgement this user wrote about this club's players this season, reduced
 * to who it was about and what tag it carried.
 *
 * `playerJudgements` narrowed by `teamId`. Rows rather than counts for the same
 * reason: `Judgement` points at a `MatchSquad`, so `playerId` is a column on the
 * relation and Postgres cannot group by it.
 */
export async function teamJudgements(teamId: number, season: number, userId: number) {
  return prisma.judgement.findMany({
    where: { userId, matchSquad: { teamId, match: { season } } },
    select: { tag: true, matchSquad: { select: { playerId: true } } },
  })
}

export type TeamProfileHeader = NonNullable<Awaited<ReturnType<typeof teamHeader>>>
