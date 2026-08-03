/**
 * The diary's five filters — the pill row from the reference screenshots — and
 * the only place they are written down.
 *
 * One table, read by three callers: the tabs render the labels, the page reads
 * the empty-state sentence, and [`diary.ts`](./diary.ts) spreads the `where`
 * fragment into its query. Splitting them would mean a slug could exist in the
 * URL that nothing knew how to query, or a query nothing could link to.
 *
 * Pure, like [`verdicts.ts`](./verdicts.ts) and [`squad.ts`](./squad.ts), and
 * for the same reason: `parseFilter` reads an untrusted URL parameter, which is
 * exactly the sort of decision worth a test, and a test must be able to import
 * this without Prisma in the loop.
 *
 * A `where` fragment is a plain object literal, so nothing here imports the
 * Prisma *client* — only its types, and `import type` is erased at compile time
 * rather than resolved at runtime.
 */

import type { Prisma } from '../generated/prisma/client'

export interface DiaryFilter {
  /** What appears in the URL: `/diary?filter=mvp`. */
  slug: string
  label: string
  /** What the list says when this filter matches nothing. */
  empty: string
  /** Folded into the query's `where` beside the user and the season. */
  where: Prisma.JudgementWhereInput
}

/**
 * In the order the design draws them, and `all` is first because it is the
 * default — `parseFilter` falls back to whatever is at index 0.
 *
 * `notes` is `{ not: null }` and nothing else: `setNote` stores a cleared note
 * as no judgement or as a null column, never as an empty string, so null is the
 * whole of the test. The same reading `seasonTotals` takes.
 */
export const DIARY_FILTERS: readonly DiaryFilter[] = [
  {
    slug: 'all',
    label: 'All',
    empty: 'Nothing here yet — start by opening a fixture and rating the players.',
    where: {},
  },
  { slug: 'mvp', label: 'MVPs', empty: 'No MVPs this season.', where: { tag: 'MVP' } },
  {
    slug: 'standout',
    label: 'Standouts',
    empty: 'No standouts this season.',
    where: { tag: 'STANDOUT' },
  },
  { slug: 'flop', label: 'Flops', empty: 'No flops this season.', where: { tag: 'FLOP' } },
  {
    slug: 'notes',
    label: 'With notes',
    empty: 'No notes this season.',
    where: { note: { not: null } },
  },
]

/**
 * Which filter a URL asked for, defaulting to All.
 *
 * `unknown` rather than `string`, because this is handed the raw value out of
 * `searchParams` — which is `string | string[] | undefined`, an array whenever
 * the parameter is repeated. Anything unrecognised falls back rather than
 * refusing: a mistyped query string should show the diary, not an error page.
 */
export function parseFilter(value: unknown): DiaryFilter {
  const slug = Array.isArray(value) ? value[0] : value
  return DIARY_FILTERS.find((filter) => filter.slug === slug) ?? DIARY_FILTERS[0]
}
