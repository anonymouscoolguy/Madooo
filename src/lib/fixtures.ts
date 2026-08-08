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
 * now. That is the production rule, not a development convenience: with the sync
 * running, every played round is hydrated and the rounds ahead are not, so the
 * latest hydrated round *is* the most recent matchday played — which is the one
 * a user opening their diary wants. Today it also happens to be the only round
 * hydrated, which is why the page opens on something usable.
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
 *
 * `squadEntries` beside it is the card's footer — the user's verdicts and notes
 * on this match. **The two do not interfere.** A `_count` entry takes its own
 * optional `where` and has none here, so it stays a count of the whole squad
 * however the sibling selection is filtered; if it did inherit that filter, every
 * card in the round would quietly stop opening.
 *
 * The filter keeps the selection to the rows this user has judged, which is a
 * handful per match rather than forty, and `countVerdicts` and `countNotes` in
 * [`verdicts.ts`](./verdicts.ts) fold it into the two numbers. Counting in JS
 * here rather than in Postgres because one relation can carry only one `_count`,
 * and this needs two different tallies out of the same rows.
 */
export async function fixturesForRound(season: number, round: string, userId: number) {
  return prisma.match.findMany({
    where: { season, round },
    orderBy: [{ kickoff: 'asc' }, { id: 'asc' }],
    include: {
      homeTeam: teamFields,
      awayTeam: teamFields,
      _count: { select: { squadEntries: true } },
      squadEntries: {
        where: { judgements: { some: { userId } } },
        select: {
          // The same `where` again, and it is not redundant: the outer one picks
          // the squad rows, this one picks which judgements come back on them.
          // Without it a second account's judgement would arrive attached to a
          // row this user judged, and the tallies would count it.
          judgements: { where: { userId }, select: { tag: true, note: true } },
        },
      },
    },
  })
}

/** The four numbers on the stat tiles, for one user in one season. */
export interface SeasonTotals {
  watched: number
  standouts: number
  flops: number
  notes: number
}

/**
 * The stat tiles. Season-wide, which is what the first tile's "this season"
 * says out loud and the other three inherit — a tally that moved as you paged
 * through matchdays would not be a tally.
 *
 * **"Watched" is a match this user has recorded anything against** — a tag or a
 * note. It is a query rather than a column: nothing marks a match as watched,
 * and having had something to say about one is the only evidence there is.
 *
 * Four `count`s rather than reading the judgements and folding them, because a
 * season's judgements are unbounded and nothing on this page wants the rows. They
 * go out together under `Promise.all`, so the page waits for the slowest rather
 * than for the sum.
 */
export async function seasonTotals(season: number, userId: number): Promise<SeasonTotals> {
  // Reaching from a judgement back to the season it belongs to, through the
  // squad row and its match. Repeated four times because Prisma's `where` is a
  // plain object literal per query, and naming it would hide the one thing worth
  // seeing here.
  const inSeason = { userId, matchSquad: { match: { season } } }

  const [watched, standouts, flops, notes] = await Promise.all([
    prisma.match.count({
      where: { season, squadEntries: { some: { judgements: { some: { userId } } } } },
    }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'STANDOUT' } }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'FLOP' } }),
    // Not `{ not: '' }` as well: `setNote` stores a cleared note as no judgement
    // or as a null column, never as an empty string, so null is the whole of it.
    prisma.judgement.count({ where: { ...inSeason, note: { not: null } } }),
  ])

  return { watched, standouts, flops, notes }
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
