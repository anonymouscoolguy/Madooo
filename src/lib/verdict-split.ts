/**
 * How a player's season divides up: the verdicts given, and the matches watched
 * without giving one.
 *
 * Pure, and its own module rather than a corner of [`players.ts`](./players.ts),
 * because that file imports the Prisma client and a test must be able to import
 * this without a database. Same reason [`squad.ts`](./squad.ts) and
 * [`verdicts.ts`](./verdicts.ts) sit where they do.
 */

/**
 * The four numbers a profile opens with — the stat tiles read them by key, and
 * the split bar reads them as a whole.
 *
 * **"Watched" counts matches, not entries.** It is the number of matches this
 * season where the user recorded something *and* this player was in the matchday
 * squad, which is the meaning `/fixtures` already gives the word, narrowed to one
 * player. That is what makes the fourth segment below mean anything: `unrated` is
 * "you watched him and had nothing to say", which a count of entries could not
 * express.
 */
export interface VerdictCounts {
  watched: number
  mvps: number
  standouts: number
  flops: number
}

/**
 * The three verdicts, plus the state that exists only here: a match watched and
 * left unjudged. Exported so the component's colour tables can be exhaustive
 * over it, and a segment nobody gave a fill is a compile error.
 */
export type SegmentKey = 'mvps' | 'standouts' | 'flops' | 'unrated'

export interface Segment {
  key: SegmentKey
  label: string
  count: number
  /** Of `watched`. Zero throughout when nothing was watched. */
  percent: number
}

/**
 * The bar and its legend, in the order the design draws them.
 *
 * The arithmetic cannot overflow: `@@unique([userId, matchSquadId])` allows one
 * judgement per player per match and `@@unique([matchId, playerId])` allows one
 * squad row, so a tagged match is always also a watched one and the three tag
 * counts can never sum past `watched`. `Math.max` guards it anyway — the four
 * counts arrive from four separate queries, and a bar whose segments overran its
 * track would be a worse failure than a zero.
 */
export function verdictSplit(counts: VerdictCounts): Segment[] {
  const { watched, mvps, standouts, flops } = counts
  const unrated = Math.max(0, watched - mvps - standouts - flops)

  // A percentage of nothing is zero, not NaN — and a NaN would reach the DOM as
  // `width: NaN%`, which browsers drop silently.
  const share = (count: number) => (watched === 0 ? 0 : (count / watched) * 100)

  return [
    { key: 'mvps', label: 'MVP', count: mvps, percent: share(mvps) },
    { key: 'standouts', label: 'STANDOUT', count: standouts, percent: share(standouts) },
    { key: 'flops', label: 'FLOP', count: flops, percent: share(flops) },
    { key: 'unrated', label: 'UNRATED', count: unrated, percent: share(unrated) },
  ]
}
