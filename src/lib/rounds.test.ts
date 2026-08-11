/**
 * Round parsing, against the round labels the provider actually sends.
 *
 * Same rule as `api-football/map.test.ts`: the strings under test are read out
 * of `scratch/fixtures_39_2024.json` at runtime rather than transcribed here. The
 * exact shape of `league.round` is a fact about API-Football, and a test that
 * asserted against a remembered `"Regular Season - 1"` would prove only that the
 * parser matches the same memory that wrote it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { compareRounds, roundDisplay, roundLabel, roundNumber } from './rounds'
import type { ApiFootballEnvelope, RawFixture } from './api-football/types'

const path = join(process.cwd(), 'scratch', 'fixtures_39_2024.json')
let payload: ApiFootballEnvelope<RawFixture>
try {
  payload = JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<RawFixture>
} catch {
  throw new Error(
    `Missing ${path}. These tests run against real captured payloads — ` +
      're-create them with `python3 scripts/verify_api.py`.',
  )
}

/** Every distinct round label in the season, in the order the payload lists them. */
const rounds = [...new Set(payload.response.map((entry) => entry.league.round))]

describe('roundNumber', () => {
  it('reads a number out of every round the season actually contains', () => {
    for (const round of rounds) {
      expect(roundNumber(round), round).not.toBeNull()
    }
  })

  it('recovers the full 1..N run, with nothing missing or duplicated', () => {
    const numbers = rounds.map(roundNumber).sort((a, b) => a! - b!)
    expect(numbers).toEqual(Array.from({ length: rounds.length }, (_, i) => i + 1))
  })

  it('is null for a round carrying no number', () => {
    expect(roundNumber('Final')).toBeNull()
  })
})

describe('roundLabel', () => {
  it('turns a bare number into a label the payload would match', () => {
    // Round 1's label, taken from the payload rather than written out: this is
    // the string `--round 1` on the command line has to reproduce exactly.
    const first = rounds.find((round) => roundNumber(round) === 1)
    expect(roundLabel('1')).toBe(first)
  })

  it('leaves an already-formed label alone', () => {
    expect(roundLabel(rounds[0])).toBe(rounds[0])
  })
})

describe('roundDisplay', () => {
  it('names the matchday', () => {
    const sixth = rounds.find((round) => roundNumber(round) === 6)!
    expect(roundDisplay(sixth)).toBe('Matchday 6')
  })

  it('falls back to the raw label when there is no number to show', () => {
    expect(roundDisplay('Final')).toBe('Final')
  })
})

describe('compareRounds', () => {
  it('orders the season the way it is played', () => {
    const shuffled = [...rounds].sort(() => Math.random() - 0.5)
    expect(shuffled.sort(compareRounds).map(roundNumber)).toEqual(
      rounds.map(roundNumber).sort((a, b) => a! - b!),
    )
  })

  it('sorts an unnumbered round last rather than dropping it', () => {
    expect(['Final', rounds[0]].sort(compareRounds)).toEqual([rounds[0], 'Final'])
  })
})
