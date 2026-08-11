/**
 * The mapper, against the real captured payloads.
 *
 * Fixtures are read from `scratch/` at runtime — the actual responses dumped by
 * `scripts/verify_api.py`, never JSON typed from memory or pasted in here. The
 * reason is specific: if the same understanding writes both the mapper and its
 * fixture, the two agree with each other and the test proves nothing. The
 * captured response is ground truth; recollection is not.
 *
 * Assertions therefore compare mapper output against values *pulled out of the
 * payload at test time*, rather than against constants transcribed by hand.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildSquad, mapFixture, mapLineup, parseRating } from './map'
import type {
  ApiFootballEnvelope,
  RawFixture,
  RawLineup,
  RawPlayerStats,
} from './types'

const SCRATCH = join(process.cwd(), 'scratch')

function load<T>(name: string): ApiFootballEnvelope<T> {
  const path = join(SCRATCH, name)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<T>
  } catch {
    throw new Error(
      `Missing ${path}. These tests run against real captured payloads — ` +
        're-create them with `python3 scripts/verify_api.py`.',
    )
  }
}

const fixtures = load<RawFixture>('fixtures_39_2024.json')
const lineups = load<RawLineup>('lineup_1208021.json')
const playerStats = load<RawPlayerStats>('players_1208021.json')

/**
 * The fixture the lineup and player payloads were captured for — taken from the
 * payload's own `parameters` block, so the three files cannot drift apart
 * silently if they are ever re-captured for a different match.
 */
const sampleFixtureId = Number((lineups.parameters as Record<string, string>).fixture)
const sampleFixture = fixtures.response.find(
  (entry) => entry.fixture.id === sampleFixtureId,
)
if (sampleFixture === undefined) {
  throw new Error(`Fixture ${sampleFixtureId} is not in scratch/fixtures_39_2024.json`)
}

describe('parseRating', () => {
  it('parses the string the API actually sends', () => {
    // Pulled from the payload rather than typed: the point is that it is a
    // string in the JSON, and that the mapper turns it into a number.
    const raw = playerStats.response[0].players[0].statistics[0].games.rating
    expect(typeof raw).toBe('string')
    expect(parseRating(raw)).toBe(Number(raw))
  })

  it('treats a missing rating as absent, not as zero', () => {
    expect(parseRating(null)).toBeNull()
    expect(parseRating(undefined)).toBeNull()
    // Number('') is 0, which would silently invent a rating of zero.
    expect(parseRating('')).toBeNull()
    expect(parseRating('  ')).toBeNull()
    expect(parseRating('not a rating')).toBeNull()
  })
})

describe('mapFixture', () => {
  const mapped = mapFixture(sampleFixture)

  it('takes the season from the payload', () => {
    expect(mapped.match.season).toBe(sampleFixture.league.season)
  })

  it('reads the kickoff as the instant the payload states', () => {
    // The date carries an explicit UTC offset and the payload also gives a Unix
    // timestamp, so the two must agree — that is the check worth making.
    expect(mapped.match.kickoff.getTime()).toBe(sampleFixture.fixture.timestamp * 1000)
  })

  it('keeps status, venue and referee', () => {
    expect(mapped.match.status).toBe(sampleFixture.fixture.status.short)
    expect(mapped.match.statusElapsed).toBe(sampleFixture.fixture.status.elapsed)
    expect(mapped.match.venueName).toBe(sampleFixture.fixture.venue.name)
    expect(mapped.match.referee).toBe(sampleFixture.fixture.referee)
  })

  it('separates full-time from half-time goals', () => {
    expect(mapped.match.homeGoals).toBe(sampleFixture.goals.home)
    expect(mapped.match.homeHalftimeGoals).toBe(sampleFixture.score.halftime.home)
    expect(mapped.match.awayHalftimeGoals).toBe(sampleFixture.score.halftime.away)
  })

  it('pulls both teams out as their own rows', () => {
    expect(mapped.homeTeam.apiFootballId).toBe(sampleFixture.teams.home.id)
    expect(mapped.awayTeam.apiFootballId).toBe(sampleFixture.teams.away.id)
    expect(mapped.match.homeTeamApiFootballId).toBe(sampleFixture.teams.home.id)
  })

  it('maps every fixture in the season without throwing', () => {
    expect(fixtures.response.length).toBeGreaterThan(0)
    for (const raw of fixtures.response) {
      const each = mapFixture(raw)
      expect(Number.isNaN(each.match.kickoff.getTime())).toBe(false)
      expect(each.match.round).toBe(raw.league.round)
    }
  })
})

describe('mapLineup', () => {
  const raw = lineups.response[0]
  const mapped = mapLineup(raw)

  it('keeps the formation and coach', () => {
    expect(mapped.formation).toBe(raw.formation)
    expect(mapped.coachApiFootballId).toBe(raw.coach.id)
    expect(mapped.coachName).toBe(raw.coach.name)
  })

  it('flattens both kits', () => {
    expect(mapped.kitPlayerPrimary).toBe(raw.team.colors!.player.primary)
    expect(mapped.kitGoalkeeperPrimary).toBe(raw.team.colors!.goalkeeper.primary)
    // The goalkeeper never matches the outfield players, which is why there are
    // two kits rather than one.
    expect(mapped.kitPlayerPrimary).not.toBe(mapped.kitGoalkeeperPrimary)
  })
})

