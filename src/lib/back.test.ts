import { describe, expect, it } from 'vitest'
import { backLink, playerHref, teamHref, TEAMS } from './back'
import { DIARY_FILTERS } from './diary-filters'
import { PLAYER_VIEWS } from './player-views'

describe('backLink', () => {
  it('reads a match back', () => {
    expect(backLink('/matches/12')).toEqual({ href: '/matches/12', label: 'Back to the match' })
  })

  it('keeps the diary filter that was on when the profile was opened', () => {
    expect(backLink('/diary?filter=flop')).toEqual({
      href: '/diary?filter=flop',
      label: 'Back to Diary',
    })
  })

  it('drops the filter when it is the default, so the URL stays clean', () => {
    expect(backLink('/diary?filter=all').href).toBe('/diary')
    expect(backLink('/diary').href).toBe('/diary')
  })

  it('drops a filter slug nothing knows how to query', () => {
    expect(backLink('/diary?filter=nonsense').href).toBe('/diary')
  })

  it('accepts every slug the diary actually offers', () => {
    for (const filter of DIARY_FILTERS) {
      expect(backLink(`/diary?filter=${filter.slug}`).label).toBe('Back to Diary')
    }
  })

  it('reads a club back', () => {
    expect(backLink('/teams/4')).toEqual({ href: '/teams/4', label: 'Back to the club' })
  })

  it('keeps the tab a player profile was left on', () => {
    expect(backLink('/players/44?view=notes')).toEqual({
      href: '/players/44?view=notes',
      label: 'Back to the player',
    })
  })

  it('drops the view when it is the default, and when nothing knows it', () => {
    expect(backLink('/players/44?view=diary').href).toBe('/players/44')
    expect(backLink('/players/44?view=nonsense').href).toBe('/players/44')
    expect(backLink('/players/44').href).toBe('/players/44')
  })

  it('accepts every view a profile actually offers', () => {
    for (const view of PLAYER_VIEWS) {
      expect(backLink(`/players/44?view=${view.slug}`).label).toBe('Back to the player')
    }
  })

  it('keeps the matchday', () => {
    expect(backLink('/fixtures?matchday=6')).toEqual({
      href: '/fixtures?matchday=6',
      label: 'Back to fixtures',
    })
    expect(backLink('/fixtures?matchday=six').href).toBe('/fixtures')
    expect(backLink('/fixtures').href).toBe('/fixtures')
  })

  /**
   * The reason this module rebuilds rather than echoes. Each of these would be a
   * link to somewhere else rendered under our own chrome if the value survived.
   */
  it.each([
    'https://evil.com',
    'http://evil.com/matches/1',
    '//evil.com',
    '///evil.com',
    'javascript:alert(1)',
    '/matches/12@evil.com',
    '/../../etc/passwd',
    '/diary/../../evil',
  ])('refuses to carry %s anywhere', (hostile) => {
    expect(backLink(hostile)).toEqual({ href: '/players', label: 'Back to Players' })
  })

  it('never returns an href it was given', () => {
    // The property the guard rests on: every href out of this function is one of
    // a handful of strings this module built itself.
    const shapes = ['/players', '/teams', '/diary', '/fixtures', '/matches/', '/diary?filter=', '/fixtures?matchday=']
    for (const input of [
      'https://evil.com',
      '/matches/12',
      '/diary?filter=mvp',
      '/teams/4',
      '/players/44?view=notes',
      'nonsense',
      '',
    ]) {
      expect(shapes.some((shape) => backLink(input).href.startsWith(shape))).toBe(true)
    }
  })

  it('falls back for anything that is not a string, or is missing', () => {
    for (const value of [undefined, null, 0, '', [], {}, '/players', '/teams']) {
      expect(backLink(value).href).toBe('/players')
    }
  })

  /**
   * The fallback is the screen's, not the value's: a club reached by typing its
   * URL belongs back at Teams, and one reached from the diary still belongs at
   * the diary.
   */
  it('takes the fallback the caller supplies when it cannot tell', () => {
    expect(backLink(undefined, TEAMS)).toEqual({ href: '/teams', label: 'Back to Teams' })
    expect(backLink('https://evil.com', TEAMS).href).toBe('/teams')
    expect(backLink('/diary?filter=mvp', TEAMS).href).toBe('/diary?filter=mvp')
  })

  it('takes the first value when the parameter is repeated', () => {
    expect(backLink(['/matches/7', '/diary']).href).toBe('/matches/7')
  })

  it('does not match a path that merely starts with a known one', () => {
    expect(backLink('/matches/12/edit').href).toBe('/players')
    expect(backLink('/matchesX/12').href).toBe('/players')
    expect(backLink('/diaryX').href).toBe('/players')
  })
})

describe('playerHref', () => {
  it('encodes the origin, so a filter survives being a value inside a query string', () => {
    const href = playerHref(44, '/diary?filter=mvp')
    expect(href).toBe('/players/44?from=%2Fdiary%3Ffilter%3Dmvp')

    // The round trip is the point: what `playerHref` writes, `backLink` reads.
    const from = new URL(href, 'https://example.test').searchParams.get('from')
    expect(backLink(from).href).toBe('/diary?filter=mvp')
  })

  it('round-trips a match', () => {
    const href = playerHref(1, '/matches/12')
    const from = new URL(href, 'https://example.test').searchParams.get('from')
    expect(backLink(from).href).toBe('/matches/12')
  })
})

describe('teamHref', () => {
  it('round-trips a player profile, tab and all', () => {
    const href = teamHref(4, '/players/44?view=notes')
    expect(href).toBe('/teams/4?from=%2Fplayers%2F44%3Fview%3Dnotes')

    const from = new URL(href, 'https://example.test').searchParams.get('from')
    expect(backLink(from, TEAMS).href).toBe('/players/44?view=notes')
  })

  /** The loop the two profiles make: a club lists players, and a player names his club. */
  it('round-trips against playerHref', () => {
    const toPlayer = playerHref(44, '/teams/4')
    const backToClub = new URL(toPlayer, 'https://example.test').searchParams.get('from')
    expect(backLink(backToClub).href).toBe('/teams/4')
  })
})
