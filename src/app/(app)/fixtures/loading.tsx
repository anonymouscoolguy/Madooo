import { Skeleton, SkeletonBox, SkeletonHeader, SkeletonLine, SkeletonTiles } from '@/components/skeleton'

/**
 * `/fixtures` while its queries run.
 *
 * The screen this stands in for is a header, the four season tiles, the league
 * row beside the matchday pager, and a card per fixture — so this is the same
 * four things, drawn as blocks in the same containers.
 *
 * **Six cards, and the number is a guess that cannot be got right.** A matchday
 * is ten fixtures in the Premier League and nine in the Primeira Liga, but a
 * skeleton is rendered before anything has been asked, so the count is not
 * knowable here. Six fills a first screen at desktop height without running so
 * far past a short matchday that the list visibly shortens when the real cards
 * arrive.
 */
export default function Loading() {
  return (
    <Skeleton>
      <SkeletonHeader />
      <SkeletonTiles />

      {/* The league row and the pager, in the wrapper `page.tsx` gives them —
          stacked below `sm`, apart on one line from there up. */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <SkeletonBox className="h-8 w-32 rounded-full" />
          <SkeletonBox className="h-8 w-28 rounded-full" />
          <SkeletonBox className="h-8 w-24 rounded-full" />
        </div>
        <SkeletonBox className="h-8 w-44" />
      </div>

      <ul className="flex flex-col gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            {/* `FixtureCard`'s three bands: the venue strip, the two clubs
                either side of the score, and the tally footer. Each keeps the
                card's own background so the skeleton reads as the same object
                rather than as a grey rectangle. */}
            <article className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="flex items-center justify-between gap-4 bg-surface-header px-4 py-2">
                <SkeletonLine className="text-caps w-40" />
                <SkeletonLine className="text-data w-16" />
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <SkeletonBox className="size-8 shrink-0" />
                  <SkeletonLine className="text-label md:text-heading w-full max-w-32" />
                </div>
                <SkeletonBox className="h-8 w-12" />
                <div className="flex min-w-0 items-center justify-end gap-3">
                  <SkeletonLine className="text-label md:text-heading w-full max-w-32" />
                  <SkeletonBox className="size-8 shrink-0" />
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-border bg-surface-alt px-4 py-2">
                <SkeletonLine className="text-caption w-20" />
                <SkeletonLine className="text-caption w-16" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Skeleton>
  )
}
