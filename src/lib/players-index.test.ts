/**
 * The players index's vocabulary, its parsers and its arithmetic.
 *
 * Nothing here reads `scratch/`, unlike the sync mapper's tests: sorts, layouts
 * and storage keys are our own invention, not the provider's, so a captured
 * payload has nothing to say about them. The same footing as
 * `diary-filters.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  ALL_LEAGUES,
  PLAYER_SORTS,
  filterPlayers,
  foldPlayerRows,
  matchesSearch,
  parseLayout,
  parseLeague,
  parseSort,
  searchKey,
  type JudgementRow,
  type PlayerIndexRow,
  type PlayerRanking,
  type PlayerSquadRow,
} from './players-index'

/** A ranking with everything at zero, so each test names only what it is about. */
function player(overrides: Partial<PlayerRanking> & { id: number }): PlayerRanking {
  return { name: `Player ${overrides.id}`, total: 0, mvps: 0, standouts: 0, flops: 0, seen: 0, ...overrides }
}

function squadRow(id: number, name: string, overrides: Partial<PlayerSquadRow> = {}): PlayerSquadRow {
  return { id, name, shirtNumber: 10, position: 'M', teamId: 1, leagueId: 7, ...overrides }
}

function judged(playerId: number, tag: string | null): JudgementRow {
  return { tag, matchSquad: { playerId } }
}

describe('PLAYER_SORTS', () => {
  it('opens on Most judged, because parseSort falls back to index 0', () => {
    expect(PLAYER_SORTS[0].slug).toBe('most-judged')
    expect(parseSort(null).slug).toBe('most-judged')
  })

  it('has distinct slugs and a label on every sort', () => {
    const slugs = PLAYER_SORTS.map((sort) => sort.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const sort of PLAYER_SORTS) expect(sort.label).not.toBe('')
  })

  it('offers the five the design draws', () => {
    expect(PLAYER_SORTS.map((sort) => sort.slug)).toEqual([
      'most-judged',
      'most-mvps',
      'most-standouts',
      'most-flops',
      'name',
    ])
  })
})

describe('every sort is a total order', () => {
  /**
   * The property that matters most on this screen. The list is the whole league,
   * so hundreds of players tie at zero on the leading key; a comparator that ran
   * out of tiebreakers would leave them in input order, and the tail would
   * reshuffle whenever the reader switched sort and switched back.
   *
   * Sorting two different permutations of one set has to give one answer.
   */
  const squad: PlayerRanking[] = [
    player({ id: 1, name: 'Cole Palmer', total: 16, mvps: 6, standouts: 9, flops: 1, seen: 14 }),
    player({ id: 2, name: 'Bukayo Saka', total: 12, mvps: 3, standouts: 8, flops: 1, seen: 13 }),
    player({ id: 3, name: 'Declan Rice', total: 11, mvps: 4, standouts: 7, flops: 0, seen: 12 }),
    player({ id: 4, name: 'Erling Haaland', total: 12, mvps: 5, standouts: 5, flops: 2, seen: 12 }),
    player({ id: 5, name: 'Álvaro Costa', seen: 3 }),
    player({ id: 6, name: 'Zeki Amdouni' }),
    player({ id: 7, name: 'Adam Wharton' }),
    player({ id: 8, name: 'Adam Wharton', seen: 3 }),
  ]

  for (const sort of PLAYER_SORTS) {
    it(`${sort.slug} gives one answer whatever order it is handed`, () => {
      const forwards = [...squad].sort(sort.compare).map((p) => p.id)
      const backwards = [...squad].reverse().sort(sort.compare).map((p) => p.id)
      const shuffled = [squad[4], squad[0], squad[7], squad[2], squad[6], squad[1], squad[5], squad[3]]
        .sort(sort.compare)
        .map((p) => p.id)

      expect(backwards).toEqual(forwards)
      expect(shuffled).toEqual(forwards)
    })
  }
})

