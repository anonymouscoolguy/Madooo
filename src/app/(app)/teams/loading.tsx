import { Skeleton, SkeletonBox, SkeletonHeader, SkeletonLine } from '@/components/skeleton'
import { SkeletonControls, SkeletonIndexList } from '@/components/skeleton-index'

/**
 * `/teams` while its five queries run.
 *
 * **No tile row, and that is the screen rather than an omission.** `/teams` is
 * the one index that opens straight onto its controls: 7.5 settled that a club
 * list has no four numbers of its own to report, since the tallies a reader
 * cares about belong to a club and not to the set of them.
 *
 * The list layout for the reason `/players`' fallback gives: the layout is a
 * `localStorage` preference whose server snapshot is `null`, and
 * `parseLayout(null)` is `'list'`, so the list is what the first paint shows
 * however the toggle is set.
 */
export default function Loading() {
  return (
    <Skeleton>
      <SkeletonHeader />
      <SkeletonControls />
      <SkeletonIndexList>
        {/* `TeamRow`'s grid, which is `PlayerRow`'s with a wider fourth column —
            a crest chip, the club over its competition, and the seen count
            pinned right. */}
        <span className="grid min-h-(--row-h-lg) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_6rem_12rem_auto]">
          <SkeletonBox className="size-10 shrink-0" />
          <span className="min-w-0">
            <SkeletonLine className="text-body w-44 max-w-full" />
            <SkeletonLine className="text-caption mt-1 w-32 max-w-full" />
          </span>
          <SkeletonBox className="hidden h-3 w-16 md:block" />
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
