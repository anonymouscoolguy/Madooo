/**
 * Everything `/fixtures` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 */

import { compareRounds } from './rounds'
import { prisma } from './prisma'

/** One matchday: its provider label and the dates it is played over. */
export interface Round {
  round: string
  firstKickoff: Date
  lastKickoff: Date
}

/**
 * Every round of the season, in playing order.
 *
 * A `groupBy` rather than a scan: the pager needs one row per matchday with its
 * date range, and there are 380 matches to derive 38 of them from. Postgres is
 * better placed to do that than we are.
 */
export async function listRounds(season: number): Promise<Round[]> {
  const grouped = await prisma.match.groupBy({
    by: ['round'],
    where: { season },
    _min: { kickoff: true },
    _max: { kickoff: true },
  })

  return grouped
    .filter(
      (row): row is typeof row & { _min: { kickoff: Date }; _max: { kickoff: Date } } =>
        row._min.kickoff !== null && row._max.kickoff !== null,
    )
    .map((row) => ({
      round: row.round,
      firstKickoff: row._min.kickoff,
      lastKickoff: row._max.kickoff,
    }))
    .sort((a, b) => compareRounds(a.round, b.round))
}

/**
 * Which matchday to show when the URL does not say.
 *
 * **The latest round that has squad rows**, falling back to the round nearest to
 * now. That is the production rule, not a development convenience: once the
 * backfill is complete every played round is hydrated, so the latest hydrated
 * round *is* the most recent matchday played — which is the one a user opening
 * their diary wants. Today it also happens to be the only round hydrated, which
 * is why the page opens on something usable.
 *
 * The fallback matters for a season with nothing hydrated at all, where landing
 * on round 1 in August would be right and in May would not.
 */
export async function defaultRound(season: number, now = new Date()): Promise<string | null> {
  const hydrated = await prisma.match.findMany({
    where: { season, squadEntries: { some: {} } },
    select: { round: true },
    distinct: ['round'],
  })
  if (hydrated.length > 0) {
    return hydrated.map((row) => row.round).sort(compareRounds).at(-1) ?? null
  }

  const next = await prisma.match.findFirst({
    where: { season, kickoff: { gte: now } },
    orderBy: { kickoff: 'asc' },
    select: { round: true },
  })
  if (next !== null) return next.round

  const last = await prisma.match.findFirst({
    where: { season },
    orderBy: { kickoff: 'desc' },
    select: { round: true },
  })
  return last?.round ?? null
}

const teamFields = {
  select: { id: true, name: true, code: true, colour: true },
} as const

/**
 * One matchday's fixtures, with everything a card draws.
 *
 * `_count.squadEntries` is what decides whether a card is openable. Counting is
 * the point: asking whether *any* squad row exists must not mean loading forty
 * of them per match to find out.
 */
export async function fixturesForRound(season: number, round: string) {
  return prisma.match.findMany({
    where: { season, round },
    orderBy: [{ kickoff: 'asc' }, { id: 'asc' }],
    include: {
      homeTeam: teamFields,
      awayTeam: teamFields,
      _count: { select: { squadEntries: true } },
    },
  })
}

/**
 * The element type of what `fixturesForRound` resolves to.
 *
 * Written as a query on the function rather than as a hand-maintained interface:
 * `include` decides the shape, so a type spelled out separately would be a second
 * copy free to drift. `Awaited<…>` unwraps the promise, `[number]` indexes the
 * array — TypeScript's way of saying "whatever you get by subscripting this".
 */
export type Fixture = Awaited<ReturnType<typeof fixturesForRound>>[number]
