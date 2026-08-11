/**
 * The pacing derivation.
 *
 * Unlike `map.test.ts` this reads no payload, because the thing under test is a
 * *response header* rather than a response body and no captured file holds one.
 * The two anchoring cases are real plan ceilings, recorded in
 * `docs/api-football-findings.md`: 300 per minute on Pro, 10 on the free tier.
 *
 * It earns its place on the branches rather than the arithmetic. Every failure
 * mode here is silent — too fast risks the firewall block API-Football's terms
 * warn about, too slow turns a backfill into an afternoon, and a missing header
 * resolving to "no limit" would look fine right up until it did neither.
 */

import { describe, expect, it } from 'vitest'

import { intervalForLimit } from './client'

const FALLBACK_MS = 6_500

describe('intervalForLimit', () => {
  it("paces under Pro's 300 per minute", () => {
    const interval = intervalForLimit(300)
    // Comfortably inside the ceiling, not sitting on it.
    expect(60_000 / interval).toBeLessThan(300)
    expect(interval).toBeLessThan(FALLBACK_MS)
  })

  it("paces under the free tier's 10 per minute", () => {
    const interval = intervalForLimit(10)
    expect(60_000 / interval).toBeLessThan(10)
  })

  it('never derives a rate at or above the stated ceiling', () => {
    // Whole-number limits only: the interval ceiling deliberately overrides the
    // margin below 1 per minute, which no plan offers.
    for (const limit of [1, 10, 60, 100, 300, 900]) {
      expect(60_000 / intervalForLimit(limit)).toBeLessThan(limit)
    }
  })

  it('falls back to the slow rate when the header is absent or unusable', () => {
    // An unreadable limit is not evidence of a generous plan. `Number(null)` is
    // 0 and `Number('')` is 0, so the zero case is the one a real header hits.
    expect(intervalForLimit(null)).toBe(FALLBACK_MS)
    expect(intervalForLimit(0)).toBe(FALLBACK_MS)
    expect(intervalForLimit(-1)).toBe(FALLBACK_MS)
    expect(intervalForLimit(Number.NaN)).toBe(FALLBACK_MS)
    expect(intervalForLimit(Number.POSITIVE_INFINITY)).toBe(FALLBACK_MS)
  })

  it('bounds an absurd limit rather than trusting it', () => {
    // A huge ceiling must not become an unpaced flood, and a tiny one must not
    // stall a sync for the rest of the day.
    expect(intervalForLimit(1_000_000)).toBeGreaterThanOrEqual(100)
    expect(intervalForLimit(0.001)).toBeLessThanOrEqual(120_000)
  })
})
