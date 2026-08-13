/**
 * Where "Back" goes on a screen reached from more than one place.
 *
 * A player profile is opened from a squad list, from the "Your verdicts" panel
 * and from the diary, so no single parent is the right destination and the
 * design's own "← Back" names none. The origin therefore travels in the URL —
 * `/players/44?from=/diary?filter=mvp` — and this module turns it back into a
 * link. A server component cannot call `history.back()`, and putting the origin
 * in the URL keeps the page a server component, which is the same reason the
 * matchday and the diary's filter live there.
 *
 * **The href is rebuilt from parsed parts and the input is never echoed.** A
 * `?from` written straight into a `<Link>` is an open redirect: anyone can send
 * `?from=https://…` and have the app render a link to it under its own chrome.
 * Recognising a small set of our own shapes and reconstructing them means a
 * value that is not one of them cannot survive at all, which is a stronger
 * guarantee than a list of things to reject.
 *
 * Pure, so `back.test.ts` can assert that. `diary-filters.ts` and
 * `player-views.ts` import Prisma's *types* only and `import type` is erased at
 * compile time, so nothing here pulls the client into a test; `leagues.ts` is
 * pure for its own reasons.
 */

import { DIARY_FILTERS } from './diary-filters'
import { isLeagueSlug } from './leagues'
import { PLAYER_VIEWS } from './player-views'

export interface BackLink {
  href: string
  label: string
}

/**
 * Where a reader who typed a URL belongs, per screen. Which of the two applies
 * is the caller's, because it is a fact about the screen holding the link
 * rather than about the value being parsed: a club falling back to `/players`
 * would send the reader somewhere they had never been.
 */
export const PLAYERS: BackLink = { href: '/players', label: 'Back to Players' }
export const TEAMS: BackLink = { href: '/teams', label: 'Back to Teams' }

/** `/matches/12`, and nothing that merely starts that way. */
const MATCH = /^\/matches\/(\d+)$/

/** The two profiles, which are origins for each other: a club lists players, a player names his club. */
const PLAYER = /^\/players\/(\d+)$/
const TEAM = /^\/teams\/(\d+)$/

/** `\d` is ASCII-only in JavaScript, so this cannot be fed Eastern Arabic digits. */
const MATCHDAY = /^\d+$/

/**
 * Where the reader came from, or `fallback` if we cannot tell.
 *
 * `unknown` rather than `string` because this is handed the raw value out of
 * `searchParams`, which is `string | string[] | undefined` and an array whenever
 * the parameter is repeated — the same signature `parseFilter` takes.
 */
export function backLink(from: unknown, fallback: BackLink = PLAYERS): BackLink {
  const value = Array.isArray(from) ? from[0] : from
  if (typeof value !== 'string') return fallback

  // Split once, on the first `?`. A second one is part of the query string as
  // far as we are concerned, and every branch below rebuilds its own anyway.
  const mark = value.indexOf('?')
  const path = mark === -1 ? value : value.slice(0, mark)
  const query = mark === -1 ? '' : value.slice(mark + 1)

  // An absolute URL, a protocol-relative `//evil.com` and a bare word all fail
  // every pattern below and fall through to `/players`. That is the whole of the
  // open-redirect guard, and it holds because nothing here returns `value`.
  const match = MATCH.exec(path)
  if (match !== null) return { href: `/matches/${match[1]}`, label: 'Back to the match' }

  const team = TEAM.exec(path)
  if (team !== null) return { href: `/teams/${team[1]}`, label: 'Back to the club' }

  const player = PLAYER.exec(path)
  if (player !== null) {
    // The tab he was reading travels with him, the way the diary's filter does.
    // One list of slugs, in `player-views.ts`; an unknown one drops to the
    // default view rather than being carried through.
    const view = new URLSearchParams(query).get('view')
    const known = PLAYER_VIEWS.find((candidate) => candidate.slug === view)
    return {
      href:
        known === undefined || known === PLAYER_VIEWS[0]
          ? `/players/${player[1]}`
          : `/players/${player[1]}?view=${known.slug}`,
      label: 'Back to the player',
    }
  }

  if (path === '/diary') {
    // One list of slugs, in `diary-filters.ts`. An unknown one drops to the
    // unfiltered diary rather than being carried through.
    const filter = new URLSearchParams(query).get('filter')
    const known = DIARY_FILTERS.find((candidate) => candidate.slug === filter)
    return {
      href: known === undefined || known === DIARY_FILTERS[0] ? '/diary' : `/diary?filter=${known.slug}`,
      label: 'Back to Diary',
    }
  }

  if (path === '/fixtures') {
    // Both halves of the address, kept or dropped independently: a matchday
    // without its league is a different weekend in the other competition, and a
    // league without a matchday still lands in the right place because
    // `defaultRound` chooses one.
    const params = new URLSearchParams(query)
    const matchday = params.get('matchday')
    const league = params.get('league')

    // `isLeagueSlug` checks the slug's shape and nothing more — this module is
    // pure and cannot ask whether the league exists, which is decided on arrival
    // by `parseLeagueScope`. Bounded rather than open-ended, and rebuilt rather
    // than echoed, which is what keeps the open-redirect guarantee above intact.
    const parts: string[] = []
    if (league !== null && isLeagueSlug(league)) parts.push(`league=${league}`)
    if (matchday !== null && MATCHDAY.test(matchday)) parts.push(`matchday=${matchday}`)

    return {
      href: parts.length === 0 ? '/fixtures' : `/fixtures?${parts.join('&')}`,
      label: 'Back to fixtures',
    }
  }

  return fallback
}

/**
 * A link to a profile that remembers where it was clicked.
 *
 * The encoding happens here, once, because a `from` carrying `?filter=mvp` has
 * to survive being a value inside another query string — and a call site that
 * forgot would lose the filter silently rather than visibly.
 */
export function playerHref(playerId: number, from: string): string {
  return `/players/${playerId}?from=${encodeURIComponent(from)}`
}

export function teamHref(teamId: number, from: string): string {
  return `/teams/${teamId}?from=${encodeURIComponent(from)}`
}
