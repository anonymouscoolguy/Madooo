import { plural } from '@/lib/text'
import { verdictSplit, type SegmentKey, type VerdictCounts } from '@/lib/verdict-split'

/**
 * "Verdict split" — how a player's watched matches divide between the three
 * verdicts and the matches that got none.
 *
 * The same card as `SquadPanel` and `VerdictSummary`: a bordered `--surface` at
 * `--radius-md` with a `--surface-header` strip, so the profile reads as one
 * system with the match page rather than as a dashboard.
 *
 * The arithmetic is in [`verdict-split.ts`](../lib/verdict-split.ts), where it is
 * pure and tested. This file only draws it.
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

/** Exhaustive, unlike the fills: every segment appears in the legend. */
const CHIP: Record<SegmentKey, string> = {
  mvps: 'bg-mvp-bg text-mvp',
  standouts: 'bg-standout-bg text-standout',
  flops: 'bg-flop-bg text-flop',
  unrated: 'bg-surface-sunken text-muted',
}

export function VerdictSplit({ counts }: { counts: VerdictCounts }) {
  const segments = verdictSplit(counts)

  return (
    <section className="mb-6 overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
        <h2 className="text-caps">Verdict split</h2>
        {/* Plurals are real here, unlike in the reference screenshot — 6.6's
            decision, and the numeral is its own span because foundations
            monospaces a number you can add up. */}
        <span className="shrink-0 text-caps text-muted">
          {/* `font-mono` overrides only the family that `text-caps` sets, so the
              size, weight and tracking of the micro-label survive — the same
              move `FixtureCard`'s footer counts and the match page's scoreline
              make. */}
          <span className="font-mono">{counts.watched}</span>{' '}
          {plural(counts.watched, 'match')} watched
        </span>
      </header>

      <div className="p-4">
        {/*
          `aria-hidden`, because every number in it is stated as text in the
          legend directly below. A bar carrying its own long label would say the
          whole thing twice.

          The track is `--surface-sunken` and the **unrated segment is the track
          showing through** rather than a fourth filled box. That is what the
          design draws, and it also means the three drawn widths cannot leave a
          rounding gap at the right-hand end.
        */}
        <div aria-hidden className="flex h-2 overflow-hidden rounded-sm bg-surface-sunken">
          {segments.map((segment) => {
            const fill = SEGMENT[segment.key]
            if (fill === undefined || segment.count === 0) return null

            return (
              /*
                An inline width, which is **data rather than a design value** —
                the percentage comes out of the database, so no token could
                express it and foundations' no-raw-values rule is not in play.
                It is also the only way: Tailwind never sees a class name built
                at runtime, so `w-[47%]` could not exist.
              */
              <span key={segment.key} style={{ width: `${segment.percent}%` }} className={fill} />
            )
          })}
        </div>

        {/* Zeroes are shown, not hidden. A legend that dropped its empty
            categories would change shape as the season went on, and "0 FLOP" is
            a fact worth reading. */}
        <ul className="mt-3 flex flex-wrap gap-2">
          {segments.map((segment) => (
            <li
              key={segment.key}
              // 20px, foundations' badge — the same object as the one in
              // `VerdictSummary`, with a count in front of the word.
              className={`inline-flex h-5 items-center gap-1.5 rounded-sm px-2 text-caps ${CHIP[segment.key]}`}
            >
              <span className="font-mono">{segment.count}</span> {segment.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
