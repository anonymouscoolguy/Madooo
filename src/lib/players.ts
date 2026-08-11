/**
 * Everything `/players` and `/players/[id]` read. Our own tables only — nothing
 * here can reach API-Football, which is constraint #2.
 *
 * The arithmetic these queries feed is in
 * [`verdict-split.ts`](./verdict-split.ts) and
 * [`players-index.ts`](./players-index.ts), both of which stay free of Prisma so
 * they can be tested.
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
          // What `crest()` needs plus the id his club line links to, and no
          // more — `Team.logo` renders nowhere.
          team: { select: { id: true, name: true, code: true, colour: true } },
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

/* ======================================================================== */
/* `/players` — the index                                                    */
/* ======================================================================== */

/**
 * Every player named in a matchday squad this season, with the club, shirt
 * number, position and competition he was last named under.
 *
 * **The one raw query in the app, and it is here because the Prisma forms of it
 * are all quietly quadratic.** "The most recent row per group" is what Postgres'
 * `DISTINCT ON` exists for, and Prisma cannot emit it: the column it distincts on
 * has to lead the `ORDER BY`, and the order wanted here is `match.kickoff`
 * through a relation. Two shapes were tried against the real database and their
 * SQL read back:
 *
 *   - `matchSquad.findMany({ distinct: ['playerId'] })` dedupes in **Node**, not
 *     in Postgres — there is an `InMemoryOps.distinct` node in
 *     `@prisma/query-plan-executor` that filters rows already fetched.
 *   - `player.findMany` with a nested `take: 1` does the same thing: the child
 *     query it emits carries **no `LIMIT`, no `LATERAL` and no `ROW_NUMBER`**. It
 *     selects every squad row for every matched player and keeps the first in
 *     memory. `relationLoadStrategy: 'join'`, which used to force a LATERAL, is
 *     not accepted by Prisma 7 at all.
 *
 * Either would therefore move a full season — 380 matches × ~40 players ≈ 15,200
 * rows — across the wire on every request of a `force-dynamic` page, to keep
 * about six hundred. Dev hides it completely: with one round hydrated there is
 * exactly one squad row per player, so all three forms return 400 rows and only
 * the emitted SQL tells them apart.
 *
 * This also folds in what were two further round trips — the player's name and
 * his match's league — so the page makes one query where it made three.
 *
 * Two things to hold onto:
 *
 *   - `$queryRaw` is a **tagged template**, so `${season}` becomes a bound
 *     parameter rather than string interpolation. `$queryRawUnsafe` is the one
 *     that would not, and nothing should reach for it.
 *   - The generic is an **assertion, not a check**. Raw SQL bypasses Prisma's
 *     mapping, so these column names are the database's own. That is safe today
 *     because no model in `schema.prisma` carries `@map` — adding one to
 *     `MatchSquad`, `Match` or `Player` would break this silently.
 *
 * `teamId` rather than the joined club: twenty clubs repeated across six hundred
 * rows are the same twenty clubs, and `teamsInSeason` sends them once.
 */
export interface SeasonPlayer {
  id: number
  name: string
  shirtNumber: number | null
  position: string | null
  teamId: number
  leagueId: number
}

export async function playersInSeason(season: number): Promise<SeasonPlayer[]> {
  return prisma.$queryRaw<SeasonPlayer[]>`
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
    WHERE m."season" = ${season}
    ORDER BY ms."playerId", m."kickoff" DESC, ms."id" DESC
  `
}

/**
 * How many matches each player was *seen* in: he was in the matchday squad, and
 * the user recorded something in that match — on anybody, not necessarily on
 * him.
 *
 * `playerTotals`' "watched", asked for every player at once. The two `some`
 * clauses it needs under `AND` collapse into one `where` here, because the
 * grouping key supplies the other half: `by: ['playerId']` *is* "he was named".
 *
 * `@@unique([matchId, playerId])` means one squad row per player per match, so a
 * count of rows is a count of matches and no `distinct` is involved.
 *
 * Players seen nought times are simply absent from the result — most of the
 * league, most of the time — and `foldPlayerRows` defaults them rather than this
 * query returning six hundred zeroes.
 */
export async function playersSeen(season: number, userId: number) {
  return prisma.matchSquad.groupBy({
    by: ['playerId'],
    where: {
      match: { season, squadEntries: { some: { judgements: { some: { userId } } } } },
    },
    _count: true,
  })
}

