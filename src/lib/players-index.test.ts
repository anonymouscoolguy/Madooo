/**
 * The players index's own arithmetic: the fold that turns three query results
 * into rows.
 *
 * The sorts, the parsers and the search normaliser moved to
 * `rankings.test.ts` when the teams index wanted the same five sorts. What is
 * left here is what is genuinely about players.
 *
 * Nothing here reads `scratch/`, unlike the sync mapper's tests: the fold is our
 * own invention, not the provider's, so a captured payload has nothing to say
 * about it. The same footing as `diary-filters.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  foldPlayerRows,
  type JudgementRow,
  type PlayerSquadRow,
} from './players-index'

function squadRow(id: number, name: string, overrides: Partial<PlayerSquadRow> = {}): PlayerSquadRow {
  return { id, name, shirtNumber: 10, position: 'M', teamId: 1, leagueId: 7, ...overrides }
}

function judged(playerId: number, tag: string | null): JudgementRow {
  return { tag, matchSquad: { playerId } }
}

describe('foldPlayerRows', () => {
  it('keeps a player nobody has judged, with every tally at zero', () => {
    const rows = foldPlayerRows([squadRow(1, 'Adam Wharton')], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 1, seen: 0, total: 0, mvps: 0, standouts: 0, flops: 0 })
  })

  it('counts a note-only judgement toward the total and toward no tag', () => {
    const rows = foldPlayerRows([squadRow(1, 'Cole Palmer')], [], [judged(1, null)])
    expect(rows[0]).toMatchObject({ total: 1, mvps: 0, standouts: 0, flops: 0 })
  })

  it('splits tags into their own tallies while counting them all', () => {
    const rows = foldPlayerRows(
      [squadRow(1, 'Cole Palmer')],
      [],
      [judged(1, 'MVP'), judged(1, 'MVP'), judged(1, 'STANDOUT'), judged(1, 'FLOP'), judged(1, null)],
    )
    expect(rows[0]).toMatchObject({ total: 5, mvps: 2, standouts: 1, flops: 1 })
  })

  it('defaults seen to zero for a player absent from the groupBy', () => {
    const rows = foldPlayerRows(
      [squadRow(1, 'Cole Palmer'), squadRow(2, 'Adam Wharton')],
      [{ playerId: 1, _count: 14 }],
      [],
    )
    expect(rows.find((row) => row.id === 1)?.seen).toBe(14)
    expect(rows.find((row) => row.id === 2)?.seen).toBe(0)
  })

  it('cannot report more verdicts than matches seen, which is what makes the split bar fill', () => {
    // One judgement per user per player per match — @@unique([userId, matchSquadId])
    // and @@unique([matchId, playerId]) between them — so a tagged match is
    // necessarily a seen one. Asserted over the realistic case rather than trusted.
    //
    // A club has no such guarantee, which is why `foldTeamRows` feeds `verdictMix`
    // rather than `verdictSplit` — see `teams-index.ts`.
    const rows = foldPlayerRows(
      [squadRow(1, 'Cole Palmer')],
      [{ playerId: 1, _count: 3 }],
      [judged(1, 'MVP'), judged(1, 'STANDOUT'), judged(1, 'FLOP')],
    )
    const row = rows[0]
    expect(row.mvps + row.standouts + row.flops).toBeLessThanOrEqual(row.seen)
  })

  it('takes the club, shirt, position and league off the latest squad row', () => {
    const rows = foldPlayerRows(
      [squadRow(1, 'Cole Palmer', { shirtNumber: 20, position: 'M', teamId: 4, leagueId: 7 })],
      [],
      [],
    )
    expect(rows[0]).toMatchObject({ shirtNumber: 20, position: 'M', teamId: 4, leagueId: 7 })
  })

  it('carries the squad row through untouched, so the fold cannot lose a club', () => {
    // `playersInSeason` selects from MatchSquad, so a player on this list always
    // has a club and a competition — unlike a profile, which is reachable by URL
    // for a player with no squad row at all.
    const row = squadRow(1, 'Cole Palmer', { shirtNumber: 20, position: 'G', teamId: 4, leagueId: 7 })
    expect(foldPlayerRows([row], [], [])[0]).toMatchObject(row)
  })

  it('precomputes the search key, so a keystroke never normalises six hundred names', () => {
    const rows = foldPlayerRows([squadRow(1, 'Moisés Caicedo')], [], [])
    expect(rows[0].key).toBe('moises caicedo')
  })
})
