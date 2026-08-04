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
 * Pure, so `back.test.ts` can assert that. `diary-filters.ts` imports Prisma's
 * *types* only and `import type` is erased at compile time, so nothing here
 * pulls the client into a test.
 */

import { DIARY_FILTERS } from './diary-filters'

export interface BackLink {
  href: string
  label: string
}

/**
 * The fallback, and the destination for anything unrecognised. `/players` is
 * still 7.3's placeholder, which is fine: it is a real page with the sidebar
 * around it, and it is where somebody who typed a profile URL belongs.
 */
const PLAYERS: BackLink = { href: '/players', label: 'Back to Players' }

/** `/matches/12`, and nothing that merely starts that way. */
const MATCH = /^\/matches\/(\d+)$/

/** `\d` is ASCII-only in JavaScript, so this cannot be fed Eastern Arabic digits. */
const MATCHDAY = /^\d+$/

/**
 * Where the reader came from, or `/players` if we cannot tell.
 *
 * `unknown` rather than `string` because this is handed the raw value out of
 * `searchParams`, which is `string | string[] | undefined` and an array whenever
 * the parameter is repeated — the same signature `parseFilter` takes.
 */
export function backLink(from: unknown): BackLink {
  const value = Array.isArray(from) ? from[0] : from
  if (typeof value !== 'string') return PLAYERS

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
    const matchday = new URLSearchParams(query).get('matchday')
    return {
      href: matchday !== null && MATCHDAY.test(matchday) ? `/fixtures?matchday=${matchday}` : '/fixtures',
      label: 'Back to fixtures',
    }
  }

  return PLAYERS
}

/**
 * A link to a player profile that remembers where it was clicked.
 *
 * The encoding happens here, once, because a `from` carrying `?filter=mvp` has
 * to survive being a value inside another query string — and a call site that
 * forgot would lose the filter silently rather than visibly.
 */
export function playerHref(playerId: number, from: string): string {
  return `/players/${playerId}?from=${encodeURIComponent(from)}`
}
