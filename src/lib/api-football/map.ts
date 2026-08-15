/**
 * API-Football's shape in, Madooo's shape out.
 *
 * Every function here is pure — no network, no Prisma, no clock. That is what
 * makes this the one part of the sync worth testing: the real captured payloads
 * go in one end and plain objects come out the other, with nothing to stub.
 *
 * The three known payload traps are all handled here, and nowhere else:
 *   - `rating` arrives as the string "7.2"
 *   - `penalty.commited` is misspelled by the API
 *   - most statistics are null for most players, and null is not zero
 */

import type {
  RawFixture,
  RawLineup,
  RawPlayerEntry,
  RawPlayerStats,
} from './types'

export interface MappedLeague {
  apiFootballId: number
  name: string
  country: string
  logo: string | null
}

export interface MappedTeam {
  apiFootballId: number
  name: string
  logo: string | null
}

export interface MappedMatch {
  apiFootballId: number
  leagueApiFootballId: number
  season: number
  round: string
  kickoff: Date
  status: string
  statusElapsed: number | null
  venueApiFootballId: number | null
  venueName: string | null
  venueCity: string | null
  referee: string | null
  homeTeamApiFootballId: number
  awayTeamApiFootballId: number
  homeGoals: number | null
  awayGoals: number | null
  homeHalftimeGoals: number | null
  awayHalftimeGoals: number | null
}

/** One fixture, decomposed into the rows it implies. */
export interface MappedFixture {
  league: MappedLeague
  homeTeam: MappedTeam
  awayTeam: MappedTeam
  match: MappedMatch
}

export interface MappedLineup {
  teamApiFootballId: number
  formation: string | null
  coachApiFootballId: number | null
  coachName: string | null
  kitPlayerPrimary: string | null
  kitPlayerNumber: string | null
  kitPlayerBorder: string | null
  kitGoalkeeperPrimary: string | null
  kitGoalkeeperNumber: string | null
  kitGoalkeeperBorder: string | null
}

export interface MappedPlayer {
  apiFootballId: number
  name: string
  photo: string | null
}

/** A player's involvement in one match — precisely what a user may judge. */
export interface MappedSquadEntry {
  teamApiFootballId: number
  player: MappedPlayer
  shirtNumber: number | null
  position: string | null
  isStarter: boolean
  grid: string | null
  minutes: number | null
  goals: number | null
  assists: number | null
  yellow: number | null
  red: number | null
  rating: number | null
}

/**
 * "7.2" -> 7.2, and anything unparseable -> null.
 *
 * Never let this reach the database as text. Note that `Number('')` is 0 rather
 * than NaN, so an empty string has to be excluded explicitly or a blank rating
 * would become a real score of zero.
 */
