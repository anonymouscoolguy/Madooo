/**
 * API-Football's JSON shape. Written from the captured payloads in `scratch/`,
 * not from their documentation.
 *
 * This file and its neighbours are the only place these shapes are allowed to
 * exist (constraint #3 in AGENTS.md). Everything inland reads our own schema, so
 * a provider change lands here and nowhere else.
 *
 * These are types, not classes: TypeScript erases them at compile time, so they
 * describe what the JSON is expected to look like without costing anything at
 * runtime. They are not validation — nothing checks the response against them.
 */

/**
 * Every v3 endpoint wraps its payload in this envelope.
 *
 * `errors` is the load-bearing field. It is `[]` on success and an *object* of
 * reason strings on failure — see `isApiFootballFailure` in `client.ts` for why
 * that distinction needs care in JavaScript.
 */
export interface ApiFootballEnvelope<T> {
  get: string
  parameters: Record<string, string> | unknown[]
  errors: string[] | Record<string, string>
  results: number
  paging: { current: number; total: number }
  response: T[]
}

/** An entry from `GET /fixtures?league={id}&season={year}`. */
export interface RawFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    /** ISO 8601 with an explicit UTC offset, e.g. "2024-08-16T19:00:00+00:00". */
    date: string
    timestamp: number
    venue: { id: number | null; name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string | null
    flag: string | null
    season: number
    /** "Regular Season - 1" */
    round: string
  }
  teams: {
    home: RawFixtureTeam
    away: RawFixtureTeam
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface RawFixtureTeam {
  id: number
  name: string
  logo: string | null
  winner: boolean | null
}

/** An entry from `GET /fixtures/lineups?fixture={id}` — one per team. */
export interface RawLineup {
  team: {
    id: number
    name: string
    logo: string | null
    /** Hex without the leading "#", e.g. "ea0000". */
    colors: {
      player: RawKit
      goalkeeper: RawKit
    } | null
  }
  coach: { id: number | null; name: string | null; photo: string | null }
  formation: string | null
  startXI: RawLineupSlot[]
  substitutes: RawLineupSlot[]
}

export interface RawKit {
  primary: string | null
  number: string | null
  border: string | null
}

export interface RawLineupSlot {
  player: {
    id: number
    /** Abbreviated here — "A. Onana". The full name is on /fixtures/players. */
    name: string
    number: number | null
    /** "G" | "D" | "M" | "F" */
    pos: string | null
    /** "row:column" for starters, null for substitutes. */
    grid: string | null
  }
}

/** An entry from `GET /fixtures/players?fixture={id}` — one per team. */
export interface RawPlayerStats {
  team: { id: number; name: string; logo: string | null }
  players: RawPlayerEntry[]
}

export interface RawPlayerEntry {
  player: {
    id: number
    /** The full name — "André Onana". This is why the endpoint is worth a call. */
    name: string
    photo: string | null
  }
  /** Always exactly one entry in every payload captured so far. */
  statistics: RawPlayerStatistics[]
}

export interface RawPlayerStatistics {
  games: {
    /** null means named in the squad but never came on. */
    minutes: number | null
    number: number | null
    position: string | null
    /** A string — "7.2" — not a number. */
    rating: string | null
    captain: boolean | null
    substitute: boolean | null
  }
  goals: {
    total: number | null
    conceded: number | null
    assists: number | null
    saves: number | null
  }
  cards: { yellow: number | null; red: number | null }
  /**
   * `commited` is API-Football's own misspelling. It is reproduced here because
   * this file describes their payload; it is corrected the moment it crosses
   * into our shape, and the typo appears nowhere inland.
   */
  penalty: {
    won: number | null
    commited: number | null
    scored: number | null
    missed: number | null
    saved: number | null
  }
}
