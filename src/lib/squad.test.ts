/**
 * The squad ordering and the position labels, against the real captured lineup.
 *
 * Same rule as `api-football/map.test.ts` and `rounds.test.ts`: the input is the
 * actual response dumped by `scripts/verify_api.py`, read at runtime, never JSON
 * typed from memory. It matters more here than usual — the first test below is
 * the entire justification for the match page saying `DEF` where the design says
 * `CB`, and it would be worthless if it asserted against a remembered idea of
 * what the provider sends.
 *
 * `buildSquad` is used to produce the input rather than a database read. Its
 * output is structurally what `squad.ts` asks for, which is the point of typing
 * these helpers against a plain interface instead of against Prisma's row.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { compareSquadEntries, positionLabel, splitSquad } from './squad'
import { buildSquad } from './api-football/map'
import type { ApiFootballEnvelope, RawLineup, RawPlayerStats } from './api-football/types'

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

const lineups = load<RawLineup>('lineup_1208021.json')
const playerStats = load<RawPlayerStats>('players_1208021.json')

/**
 * The squad as the sync would write it, with the team key renamed to what the
 * database calls it. `splitSquad` only ever compares the value to itself, so
 * API-Football's id stands in for our own here without changing what is tested.
 */
const squad = buildSquad(lineups.response, playerStats.response).map((entry) => ({
  ...entry,
  teamId: entry.teamApiFootballId,
}))

describe('positionLabel', () => {
  it('has a label for every position the provider actually sends', () => {
    // The claim under test: `G`, `D`, `M`, `F` is the whole vocabulary. If a
    // fifth letter ever appears in a captured payload, this fails and the match
    // page's position column is the thing to go and look at.
    const positions = [...new Set(squad.map((entry) => entry.position))]
    expect(positions.length).toBeGreaterThan(0)
    for (const position of positions) {
      expect(positionLabel(position), `position ${position}`).not.toBeNull()
    }
  })

  it('does not invent a label for something it does not know', () => {
    expect(positionLabel('RB')).toBeNull()
    expect(positionLabel(null)).toBeNull()
  })
})

describe('splitSquad', () => {
  /** Each team's raw lineup, which is where the expected counts come from. */
  const teams = lineups.response.map((lineup) => lineup.team.id)

  it('splits each side into the eleven and the bench the payload lists', () => {
    for (const teamId of teams) {
      const raw = lineups.response.find((lineup) => lineup.team.id === teamId)!
      const { starters, substitutes } = splitSquad(squad, teamId)

      expect(starters).toHaveLength(raw.startXI.length)
      expect(substitutes).toHaveLength(raw.substitutes.length)
    }
  })

  it('puts the goalkeeper first in the starting eleven', () => {
    for (const teamId of teams) {
      const raw = lineups.response.find((lineup) => lineup.team.id === teamId)!
      // Pulled out of the payload, not assumed: whoever the provider marks `G`
      // is who the page must list first.
      const keeper = raw.startXI.find((slot) => slot.player.pos === 'G')!
      const { starters } = splitSquad(squad, teamId)

      expect(starters[0].player.apiFootballId).toBe(keeper.player.id)
    }
  })

  it('orders the starting eleven back to front', () => {
    const rank = ['G', 'D', 'M', 'F']
    for (const teamId of teams) {
      const { starters } = splitSquad(squad, teamId)
      const ranks = starters.map((entry) => rank.indexOf(entry.position ?? ''))
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('gives a team with no rows two empty lists rather than failing', () => {
    expect(splitSquad(squad, -1)).toEqual({ starters: [], substitutes: [] })
  })
})

describe('compareSquadEntries', () => {
  const entry = (grid: string | null, shirtNumber: number | null, name: string) => ({
    position: 'D',
    grid,
    shirtNumber,
    player: { name },
  })

  it('reads the grid as two numbers, not as a string', () => {
    // The lexical comparison this guards against would put row 10 before row 2.
    // No captured payload reaches row 10, which is exactly why it is asserted
    // here rather than left to the fixture to catch.
    const sorted = [entry('10:1', 1, 'a'), entry('2:1', 2, 'b')].sort(compareSquadEntries)
    expect(sorted.map((row) => row.grid)).toEqual(['2:1', '10:1'])
  })

  it('sorts a player with no grid or shirt number last, rather than first', () => {
    const sorted = [entry(null, null, 'a'), entry('2:1', 5, 'b')].sort(compareSquadEntries)
    expect(sorted.map((row) => row.player.name)).toEqual(['b', 'a'])
  })
})
