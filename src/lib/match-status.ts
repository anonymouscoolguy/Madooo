/**
 * API-Football's `status.short` vocabulary, split by what it means to us.
 *
 * This lives on its own rather than inside [`hydration.ts`](./hydration.ts) for
 * the reason `rounds.ts` does: **the pages need it too, and they may not import
 * the sync's selection policy.** One list of statuses, read by the scheduled
 * run deciding what to fetch and by a card deciding what to draw — two copies
 * would be free to disagree about what `HT` means.
 *
 * Taken from the provider's own documentation rather than from the captured
 * payloads, which contain only `FT` and `NS`: a season is either finished or not
 * yet played, and every interesting status exists for a few hours on one
 * afternoon. `hydration.test.ts` asserts that every status the payloads *do*
 * contain is classified here, which is the part recollection could get wrong.
 *
 * Pure, and imports nothing — which is what lets Vitest reach it and what makes
 * it safe on both sides of the sync boundary.
 */

/** Played to a result. The squad is final and worth reading. */
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN'] as const

/**
 * Over, and there is nothing to read. A match awarded 3–0 or walked over never
 * had a team sheet, and an abandoned one's is not what happened.
 *
 * These are the ones it would be easy to fold into FINISHED by mistake: they
 * satisfy every plain-English reading of "the match is over" and would put a
 * permanently unhydratable row in the hydration queue.
 */
export const ABANDONED_STATUSES = ['PST', 'CANC', 'ABD', 'AWD', 'WO'] as const

/** Named but not yet under way. */
export const NOT_STARTED_STATUSES = ['TBD', 'NS'] as const

/**
 * The ball is in play, or the match has started and stopped.
 *
 * `SUSP` and `INT` are in here rather than with the abandoned ones on purpose: a
 * suspended match has been played in part and may resume, so its team sheet is
 * real and its result is not final. Both readings of this list want the same
 * answer for them.
 */
export const IN_PROGRESS_STATUSES = [
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'SUSP',
  'INT',
  'LIVE',
] as const

/** Not yet, or in progress. Hydrating here writes partial minutes and no rating. */
export const PENDING_STATUSES = [
  ...NOT_STARTED_STATUSES,
  ...IN_PROGRESS_STATUSES,
] as const

function isMember(statuses: readonly string[], status: string): boolean {
  return statuses.includes(status)
}

export function isFinished(status: string): boolean {
  return isMember(FINISHED_STATUSES, status)
}

export function isAbandoned(status: string): boolean {
  return isMember(ABANDONED_STATUSES, status)
}

export function isPending(status: string): boolean {
  return isMember(PENDING_STATUSES, status)
}

/**
 * Whether a match is being played right now.
 *
 * The page side's question, and the reason this file exists. Every screen used
 * to infer "played" from `homeGoals !== null`, which is true the moment a match
 * kicks off — so a live match rendered as a finished goalless draw. It is also
 * why a live match shows no score at all rather than a live one: these pages are
 * server-rendered and never poll, so a scoreline painted at kick-off plus ten
 * would sit there unchanged while the match moved on. "LIVE" is what the page
 * actually knows.
 */
export function isInProgress(status: string): boolean {
  return isMember(IN_PROGRESS_STATUSES, status)
}

/**
 * Whether the provider's vocabulary still matches ours. A status classified by
 * none of the groups is one API-Football has added since this was written, and
 * the honest response is to notice rather than to guess which group it belongs
 * in — an unclassified status is simply never hydrated, and draws as though the
 * match were unplayed.
 */
export function isKnownStatus(status: string): boolean {
  return isFinished(status) || isAbandoned(status) || isPending(status)
}