describe('sort tiebreaks', () => {
  it('most-judged falls to seen when the totals match', () => {
    const compare = parseSort('most-judged').compare
    const a = player({ id: 1, total: 5, seen: 9 })
    const b = player({ id: 2, total: 5, seen: 12 })
    expect([a, b].sort(compare).map((p) => p.id)).toEqual([2, 1])
  })

  it('most-mvps falls to the total when the MVPs match', () => {
    const compare = parseSort('most-mvps').compare
    const a = player({ id: 1, mvps: 3, total: 4 })
    const b = player({ id: 2, mvps: 3, total: 9 })
    expect([a, b].sort(compare).map((p) => p.id)).toEqual([2, 1])
  })

  it('most-flops leads on flops, not on the total', () => {
    const compare = parseSort('most-flops').compare
    const a = player({ id: 1, flops: 1, total: 20 })
    const b = player({ id: 2, flops: 6, total: 6 })
    expect([a, b].sort(compare).map((p) => p.id)).toEqual([2, 1])
  })

  it('breaks a full tie on id, so identical names cannot swap', () => {
    const compare = parseSort('name').compare
    const a = player({ id: 8, name: 'Adam Wharton' })
    const b = player({ id: 7, name: 'Adam Wharton' })
    expect([a, b].sort(compare).map((p) => p.id)).toEqual([7, 8])
  })

  it('collates diacritics beside their plain letters rather than after Z', () => {
    const compare = parseSort('name').compare
    const names = [
      player({ id: 1, name: 'Zirkzee' }),
      player({ id: 2, name: 'Álvarez' }),
      player({ id: 3, name: 'Alvarez' }),
    ]
    expect(names.sort(compare).map((p) => p.name)).toEqual(['Alvarez', 'Álvarez', 'Zirkzee'])
  })
})

describe('parseSort and parseLayout fall back rather than refusing', () => {
  it('finds each sort by its slug', () => {
    for (const sort of PLAYER_SORTS) expect(parseSort(sort.slug).slug).toBe(sort.slug)
  })

  it.each([null, '', 'most-judgements', 'Most-Judged', 'MOST-JUDGED', 'nonsense'])(
    'falls back to Most judged for %j',
    (raw) => {
      expect(parseSort(raw).slug).toBe('most-judged')
    },
  )

  it('opens on the list layout', () => {
    expect(parseLayout(null)).toBe('list')
    expect(parseLayout('grid')).toBe('grid')
    expect(parseLayout('list')).toBe('list')
  })

  it.each([null, '', 'Grid', 'cards', 'table'])('falls back to the list for %j', (raw) => {
    expect(parseLayout(raw)).toBe('list')
  })
})

describe('parseLeague', () => {
  const leagues = [{ id: 7, name: 'Premier League' }]

  it('reads "all" and an absent value as every league', () => {
    expect(parseLeague(ALL_LEAGUES, leagues)).toBeNull()
    expect(parseLeague(null, leagues)).toBeNull()
  })

  it('reads a known id', () => {
    expect(parseLeague('7', leagues)).toBe(7)
  })

  it.each(['premier-league', '', '7.5', 'NaN'])('rejects the non-numeric %j', (raw) => {
    expect(parseLeague(raw, leagues)).toBeNull()
  })

  it('rejects an id no longer among the leagues found — the stale-preference guard', () => {
    // A preference stored last season, or against a database that has since been
    // pointed at a different SEASON. Filtering to it would empty the list.
    expect(parseLeague('99', leagues)).toBeNull()
  })
})

describe('searchKey and matchesSearch', () => {
  it('strips the diacritics a UK keyboard cannot type', () => {
    expect(searchKey('Moisés Caicedo')).toBe('moises caicedo')
    expect(searchKey('Gabriel Magalhães')).toBe('gabriel magalhaes')
  })

  it('finds a player by an unaccented spelling of his name', () => {
    const key = searchKey('Moisés Caicedo')
    expect(matchesSearch(key, 'moises')).toBe(true)
    expect(matchesSearch(key, 'Moisés')).toBe(true)
  })

  it('matches a substring, not merely a prefix — a surname is what a reader knows', () => {
    expect(matchesSearch(searchKey('Moisés Caicedo'), 'caicedo')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesSearch(searchKey('Cole Palmer'), '  PALMER ')).toBe(true)
  })

  it('matches everything on an empty or blank query, which is what clearing the box does', () => {
    expect(matchesSearch(searchKey('Cole Palmer'), '')).toBe(true)
    expect(matchesSearch(searchKey('Cole Palmer'), '   ')).toBe(true)
  })

  it('does not match an unrelated name', () => {
    expect(matchesSearch(searchKey('Cole Palmer'), 'haaland')).toBe(false)
  })
})

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

describe('filterPlayers', () => {
  const rows: PlayerIndexRow[] = [
    { ...player({ id: 1, name: 'Cole Palmer' }), key: 'cole palmer', teamId: 1, leagueId: 7, shirtNumber: 20, position: 'M' },
    { ...player({ id: 2, name: 'Lamine Yamal' }), key: 'lamine yamal', teamId: 2, leagueId: 9, shirtNumber: 10, position: 'F' },
  ]

  it('returns everything on a blank query and no league', () => {
    expect(filterPlayers(rows, '', null)).toHaveLength(2)
  })

  it('narrows to one league', () => {
    expect(filterPlayers(rows, '', 7).map((row) => row.id)).toEqual([1])
  })

  it('applies the search and the league together', () => {
    expect(filterPlayers(rows, 'yamal', 7)).toEqual([])
    expect(filterPlayers(rows, 'yamal', 9).map((row) => row.id)).toEqual([2])
  })
})
