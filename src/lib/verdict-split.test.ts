/**
 * The split bar's arithmetic. Nothing here comes from a captured payload,
 * because none of it is API-Football's — these are our own tallies, and what is
 * worth asserting is that the four segments always describe the same season.
 */

import { describe, expect, it } from 'vitest'

import { verdictSplit } from './verdict-split'

const total = (counts: { watched: number; mvps: number; standouts: number; flops: number }) =>
  verdictSplit(counts).reduce((sum, segment) => sum + segment.count, 0)

describe('verdictSplit', () => {
  it('divides the watched matches into four', () => {
    const split = verdictSplit({ watched: 14, mvps: 6, standouts: 4, flops: 1 })

    expect(split.map((segment) => [segment.key, segment.count])).toEqual([
      ['mvps', 6],
      ['standouts', 4],
      ['flops', 1],
      ['unrated', 3],
    ])
  })

  it('always accounts for every match watched', () => {
    // The property that makes the bar honest: it fills its track exactly.
    for (const counts of [
      { watched: 14, mvps: 6, standouts: 4, flops: 1 },
      { watched: 1, mvps: 1, standouts: 0, flops: 0 },
      { watched: 38, mvps: 0, standouts: 0, flops: 0 },
      { watched: 9, mvps: 3, standouts: 3, flops: 3 },
    ]) {
      expect(total(counts), JSON.stringify(counts)).toBe(counts.watched)
    }
  })

  it('turns the counts into percentages of the whole', () => {
    const split = verdictSplit({ watched: 10, mvps: 5, standouts: 2, flops: 1 })

    expect(split.map((segment) => segment.percent)).toEqual([50, 20, 10, 20])
    expect(split.reduce((sum, segment) => sum + segment.percent, 0)).toBeCloseTo(100)
  })

  it('gives four zeroes rather than a NaN when nothing was watched', () => {
    // `width: NaN%` is dropped silently by every browser, so a bar built from a
    // division by zero would go missing rather than fail loudly.
    const split = verdictSplit({ watched: 0, mvps: 0, standouts: 0, flops: 0 })

    for (const segment of split) {
      expect(segment.count, segment.key).toBe(0)
      expect(segment.percent, segment.key).toBe(0)
    }
  })

  it('never reports a negative remainder', () => {
    // Unreachable through the schema — one judgement per player per match means
    // tagged can never exceed watched — but the four counts come from four
    // separate queries, and a segment of -2 would overrun the track.
    const split = verdictSplit({ watched: 2, mvps: 3, standouts: 1, flops: 0 })

    expect(split.at(-1)?.count).toBe(0)
    expect(split.at(-1)?.percent).toBe(0)
  })

  it('labels the segments in the verdict vocabulary', () => {
    // The three words foundations allows in caps, plus the fourth state that
    // exists only here — a match watched and left unjudged.
    expect(verdictSplit({ watched: 0, mvps: 0, standouts: 0, flops: 0 }).map((s) => s.label)).toEqual(
      ['MVP', 'STANDOUT', 'FLOP', 'UNRATED'],
    )
  })
})
