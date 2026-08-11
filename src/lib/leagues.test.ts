/**
 * The URL's league vocabulary, against the names the provider actually sends.
 *
 * Same rule as `rounds.test.ts`: the league names are read out of the captured
 * payloads at runtime rather than transcribed. "Primeira Liga" is a fact about
 * API-Football — the competition is commonly called Liga Portugal, and a test
 * asserting against the name a person would say would prove only that the slug
 * matches the same memory that wrote it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { leagueSlug, parseLeagueScope } from './leagues'
import type { ApiFootballEnvelope, RawFixture } from './api-football/types'

/** The league named by a captured season, as the provider spells it. */
function leagueName(file: string): string {
  const path = join(process.cwd(), 'scratch', file)
  let payload: ApiFootballEnvelope<RawFixture>
  try {
    payload = JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<RawFixture>
  } catch {
    throw new Error(
      `Missing ${path}. These tests run against real captured payloads — ` +
        're-create them with `python3 scripts/verify_api.py`.',
    )
  }
  return payload.response[0].league.name
}

const PREMIER_LEAGUE = leagueName('fixtures_39_2024.json')
const PRIMEIRA_LIGA = leagueName('fixtures_94_2026.json')

/** What the database hands the parser: our own ids, the provider's names. */
const LEAGUES = [
  { id: 1, name: PREMIER_LEAGUE },
  { id: 2, name: PRIMEIRA_LIGA },
]

describe('leagueSlug', () => {
  it('is typeable, for every league the app actually holds', () => {
    for (const name of [PREMIER_LEAGUE, PRIMEIRA_LIGA]) {
      expect(leagueSlug(name), name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('tells the two leagues apart', () => {
    expect(leagueSlug(PREMIER_LEAGUE)).not.toBe(leagueSlug(PRIMEIRA_LIGA))
  })

  it('strips the diacritics a UK keyboard cannot produce', () => {
    // La Liga's own name, which the app will meet the day a third league lands.
    expect(leagueSlug('Primera División')).toBe('primera-division')
  })

  it('leaves no leading, trailing or doubled hyphen', () => {
    expect(leagueSlug('  Serie A!  ')).toBe('serie-a')
  })
})

describe('parseLeagueScope', () => {
  it('finds the league a slug names', () => {
    const slug = leagueSlug(PRIMEIRA_LIGA)
    expect(parseLeagueScope(slug, LEAGUES)?.name).toBe(PRIMEIRA_LIGA)
  })

  it('falls back to the first league when the URL says nothing', () => {
    expect(parseLeagueScope(undefined, LEAGUES)?.name).toBe(PREMIER_LEAGUE)
  })

  it('falls back rather than scoping the page to nothing', () => {
    // A league that was synced once and has no matches this season, or simply a
    // mistyped address. Either way the page should draw football.
    expect(parseLeagueScope('serie-a', LEAGUES)?.name).toBe(PREMIER_LEAGUE)
  })

  it('takes the first of a repeated parameter', () => {
    const slug = leagueSlug(PRIMEIRA_LIGA)
    expect(parseLeagueScope([slug, 'serie-a'], LEAGUES)?.name).toBe(PRIMEIRA_LIGA)
  })

  it('is null only when there are no leagues at all', () => {
    expect(parseLeagueScope('premier-league', [])).toBeNull()
  })
})
