/**
 * The scheduled run's selection policy.
 *
 * The status vocabulary is asserted against the real captured fixture lists,
 * for the reason `map.test.ts` and `squad.test.ts` state: if the same
 * understanding writes both the code and its fixture they agree with each other
 * and are both wrong. What the payloads can prove is narrow — a season is
 * either finished or unplayed, so they contain only `FT` and `NS` — and that is
 * exactly why the boundary cases below are asserted against constructed rows
 * instead. The claim under test there is our own arithmetic, not the provider's
 * shape.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ABANDONED_STATUSES,
  clampToQuota,
  FINISHED_STATUSES,
  isDue,
  isKnownStatus,
  PENDING_STATUSES,
  selectDue,
  SETTLE_HOURS,
  WINDOW_DAYS,
  windowStart,
} from './hydration'
import type { ApiFootballEnvelope, RawFixture } from './api-football/types'

const SCRATCH = join(process.cwd(), 'scratch')

function load(name: string): ApiFootballEnvelope<RawFixture> {
  const path = join(SCRATCH, name)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<RawFixture>
  } catch {
    throw new Error(
      `Missing ${path}. These tests run against real captured payloads — ` +
        're-create them with `python3 scripts/verify_api.py`.',
    )
  }
}

/** Every season captured so far: two closed, three unplayed, one in progress. */
const CAPTURED = [
  'fixtures_39_2024.json',
  'fixtures_39_2025.json',
  'fixtures_39_2026.json',
  'fixtures_94_2026.json',
  'fixtures_140_2025.json',
  'fixtures_140_2026.json',
]

const capturedStatuses = [
  ...new Set(
    CAPTURED.flatMap((name) =>
      load(name).response.map((fixture) => fixture.fixture.status.short),
    ),
  ),
]

const HOUR_MS = 60 * 60 * 1000
const NOW = new Date('2026-08-15T18:00:00Z')

/** A finished fixture that kicked off `hoursAgo` before NOW. */
function played(hoursAgo: number, hydratedAt: Date | null = null) {
  return {
    kickoff: new Date(NOW.getTime() - hoursAgo * HOUR_MS),
    status: 'FT',
    hydratedAt,
  }
}

describe('the status vocabulary', () => {
  it('classifies every status the provider actually sends', () => {
    // The claim under test: nothing arrives that all three lists have missed.
    // A fifth group appearing in a future capture fails here rather than being
    // silently skipped by a scheduled run nobody is watching.
    expect(capturedStatuses.length).toBeGreaterThan(0)
    for (const status of capturedStatuses) {
      expect(isKnownStatus(status), `status ${status}`).toBe(true)
    }
  })

  it('has no status in two groups at once', () => {
    const all = [...FINISHED_STATUSES, ...ABANDONED_STATUSES, ...PENDING_STATUSES]
    expect(new Set(all).size).toBe(all.length)
  })

  it('does not claim to know a status it has never seen', () => {
    expect(isKnownStatus('XYZ')).toBe(false)
  })
})

describe('isDue', () => {
  it('wants a finished match nobody has read', () => {
    expect(isDue(played(3), NOW)).toBe(true)
  })

  it('leaves an unplayed match alone', () => {
    // The captured 2026 lists are entirely NS, which is the state every fixture
    // is in for most of its life. A run that hydrated these would spend two
    // requests each on 380 matches with no team sheet.
    expect(isDue({ ...played(3), status: 'NS' }, NOW)).toBe(false)
  })

  it('never returns to a match that will not be played', () => {
    for (const status of ABANDONED_STATUSES) {
      expect(isDue({ ...played(3), status }, NOW), status).toBe(false)
    }
  })

  it('reads a match again when the first read was too early to be final', () => {
    const match = played(1)
    expect(isDue({ ...match, hydratedAt: NOW }, NOW)).toBe(true)
  })

  it('stops once a read has settled', () => {
    const kickoff = new Date(NOW.getTime() - 10 * HOUR_MS)
    const settled = new Date(kickoff.getTime() + SETTLE_HOURS * HOUR_MS)

    expect(isDue({ kickoff, status: 'FT', hydratedAt: settled }, NOW)).toBe(false)
    // One millisecond earlier is still provisional. The boundary is asserted in
    // both directions because an off-by-one here either re-reads every match
    // forever or never confirms one.
    expect(
      isDue({ kickoff, status: 'FT', hydratedAt: new Date(settled.getTime() - 1) }, NOW),
    ).toBe(true)
  })

  it('gives up on a match older than the window', () => {
    const outside = (WINDOW_DAYS * 24 + 1) * HOUR_MS
    expect(isDue({ ...played(0), kickoff: new Date(NOW.getTime() - outside) }, NOW)).toBe(
      false,
    )
    expect(windowStart(NOW).getTime()).toBe(NOW.getTime() - WINDOW_DAYS * 24 * HOUR_MS)
  })
})

describe('selectDue', () => {
  it('puts a match nobody has read ahead of a confirming re-read', () => {
    // The re-read kicked off first, so kickoff order alone would starve the
    // unread match. A hole in a diary outranks a rating that may be revised.
    const reread = played(30, new Date(NOW.getTime() - 29 * HOUR_MS))
    const unread = played(2)

    expect(selectDue([reread, unread], NOW)).toEqual([unread, reread])
  })

  it('takes the oldest first within a tier', () => {
    const older = played(5)
    const newer = played(2)
    expect(selectDue([newer, older], NOW)).toEqual([older, newer])
  })

  it('carries whatever else the caller attached to the row', () => {
    // sync.ts hangs the league and a printable label off these, so a failure
    // names the competition rather than an id.
    const row = { ...played(2), label: 'Porto vs Benfica' }
    expect(selectDue([row], NOW)[0].label).toBe('Porto vs Benfica')
  })

  it('leaves out everything that is not due', () => {
    expect(selectDue([{ ...played(2), status: 'NS' }], NOW)).toEqual([])
  })
})

describe('clampToQuota', () => {
  it('leaves a comfortable run alone', () => {
    expect(clampToQuota(10, 7500)).toBe(10)
  })

  it('spends at most half of what is left', () => {
    // 40 remaining, two requests each, half the remainder — ten fixtures.
    expect(clampToQuota(30, 40)).toBe(10)
  })

  it('returns nothing rather than a negative count', () => {
    expect(clampToQuota(10, 0)).toBe(0)
  })

  it('does not clamp when the header was unreadable', () => {
    // A missing header is not evidence of a tight plan. The client already
    // paces itself slowly in that case, which is where the caution belongs.
    expect(clampToQuota(10, null)).toBe(10)
  })
})
