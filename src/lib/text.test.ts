/**
 * Wording that depends on a number. Our own text, so there is no captured
 * payload to be ground truth for it — the rule binding `map.test.ts` is about
 * API-Football's JSON, where recollection is the unreliable part.
 */

import { describe, expect, it } from 'vitest'

import { plural, scoreline } from './text'

describe('plural', () => {
  it('leaves the noun alone for exactly one', () => {
    expect(plural(1, 'verdict')).toBe('verdict')
    expect(plural(1, 'note')).toBe('note')
  })

  it('pluralises zero, which is the case the reference screenshot draws most', () => {
    expect(plural(0, 'note')).toBe('notes')
  })

  it('pluralises everything above one', () => {
    expect(plural(2, 'verdict')).toBe('verdicts')
    expect(plural(31, 'standout')).toBe('standouts')
  })
})

describe('scoreline', () => {
  const teams = { homeTeam: { name: 'Chelsea' }, awayTeam: { name: 'Arsenal' } }

  it('names both clubs around the score', () => {
    expect(scoreline({ ...teams, homeGoals: 1, awayGoals: 1 })).toBe('Chelsea 1–1 Arsenal')
  })

  it('reads a real goalless draw as a score, not as a missing one', () => {
    expect(scoreline({ ...teams, homeGoals: 0, awayGoals: 0 })).toBe('Chelsea 0–0 Arsenal')
  })

  it('says "v" when there is no result recorded', () => {
    // A fixture exists from the moment it is scheduled, so this is most of a
    // season for most of a season — and it is the case a `??  0` would get wrong.
    expect(scoreline({ ...teams, homeGoals: null, awayGoals: null })).toBe('Chelsea v Arsenal')
  })

  it('treats half a result as no result', () => {
    expect(scoreline({ ...teams, homeGoals: 2, awayGoals: null })).toBe('Chelsea v Arsenal')
    expect(scoreline({ ...teams, homeGoals: null, awayGoals: 2 })).toBe('Chelsea v Arsenal')
  })
})
