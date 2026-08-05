/**
 * The teams index's own arithmetic: the fold that turns four query results into
 * rows.
 *
 * Nothing here reads `scratch/`, unlike the sync mapper's tests: the fold is our
 * own invention, not the provider's, so a captured payload has nothing to say
 * about it. The sorts and parsers it shares with the players index are covered in
 * `rankings.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  foldTeamRows,
  type ClubIdentityRow,
  type ClubLeagueRow,
  type TeamJudgementRow,
} from './teams-index'

const ARSENAL: ClubIdentityRow = { id: 1, name: 'Arsenal', code: 'ARS', colour: '#ef0107' }
const CHELSEA: ClubIdentityRow = { id: 2, name: 'Chelsea', code: 'CHE', colour: '#034694' }
const PREMIER_LEAGUE = { id: 7, name: 'Premier League' }

/** A club arrives once per side of the fixture, which is what the fold dedupes. */
function played(teamId: number, leagueId = 7): ClubLeagueRow[] {
  return [
    { teamId, leagueId },
    { teamId, leagueId },
  ]
}

function judged(teamId: number, playerId: number, tag: string | null): TeamJudgementRow {
  return { tag, matchSquad: { teamId, playerId } }
}

describe('foldTeamRows', () => {
  it('keeps a club nobody has judged, with every tally at zero', () => {
    const rows = foldTeamRows(played(1), [ARSENAL], [PREMIER_LEAGUE], [], [])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      name: 'Arsenal',
      seen: 0,
      total: 0,
      mvps: 0,
      standouts: 0,
      flops: 0,
      players: 0,
    })
  })

  it('draws a club once, however many sides of a fixture it arrived on', () => {
    // `clubLeagues` groups home and away separately, so every club that both
    // hosted and visited comes back twice. A directory listing Arsenal twice is
    // the failure this guards.
    const rows = foldTeamRows(played(1), [ARSENAL], [PREMIER_LEAGUE], [], [])
    expect(rows.map((row) => row.id)).toEqual([1])
  })

  it('sums the seen count across both sides of the fixture', () => {
    // Home and away are separate groupBy rows and both halves are real: eight
    // watched at home plus six away is fourteen matches seen, not six.
    const rows = foldTeamRows(
      played(1),
      [ARSENAL],
      [PREMIER_LEAGUE],
      [
        { teamId: 1, count: 8 },
        { teamId: 1, count: 6 },
      ],
      [],
    )
    expect(rows[0].seen).toBe(14)
  })

  it('counts distinct players, not judgements', () => {
    // The drawing's "N players" column. Saka judged in three matches is one
    // player; the three judgements are already carried as `total`.
    const rows = foldTeamRows(
      played(1),
      [ARSENAL],
      [PREMIER_LEAGUE],
      [],
      [judged(1, 50, 'MVP'), judged(1, 50, 'STANDOUT'), judged(1, 50, 'MVP'), judged(1, 51, 'FLOP')],
    )

    expect(rows[0]).toMatchObject({ players: 2, total: 4 })
  })

  it('counts a note-only judgement toward the total and the player, and toward no tag', () => {
    const rows = foldTeamRows(played(1), [ARSENAL], [PREMIER_LEAGUE], [], [judged(1, 50, null)])

    expect(rows[0]).toMatchObject({ total: 1, players: 1, mvps: 0, standouts: 0, flops: 0 })
  })

  it('splits tags into their own tallies while counting them all', () => {
    const rows = foldTeamRows(
      played(1),
      [ARSENAL],
      [PREMIER_LEAGUE],
      [],
      [
        judged(1, 50, 'MVP'),
        judged(1, 51, 'MVP'),
        judged(1, 52, 'STANDOUT'),
        judged(1, 53, 'FLOP'),
        judged(1, 54, null),
      ],
    )

    expect(rows[0]).toMatchObject({ total: 5, mvps: 2, standouts: 1, flops: 1, players: 5 })
  })

  it('keeps one club’s judgements off another’s row', () => {
    const rows = foldTeamRows(
      [...played(1), ...played(2)],
      [ARSENAL, CHELSEA],
      [PREMIER_LEAGUE],
      [],
      [judged(1, 50, 'MVP'), judged(2, 60, 'FLOP'), judged(2, 61, 'FLOP')],
    )

    expect(rows.find((row) => row.id === 1)).toMatchObject({ mvps: 1, flops: 0, players: 1 })
    expect(rows.find((row) => row.id === 2)).toMatchObject({ mvps: 0, flops: 2, players: 2 })
  })

  it('can report more verdicts than matches seen, which is why the bar is a mix', () => {
    // The whole reason `verdictMix` exists. One watched match carries eleven of a
    // club's players, so five verdicts against one match is ordinary rather than
    // corrupt — and a bar drawn as a proportion of `seen` would overrun its track.
    const rows = foldTeamRows(
      played(1),
      [ARSENAL],
      [PREMIER_LEAGUE],
      [{ teamId: 1, count: 1 }],
      [
        judged(1, 50, 'MVP'),
        judged(1, 51, 'STANDOUT'),
        judged(1, 52, 'STANDOUT'),
        judged(1, 53, 'FLOP'),
        judged(1, 54, 'FLOP'),
      ],
    )

    const row = rows[0]
    expect(row.mvps + row.standouts + row.flops).toBeGreaterThan(row.seen)
  })

  it('joins the league name off the select’s own options', () => {
    const rows = foldTeamRows(played(1, 7), [ARSENAL], [PREMIER_LEAGUE], [], [])
    expect(rows[0]).toMatchObject({ leagueId: 7, league: 'Premier League' })
  })

  it('draws no league rather than a wrong one when the id is not among the options', () => {
    const rows = foldTeamRows(played(1, 99), [ARSENAL], [PREMIER_LEAGUE], [], [])
    expect(rows[0]).toMatchObject({ leagueId: 99, league: null })
  })

  it('carries the crest fields through, so a row can be handed straight to CrestChip', () => {
    const rows = foldTeamRows(played(1), [ARSENAL], [PREMIER_LEAGUE], [], [])
    expect(rows[0]).toMatchObject({ name: 'Arsenal', code: 'ARS', colour: '#ef0107' })
  })

  it('omits a club whose identity is missing rather than drawing a nameless row', () => {
    // Unreachable while both queries ask the same question of the same season.
    const rows = foldTeamRows([...played(1), ...played(2)], [ARSENAL], [PREMIER_LEAGUE], [], [])
    expect(rows.map((row) => row.id)).toEqual([1])
  })

  it('precomputes the search key, stripped of the diacritics a UK keyboard cannot type', () => {
    const atletico: ClubIdentityRow = { id: 3, name: 'Atlético Madrid', code: 'ATL', colour: null }
    const rows = foldTeamRows(played(3, 9), [atletico], [{ id: 9, name: 'La Liga' }], [], [])

    expect(rows[0].key).toBe('atletico madrid')
  })
})
