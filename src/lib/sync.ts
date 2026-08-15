/**
 * The sync job: API-Football in, our own Postgres out.
 *
 * This is the only code that ever calls the provider (constraint #2 — nothing
 * reachable from a page render appears in this file's import graph), and it
 * speaks to the provider only through `api-football/`, which is the single
 * translation boundary (constraint #3).
 *
 * Everything written here is an **upsert on a natural key**. That is not just
 * tidiness: `Judgement` points at `MatchSquad.id` with `onDelete: Cascade`, so
 * clearing squad rows in order to rewrite them would silently delete the user's
 * diary on the next re-sync. Upserting keeps the ids the judgements hang off.
 * Nothing in this file deletes anything.
 */

import { apiGet } from './api-football/client'
import {
  buildSquad,
  mapFixture,
  mapLineup,
  mapSquadTeams,
  type MappedMatch,
  type MappedSquadEntry,
  type MappedTeam,
} from './api-football/map'
import type { RawFixture, RawLineup, RawPlayerStats } from './api-football/types'
import {
  FINISHED_STATUSES,
  lineupKickoffRange,
  PENDING_STATUSES,
  selectDue,
  selectLineupDue,
  windowStart,
} from './hydration'
import { prisma } from './prisma'

// Re-exported so `scripts/sync.ts` keeps its single import site. The definition
// lives in `rounds.ts` because pages need it too and may not import this file.
export { roundLabel } from './rounds'

/**
 * Run `work` over `items` a few at a time.
 *
 * A season is 380 upserts. Sequentially that is 380 round trips to Neon; all at
 * once it would open more connections than the pooler wants. Ten at a time is
 * the boring middle.
 */
async function inChunks<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(work))))
  }
  return results
}

async function upsertTeams(teams: MappedTeam[]): Promise<Map<number, number>> {
  const rows = await inChunks(teams, 10, (team) =>
    prisma.team.upsert({
      where: { apiFootballId: team.apiFootballId },
      create: team,
      update: { name: team.name, logo: team.logo },
    }),
  )
  return new Map(rows.map((row) => [row.apiFootballId, row.id]))
}

async function upsertMatch(
  match: MappedMatch,
  leagueId: number,
  teamIds: Map<number, number>,
) {
  const homeTeamId = teamIds.get(match.homeTeamApiFootballId)
  const awayTeamId = teamIds.get(match.awayTeamApiFootballId)
  if (homeTeamId === undefined || awayTeamId === undefined) {
    throw new Error(`Fixture ${match.apiFootballId}: a team was not written first`)
  }

  // Written out column by column rather than spread from the mapped object:
  // the provider's ids are replaced by ours here, and listing the columns makes
  // the substitution visible instead of implied by what was left over.
  const data = {
    leagueId,
    season: match.season,
    round: match.round,
    kickoff: match.kickoff,
    status: match.status,
    statusElapsed: match.statusElapsed,
    venueApiFootballId: match.venueApiFootballId,
    venueName: match.venueName,
    venueCity: match.venueCity,
    referee: match.referee,
    homeTeamId,
    awayTeamId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homeHalftimeGoals: match.homeHalftimeGoals,
    awayHalftimeGoals: match.awayHalftimeGoals,
  }

  return prisma.match.upsert({
    where: { apiFootballId: match.apiFootballId },
    create: { apiFootballId: match.apiFootballId, ...data },
    update: data,
  })
}

export interface FixturesSyncResult {
  season: number
  /** The API-Football id this run asked for — known even when nothing came back. */
  leagueApiFootballId: number
  /** Our own row, and its name for printing. */
  league: { id: number; name: string }
  teams: number
  matches: number
  remaining: number | null
  limit: number | null
  /** Every fixture written, so the caller can pick which ones to hydrate. */
  fixtures: { apiFootballId: number; round: string; label: string }[]
}

/**
 * One request: every fixture of one league's season. Writes the league, its
 * clubs and its matches — the calendar, without lineups or squads.
 *
 * One league per call rather than a loop over the configured list, so that a
 * failure names the league that failed. The caller runs the loop and owns the
 * summary; this returns *which* league it wrote rather than a count of them.
 */
