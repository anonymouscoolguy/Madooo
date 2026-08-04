/**
 * Everything `/players/[id]` reads. Our own tables only — nothing here can reach
 * API-Football, which is constraint #2.
 *
 * The arithmetic these queries feed is in
 * [`verdict-split.ts`](./verdict-split.ts), which stays free of Prisma so it can
 * be tested.
 */

import { prisma } from './prisma'
import type { PlayerView } from './player-views'
import type { VerdictCounts } from './verdict-split'

/**
 * Who this is: the name, and the club and shirt number to draw beside it.
 *
 * **A player has no club column and never will.** `Player` holds a name, a photo
 * URL nothing renders, and API-Football's id; which club he plays for is a fact
 * about a *match*, recorded on `MatchSquad`. So the club is read off his most
 * recent squad row of the season, which is what makes a January transfer show
 * the club he is at now rather than the one he started at.
 *
 * `take: 1` after ordering by kickoff, so this is one row rather than a season
 * of them folded in JavaScript. Ordering by `match.kickoff` reaches through a
 * to-one relation, which Prisma resolves in the same query.
 *
 * The list comes back empty for a player in the database with no squad row this
 * season — which is reachable by typing a URL, and is the caller's empty state.
 */
export async function playerHeader(playerId: number, season: number) {
  return prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      squadEntries: {
        where: { match: { season } },
        orderBy: { match: { kickoff: 'desc' } },
        take: 1,
        select: {
          shirtNumber: true,
          position: true,
          // What `crest()` needs, and no more — `Team.logo` renders nowhere.
          team: { select: { name: true, code: true, colour: true } },
        },
      },
    },
  })
}

/**
 * The four tallies above the split bar, for one player in one season.
 *
 * **`watched` counts matches, not judgements.** A match counts when the user
 * recorded anything in it *and* this player was in the matchday squad — the
 * meaning `seasonTotals` gives the word, narrowed to one player. Unused
 * substitutes count, because the app's own rule is that anyone named in the
 * squad can be judged.
 *
 * The two conditions are **separate `some` clauses under `AND`, not one object**,
 * and that is the whole of the query's correctness: a single
 * `{ squadEntries: { some: { playerId, judgements: … } } }` would demand one row
 * satisfying both, which asks whether the user judged *this player* — a different
 * and much smaller number. What is wanted is that he was named and that somebody
 * was judged, not necessarily him.
 *
 * It runs against `MatchSquad @@index([playerId])`, which has been in the schema
 * since step 2 and is the query it was added for.
 *
 * Four `count`s rather than reading the judgements and folding them, and they go
 * out together, so the page waits for the slowest rather than for the sum.
 */
export async function playerTotals(
  playerId: number,
  season: number,
  userId: number,
): Promise<VerdictCounts> {
  const onPlayer = { userId, matchSquad: { playerId, match: { season } } }

  const [watched, mvps, standouts, flops] = await Promise.all([
    prisma.match.count({
      where: {
        season,
        AND: [
          { squadEntries: { some: { playerId } } },
          { squadEntries: { some: { judgements: { some: { userId } } } } },
        ],
      },
    }),
    prisma.judgement.count({ where: { ...onPlayer, tag: 'MVP' } }),
    prisma.judgement.count({ where: { ...onPlayer, tag: 'STANDOUT' } }),
    prisma.judgement.count({ where: { ...onPlayer, tag: 'FLOP' } }),
  ])

  return { watched, mvps, standouts, flops }
}

/**
 * Every judgement this user has recorded about this player, newest first.
 *
 * `diaryEntries` with the player pinned and dropped from the selection — this
 * screen *is* the player, so naming him on every row would be the same word
 * fourteen times. The match is named instead, and links back to itself.
 *
 * **Ordered by when it was written, not by when the match was played**, for the
 * reason 7.1 settled: an entry is dated by the act of writing it. That is why
 * two verdicts on one fixture recorded a fortnight apart sit a fortnight apart.
 *
 * No `take`. A player's entries are bounded by a season's fixtures, so this is
 * at most 38 rows.
 */
export async function playerEntries(
  playerId: number,
  season: number,
  userId: number,
  view: PlayerView,
) {
  return prisma.judgement.findMany({
    where: { userId, matchSquad: { playerId, match: { season } }, ...view.where },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      tag: true,
      note: true,
      createdAt: true,
      matchSquad: {
        select: {
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

/**
 * The shapes the page renders, derived from the queries rather than written out
 * — `select` decides the shape, so a hand-maintained interface would be a second
 * copy free to drift. The same idiom as `Fixture`, `DiaryEntry` and
 * `MatchWithSquads`.
 */
export type PlayerHeader = NonNullable<Awaited<ReturnType<typeof playerHeader>>>
export type PlayerEntry = Awaited<ReturnType<typeof playerEntries>>[number]
