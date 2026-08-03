/**
 * The diary's filter table.
 *
 * Nothing here comes from a captured payload, and it should not: a filter slug
 * is our own vocabulary, not API-Football's. What is asserted is the thing the
 * table is for — that an untrusted URL parameter always lands on a real filter.
 */

import { describe, expect, it } from 'vitest'

import { DIARY_FILTERS, parseFilter } from './diary-filters'

describe('DIARY_FILTERS', () => {
  it('opens on the unfiltered list', () => {
    // `parseFilter` falls back to index 0, so the order is load-bearing rather
    // than cosmetic.
    expect(DIARY_FILTERS[0].slug).toBe('all')
    expect(DIARY_FILTERS[0].where).toEqual({})
  })

  it('gives every filter a distinct slug', () => {
    const slugs = DIARY_FILTERS.map((filter) => filter.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every filter something to say when it matches nothing', () => {
    // Every slice owns its empty state, and a filter with no sentence would
    // render a blank page rather than an answer.
    for (const filter of DIARY_FILTERS) expect(filter.empty.length, filter.slug).toBeGreaterThan(0)
  })

  it('asks for a missing note by null alone', () => {
    // `setNote` stores a cleared note as no judgement or as a null column, never
    // as an empty string — so `{ not: null }` is the whole of the test, and an
    // extra `{ not: '' }` would be answering a case that cannot occur.
    const notes = DIARY_FILTERS.find((filter) => filter.slug === 'notes')
    expect(notes?.where).toEqual({ note: { not: null } })
  })
})

describe('parseFilter', () => {
  it('finds each filter by its slug', () => {
    for (const filter of DIARY_FILTERS) expect(parseFilter(filter.slug)).toBe(filter)
  })

  it('falls back to All for anything unrecognised', () => {
    // A mistyped query string should show the diary, not an error page.
    for (const value of [undefined, '', 'mvps', 'MVP', 'nonsense', null, 0])
      expect(parseFilter(value).slug).toBe('all')
  })

  it('takes the first of a repeated parameter', () => {
    // `/diary?filter=flop&filter=mvp` arrives as an array — Next hands
    // `searchParams` over as `string | string[] | undefined`.
    expect(parseFilter(['flop', 'mvp']).slug).toBe('flop')
  })

  it('falls back when a repeated parameter leads with rubbish', () => {
    expect(parseFilter(['nonsense', 'flop']).slug).toBe('all')
  })
})
