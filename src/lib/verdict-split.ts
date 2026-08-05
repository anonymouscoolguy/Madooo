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
 * The three verdicts without the matches they were given in — what `verdictMix`
 * takes, because it genuinely does not look at `watched`.
 *
 * Stated in the type rather than merely ignored in the body: a club row carries
 * `seen` rather than `watched`, and a signature demanding a field it never reads
 * would have every caller inventing one.
 */
export type VerdictTally = Omit<VerdictCounts, 'watched'>

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

/**
 * The same three verdicts as a proportion of **each other**, with no remainder.
 *
 * **A club cannot use `verdictSplit`, and the reason is arithmetic rather than
 * taste.** Above, `watched` counts matches and the three tags count judgements,
 * and for one player those are the same unit: `@@unique([userId, matchSquadId])`
 * allows him one judgement per match, so the tags can never outrun the matches
 * and the difference between them is a real state — "watched him and said
 * nothing".
 *
 * A club breaks that. One match carries eleven of their players, so a reader who
 * tags five Arsenal players in one fixture has five judgements against one
 * watched match. `unrated` would clamp to zero, the three segments would overrun
 * their track, and the bar would quietly assert a remainder that does not exist.
 * That is why the club profile draws no bar at all.
 *
 * So the club's bar answers the question the numbers can answer — *what is the
 * mix of what you gave them* — and leaves *how much* to the `N seen` beside it
 * and the counts in the legend. It is full width on any club with a verdict,
 * which is the honest consequence: length carries no information here, colour
 * does.
 */
export function verdictMix(counts: VerdictTally): Segment[] {
  const { mvps, standouts, flops } = counts
  const given = mvps + standouts + flops

  // A percentage of nothing is zero, not NaN — `verdictSplit`'s reason, and here
  // it is the common case rather than the edge one: most clubs on a directory
  // have never been judged, and each draws a bare track.
  const share = (count: number) => (given === 0 ? 0 : (count / given) * 100)

  return [
    { key: 'mvps', label: 'MVP', count: mvps, percent: share(mvps) },
    { key: 'standouts', label: 'STANDOUT', count: standouts, percent: share(standouts) },
    { key: 'flops', label: 'FLOP', count: flops, percent: share(flops) },
  ]
}