export async function syncSeasonFixtures(
  season: number,
  leagueApiFootballId: number,
): Promise<FixturesSyncResult> {
  const { response, remaining, limit } = await apiGet<RawFixture>('fixtures', {
    league: leagueApiFootballId,
    season,
  })

  const mapped = response.map(mapFixture)
  // `apiGet` throws on the `errors` field, so a refusal never reaches here. An
  // empty response therefore means a league id that does not exist, or one with
  // no such season — a configuration error, and one worth refusing loudly
  // rather than recording as a quiet zero. Every write above is an upsert, so
  // throwing after an earlier league succeeded costs nothing.
  if (mapped.length === 0) {
    throw new Error(
      `League ${leagueApiFootballId} has no fixtures in ${season} — check LEAGUES and SEASON`,
    )
  }

  const league = mapped[0].league
  const row = await prisma.league.upsert({
    where: { apiFootballId: league.apiFootballId },
    create: league,
    update: { name: league.name, country: league.country, logo: league.logo },
  })
  const leagueId = row.id

  const teams = new Map<number, MappedTeam>()
  for (const { homeTeam, awayTeam } of mapped) {
    teams.set(homeTeam.apiFootballId, homeTeam)
    teams.set(awayTeam.apiFootballId, awayTeam)
  }
  const teamIds = await upsertTeams([...teams.values()])

  await inChunks(mapped, 10, ({ match }) => upsertMatch(match, leagueId, teamIds))

  return {
    season,
    leagueApiFootballId,
    league: { id: row.id, name: row.name },
    teams: teamIds.size,
    matches: mapped.length,
    remaining,
    limit,
    fixtures: mapped.map(({ match, homeTeam, awayTeam }) => ({
      apiFootballId: match.apiFootballId,
      round: match.round,
      label: `${homeTeam.name} vs ${awayTeam.name}`,
    })),
  }
}

async function upsertSquadEntry(
  entry: MappedSquadEntry,
  matchId: number,
  teamIds: Map<number, number>,
) {
  const teamId = teamIds.get(entry.teamApiFootballId)
  if (teamId === undefined) {
    throw new Error(`Player ${entry.player.apiFootballId}: unknown team`)
  }

  // A null photo means this entry came from the lineup alone, so its name is
  // the abbreviated "A. Onana". Leave the stored name untouched in that case:
  // overwriting a full name with an abbreviation would be a downgrade.
  const { id: playerId } = await prisma.player.upsert({
    where: { apiFootballId: entry.player.apiFootballId },
    create: entry.player,
    update:
      entry.player.photo === null
        ? {}
        : { name: entry.player.name, photo: entry.player.photo },
  })

  const data = {
    teamId,
    shirtNumber: entry.shirtNumber,
    position: entry.position,
    isStarter: entry.isStarter,
    grid: entry.grid,
    minutes: entry.minutes,
    goals: entry.goals,
    assists: entry.assists,
    yellow: entry.yellow,
    red: entry.red,
    rating: entry.rating,
  }

  return prisma.matchSquad.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, ...data },
    update: data,
  })
}

/** Our own `Match.id` for a provider fixture id, or a refusal naming it. */
async function matchIdFor(fixtureApiFootballId: number): Promise<number> {
  const match = await prisma.match.findUnique({
    where: { apiFootballId: fixtureApiFootballId },
    select: { id: true },
  })
  if (match === null) {
    throw new Error(
      `Fixture ${fixtureApiFootballId} is not in the database — sync fixtures first`,
    )
  }
  return match.id
}

/**
 * Write one fixture's team sheets and squad rows.
 *
 * Shared by both readers, and the whole of what makes a lineup-only fetch cost
 * nothing extra: `mapSquadTeams` and `buildSquad` already accept an empty
 * statistics response, seeding entries from `startXI` and `substitutes` with
 * null minutes. The `null` photo those entries carry is what tells
 * `upsertSquadEntry` not to overwrite a full name with an abbreviation later.
 */
