/**
 * Wording that depends on a number. Our own text, so there is no captured
 * payload to be ground truth for it — the rule binding `map.test.ts` is about
 * API-Football's JSON, where recollection is the unreliable part.
 */

import { describe, expect, it } from 'vitest'

import { plural } from './text'

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
