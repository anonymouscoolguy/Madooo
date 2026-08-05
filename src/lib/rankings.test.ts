/**
 * The vocabulary both indexes are drawn from, and its parsers.
 *
 * Nothing here reads `scratch/`, unlike the sync mapper's tests: sorts, layouts
 * and storage keys are our own invention, not the provider's, so a captured
 * payload has nothing to say about them. The same footing as
 * `diary-filters.test.ts`.
 *
 * These tests moved out of `players-index.test.ts` when the teams index wanted
 * the same five sorts. They are written over `Ranking` rather than over a player,
 * which is the point: a comparator that assumed a player would not compile.
 */

import { describe, expect, it } from 'vitest'
import {
  ALL_LEAGUES,
  SORTS,
  filterRows,
  matchesSearch,
  parseLayout,
  parseLeague,
  parseSort,
  searchKey,
  type Filterable,
  type Ranking,
} from './rankings'

/** A ranking with everything at zero, so each test names only what it is about. */
function row(overrides: Partial<Ranking> & { id: number }): Ranking {
  return { name: `Row ${overrides.id}`, total: 0, mvps: 0, standouts: 0, flops: 0, seen: 0, ...overrides }
}

describe('SORTS', () => {
  it('opens on Most judged, because parseSort falls back to index 0', () => {
    expect(SORTS[0].slug).toBe('most-judged')
    expect(parseSort(null).slug).toBe('most-judged')
  })

  it('has distinct slugs and a label on every sort', () => {
    const slugs = SORTS.map((sort) => sort.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const sort of SORTS) expect(sort.label).not.toBe('')
  })

  it('offers the five the design draws', () => {
    expect(SORTS.map((sort) => sort.slug)).toEqual([
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
   * The property that matters most on these screens. The players index is the
   * whole league, so hundreds tie at zero on the leading key; a comparator that
   * ran out of tiebreakers would leave them in input order, and the tail would
   * reshuffle whenever the reader switched sort and switched back.
   *
   * Sorting two different permutations of one set has to give one answer.
   */
  const rows: Ranking[] = [
    row({ id: 1, name: 'Cole Palmer', total: 16, mvps: 6, standouts: 9, flops: 1, seen: 14 }),
    row({ id: 2, name: 'Bukayo Saka', total: 12, mvps: 3, standouts: 8, flops: 1, seen: 13 }),
    row({ id: 3, name: 'Declan Rice', total: 11, mvps: 4, standouts: 7, flops: 0, seen: 12 }),
    row({ id: 4, name: 'Erling Haaland', total: 12, mvps: 5, standouts: 5, flops: 2, seen: 12 }),
    row({ id: 5, name: 'Álvaro Costa', seen: 3 }),
    row({ id: 6, name: 'Zeki Amdouni' }),
    row({ id: 7, name: 'Adam Wharton' }),
    row({ id: 8, name: 'Adam Wharton', seen: 3 }),
  ]

  for (const sort of SORTS) {
    it(`${sort.slug} gives one answer whatever order it is handed`, () => {
      const forwards = [...rows].sort(sort.compare).map((r) => r.id)
      const backwards = [...rows].reverse().sort(sort.compare).map((r) => r.id)
      const shuffled = [rows[4], rows[0], rows[7], rows[2], rows[6], rows[1], rows[5], rows[3]]
        .sort(sort.compare)
        .map((r) => r.id)

      expect(backwards).toEqual(forwards)
      expect(shuffled).toEqual(forwards)
    })
  }
})

describe('the sorts rank clubs on the same numbers', () => {
  // The reason this file exists rather than a second copy under `teams-index`.
  // `Ranking` is structural, so a club satisfies it without conversion.
  const clubs: Ranking[] = [
    row({ id: 1, name: 'Arsenal', total: 10, mvps: 4, standouts: 5, flops: 1, seen: 14 }),
    row({ id: 2, name: 'Chelsea', total: 9, mvps: 3, standouts: 4, flops: 2, seen: 13 }),
    row({ id: 3, name: 'Tottenham', total: 6, mvps: 1, standouts: 2, flops: 3, seen: 9 }),
  ]

  it('puts the most-judged club first', () => {
    expect([...clubs].sort(parseSort('most-judged').compare).map((c) => c.name)).toEqual([
      'Arsenal',
      'Chelsea',
      'Tottenham',
    ])
  })

  it('leads on flops when asked to, not on the total', () => {
    expect([...clubs].sort(parseSort('most-flops').compare)[0].name).toBe('Tottenham')
  })

  it('sorts names A-Z', () => {
    expect([...clubs].sort(parseSort('name').compare).map((c) => c.name)).toEqual([
      'Arsenal',
      'Chelsea',
      'Tottenham',
    ])
  })
})

describe('sort tiebreaks', () => {
  it('most-judged falls to seen when the totals match', () => {
    const compare = parseSort('most-judged').compare
    expect([row({ id: 1, total: 5, seen: 9 }), row({ id: 2, total: 5, seen: 12 })].sort(compare).map((r) => r.id)).toEqual([2, 1])
  })

  it('most-mvps falls to the total when the MVPs match', () => {
    const compare = parseSort('most-mvps').compare
    expect([row({ id: 1, mvps: 3, total: 4 }), row({ id: 2, mvps: 3, total: 9 })].sort(compare).map((r) => r.id)).toEqual([2, 1])
  })

  it('most-flops leads on flops, not on the total', () => {
    const compare = parseSort('most-flops').compare
    expect([row({ id: 1, flops: 1, total: 20 }), row({ id: 2, flops: 6, total: 6 })].sort(compare).map((r) => r.id)).toEqual([2, 1])
  })

  it('breaks a full tie on id, so identical names cannot swap', () => {
    const compare = parseSort('name').compare
    const a = row({ id: 8, name: 'Adam Wharton' })
    const b = row({ id: 7, name: 'Adam Wharton' })
    expect([a, b].sort(compare).map((r) => r.id)).toEqual([7, 8])
  })

  it('collates diacritics beside their plain letters rather than after Z', () => {
    const compare = parseSort('name').compare
    const names = [
      row({ id: 1, name: 'Zirkzee' }),
      row({ id: 2, name: 'Álvarez' }),
      row({ id: 3, name: 'Alvarez' }),
    ]
    expect(names.sort(compare).map((r) => r.name)).toEqual(['Alvarez', 'Álvarez', 'Zirkzee'])
  })
})

describe('parseSort and parseLayout fall back rather than refusing', () => {
  it('finds each sort by its slug', () => {
    for (const sort of SORTS) expect(parseSort(sort.slug).slug).toBe(sort.slug)
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

  it('strips them from a club name too, which is what reaches Atlético', () => {
    expect(searchKey('Atlético Madrid')).toBe('atletico madrid')
    expect(matchesSearch(searchKey('Atlético Madrid'), 'atletico')).toBe(true)
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

describe('filterRows', () => {
  interface TestRow extends Filterable {
    id: number
  }

  const rows: TestRow[] = [
    { id: 1, key: 'cole palmer', leagueId: 7 },
    { id: 2, key: 'lamine yamal', leagueId: 9 },
  ]

  it('returns everything on a blank query and no league', () => {
    expect(filterRows(rows, '', null)).toHaveLength(2)
  })

  it('narrows to one league', () => {
    expect(filterRows(rows, '', 7).map((r) => r.id)).toEqual([1])
  })

  it('applies the search and the league together', () => {
    expect(filterRows(rows, 'yamal', 7)).toEqual([])
    expect(filterRows(rows, 'yamal', 9).map((r) => r.id)).toEqual([2])
  })

  it('keeps the row type it was handed, so a caller loses nothing to the filter', () => {
    const [only] = filterRows(rows, 'palmer', null)
    expect(only.id).toBe(1)
  })
})
