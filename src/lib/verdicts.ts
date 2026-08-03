/**
 * Reading a user's verdicts back off a squad.
 *
 * Pure, and deliberately so, for the same reason as [`squad.ts`](./squad.ts):
 * Prisma is not imported, everything below is structural, and the decisions
 * worth a test — which players appear in the summary panel and in what order —
 * are made here rather than in a component nothing can assert against.
 *
 * The write side is [`actions.ts`](./actions.ts).
 */

// Relative, not `@/generated/…`, because Vitest resolves no path aliases — its
// config declares none, and the rest of `src/lib` reaches its neighbours the
// same way. A module that a test imports has to be importable without Next's
// bundler in the loop.
import { JudgementTag } from '../generated/prisma/enums'

/**
 * Re-exported so nothing outside this module has to know where Prisma's
 * generated client puts its enums — `src/generated/` is gitignored build output
 * and its layout is the generator's business, not ours.
 */
export type { JudgementTag }

/**
 * The shape these helpers need, rather than Prisma's `Judgement`.
 *
 * The array is 0 or 1 long and never more: `@@unique([userId, matchSquadId])`
 * guarantees one judgement per user per player per match, and the query filters
 * to one user. Prisma still types a to-many relation as an array, so the
 * unwrapping happens once, in `verdictOf`, instead of at every call site.
 */
export interface Judgeable {
  judgements: { tag: JudgementTag | null }[]
}

/**
 * Whether an untrusted value is one of the three tags.
 *
 * The `value is JudgementTag` return type is a **type predicate**: it tells
 * TypeScript that a `true` narrows the argument at the call site, which is how a
 * `string` arriving over the wire becomes a typed enum without a cast. The
 * Server Action needs it because every export of a `'use server'` file is a
 * public POST endpoint, so its arguments are as untrusted as a URL's.
 *
 * `Object.hasOwn` rather than `in`, which would also accept `"toString"`.
 */
export function isJudgementTag(value: unknown): value is JudgementTag {
  return typeof value === 'string' && Object.hasOwn(JudgementTag, value)
}

/** The user's verdict on one squad entry, or null for the great unjudged majority. */
export function verdictOf(entry: Judgeable): JudgementTag | null {
  return entry.judgements[0]?.tag ?? null
}

/** The number beside a panel's micro-label. Zero is a real answer and is shown. */
export function countVerdicts(entries: readonly Judgeable[]): number {
  return entries.filter((entry) => verdictOf(entry) !== null).length
}

/**
 * MVP, then the standouts, then the flops — the order the reference screenshot
 * draws the summary panel in, which is not the left-to-right order of the
 * buttons on a row. Two orders for one vocabulary, so both are written down.
 */
const SUMMARY_RANK: Record<JudgementTag, number> = { MVP: 0, STANDOUT: 1, FLOP: 2 }

export interface Verdict<T> {
  entry: T
  tag: JudgementTag
}

/**
 * The "Your verdicts" panel: every judged player, grouped by verdict.
 *
 * Within a group the incoming order survives, because `Array.prototype.sort` is
 * required to be stable and the caller hands entries over in the order the
 * panels above draw them — home eleven, home bench, away eleven, away bench.
 *
 * `flatMap` rather than `filter` then `map`: it drops the untagged entries and
 * narrows `tag` away from `JudgementTag | null` in one pass, where a `filter`
 * would leave TypeScript still believing the tag might be null.
 */
export function summariseVerdicts<T extends Judgeable>(entries: readonly T[]): Verdict<T>[] {
  return entries
    .flatMap((entry) => {
      const tag = verdictOf(entry)
      return tag === null ? [] : [{ entry, tag }]
    })
    .sort((a, b) => SUMMARY_RANK[a.tag] - SUMMARY_RANK[b.tag])
}
