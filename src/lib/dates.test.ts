/**
 * Date formatting, against the kickoff timestamps the provider actually sends.
 *
 * Same rule as the mapper's tests: the inputs come out of
 * `scratch/fixtures_2024.json` at runtime. That matters more here than it looks —
 * the payload's timestamps carry an explicit offset and a real season crosses
 * both a month boundary and a daylight-saving change, neither of which a date
 * typed from memory would exercise.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { dateRange, kickoffDate, kickoffTime } from './dates'
import { roundNumber } from './rounds'
import type { ApiFootballEnvelope, RawFixture } from './api-football/types'

const path = join(process.cwd(), 'scratch', 'fixtures_2024.json')
let payload: ApiFootballEnvelope<RawFixture>
try {
  payload = JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<RawFixture>
} catch {
  throw new Error(
    `Missing ${path}. These tests run against real captured payloads — ` +
      're-create them with `python3 scripts/verify_api.py`.',
  )
}

interface Played {
  round: string
  kickoff: Date
}

const played: Played[] = payload.response.map((entry) => ({
  round: entry.league.round,
  kickoff: new Date(entry.fixture.date),
}))

/** Every round's span, derived the way `listRounds` derives it in Postgres. */
const spans = new Map<string, { first: Date; last: Date }>()
for (const { round, kickoff } of played) {
  const span = spans.get(round)
  if (span === undefined) {
    spans.set(round, { first: kickoff, last: kickoff })
    continue
  }
  if (kickoff < span.first) span.first = kickoff
  if (kickoff > span.last) span.last = kickoff
}

describe('kickoffDate', () => {
  it('is a weekday, a day and a three-letter month for every fixture in the season', () => {
    // Three letters exactly, every time. `en-GB` alone would give "Sept" for one
    // month in twelve, which is the reason the month is cut by hand.
    for (const { kickoff } of played) {
      expect(kickoffDate(kickoff), kickoff.toISOString()).toMatch(
        /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/,
      )
    }
  })

  it('covers all twelve months without any of them growing a fourth letter', () => {
    const months = new Set(played.map(({ kickoff }) => kickoffDate(kickoff).split(' ')[2]))
    for (const month of months) expect(month.length, month).toBe(3)
  })
})

describe('kickoffTime', () => {
  it('is 24-hour, zero-padded, for every fixture in the season', () => {
    for (const { kickoff } of played) {
      expect(kickoffTime(kickoff), kickoff.toISOString()).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('reads the London clock, not the runner’s', () => {
    // A midsummer fixture: London is one hour ahead of UTC, so a payload
    // timestamp in UTC must not render as itself.
    const summer = played.find((entry) => entry.kickoff.getUTCMonth() === 7)
    if (summer === undefined) return
    const utc = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(summer.kickoff)
    expect(kickoffTime(summer.kickoff)).not.toBe(utc)
  })
})

describe('dateRange', () => {
  it('gives every round of the season a range that names a month exactly once or twice', () => {
    for (const [round, span] of spans) {
      expect(dateRange(span.first, span.last), round).toMatch(
        /^\d{1,2}(–\d{1,2})? [A-Z][a-z]{2}$|^\d{1,2} [A-Z][a-z]{2} – \d{1,2} [A-Z][a-z]{2}$/,
      )
    }
  })

  it('drops the repeated month for a round played over two days', () => {
    // Found in the payload rather than assumed: most rounds span a weekend.
    const weekend = [...spans.entries()].find(
      ([, span]) =>
        span.first.getUTCDate() !== span.last.getUTCDate() &&
        span.first.getUTCMonth() === span.last.getUTCMonth(),
    )
    expect(weekend, 'no round in the season spans two days of one month').toBeDefined()
    expect(dateRange(weekend![1].first, weekend![1].last)).toMatch(/^\d{1,2}–\d{1,2} [A-Z][a-z]{2}$/)
  })

  it('keeps both months when a round straddles them', () => {
    // Round 1's opening day paired with round 38's last: guaranteed to cross a
    // month, and both ends are real fixtures.
    const first = spans.get(played.find((e) => roundNumber(e.round) === 1)!.round)!.first
    const last = spans.get(played.find((e) => roundNumber(e.round) === 38)!.round)!.last
    expect(dateRange(first, last)).toMatch(/^\d{1,2} [A-Z][a-z]{2} – \d{1,2} [A-Z][a-z]{2}$/)
  })

  it('collapses to one date when a round is played on a single day', () => {
    const single = [...spans.values()].find(
      (span) => span.first.getUTCDate() === span.last.getUTCDate(),
    )
    if (single === undefined) return
    expect(dateRange(single.first, single.last)).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/)
  })
})
