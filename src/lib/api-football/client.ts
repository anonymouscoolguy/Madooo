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
 * There is a *per-minute* limit as well as the documented 100 per day, and it is
 * not advertised in the response headers — it announces itself as an HTTP 429
 * with `errors.rateLimit`. The free tier allows 10 per minute, so requests are
 * spaced just over six seconds apart. A round of ten fixtures therefore takes
 * about two minutes, which is the cost of not being throttled out mid-round.
 */
const MIN_REQUEST_INTERVAL_MS = 6_500

/** How long to wait out a 429 before the single retry. */
const RATE_LIMIT_BACKOFF_MS = 60_000

let lastRequestAt = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForSlot() {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
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

  // One retry, because a 429 here means the minute window is still open and
  // waiting it out is the only correct response. A second 429 is a real problem
  // — a stale clock, or a limit lower than we think — and should surface.
  if (response.status === 429) {
    console.warn(`  wait  rate limited on /${path}, retrying in 60s`)
    await sleep(RATE_LIMIT_BACKOFF_MS)
    await waitForSlot()
    response = await fetch(url, { headers })
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
