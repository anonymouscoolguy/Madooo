/**
 * The two tabs on a player profile — Diary and Notes — and the only place they
 * are written down.
 *
 * The same table as [`diary-filters.ts`](./diary-filters.ts), for the same
 * reasons: one list read by the tab strip, the empty state and the query, so a
 * slug cannot exist in the URL that nothing knows how to query. Pure, so
 * `parseView` — which reads an untrusted URL parameter — is testable without
 * Prisma in the loop.
 */

import type { Prisma } from '../generated/prisma/client'

export interface PlayerView {
  /** What appears in the URL: `/players/44?view=notes`. */
  slug: string
  label: string
  /** What the list says when this view holds nothing. */
  empty: string
  /** Folded into the query's `where` beside the player, the user and the season. */
  where: Prisma.JudgementWhereInput
}

/**
 * In the order the design draws them, and `diary` is first because it is the
 * default — `parseView` falls back to whatever is at index 0.
 *
 * `notes` is `{ not: null }` and nothing else, the same reading the diary's own
 * filter takes: `setNote` stores a cleared note as no judgement or as a null
 * column, never as an empty string.
 */
export const PLAYER_VIEWS: readonly PlayerView[] = [
  {
    slug: 'diary',
    label: 'Diary',
    empty: 'Nothing recorded about this player yet.',
    where: {},
  },
  {
    slug: 'notes',
    label: 'Notes',
    empty: 'No notes on this player yet.',
    where: { note: { not: null } },
  },
]

/**
 * Which view a URL asked for, defaulting to the diary.
 *
 * `unknown` rather than `string`, because this is the raw value out of
 * `searchParams`. Anything unrecognised falls back rather than refusing: a
 * mistyped query string should show the profile, not an error page.
 */
export function parseView(value: unknown): PlayerView {
  const slug = Array.isArray(value) ? value[0] : value
  return PLAYER_VIEWS.find((view) => view.slug === slug) ?? PLAYER_VIEWS[0]
}
