/**
 * The player profile's tab table, asserted the same way the diary's filter table
 * is: a slug is our own vocabulary, not API-Football's, so nothing here comes
 * from a captured payload. What matters is that an untrusted URL parameter
 * always lands on a real view.
 */

import { describe, expect, it } from 'vitest'

import { PLAYER_VIEWS, parseView } from './player-views'

describe('PLAYER_VIEWS', () => {
  it('opens on the diary', () => {
    // `parseView` falls back to index 0, so the order is load-bearing.
    expect(PLAYER_VIEWS[0].slug).toBe('diary')
    expect(PLAYER_VIEWS[0].where).toEqual({})
  })

  it('gives every view a distinct slug', () => {
    const slugs = PLAYER_VIEWS.map((view) => view.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every view something to say when it holds nothing', () => {
    for (const view of PLAYER_VIEWS) expect(view.empty.length, view.slug).toBeGreaterThan(0)
  })

  it('asks for a missing note by null alone', () => {
    // The same reading `DIARY_FILTERS` takes: a cleared note is never stored as
    // an empty string, so `{ not: null }` is the whole of the test.
    const notes = PLAYER_VIEWS.find((view) => view.slug === 'notes')
    expect(notes?.where).toEqual({ note: { not: null } })
  })
})

describe('parseView', () => {
  it('finds each view by its slug', () => {
    for (const view of PLAYER_VIEWS) expect(parseView(view.slug)).toBe(view)
  })

  it('falls back to the diary for anything unrecognised', () => {
    for (const value of [undefined, '', 'note', 'Notes', 'nonsense', null, 0])
      expect(parseView(value).slug).toBe('diary')
  })

  it('takes the first of a repeated parameter', () => {
    expect(parseView(['notes', 'diary']).slug).toBe('notes')
  })
})
