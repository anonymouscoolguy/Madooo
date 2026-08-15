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

import { isFinished, isPending } from './match-status'

/**
 * The status vocabulary itself lives in [`match-status.ts`](./match-status.ts),
 * because the pages need it too and may not import this file — the same split
 * `rounds.ts` exists for. It is re-exported here so the sync and its tests keep
 * one import site for everything about selection.
 */
export {
  ABANDONED_STATUSES,
  FINISHED_STATUSES,
  IN_PROGRESS_STATUSES,
  isAbandoned,
  isFinished,
  isInProgress,
  isKnownStatus,
  isPending,
  NOT_STARTED_STATUSES,
  PENDING_STATUSES,
} from './match-status'

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

/** `syncFixtureLineups` costs one. It never calls `/fixtures/players`. */
export const REQUESTS_PER_LINEUP = 1

/**
 * How long before kickoff a team sheet becomes worth asking for.
 *
 * **Measured, not assumed.** API-Football documents 20 to 40 minutes, and timed
 * probes across two leagues found a fixture empty at 29 minutes and complete at
 * 18 — the late edge of that band. 45 covers the documented earliest with a
 * small margin; the numbers and the method are in
 * [`api-football-findings.md`](../../docs/api-football-findings.md).
 *
 * It was 90 before those probes ran, which at a quarter-hour cadence spent five
 * requests per fixture on a response that could not exist yet. Being wrong in
 * the other direction is far cheaper: the window runs to full time, so a lead
 * that is too short delays a team sheet by one run rather than losing it.
 */
export const LINEUP_LEAD_MINUTES = 45

/**
 * A fixture wants one lineup per club, and fewer means it is still incomplete.
 *
 * The count is what makes this terminate on its own *and* survive the two clubs
 * announcing minutes apart. "Has any squad row" would retire the fixture on the
 * first club's team sheet and leave the second side blank until full time.
 */
export const LINEUPS_PER_FIXTURE = 2

/**
 * How much of the reported daily remainder a single run will spend. The counter
 * is documented as non-monotonic — observed going 77, 75, 78, 76 within one run
 * — so it is not trustworthy to the last unit, and a scheduled job that drained
 * it would leave nothing for the next fifty runs of the day.
 */
const QUOTA_SHARE = 0.5

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** The shape `selectDue` needs. Rows may carry anything else besides. */
export interface HydrationCandidate {
  kickoff: Date
  status: string
  /** When the detail endpoints were last read for this fixture. */
  hydratedAt: Date | null
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

/** The shape `selectLineupDue` needs. Rows may carry anything else besides. */
export interface LineupCandidate {
  kickoff: Date
  status: string
  /** `MatchLineup` rows this fixture already has: 0, 1 or 2. */
  lineupCount: number
}

/** The earliest a run will ask for a team sheet. */
export function lineupWindowOpens(kickoff: Date): Date {
  return new Date(kickoff.getTime() - LINEUP_LEAD_MINUTES * MINUTE_MS)
}

/**
 * The latest. A fixture the provider leaves sitting at `NS` long past its
 * kickoff would otherwise be asked for forever, so this is the give-up rule the
 * fortnight window is for the other predicate — and it reuses `SETTLE_HOURS`
 * rather than inventing a number, because it is the same judgement: past that
 * point the provider is not going to say anything new about this match.
 */
export function lineupWindowCloses(kickoff: Date): Date {
  return new Date(kickoff.getTime() + SETTLE_HOURS * HOUR_MS)
}

/**
 * The kickoffs a run will consider for team sheets, as a range Postgres can
 * take. The inverse of the two window functions above: a fixture is in play when
 * its window has opened and not yet closed, which read from `now` rather than
 * from the kickoff is simply a band of kickoff times either side of it.
 *
 * It exists so the coarse Prisma filter and the policy cannot drift apart —
 * `windowStart` does the same job for the other predicate.
 */
export function lineupKickoffRange(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - SETTLE_HOURS * HOUR_MS),
    to: new Date(now.getTime() + LINEUP_LEAD_MINUTES * MINUTE_MS),
  }
}

/**
 * Whether one fixture still wants a team sheet.
 *
 * The counterpart to `isDue`, and deliberately a separate predicate rather than
 * a widening of it: that one insists on `FT` precisely so a run never writes
 * partial minutes and missing ratings, while this one runs when there are no
 * statistics at all and is safe only because its caller fetches
 * `/fixtures/lineups` alone.
 *
 * The window runs to full time rather than to kickoff, which is what covers a
 * team sheet published late — so the status test is *not finished* rather than
 * *not started*, and `1H`, `HT` and `2H` all still qualify. A lineup is complete
 * and final once a match is under way; it is only the statistics that are
 * provisional, and those are never read here.
 */
export function isLineupDue(row: LineupCandidate, now: Date): boolean {
  if (!isPending(row.status)) return false
  if (row.lineupCount >= LINEUPS_PER_FIXTURE) return false
  return now >= lineupWindowOpens(row.kickoff) && now <= lineupWindowCloses(row.kickoff)
}

/**
 * The fixtures wanting a team sheet, soonest kickoff first.
 *
 * Ordered the opposite way to `selectDue`, and for the opposite reason: that
 * queue is a fortnight wide and can afford to wait, while this one closes at
 * full time. The match kicking off next is the one a delay actually costs.
 */
export function selectLineupDue<T extends LineupCandidate>(rows: T[], now: Date): T[] {
  return rows
    .filter((row) => isLineupDue(row, now))
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
}

/**
 * The share of the day's remaining quota one run will spend, in requests.
 *
 * Null when the header was missing or unreadable, which is not evidence of a
 * generous plan but is not evidence of a tight one either — the client already
 * paces itself slowly in that case, which is where the caution belongs.
 */
export function affordableRequests(remaining: number | null): number | null {
  if (remaining === null) return null
  return Math.max(0, Math.floor(remaining * QUOTA_SHARE))
}

/** How much of each queue a run can afford. */
export interface RunBudget {
  lineups: number
  fixtures: number
}

/**
 * How much work this run can pay for, across both queues.
 *
 * One budget rather than two, because the quota is one number and both queues
 * spend it. **Lineups are taken first**: their window is ninety minutes wide and
 * closes at full time, while a fixture waiting to be hydrated has a fortnight —
 * so when something has to wait, it should be the queue that can.
 *
 * It clamps and never refuses. The CLI used to throw here and advise passing
 * `--limit`, which has no reader in a scheduled run, and refusing outright reads
 * nothing where reading some would have been right.
 */
export function planRun(
  wantedLineups: number,
  wantedFixtures: number,
  remaining: number | null,
): RunBudget {
  const budget = affordableRequests(remaining)
  if (budget === null) return { lineups: wantedLineups, fixtures: wantedFixtures }

  const lineups = Math.min(wantedLineups, Math.floor(budget / REQUESTS_PER_LINEUP))
  const left = budget - lineups * REQUESTS_PER_LINEUP
  const fixtures = Math.min(wantedFixtures, Math.floor(left / REQUESTS_PER_FIXTURE))
  return { lineups, fixtures }
}