async function writeFixtureSquads(
  matchId: number,
  lineups: RawLineup[],
  stats: RawPlayerStats[],
): Promise<{ lineups: number; squadEntries: number }> {
  const teamIds = await upsertTeams(mapSquadTeams(lineups, stats))

  // Players first, team sheets second, and the order is load-bearing.
  //
  // `lineupDueFixtures` treats two `MatchLineup` rows as "this fixture is done",
  // so writing them first means a run that dies part way through marks the
  // fixture complete with no players in it — and the predicate never looks at it
  // again. That is not hypothetical: it happened the first time a real team
  // sheet arrived carrying a player with a null id, and left the match
  // unopenable until full time.
  //
  // Writing them last makes the marker mean what the predicate reads it as. The
  // same shape as `hydratedAt`, which is stamped only after the squad is in.
  const squad = buildSquad(lineups, stats)
  await inChunks(squad, 10, (entry) => upsertSquadEntry(entry, matchId, teamIds))

  for (const raw of lineups) {
    const lineup = mapLineup(raw)
    const teamId = teamIds.get(lineup.teamApiFootballId)
    if (teamId === undefined) continue

    const data = {
      formation: lineup.formation,
      coachApiFootballId: lineup.coachApiFootballId,
      coachName: lineup.coachName,
      kitPlayerPrimary: lineup.kitPlayerPrimary,
      kitPlayerNumber: lineup.kitPlayerNumber,
      kitPlayerBorder: lineup.kitPlayerBorder,
      kitGoalkeeperPrimary: lineup.kitGoalkeeperPrimary,
      kitGoalkeeperNumber: lineup.kitGoalkeeperNumber,
      kitGoalkeeperBorder: lineup.kitGoalkeeperBorder,
    }

    await prisma.matchLineup.upsert({
      where: { matchId_teamId: { matchId, teamId } },
      create: { matchId, teamId, ...data },
      update: data,
    })
  }

  return { lineups: lineups.length, squadEntries: squad.length }
}

export interface FixtureDetailResult {
  fixtureApiFootballId: number
  lineups: number
  squadEntries: number
  remaining: number | null
}

/**
 * One request: the team sheets for a fixture that has not been played out yet.
 *
 * The counterpart to `syncFixtureDetail`, and the reason it is a separate
 * function rather than a flag is what it must *not* do. `/fixtures/players`
 * before full time returns partial minutes and no ratings, so this never asks
 * for it — which is also what makes the predicate behind it safe to run while a
 * match is being played.
 *
 * **It does not stamp `hydratedAt`.** That column records when *both* detail
 * endpoints were last read, and only one was; leaving it null is also what keeps
 * the fixture queued for the full hydration after full time, which is where
 * minutes and ratings come from.
 */
export async function syncFixtureLineups(
  fixtureApiFootballId: number,
): Promise<FixtureDetailResult> {
  const matchId = await matchIdFor(fixtureApiFootballId)

  const lineups = await apiGet<RawLineup>('fixtures/lineups', {
    fixture: fixtureApiFootballId,
  })
  const written = await writeFixtureSquads(matchId, lineups.response, [])

  return { fixtureApiFootballId, ...written, remaining: lineups.remaining }
}

/**
 * Two requests: the lineups and the player statistics for one fixture. Both are
 * needed — only the first carries formation, pitch grid and kit colours, and
 * only the second carries full names and minutes.
 *
 * Not wrapped in a transaction, deliberately. Since every write is an idempotent
 * upsert and nothing is ever deleted, an interrupted run leaves a partially
 * hydrated fixture that re-running repairs exactly — which is the same guarantee
 * a transaction would buy, without holding one open across ~40 statements.
 */
export async function syncFixtureDetail(
  fixtureApiFootballId: number,
): Promise<FixtureDetailResult> {
  const matchId = await matchIdFor(fixtureApiFootballId)

  const lineups = await apiGet<RawLineup>('fixtures/lineups', {
    fixture: fixtureApiFootballId,
  })
  const stats = await apiGet<RawPlayerStats>('fixtures/players', {
    fixture: fixtureApiFootballId,
  })

  const written = await writeFixtureSquads(matchId, lineups.response, stats.response)

  // Stamped only when something came back. A fixture whose lineup the provider
  // has not published yet must stay in the queue: stamping it here would retire
  // it from every future run and leave its card reading "No squad yet" forever.
  // Two wasted requests is the correct price for that.
  if (written.squadEntries > 0) {
    await prisma.match.update({
      where: { id: matchId },
      data: { hydratedAt: new Date() },
    })
  }

  return { fixtureApiFootballId, ...written, remaining: stats.remaining }
}