export function parseRating(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapFixture(raw: RawFixture): MappedFixture {
  return {
    league: {
      apiFootballId: raw.league.id,
      name: raw.league.name,
      country: raw.league.country,
      logo: raw.league.logo,
    },
    homeTeam: {
      apiFootballId: raw.teams.home.id,
      name: raw.teams.home.name,
      logo: raw.teams.home.logo,
    },
    awayTeam: {
      apiFootballId: raw.teams.away.id,
      name: raw.teams.away.name,
      logo: raw.teams.away.logo,
    },
    match: {
      apiFootballId: raw.fixture.id,
      leagueApiFootballId: raw.league.id,
      season: raw.league.season,
      round: raw.league.round,
      // The payload carries an explicit UTC offset, so no timezone guessing.
      kickoff: new Date(raw.fixture.date),
      status: raw.fixture.status.short,
      statusElapsed: raw.fixture.status.elapsed,
      venueApiFootballId: raw.fixture.venue?.id ?? null,
      venueName: raw.fixture.venue?.name ?? null,
      venueCity: raw.fixture.venue?.city ?? null,
      referee: raw.fixture.referee,
      homeTeamApiFootballId: raw.teams.home.id,
      awayTeamApiFootballId: raw.teams.away.id,
      homeGoals: raw.goals.home,
      awayGoals: raw.goals.away,
      homeHalftimeGoals: raw.score.halftime.home,
      awayHalftimeGoals: raw.score.halftime.away,
    },
  }
}

export function mapLineup(raw: RawLineup): MappedLineup {
  const colors = raw.team.colors
  return {
    teamApiFootballId: raw.team.id,
    formation: raw.formation,
    coachApiFootballId: raw.coach?.id ?? null,
    coachName: raw.coach?.name ?? null,
    kitPlayerPrimary: colors?.player?.primary ?? null,
    kitPlayerNumber: colors?.player?.number ?? null,
    kitPlayerBorder: colors?.player?.border ?? null,
    kitGoalkeeperPrimary: colors?.goalkeeper?.primary ?? null,
    kitGoalkeeperNumber: colors?.goalkeeper?.number ?? null,
    kitGoalkeeperBorder: colors?.goalkeeper?.border ?? null,
  }
}

/** The teams named across both endpoints, deduplicated. */
export function mapSquadTeams(
  lineups: RawLineup[],
  stats: RawPlayerStats[],
): MappedTeam[] {
  const teams = new Map<number, MappedTeam>()
  for (const lineup of lineups) {
    teams.set(lineup.team.id, {
      apiFootballId: lineup.team.id,
      name: lineup.team.name,
      logo: lineup.team.logo,
    })
  }
  for (const entry of stats) {
    teams.set(entry.team.id, {
      apiFootballId: entry.team.id,
      name: entry.team.name,
      logo: entry.team.logo,
    })
  }
  return [...teams.values()]
}

/**
 * Merge both per-fixture endpoints into the judgeable squad.
 *
 * Neither endpoint is sufficient alone. Only `/fixtures/lineups` carries `grid`,
 * shirt number and the starter/bench split; only `/fixtures/players` carries the
 * full name and minutes — the lineup abbreviates "André Onana" to "A. Onana",
 * which is not what a diary should show.
 *
 * The merge is a **union** keyed on player id, not an intersection. The two
 * endpoints agreed exactly (20 players each, identical ids) in the fixture we
 * captured, but that is a single data point, and a fixture with no published
 * lineup should still produce squad rows rather than none.
 */
export function buildSquad(
  lineups: RawLineup[],
  stats: RawPlayerStats[],
): MappedSquadEntry[] {
  const entries = new Map<number, MappedSquadEntry>()

  for (const lineup of lineups) {
    const slots = [
      ...lineup.startXI.map((slot) => ({ slot, isStarter: true })),
      ...lineup.substitutes.map((slot) => ({ slot, isStarter: false })),
    ]
    for (const { slot, isStarter } of slots) {
      // A team sheet can name a player the provider has no record for, and it
      // arrives as a null id — seen on a real bench, `{"id": null, "name":
      // "Afonso Duarte"}`. There is nothing to store: `Player.apiFootballId` is
      // the natural key every upsert in the sync hangs off, and inventing one
      // would collide with whatever id the provider assigns him later.
      //
      // So he is dropped, and the cost is stated rather than hidden: that
      // player cannot be judged until the provider gives him an id, at which
      // point an ordinary re-read picks him up like anyone else. Dropping one
      // bench place is much better than failing the whole fixture, which is
      // what happened before this guard existed.
      if (slot.player.id === null) continue

      entries.set(slot.player.id, {
        teamApiFootballId: lineup.team.id,
        player: {
          apiFootballId: slot.player.id,
          // Provisional: overwritten below by the full name when the statistics
          // endpoint also lists this player, which is the normal case.
          name: slot.player.name,
          photo: null,
        },
        shirtNumber: slot.player.number,
        position: slot.player.pos,
        isStarter,
        grid: slot.player.grid,
        minutes: null,
        goals: null,
        assists: null,
        yellow: null,
        red: null,
        rating: null,
      })
    }
  }

  for (const team of stats) {
    for (const raw of team.players) {
      const existing = entries.get(raw.player.id)
      entries.set(raw.player.id, {
        ...mapPlayerEntry(raw, team.team.id, existing),
      })
    }
  }

  return [...entries.values()]
}

/**
 * One player's row from `/fixtures/players`, layered over whatever the lineup
 * already established. `existing` is undefined when the player appears only in
 * the statistics endpoint, in which case the lineup-only fields stay null and
 * `substitute` is what is left to infer starter status from.
 */
function mapPlayerEntry(
  raw: RawPlayerEntry,
  teamApiFootballId: number,
  existing: MappedSquadEntry | undefined,
): MappedSquadEntry {
  const statistics = raw.statistics[0]
  const games = statistics?.games

  return {
    teamApiFootballId: existing?.teamApiFootballId ?? teamApiFootballId,
    player: {
      apiFootballId: raw.player.id,
      name: raw.player.name,
      photo: raw.player.photo,
    },
    shirtNumber: existing?.shirtNumber ?? games?.number ?? null,
    position: existing?.position ?? games?.position ?? null,
    isStarter: existing?.isStarter ?? games?.substitute === false,
    grid: existing?.grid ?? null,
    minutes: games?.minutes ?? null,
    // No `?? 0` anywhere below. An unused substitute has no goals figure; they
    // did not score zero, and the diary must be able to tell those apart.
    goals: statistics?.goals?.total ?? null,
    assists: statistics?.goals?.assists ?? null,
    yellow: statistics?.cards?.yellow ?? null,
    red: statistics?.cards?.red ?? null,
    rating: parseRating(games?.rating),
  }
}
