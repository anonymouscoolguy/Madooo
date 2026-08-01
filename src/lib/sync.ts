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
import { prisma } from './prisma'

/**
 * Premier League. Not a season literal — the season is configuration and comes
 * from `season()`. Scope is Premier-League-only for now by product decision; a
 * second league becomes a parameter here when one is added.
 */
export const PREMIER_LEAGUE_ID = 39

/** "1" and "Regular Season - 1" both mean the same round. */
export function roundLabel(round: string): string {
  return /^\d+$/.test(round.trim()) ? `Regular Season - ${round.trim()}` : round
}

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
  leagues: number
  teams: number
  matches: number
  remaining: number | null
  limit: number | null
  /** Every fixture written, so the caller can pick which ones to hydrate. */
  fixtures: { apiFootballId: number; round: string; label: string }[]
}

/**
 * One request: every fixture of the season. Writes the league, all 20 teams and
 * all 380 matches — the calendar, without lineups or squads.
 */
export async function syncSeasonFixtures(season: number): Promise<FixturesSyncResult> {
  const { response, remaining, limit } = await apiGet<RawFixture>('fixtures', {
    league: PREMIER_LEAGUE_ID,
    season,
  })

  const mapped = response.map(mapFixture)
  if (mapped.length === 0) {
    return {
      season,
      leagues: 0,
      teams: 0,
      matches: 0,
      remaining,
      limit,
      fixtures: [],
    }
  }

  const league = mapped[0].league
  const { id: leagueId } = await prisma.league.upsert({
    where: { apiFootballId: league.apiFootballId },
    create: league,
    update: { name: league.name, country: league.country, logo: league.logo },
  })

  const teams = new Map<number, MappedTeam>()
  for (const { homeTeam, awayTeam } of mapped) {
    teams.set(homeTeam.apiFootballId, homeTeam)
    teams.set(awayTeam.apiFootballId, awayTeam)
  }
  const teamIds = await upsertTeams([...teams.values()])

  await inChunks(mapped, 10, ({ match }) => upsertMatch(match, leagueId, teamIds))

  return {
    season,
    leagues: 1,
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

export interface FixtureDetailResult {
  fixtureApiFootballId: number
  lineups: number
  squadEntries: number
  remaining: number | null
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
  const match = await prisma.match.findUnique({
    where: { apiFootballId: fixtureApiFootballId },
    select: { id: true },
  })
  if (match === null) {
    throw new Error(
      `Fixture ${fixtureApiFootballId} is not in the database — sync fixtures first`,
    )
  }

  const lineups = await apiGet<RawLineup>('fixtures/lineups', {
    fixture: fixtureApiFootballId,
  })
  const stats = await apiGet<RawPlayerStats>('fixtures/players', {
    fixture: fixtureApiFootballId,
  })

  const teamIds = await upsertTeams(mapSquadTeams(lineups.response, stats.response))

  for (const raw of lineups.response) {
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
      where: { matchId_teamId: { matchId: match.id, teamId } },
      create: { matchId: match.id, teamId, ...data },
      update: data,
    })
  }

  const squad = buildSquad(lineups.response, stats.response)
  await inChunks(squad, 10, (entry) => upsertSquadEntry(entry, match.id, teamIds))

  return {
    fixtureApiFootballId,
    lineups: lineups.response.length,
    squadEntries: squad.length,
    remaining: stats.remaining,
  }
}