export interface DueFixture {
  apiFootballId: number
  kickoff: Date
  status: string
  hydratedAt: Date | null
  /** The competition's name, so a log line names it rather than an id. */
  league: string
  label: string
}

/**
 * Which fixtures a scheduled run should read detail for.
 *
 * The coarse filter is Postgres's and the policy is `hydration.ts`'s. The split
 * is not tidiness: `hydratedAt < kickoff + 6 hours` is a row-to-row comparison
 * that Prisma's `where` cannot express, so it is either a third `$queryRaw` —
 * which `architecture.md` says has to argue for itself — or a fold in Node over
 * a set the fortnight window already bounds to a few dozen rows. The fold also
 * puts the whole policy under Vitest, which raw SQL would not be.
 *
 * `leagueIds` are **ours**, not the provider's, and are resolved by the caller
 * from the `League` table rather than taken from the calendar phase's results.
 * That is deliberate: a league whose calendar request failed this run still has
 * finished matches from previous runs waiting to be read, and tying the two
 * together would let one provider hiccup starve a whole competition.
 */
export async function dueFixtures(
  season: number,
  now: Date,
  leagueIds: number[],
): Promise<DueFixture[]> {
  const rows = await prisma.match.findMany({
    where: {
      season,
      leagueId: { in: leagueIds },
      status: { in: [...FINISHED_STATUSES] },
      kickoff: { gte: windowStart(now), lte: now },
    },
    select: {
      apiFootballId: true,
      kickoff: true,
      status: true,
      hydratedAt: true,
      league: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })

  const candidates = rows.map((row) => ({
    apiFootballId: row.apiFootballId,
    kickoff: row.kickoff,
    status: row.status,
    hydratedAt: row.hydratedAt,
    league: row.league.name,
    label: `${row.homeTeam.name} vs ${row.awayTeam.name}`,
  }))

  return selectDue(candidates, now)
}

export interface DueLineup {
  apiFootballId: number
  kickoff: Date
  status: string
  lineupCount: number
  league: string
  label: string
}

/**
 * Which fixtures a scheduled run should ask for a team sheet.
 *
 * The same split as `dueFixtures` — coarse filter in Postgres, policy in
 * `hydration.ts` — and here the fold is not a preference: Prisma's `where` can
 * ask whether a relation has *no* rows but not whether it has *fewer than two*,
 * and two is the number that matters, because the clubs announce minutes apart.
 * The kickoff band the query is given is narrow enough that the candidate set is
 * a handful of rows.
 */
export async function lineupDueFixtures(
  season: number,
  now: Date,
  leagueIds: number[],
): Promise<DueLineup[]> {
  const { from, to } = lineupKickoffRange(now)

  const rows = await prisma.match.findMany({
    where: {
      season,
      leagueId: { in: leagueIds },
      status: { in: [...PENDING_STATUSES] },
      kickoff: { gte: from, lte: to },
    },
    select: {
      apiFootballId: true,
      kickoff: true,
      status: true,
      league: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      _count: { select: { lineups: true } },
    },
  })

  const candidates = rows.map((row) => ({
    apiFootballId: row.apiFootballId,
    kickoff: row.kickoff,
    status: row.status,
    lineupCount: row._count.lineups,
    league: row.league.name,
    label: `${row.homeTeam.name} vs ${row.awayTeam.name}`,
  }))

  return selectLineupDue(candidates, now)
}

/** Our own league ids for the configured provider ids, with their names. */
export async function leagueRows(
  apiFootballIds: number[],
): Promise<{ id: number; name: string }[]> {
  return prisma.league.findMany({
    where: { apiFootballId: { in: apiFootballIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}
