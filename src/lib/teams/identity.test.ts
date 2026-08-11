/**
 * Crest chips.
 *
 * The codes and colours themselves are ours, not the provider's, so there is no
 * payload to assert them against. What *is* ground truth is the set of team
 * names — read out of `scratch/fixtures_39_2024.json` — and those are what the
 * fallback has to survive.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { crest, crestInk, teamCode } from './identity'
import type { ApiFootballEnvelope, RawFixture } from '../api-football/types'

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

const teamNames = [
  ...new Set(
    payload.response.flatMap((entry) => [entry.teams.home.name, entry.teams.away.name]),
  ),
]

describe('teamCode', () => {
  it('prefers the seeded code', () => {
    expect(teamCode({ name: 'Manchester United', code: 'MUN', colour: null })).toBe('MUN')
  })

  it('gives three uppercase letters for every real club name, seeded or not', () => {
    for (const name of teamNames) {
      expect(teamCode({ name, code: null, colour: null }), name).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('collides on the real Manchester clubs, which is why codes are seeded', () => {
    // Both names taken from the payload: the collision is a fact about the data,
    // not about a name invented for this test.
    const manchester = teamNames.filter((name) => name.startsWith('Manchester'))
    expect(manchester.length).toBe(2)
    const [first, second] = manchester.map((name) =>
      teamCode({ name, code: null, colour: null }),
    )
    expect(first).toBe(second)
  })
})

describe('crestInk', () => {
  it('puts white on a dark club colour', () => {
    expect(crestInk('#0b1f4b')).toBe('var(--gray-0)')
  })

  it('puts black on a light one', () => {
    // Manchester City's sky blue. A naive channel average calls this dark and
    // prints unreadable white on it; the gamma-corrected luminance does not.
    expect(crestInk('#6cabdd')).toBe('var(--gray-9)')
  })

  it('accepts the short hex form', () => {
    expect(crestInk('#fff')).toBe('var(--gray-9)')
  })
})

describe('crest', () => {
  it('falls back to a neutral chip rather than inventing a colour', () => {
    expect(crest({ name: 'Ipswich', code: null, colour: null })).toEqual({
      label: 'IPS',
      background: 'var(--surface-sunken)',
      ink: 'var(--text-muted)',
    })
  })

  it('treats an unparseable colour as no colour at all', () => {
    expect(crest({ name: 'Ipswich', code: 'IPS', colour: 'blue' }).background).toBe(
      'var(--surface-sunken)',
    )
  })

  it('uses the club colour when there is one', () => {
    expect(crest({ name: 'Chelsea', code: 'CHE', colour: '#034694' })).toEqual({
      label: 'CHE',
      background: '#034694',
      ink: 'var(--gray-0)',
    })
  })
})