/**
 * Every judgement this user wrote this season, reduced to the two facts the index
 * needs: who it was about, and what tag it carried.
 *
 * **The rows rather than counts, which is the opposite of `seasonTotals` — and it
 * has to be.** Postgres can group a judgement by its tag, but not by its player:
 * `Judgement` points at a `MatchSquad`, so `playerId` is a column on the relation
 * rather than on the row being grouped. One `groupBy` per player is six hundred
 * queries; one read of the user's own judgements is one. It is bounded by how
 * much one person typed, which is the same bound the diary accepts for having no
 * pager.
 *
 * `note` is deliberately unselected. Nothing on this screen draws a per-player
 * note count — the Notes tile is a season-wide `count` — and selecting it would
 * carry the full text of every note ever written for nothing.
 */
export async function playerJudgements(season: number, userId: number) {
  return prisma.judgement.findMany({
    where: { userId, matchSquad: { match: { season } } },
    select: { tag: true, matchSquad: { select: { playerId: true } } },
  })
}

/**
 * The leagues the select offers, beside its "All leagues" option.
 *
 * **Derived, never written down.** Hardcoding a league would put a literal in
 * product code: `League.id` is our own autoincrement, and 39 is API-Football's
 * id, which stops at the sync boundary. Asking which leagues have squads this
 * season answered it with one row when there was one league and answered it by
 * itself when the second landed. `LEAGUES` in the environment is not a second
 * source for this — the sync reads it, pages read the database.
 *
 * Only leagues with squad rows, so an option cannot filter the list to nothing.
 * That is a stricter question than `leaguesWithMatches` asks, and deliberately:
 * a league whose season has not kicked off has no players to list, so in August
 * this offers the Primeira Liga and not the Premier League. It is also why the
 * league row on `/fixtures` cannot be built from this one.
 */
export async function leaguesInSeason(season: number) {
  return prisma.league.findMany({
    where: { matches: { some: { season, squadEntries: { some: {} } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * The clubs the rows draw, as a lookup rather than repeated per player.
 *
 * Twenty rows sent once instead of a name, code and colour on each of six
 * hundred players. That is a real saving on the payload, but the better reason is
 * that it is true: a club is one thing, and six hundred copies of it could
 * disagree.
 */
export async function teamsInSeason(season: number) {
  return prisma.team.findMany({
    where: { squadEntries: { some: { match: { season } } } },
    select: { id: true, name: true, code: true, colour: true },
  })
}

/** The four numbers on `/players`' tiles, for one user in one season. */
export interface PlayersTotals {
  mvps: number
  standouts: number
  flops: number
  notes: number
}

/**
 * The stat tiles: what this user has given out across the season.
 *
 * Its own function rather than a call to `seasonTotals` or `diaryTotals`, for the
 * reason the third tile row settled: each screen's four boxes ask a different
 * question. This is the only row with an MVPs tile and no count of the list
 * beneath it — because that list is the league, not anything the user did, so
 * counting it would say nothing about them.
 *
 * Four `count`s rather than a fold over `playerJudgements`, even though three of
 * them could be summed from rows already in hand. Deriving them would make the
 * tiles and the bars two readings of one fold, so a bug in it would corroborate
 * itself on screen instead of contradicting itself.
 */
export async function playersTotals(season: number, userId: number): Promise<PlayersTotals> {
  const inSeason = { userId, matchSquad: { match: { season } } }

  const [mvps, standouts, flops, notes] = await Promise.all([
    prisma.judgement.count({ where: { ...inSeason, tag: 'MVP' } }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'STANDOUT' } }),
    prisma.judgement.count({ where: { ...inSeason, tag: 'FLOP' } }),
    // Not `{ not: '' }` as well: `setNote` stores a cleared note as no judgement
    // or as a null column, never as an empty string.
    prisma.judgement.count({ where: { ...inSeason, note: { not: null } } }),
  ])

  return { mvps, standouts, flops, notes }
}

/**
 * The shapes the pages render, derived from the queries rather than written out
 * — `select` decides the shape, so a hand-maintained interface would be a second
 * copy free to drift. The same idiom as `Fixture`, `DiaryEntry` and
 * `MatchWithSquads`.
 */
export type PlayerHeader = NonNullable<Awaited<ReturnType<typeof playerHeader>>>
export type PlayerEntry = Awaited<ReturnType<typeof playerEntries>>[number]
export type IndexTeam = Awaited<ReturnType<typeof teamsInSeason>>[number]