describe('buildSquad', () => {
  const squad = buildSquad(lineups.response, playerStats.response)

  const rawPlayers = playerStats.response.flatMap((team) => team.players)
  const rawSlots = lineups.response.flatMap((team) => [
    ...team.startXI,
    ...team.substitutes,
  ])

  it('covers the union of both endpoints', () => {
    const expected = new Set([
      ...rawPlayers.map((entry) => entry.player.id),
      ...rawSlots.map((slot) => slot.player.id),
    ])
    expect(squad.length).toBe(expected.size)
    expect(new Set(squad.map((entry) => entry.player.apiFootballId))).toEqual(expected)
  })

  it('prefers the full name over the lineup abbreviation', () => {
    // The lineup says "A. Onana", the statistics endpoint says "André Onana".
    // Whichever player the payload happens to list first will do.
    const slot = rawSlots[0]
    const full = rawPlayers.find((entry) => entry.player.id === slot.player.id)!
    const mapped = squad.find(
      (entry) => entry.player.apiFootballId === slot.player.id,
    )!

    expect(full.player.name).not.toBe(slot.player.name)
    expect(mapped.player.name).toBe(full.player.name)
    expect(mapped.player.photo).toBe(full.player.photo)
  })

  it('marks starters and substitutes as the lineup does', () => {
    for (const team of lineups.response) {
      for (const slot of team.startXI) {
        const mapped = squad.find(
          (entry) => entry.player.apiFootballId === slot.player.id,
        )!
        expect(mapped.isStarter).toBe(true)
        // grid is "row:column" for starters — the formation layout, handed to us.
        expect(mapped.grid).toBe(slot.player.grid)
        expect(mapped.grid).not.toBeNull()
      }
      for (const slot of team.substitutes) {
        const mapped = squad.find(
          (entry) => entry.player.apiFootballId === slot.player.id,
        )!
        expect(mapped.isStarter).toBe(false)
        expect(mapped.grid).toBeNull()
      }
    }
  })

  it('keeps shirt number and position', () => {
    const slot = rawSlots.find((entry) => entry.player.number !== null)!
    const mapped = squad.find(
      (entry) => entry.player.apiFootballId === slot.player.id,
    )!
    expect(mapped.shirtNumber).toBe(slot.player.number)
    expect(mapped.position).toBe(slot.player.pos)
  })

  it('keeps null minutes distinct from zero — the unused substitutes', () => {
    const unused = rawPlayers.filter(
      (entry) => entry.statistics[0].games.minutes === null,
    )
    // The captured fixture has some; if a future capture does not, this test is
    // asserting nothing and should be pointed at one that does.
    expect(unused.length).toBeGreaterThan(0)

    for (const entry of unused) {
      const mapped = squad.find(
        (row) => row.player.apiFootballId === entry.player.id,
      )!
      expect(mapped.minutes).toBeNull()
      // Named in the squad but never came on — still judgeable. That is the
      // product rule this row exists to support.
      expect(mapped.isStarter).toBe(false)
    }
  })

  it('does not turn absent statistics into zeroes', () => {
    const absent = rawPlayers.filter(
      (entry) => entry.statistics[0].goals.total === null,
    )
    expect(absent.length).toBeGreaterThan(0)

    for (const entry of absent) {
      const mapped = squad.find(
        (row) => row.player.apiFootballId === entry.player.id,
      )!
      expect(mapped.goals).toBeNull()
    }
  })

  it('carries the statistics that are present', () => {
    const scored = rawPlayers.find(
      (entry) => (entry.statistics[0].goals.total ?? 0) > 0,
    )
    expect(scored).toBeDefined()

    const mapped = squad.find(
      (row) => row.player.apiFootballId === scored!.player.id,
    )!
    const stats = scored!.statistics[0]
    expect(mapped.goals).toBe(stats.goals.total)
    expect(mapped.assists).toBe(stats.goals.assists)
    expect(mapped.yellow).toBe(stats.cards.yellow)
    expect(mapped.red).toBe(stats.cards.red)
    expect(mapped.rating).toBe(parseRating(stats.games.rating))
  })

  it('assigns every player to the team that named them', () => {
    for (const team of playerStats.response) {
      for (const entry of team.players) {
        const mapped = squad.find(
          (row) => row.player.apiFootballId === entry.player.id,
        )!
        expect(mapped.teamApiFootballId).toBe(team.team.id)
      }
    }
  })

  it('survives a fixture with no published lineup', () => {
    // Not a hypothetical: /fixtures/lineups is empty for a match that has not
    // kicked off, and the squad should still come out of the statistics alone.
    const withoutLineups = buildSquad([], playerStats.response)
    expect(withoutLineups.length).toBe(rawPlayers.length)
    expect(withoutLineups.every((entry) => entry.grid === null)).toBe(true)
  })
})
