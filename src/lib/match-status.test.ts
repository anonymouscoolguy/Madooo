/**
 * The read side of the status vocabulary.
 *
 * A file of its own rather than more of `hydration.test.ts`, whose suite is the
 * scheduled run's *selection policy*. What is asserted here is the relationship
 * between two of the groups, and the words a screen draws — neither of which is
 * a question about what to fetch.
 *
 * **Nothing here reads `scratch/`, and it is not the usual exemption.** The
 * captured fixture lists contain only `FT` and `NS`, as `hydration.test.ts` says
 * at length: a season is either finished or unplayed, and every interesting
 * status exists for a few hours on one afternoon. So no payload can supply a
 * `PST`, and the statuses under test come from the provider's own documentation.
 * The claims below are consequently about *our* two groups agreeing with each
 * other, which is a fact about this file and provable without a fixture.
 */

import { describe, expect, it } from 'vitest'

import { ABANDONED_STATUSES, CALLED_OFF_STATUSES, calledOffLabel } from './match-status'

describe('CALLED_OFF_STATUSES', () => {
  it('stays inside the group the sync excludes from both queues', () => {
    // The load-bearing assertion of this file. `CALLED_OFF_STATUSES` is a view
    // over `ABANDONED_STATUSES` for the pages' benefit, and a status added to it
    // that was not already in that group would be one the sync happily queues —
    // asking a provider for the team sheet of a match that was called off, twice
    // a day for a fortnight.
    for (const status of CALLED_OFF_STATUSES) {
      expect(ABANDONED_STATUSES, status).toContain(status)
    }
  })

  it('is a strict subset — the other three do not render like a postponement', () => {
    // `AWD` and `WO` carry a real score and `ABD` a partial one, so widening this
    // group to the whole of the abandoned one would put a badge where a result
    // belongs. If that is ever wanted it is a decision, not a tidy-up.
    expect(CALLED_OFF_STATUSES.length).toBeLessThan(ABANDONED_STATUSES.length)
  })
})

describe('calledOffLabel', () => {
  it('has a word for every status in the group', () => {
    // The `Record` over the union makes a missing word a compile error, so this
    // guards the runtime half: that the lookup actually reaches the table.
    for (const status of CALLED_OFF_STATUSES) {
      expect(calledOffLabel(status), status).not.toBeNull()
    }
  })

  it('draws the words the design asks for', () => {
    // Pinned literally, because these two strings are what a reader sees and the
    // type system has no opinion about their content.
    expect(calledOffLabel('PST')).toBe('Postponed')
    expect(calledOffLabel('CANC')).toBe('Cancelled')
  })

  it('says nothing about a match that will be played', () => {
    for (const status of ['FT', 'NS', 'TBD', '1H', 'HT', 'LIVE']) {
      expect(calledOffLabel(status), status).toBeNull()
    }
  })

  it('says nothing about the abandoned statuses it deliberately excludes', () => {
    for (const status of ['ABD', 'AWD', 'WO']) {
      expect(calledOffLabel(status), status).toBeNull()
    }
  })

  it('says nothing about a status it has never seen', () => {
    expect(calledOffLabel('XYZ')).toBeNull()
  })
})
