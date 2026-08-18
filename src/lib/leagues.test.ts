/**
 * The URL's league vocabulary, against the names the provider actually sends.
 *
 * Same rule as `rounds.test.ts`: the league names are read out of the captured
 * payloads at runtime rather than transcribed. "Primeira Liga" is a fact about
 * API-Football — the competition is commonly called Liga Portugal, and a test
 * asserting against the name a person would say would prove only that the slug
 * matches the same memory that wrote it. League 140 is the same trap facing the
 * other way: the provider says "La Liga" where the competition's own name is
 * Primera División, so writing down either from memory is a coin toss.
 *
 * League 135 is a third face of it. "Serie A" is what a person would say and
 * what the provider sends, so it looks like the one name safe to transcribe —
 * but it is not unique in the provider's own catalogue, where id 71 is Brazil's
 * Serie A. Reading it out of the payload is what keeps this suite honest about
 * which competition it is describing.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { flagClass, isLeagueSlug, leagueSlug, parseLeagueScope } from './leagues'
import type { ApiFootballEnvelope, RawFixture } from './api-football/types'

/** The league a captured season is played in, as the provider describes it. */
function rawLeague(file: string): RawFixture['league'] {
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
  return payload.response[0].league
}

function leagueName(file: string): string {
  return rawLeague(file).name
}

const PREMIER_LEAGUE = leagueName('fixtures_39_2024.json')
const PRIMEIRA_LIGA = leagueName('fixtures_94_2026.json')
const LA_LIGA = leagueName('fixtures_140_2026.json')
const SERIE_A = leagueName('fixtures_135_2026.json')

const ALL = [PREMIER_LEAGUE, PRIMEIRA_LIGA, LA_LIGA, SERIE_A]

/** What the database hands the parser: our own ids, the provider's names. */
const LEAGUES = [
  { id: 1, name: PREMIER_LEAGUE },
  { id: 2, name: PRIMEIRA_LIGA },
  { id: 3, name: LA_LIGA },
  { id: 4, name: SERIE_A },
]

describe('leagueSlug', () => {
  it('is typeable, for every league the app actually holds', () => {
    for (const name of ALL) {
      expect(leagueSlug(name), name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('tells every league apart', () => {
    expect(new Set(ALL.map(leagueSlug)).size).toBe(ALL.length)
  })

  it('strips the diacritics a UK keyboard cannot produce', () => {
    // Not any league the app holds: the provider calls 140 "La Liga", so this
    // is the normaliser tested on a synthetic input. It is kept because the
    // accent is the interesting case and no synced league currently has one.
    expect(leagueSlug('Primera División')).toBe('primera-division')
  })

  it('leaves no leading, trailing or doubled hyphen', () => {
    // Written when Serie A was not a league the app held, as a synthetic input
    // chosen for its punctuation. It keeps its place now that 135 is one: the
    // assertion is about the trimming, and it happens to pin the real slug as
    // well.
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
    expect(parseLeagueScope('bundesliga', LEAGUES)?.name).toBe(PREMIER_LEAGUE)
  })

  it('takes the first of a repeated parameter', () => {
    const slug = leagueSlug(PRIMEIRA_LIGA)
    expect(parseLeagueScope([slug, 'bundesliga'], LEAGUES)?.name).toBe(PRIMEIRA_LIGA)
  })

  it('is null only when there are no leagues at all', () => {
    expect(parseLeagueScope('premier-league', [])).toBeNull()
  })

  it('opens on the remembered league when the URL says nothing', () => {
    const slug = leagueSlug(PRIMEIRA_LIGA)
    expect(parseLeagueScope(undefined, LEAGUES, slug)?.name).toBe(PRIMEIRA_LIGA)
  })

  it('lets the URL beat the cookie', () => {
    // A link someone was sent, or a bookmark, against a habit. The address bar
    // is the one that says what this page is.
    expect(parseLeagueScope(leagueSlug(LA_LIGA), LEAGUES, leagueSlug(PRIMEIRA_LIGA))?.name).toBe(
      LA_LIGA,
    )
  })

  it('distrusts a stored slug exactly as far as a typed one', () => {
    // A cookie outlives deploys, so it can name a league that has stopped
    // playing. It gets no more credit than the address bar does.
    expect(parseLeagueScope(undefined, LEAGUES, 'bundesliga')?.name).toBe(PREMIER_LEAGUE)
  })

  it('falls back past an unrecognised URL to the remembered league', () => {
    expect(parseLeagueScope('bundesliga', LEAGUES, leagueSlug(PRIMEIRA_LIGA))?.name).toBe(
      PRIMEIRA_LIGA,
    )
  })
})

describe('isLeagueSlug', () => {
  it('accepts every slug the app can produce', () => {
    for (const name of ALL) {
      expect(isLeagueSlug(leagueSlug(name)), name).toBe(true)
    }
  })

  it.each([
    ['', 'nothing at all'],
    ['Premier League', 'a name rather than a slug'],
    ['../../etc/passwd', 'a path'],
    ['premier league', 'a space'],
    ['x'.repeat(65), 'more than any competition is called'],
  ])('refuses %j — %s', (value) => {
    expect(isLeagueSlug(value)).toBe(false)
  })
})

describe('flagClass', () => {
  /*
    The countries out of the captured payloads for the same reason the names
    are: "England" is a fact about API-Football, not about football. The
    provider files the Premier League under a country no other data source
    would call a country at all, and a map written from memory would be a map
    of what someone assumed it says.
  */
  const COUNTRIES = [
    rawLeague('fixtures_39_2026.json').country,
    rawLeague('fixtures_94_2026.json').country,
    rawLeague('fixtures_140_2026.json').country,
    rawLeague('fixtures_135_2026.json').country,
  ]

  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

  /*
    The check that earns this suite its place. A country and its class name live
    in two files with nothing binding them, so `flagClass` returning `flag-pt`
    while globals.css says `.flag-prt` draws an empty 16x12 box: no console
    error, no failing build, nothing but a gap in a pill. It is precisely how a
    misspelled Material Symbols name fails, which architecture.md already
    records — this is that failure closed rather than documented.
  */
  it.each(COUNTRIES)('has a rule and a file for %s', (country) => {
    const flag = flagClass({ country })
    expect(flag, country).not.toBeNull()
    expect(css).toContain(`.${flag} {`)
    expect(existsSync(join(process.cwd(), 'public/flags', `${flag?.replace('flag-', '')}.svg`))).toBe(
      true,
    )
  })

  it('tells the four leagues apart', () => {
    expect(new Set(COUNTRIES.map((country) => flagClass({ country }))).size).toBe(COUNTRIES.length)
  })

  it('draws nothing for a country we have no file for', () => {
    // API-Football's country for the Champions League, so the fifth league is
    // as likely to hit this as to hit a flag.
    expect(flagClass({ country: 'World' })).toBeNull()
  })

  it('survives the provider recasing a country', () => {
    expect(flagClass({ country: 'ENGLAND' })).toBe(flagClass({ country: 'England' }))
  })
})
