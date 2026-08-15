import { Skeleton, SkeletonBox, SkeletonHeader, SkeletonLine, SkeletonTiles } from '@/components/skeleton'
import { SkeletonControls, SkeletonIndexList } from '@/components/skeleton-index'

/**
 * `/players` while its six queries run.
 *
 * **Drawn as the list layout, not the card grid, and that is not a coin toss.**
 * The layout is a `localStorage` preference read through `usePreference`, whose
 * server snapshot is `null`; `parseLayout(null)` is `'list'`, so the list is
 * what the server renders and what the first paint shows whichever way the
 * toggle is actually set. A grid skeleton would therefore be wrong for every
 * reader for one frame, and wrong for list readers permanently.
 */
export default function Loading() {
  return (
    <Skeleton>
      <SkeletonHeader />
      <SkeletonTiles />
      <SkeletonControls />
      <SkeletonIndexList>
        {/* `PlayerRow`'s grid: a shirt tile, the name over its club line, and
            the seen count pinned right. `min-h-(--row-h-lg)` is the row's own
            height token, so a skeleton row and a real one are the same height
            even before their contents are. */}
        <span className="grid min-h-(--row-h-lg) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_4rem_12rem_auto]">
          <SkeletonBox className="size-10 shrink-0" />
          <span className="min-w-0">
            <SkeletonLine className="text-body w-40 max-w-full" />
            <SkeletonLine className="text-caption mt-1 w-28 max-w-full" />
          </span>
          <SkeletonBox className="hidden h-3 w-8 md:block" />
          <span className="col-start-2 -col-end-1 md:col-start-4 md:col-end-auto">
            <SkeletonBox className="h-2 w-full" />
          </span>
          <span className="col-start-3 row-start-1 shrink-0 justify-self-end md:col-start-5 md:row-start-auto">
            <SkeletonLine className="text-data w-12" />
          </span>
        </span>
      </SkeletonIndexList>
    </Skeleton>
  )
}
