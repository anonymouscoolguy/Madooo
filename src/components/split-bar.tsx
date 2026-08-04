import type { Segment, SegmentKey } from '@/lib/verdict-split'

/**
 * The verdict split, drawn: a bar and the badges that name it.
 *
 * Extracted from [`verdict-split.tsx`](./verdict-split.tsx) when the players
 * index wanted the same bar without the card around it — a profile draws it as a
 * panel with a header and a legend, a list row draws it bare between a name and
 * a count. The card kept its own file; these two are the parts both screens
 * share.
 *
 * The arithmetic stays in [`verdict-split.ts`](../lib/verdict-split.ts), where it
 * is pure and tested. Both components take the segments already computed, so a
 * caller drawing six hundred rows calls `verdictSplit` once per row rather than
 * once per part.
 */

/**
 * Written out per key rather than assembled from it, for the reason Tailwind
 * forces: it finds class names by scanning source text.
 *
 * The **ink** tokens, not the `--*-mark` trio. Foundations scopes those to a
 * glyph on an inverse surface, and the ink is the better answer anyway — each
 * segment then matches the legend label beneath it exactly. Both read at a
 * glance in dark, where the verdict inks lighten rather than staying the light
 * theme's near-black.
 *
 * `Partial` says the thing the type would otherwise hide: **`unrated` has no
 * fill**, because it is the track showing through rather than a box drawn over
 * it. Keying on `SegmentKey` still makes a misspelt segment a compile error.
 */
const SEGMENT: Partial<Record<SegmentKey, string>> = {
  mvps: 'bg-mvp',
  standouts: 'bg-standout',
  flops: 'bg-flop',
}

/** Exhaustive, unlike the fills: every segment can appear in a legend. */
const CHIP: Record<SegmentKey, string> = {
  mvps: 'bg-mvp-bg text-mvp',
  standouts: 'bg-standout-bg text-standout',
  flops: 'bg-flop-bg text-flop',
  unrated: 'bg-surface-sunken text-muted',
}

/**
 * The bar alone.
 *
 * **`aria-hidden`, and it carries `CrestChip`'s contract: whatever holds it has
 * to name it.** In the profile's card the legend directly below states every
 * count as text, so a bar announcing its own numbers would say the whole thing
 * twice. In a list row there is no legend, so the row supplies an `sr-only`
 * sentence instead — and the rule is the same either way, because the bar itself
 * cannot know which of the two it is in.
 *
 * The track is `--surface-sunken` and **the unrated segment is the track showing
 * through** rather than a fourth filled box. That is what the design draws, and
 * it also means the three drawn widths cannot leave a rounding gap at the
 * right-hand end. A player nobody has judged is therefore a bare track, which is
 * most of the league on the index and is correct.
 *
 * No margin of its own — the caller places it.
 */
export function SplitBar({ segments }: { segments: readonly Segment[] }) {
  return (
    <div aria-hidden className="flex h-2 overflow-hidden rounded-sm bg-surface-sunken">
      {segments.map((segment) => {
        const fill = SEGMENT[segment.key]
        if (fill === undefined || segment.count === 0) return null

        return (
          /*
            An inline width, which is **data rather than a design value** — the
            percentage comes out of the database, so no token could express it and
            foundations' no-raw-values rule is not in play. It is also the only
            way: Tailwind never sees a class name built at runtime, so `w-[47%]`
            could not exist.
          */
          <span key={segment.key} style={{ width: `${segment.percent}%` }} className={fill} />
        )
      })}
    </div>
  )
}

/**
 * The badges under the bar, each naming a segment and counting it.
 *
 * Zeroes are shown, not hidden. A legend that dropped its empty categories would
 * change shape as the season went on, and "0 FLOP" is a fact worth reading.
 *
 * Which segments appear is the caller's decision rather than this component's:
 * the profile passes all four, a grid card passes the three that are verdicts,
 * because a card has no "watched" number for `unrated` to be a remainder of.
 */
export function SplitLegend({
  segments,
  className,
}: {
  segments: readonly Segment[]
  className?: string
}) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {segments.map((segment) => (
        <li
          key={segment.key}
          // 20px, foundations' badge — the same object as the one in
          // `VerdictSummary`, with a count in front of the word.
          className={`inline-flex h-5 items-center gap-1.5 rounded-sm px-2 text-caps ${CHIP[segment.key]}`}
        >
          {/* `font-mono` overrides only the family `text-caps` sets, so the size,
              weight and tracking of the micro-label survive. */}
          <span className="font-mono">{segment.count}</span> {segment.label}
        </li>
      ))}
    </ul>
  )
}
