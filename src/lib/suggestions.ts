/**
 * What a suggestion is allowed to be, and the one function that decides.
 *
 * This lives beside `actions.ts` rather than inside it for the same reason
 * `NOTE_MAX_LENGTH` does: that file is `'use server'`, so **every** export of it
 * becomes a public POST endpoint. A constant or a helper declared alongside the
 * actions would be reachable over the network, which is not what a constant is
 * for.
 *
 * Keeping the rule here also makes it the piece that can be tested. The action
 * around it talks to Postgres and to Clerk; this does neither, so `npm test`
 * covers the part where the decisions actually live.
 */

/**
 * What `sendSuggestion` answers.
 *
 * It lives here rather than beside the action for the reason at the top of this
 * file: `actions.ts` may export nothing but async functions. A `type` is erased
 * before it could become an endpoint, so nothing would break — but the rule is
 * worth keeping literal, because the moment it is read as "nothing but async
 * functions, and small exceptions" it stops being a rule anybody checks.
 *
 * **A refusal is a returned value, not a thrown error.** Throwing out of a
 * Server Action gives the client a redacted message in production, so "you have
 * sent too many of these" would reach the reader as "an error occurred" and the
 * dialog could not tell the two refusals apart.
 */
export type SuggestionResult = { ok: true } | { ok: false; reason: 'invalid' | 'rate-limited' }

/**
 * The longest a suggestion may be.
 *
 * The column itself is unbounded `text` — this is a product limit, not a schema
 * one, the same split `Judgement.note` makes. Two thousand characters is several
 * paragraphs, which is more than anyone writes into a box in a top bar, and the
 * limit exists to bound what a crafted POST can store rather than to discipline
 * anybody's prose.
 */
export const SUGGESTION_MAX_LENGTH = 2000

/**
 * How many suggestions one account may send inside `SUGGESTION_WINDOW_MS`.
 *
 * **This is a real guard, not politeness.** `sendSuggestion` is a public
 * endpoint that anyone with a session can POST to directly, so without a limit
 * one signed-in account can fill the table at the speed of the network. Five an
 * hour is far above what a person writing genuine suggestions produces and far
 * below what a loop produces in a second.
 */
export const SUGGESTION_LIMIT_PER_WINDOW = 5

/** One hour, in milliseconds. */
export const SUGGESTION_WINDOW_MS = 60 * 60 * 1000

/**
 * Turn whatever arrived over the wire into a suggestion, or into `null`.
 *
 * `unknown` rather than `string` is the point of the signature. The argument
 * reaches this from a POST body, so the type annotation on the action promises
 * nothing at runtime — a caller that is not our dialog can send a number, an
 * object, or nothing at all, and TypeScript is not there to stop it.
 *
 * Ends are trimmed and **interior line breaks are kept**, which is the same call
 * `player-controls.tsx` made for notes: the textarea lets someone press Enter,
 * so collapsing what they typed would silently rewrite it.
 *
 * Over-length is rejected rather than truncated. The textarea carries
 * `maxLength`, so no one using the dialog can reach this branch; the only caller
 * that can is one bypassing the UI, and silently keeping the first two thousand
 * characters of that would be storing something nobody wrote.
 */
export function normaliseSuggestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > SUGGESTION_MAX_LENGTH) return null

  return trimmed
}
