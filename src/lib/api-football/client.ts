/**
 * The only code that talks to API-Football over the network.
 *
 * Deliberately thin: one GET, the auth header, the error check, and the quota
 * headers. Everything shape-related lives in `map.ts`.
 */

import { apiFootballKey } from '../env'

import type { ApiFootballEnvelope } from './types'

const BASE_URL = 'https://v3.football.api-sports.io'

/**
 * Pacing is *derived from the plan*, not asserted about it.
 *
 * There is a per-minute limit as well as the daily one, and exceeding it returns
 * an HTTP 429 with `errors.rateLimit`. Both ceilings are reported on every
 * response: `x-ratelimit-limit` is the per-minute one and
 * `x-ratelimit-requests-limit` the daily. So rather than hardcode a number that
 * silently becomes wrong the day the subscription changes, the client reads the
 * per-minute ceiling off each response and paces itself against it.
 *
 * The first request of a process cannot know the limit yet, so it starts from
 * the slowest plausible rate and speeds up once the first response has answered
 * the question. Being wrong in this direction costs seconds; being wrong in the
 * other risks the firewall block API-Football's terms warn about for sustained
 * over-consumption.
 */
const FALLBACK_INTERVAL_MS = 6_500

/**
 * Aim for this share of the stated ceiling. Sitting exactly on the limit means
 * any clock skew between us and the provider is a 429, and the retry below costs
 * a minute — far more than the margin ever does.
 */
const SAFETY_FACTOR = 0.8

/**
 * Bounds on the derived interval, in case the header is absurd.
 *
 * The ceiling sits above the slowest rate any whole-number limit can produce —
 * one request per minute works out at 75s once the margin is applied — so that
 * it only ever engages for a limit below 1, which is not a plan anyone sells.
 * That is the one input for which the margin is deliberately abandoned: past
 * that point, bounding the wait matters more than staying under a ceiling the
 * header has already failed to describe honestly.
 */
const FLOOR_INTERVAL_MS = 100
const CEILING_INTERVAL_MS = 120_000

/** How long to wait out a 429 before the single retry. */
const RATE_LIMIT_BACKOFF_MS = 60_000

let lastRequestAt = 0
let minRequestIntervalMs = FALLBACK_INTERVAL_MS

/**
 * The gap to leave between requests, given a per-minute ceiling.
 *
 * A missing or nonsensical header falls back to the slow rate rather than to an
 * optimistic one: an unparseable limit is not evidence of a generous plan.
 */
export function intervalForLimit(perMinuteLimit: number | null): number {
  if (perMinuteLimit === null || !Number.isFinite(perMinuteLimit) || perMinuteLimit <= 0) {
    return FALLBACK_INTERVAL_MS
  }
  const interval = Math.ceil(60_000 / (perMinuteLimit * SAFETY_FACTOR))
  return Math.min(CEILING_INTERVAL_MS, Math.max(FLOOR_INTERVAL_MS, interval))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForSlot() {
  const wait = lastRequestAt + minRequestIntervalMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

/** Learn the plan's pace from a response, including a 429's. */
function observeRateLimit(response: Response) {
  const raw = response.headers.get('x-ratelimit-limit')
  if (raw !== null) minRequestIntervalMs = intervalForLimit(Number(raw))
}

/** A refusal reported by API-Football inside an otherwise successful response. */
export class ApiFootballError extends Error {
  constructor(path: string, reason: string) {
    super(`API-Football refused /${path}: ${reason}`)
    this.name = 'ApiFootballError'
  }
}

/**
 * Did the response report an error?
 *
 * Subtler than it looks, and the reason this is its own named function. The API
 * sends `"errors": []` on success and `"errors": {"plan": "..."}` on failure —
 * and **an empty array is truthy in JavaScript**. The obvious `if (body.errors)`
 * is therefore always true and would turn every successful call into a failure.
 * (The Python probe script gets away with `if errors:` because Python treats an
 * empty list as false. This is one of the sharper differences between the two
 * languages, and it bites precisely here.)
 */
export function isApiFootballFailure(
  errors: ApiFootballEnvelope<unknown>['errors'],
): boolean {
  if (!errors) return false
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0
}

function describeErrors(errors: ApiFootballEnvelope<unknown>['errors']): string {
  return Array.isArray(errors)
    ? errors.join('; ')
    : Object.entries(errors)
        .map(([field, reason]) => `${field}: ${reason}`)
        .join('; ')
}

export interface ApiFootballResult<T> {
  response: T[]
  /** Requests left on today's quota, as reported by the response headers. */
  remaining: number | null
  limit: number | null
}

/**
 * GET a v3 endpoint.
 *
 * Throws `ApiFootballError` on a refusal reported in the body (constraint #4:
 * status-code-only handling would read "free plans cannot access this season" as
 * "this season has no fixtures"), and a plain Error on a non-200.
 */
export async function apiGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<ApiFootballResult<T>> {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  )
  const url = `${BASE_URL}/${path}?${query}`
  const headers = { 'x-apisports-key': apiFootballKey() }

  await waitForSlot()
  let response = await fetch(url, { headers })
  observeRateLimit(response)

  // One retry, because a 429 here means the minute window is still open and
  // waiting it out is the only correct response. A second 429 is a real problem
  // — a stale clock, or a limit lower than we think — and should surface.
  if (response.status === 429) {
    console.warn(`  wait  rate limited on /${path}, retrying in 60s`)
    await sleep(RATE_LIMIT_BACKOFF_MS)
    await waitForSlot()
    response = await fetch(url, { headers })
    observeRateLimit(response)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on /${path}: ${await response.text()}`)
  }

  const body = (await response.json()) as ApiFootballEnvelope<T>
  if (isApiFootballFailure(body.errors)) {
    throw new ApiFootballError(path, describeErrors(body.errors))
  }

  const header = (name: string) => {
    const value = response.headers.get(name)
    return value === null ? null : Number(value)
  }

  return {
    response: body.response,
    remaining: header('x-ratelimit-requests-remaining'),
    limit: header('x-ratelimit-requests-limit'),
  }
}
