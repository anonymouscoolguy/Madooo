/**
 * Which matches a scheduled run should fetch detail for.
 *
 * The scheduled sync does not ask API-Football which round is current. It asks
 * our own table which *fixtures* are finished and not yet read, which is why
 * three leagues at three different points of their seasons — 38 rounds, 34 and
 * 38, played on different weekends — produce no branch anywhere below. The
 * question is asked per fixture, so the leagues never have to be told apart.
 *
 * This module is pure and imports nothing, which is what lets Vitest reach it:
 * the suite resolves no path aliases and cannot load anything that pulls in
 * Prisma. `sync.ts` does the coarse Prisma query and hands the rows here.
 */

/**
 * The provider's whole `status.short` vocabulary, split three ways.
 *
 * Taken from API-Football's own documentation rather than from the captured
 * payloads, which contain only `FT` and `NS` — a season is either finished or
 * not yet played, and every interesting status exists for a few hours on one
 * afternoon. `hydration.test.ts` asserts that every status the payloads *do*
 * contain is classified here, which is the part recollection could get wrong.
 */

/** Played to a result. The squad is final and worth reading. */
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN'] as const

/**
 * Over, and there is nothing to read. A match awarded 3–0 or walked over never
 * had a team sheet, and an abandoned one's is not what happened.
 *
 * These are the ones it would be easy to fold into FINISHED by mistake: they
 * satisfy every plain-English reading of "the match is over" and would put a
 * permanently unhydratable row in the queue for the length of the window.
 */
export const ABANDONED_STATUSES = ['PST', 'CANC', 'ABD', 'AWD', 'WO'] as const

/** Not yet, or in progress. Hydrating here writes partial minutes and no rating. */
export const PENDING_STATUSES = [
  'TBD',
  'NS',
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

/**
 * How far back a run will look. Three jobs at once: it bounds the queue so the
 * budget is never the binding constraint, it stops the first scheduled run
 * trying to hydrate a previous season, and it is the give-up rule — a fixture
 * the provider never publishes a lineup for drops out on its own after a
 * fortnight, so nothing has to decide it is hopeless.
 *
 * The cost, stated: a match missed because the job was broken for two weeks is
 * never picked up automatically. The repair path is `npm run sync -- --round N`.
 */
export const WINDOW_DAYS = 14

/**
 * How long after kickoff a reading counts as final.
 *
 * A run fifteen minutes after full time can catch API-Football mid-write —
 * minutes and ratings settle over the following hour. So a match stays due
 * until it has been read at least this long after it kicked off, which buys
 * every match exactly one confirming re-read that evening and then never again.
 */
export const SETTLE_HOURS = 6

/** `syncFixtureDetail` costs two: `/fixtures/lineups` and `/fixtures/players`. */
export const REQUESTS_PER_FIXTURE = 2

/**
 * How much of the reported daily remainder a single run will spend. The counter
 * is documented as non-monotonic — observed going 77, 75, 78, 76 within one run
 * — so it is not trustworthy to the last unit, and a scheduled job that drained
 * it would leave nothing for the next fifty runs of the day.
 */
const QUOTA_SHARE = 0.5

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** The shape `selectDue` needs. Rows may carry anything else besides. */
export interface HydrationCandidate {
  kickoff: Date
  status: string
  /** When the detail endpoints were last read for this fixture. */
  hydratedAt: Date | null
}

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
 * Whether the provider's vocabulary still matches ours. A status classified by
 * none of the three is one API-Football has added since this was written, and
 * the honest response is to notice rather than to guess which group it belongs
 * in — an unclassified status is simply never hydrated.
 */
export function isKnownStatus(status: string): boolean {
  return isFinished(status) || isAbandoned(status) || isPending(status)
}

/** The oldest kickoff a run will consider. */
export function windowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_DAYS * DAY_MS)
}

/**
 * Whether one fixture still wants reading.
 *
 * Read the last clause aloud: *a match is due until it has been read at least
 * six hours after it kicked off.* One expression covers "never read", "read too
 * early to be final" and "stop, this is finished", and it terminates by
 * construction — no attempt counter, no give-up list.
 *
 * The kickoff in that comparison is safe even though a live season's calendar
 * is provisional. Placeholder Saturday-14:00 kickoffs only exist for matches
 * that have not been played; by the time a fixture is `FT` its kickoff is the
 * real one.
 */
export function isDue(row: HydrationCandidate, now: Date): boolean {
  if (!isFinished(row.status)) return false
  if (row.kickoff < windowStart(now)) return false
  if (row.hydratedAt === null) return true
  return row.hydratedAt.getTime() < row.kickoff.getTime() + SETTLE_HOURS * HOUR_MS
}

/**
 * The fixtures to hydrate, in the order to hydrate them.
 *
 * Never-read first, then oldest first within each tier. A match nobody has ever
 * read is a permanent hole in a diary; a confirming re-read is a few hours'
 * wait. At three leagues the ordering never actually bites — the heaviest
 * realistic day drains in one run — but it decides who waits when it does.
 *
 * Uncapped on purpose. The caller needs the full count in order to say how many
 * it is leaving behind, so it takes the head of this list itself rather than
 * being handed a truncated one it cannot measure.
 */
export function selectDue<T extends HydrationCandidate>(rows: T[], now: Date): T[] {
  return rows
    .filter((row) => isDue(row, now))
    .sort((a, b) => {
      const unread = Number(a.hydratedAt === null) - Number(b.hydratedAt === null)
      if (unread !== 0) return -unread
      return a.kickoff.getTime() - b.kickoff.getTime()
    })
}

/**
 * How many fixtures this run can afford.
 *
 * The CLI used to throw here and tell the author to pass `--limit`. A scheduled
 * run has nobody to read that, and refusing to run means hydrating nothing
 * where hydrating some would have been right — so it clamps and says so.
 *
 * A null remainder means the header was missing or unreadable, which is not
 * evidence of a generous plan; but it is also not evidence of a tight one, and
 * the client already paces itself slowly in that case. Leave the count alone.
 */
export function clampToQuota(wanted: number, remaining: number | null): number {
  if (remaining === null) return wanted
  const affordable = Math.floor((remaining * QUOTA_SHARE) / REQUESTS_PER_FIXTURE)
  return Math.max(0, Math.min(wanted, affordable))
}
