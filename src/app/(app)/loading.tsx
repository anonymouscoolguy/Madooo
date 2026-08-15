import { Skeleton, SkeletonHeader, SkeletonTiles } from '@/components/skeleton'

/**
 * The fallback for any route in the group without one of its own.
 *
 * Next nests `loading.tsx` inside the segment's layout and wraps everything
 * below it — the page, and any nested layout — in a `<Suspense>` boundary, so
 * this one covers the whole `(app)` group and each route's own file overrides it
 * where it exists.
 *
 * **Today that means the two profile screens**, `/players/[id]` and
 * `/teams/[id]`, and a header over a tile row is close to right for both: each
 * opens with a name, four tallies and a list of entries. They can take files of
 * their own if that stops being close enough — the point of the shared one is
 * that a new route under `(app)` is never left with no fallback at all, which is
 * the state every route was in before this.
 */
export default function Loading() {
  return (
    <Skeleton>
      <SkeletonHeader />
      <SkeletonTiles />
    </Skeleton>
  )
}
