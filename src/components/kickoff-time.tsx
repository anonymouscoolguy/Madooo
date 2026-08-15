'use client'

import { useSyncExternalStore } from 'react'
import { kickoffTime } from '@/lib/dates'

/**
 * A kickoff, on the reader's own clock.
 *
 * **This exists because the server cannot know what time it is where you are.**
 * Every other date in the app is formatted on the server in a fixed
 * `Europe/London`, which is right for them — a matchday and a month heading are
 * facts about the competition's calendar. A kickoff time is the one date that is
 * about the reader's evening rather than the season's shape, and only the
 * browser can say which evening that is. So this is a client island, and it is
 * the only one.
 *
 * The hook is the app's third use of `useSyncExternalStore` and the same reading
 * as [`use-preference.ts`](./use-preference.ts): a browser value the server
 * cannot see needs a separate server snapshot, so the server render and the
 * first client render agree *by construction*. The obvious alternative here is
 * worse than useless — `suppressHydrationWarning` keeps the DOM's text, which is
 * the **server's** London time, so it would suppress the warning and the change
 * with it.
 *
 * **The cost, stated rather than hidden: the first paint is London.** A reader in
 * Tokyo sees the English time for one frame after a cold load, then it swaps. A
 * reader in the UK — or in Lisbon, which shares the offset year-round — sees
 * nothing move at all. The alternative that removes the flash is a timezone
 * cookie set by a script in the head, which is still wrong on a first visit and
 * puts a cookie on every request to save one frame.
 *
 * No zone label beside the number, agreed rather than overlooked: the score slot
 * this sits in is sized for four characters and a bare monospaced numeral is what
 * foundations asks for.
 */

/**
 * The zone cannot change while the page is open, so there is nothing to
 * subscribe to. A module-level noop rather than a fresh closure per call: React
 * compares the returned unsubscribe by identity and would resubscribe on every
 * render otherwise.
 */
const noop = () => {}

function subscribe() {
  return noop
}

/**
 * Resolved once per session, not once per render. `Intl.DateTimeFormat()` with
 * no arguments is the same constructor the module docblock in `dates.ts` calls
 * the expensive part, and React calls `getSnapshot` on every render.
 *
 * A string, which is load-bearing for the same reason `use-preference.ts` gives:
 * React compares snapshots with `Object.is`, so anything freshly allocated per
 * call would never compare equal and would re-render forever.
 */
let resolved: string | undefined

function browserZone(): string {
  resolved ??= Intl.DateTimeFormat().resolvedOptions().timeZone
  return resolved
}

/**
 * `undefined` means "the London default" to `kickoffTime`, and it is what a
 * first-time render on the server and in the browser both produce — which is the
 * agreement that makes this hydrate cleanly.
 */
function serverZone(): undefined {
  return undefined
}

export function KickoffTime({ kickoff, className }: { kickoff: Date; className?: string }) {
  const zone = useSyncExternalStore(subscribe, browserZone, serverZone)

  // `<time>` rather than a `<span>`: the instant is the whole content of this
  // element, and `dateTime` is where it can be stated unambiguously — which the
  // rendered text no longer does, now that it depends on who is reading.
  return (
    <time dateTime={kickoff.toISOString()} className={className}>
      {kickoffTime(kickoff, zone)}
    </time>
  )
}
