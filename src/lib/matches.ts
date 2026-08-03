/**
 * Everything `/matches/[id]` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 */

import { prisma } from './prisma'

/** What `CrestChip` and `crest()` need, matching `fixtures.ts`'s own selection. */
const teamFields = {
  select: { id: true, name: true, code: true, colour: true },
} as const

/**
 * One match with both squads, in a single round-trip.
 *
 * No `orderBy` on `squadEntries`. Ordering a team sheet is a decision rather
 * than a query — `compareSquadEntries` in [`squad.ts`](./squad.ts) makes it,
 * where it is pure and covered by tests. Postgres cannot sort on the grid
 * anyway: it is a `"row:column"` string, and sorting it as text puts row 10
 * ahead of row 2.
 *
 * The squad is a bounded ~40 rows, so it comes back whole rather than as two
 * queries filtered by team.
 *
 * `userId` is what makes a diary private. The nested selection below filters the
 * judgements to one user, so a second account reading the same match sees an
 * unjudged team sheet — that `where` is the whole of the guarantee, and there is
 * no second place it is enforced.
 */
export async function matchWithSquads(id: number, userId: number) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      league: { select: { name: true } },
      homeTeam: teamFields,
      awayTeam: teamFields,
      squadEntries: {
        select: {
          id: true,
          teamId: true,
          shirtNumber: true,
          position: true,
          isStarter: true,
          grid: true,
          player: { select: { id: true, name: true } },
          // 0 or 1 rows, never more — `@@unique([userId, matchSquadId])` says
          // so. Prisma types a to-many relation as an array regardless, and
          // `verdictOf` in [`verdicts.ts`](./verdicts.ts) is the one place that
          // unwraps it. Still one round trip: Prisma resolves the nested
          // selection in the same query, which is what this function's whole
          // shape is for.
          judgements: { where: { userId }, select: { tag: true } },
        },
      },
    },
  })
}

/**
 * The shape the page renders, derived from the query rather than written out.
 *
 * Same reasoning as `Fixture` in [`fixtures.ts`](./fixtures.ts): `include` and
 * `select` decide the shape, so a hand-maintained interface would be a second
 * copy free to drift. `NonNullable<…>` strips the `null` that `findUnique`
 * returns for a missing row, which the page has already turned into a 404 by the
 * time it uses this type.
 */
export type MatchWithSquads = NonNullable<Awaited<ReturnType<typeof matchWithSquads>>>
export type SquadEntry = MatchWithSquads['squadEntries'][number]
export type MatchTeam = MatchWithSquads['homeTeam']
