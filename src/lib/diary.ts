/**
 * Everything `/diary` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 */

import { prisma } from './prisma'
import type { DiaryFilter } from './diary-filters'

/**
 * Every judgement this user has recorded in one season, newest first.
 *
 * **Ordered by when it was written, not by when the match was played.** A diary
 * entry is dated by the act of writing it, which is what makes two verdicts on
 * one match recorded a fortnight apart sit a fortnight apart in the list. The
 * fixture is still named on every row, so nothing is lost by the date meaning
 * the other thing.
 *
 * That order is why `Judgement` carries `@@index([userId, createdAt])`: the
 * index has been in the schema since step 2, and this is the query it was for.
 * `id` breaks ties, because two judgements saved in the same millisecond would
 * otherwise come back in whatever order Postgres liked that afternoon.
 *
 * The season is reached through two relations — `matchSquad.match.season` —
 * since a `Judgement` points at a `MatchSquad` and carries no match of its own.
 *
 * No `take`. A season's entries are bounded by how much one person typed, and
 * the design draws no pager; if that ever stops being true the fix is a `take`
 * here rather than a different shape.
 */
export async function diaryEntries(season: number, userId: number, filter: DiaryFilter) {
  return prisma.judgement.findMany({
    where: { userId, matchSquad: { match: { season } }, ...filter.where },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      tag: true,
      note: true,
      createdAt: true,
      matchSquad: {
        select: {
          player: { select: { name: true } },
          match: {
            select: {
              id: true,
              homeGoals: true,
              awayGoals: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          },
        },
      },
    },
  })
}

/** The four numbers on the diary's stat tiles, for one user in one season. */
export interface DiaryTotals {
  entries: number
  standouts: number
  flops: number
  notes: number
}

/**
 * The stat tiles above the list. Season-wide, and deliberately deaf to the
 * filter: the tiles say what the season holds, and a tally that changed when you
 * clicked "Flops" would not be a tally.
 *
 * Its own function rather than a call to `seasonTotals` in
 * [`fixtures.ts`](./fixtures.ts), which the three lower tiles duplicate. The two
 * pages count different things in their first tile — that one counts *matches
 * watched*, this one counts *entries written* — and a shared function returning
 * five numbers so each caller could throw one away would make both pay for the
 * other's question. If a third screen wants these three, that is the point at
 * which extracting them earns its keep.
 */
export async function diaryTotals(season: number, userId: number): Promise<DiaryTotals> {
  const inSeason = { userId, matchSquad: { match: { season } } }

  const [entries, standouts, flops, notes] = await Promise.all([
    prisma.judgement.count({ where: inSeason }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'STANDOUT' } }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'FLOP' } }),
    prisma.judgement.count({ where: { ...inSeason, note: { not: null } } }),
  ])

  return { entries, standouts, flops, notes }
}

/**
 * The element type of what `diaryEntries` resolves to.
 *
 * Derived from the function rather than written out, the same way `Fixture` and
 * `MatchWithSquads` are: `select` decides the shape, so a hand-maintained
 * interface would be a second copy free to drift.
 */
export type DiaryEntry = Awaited<ReturnType<typeof diaryEntries>>[number]
