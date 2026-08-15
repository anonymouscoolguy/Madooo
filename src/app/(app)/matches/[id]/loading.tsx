import { Skeleton, SkeletonBox, SkeletonLine } from '@/components/skeleton'

/**
 * `/matches/[id]` while the match and both squads are read.
 *
 * The one screen whose fallback is worth the most, because it is the screen the
 * app is for: a fixture card is the thing a reader clicks, and this is what they
 * wait on. It is also a single query returning ~40 squad rows, so there is one
 * round trip to cover rather than a staggered handful.
 *
 * No page header — this screen opens on the scoreline card instead, which is
 * `ScorelineCard`'s own `<header className="mb-8">` with a back link above it.
 */

/**
 * One club's half: the starting eleven over the bench, in the nested column the
 * page uses so the two clubs stack whole below `md` rather than interleaving.
 *
 * `md:grid-rows-subgrid` and the row span are copied from `TeamSquad` — without
 * them the two benches stop starting at the same height, which is the one thing
 * the real page's layout comment says this structure exists to buy.
 */
function SkeletonSquad() {
  return (
    <div className="flex flex-col gap-4 md:row-span-2 md:grid md:grid-rows-subgrid md:items-start">
      {[11, 9].map((count, panel) => (
        <section
          key={panel}
          className="overflow-hidden rounded-md border border-border bg-surface"
        >
          <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
            <SkeletonLine className="text-caps w-36" />
          </header>
          <ul className="divide-y divide-border">
            {Array.from({ length: count }, (_, i) => (
              <li
                key={i}
                className="flex min-h-(--row-h-lg) items-center gap-3 px-4 py-3"
              >
                <SkeletonBox className="size-8 shrink-0" />
                <SkeletonLine className="text-body w-40 max-w-full" />
                <span className="ml-auto flex shrink-0 gap-1">
                  <SkeletonBox className="size-8 rounded-sm" />
                  <SkeletonBox className="size-8 rounded-sm" />
                  <SkeletonBox className="size-8 rounded-sm" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function Loading() {
  return (
    <Skeleton>
      <header className="mb-8">
        <SkeletonLine className="text-body mb-4 w-36" />

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {/* The facts strip: competition, ground, date, referee, centred and
              wrapping rather than shrinking. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-surface-header px-4 py-2 md:gap-x-6">
            <SkeletonLine className="text-caption w-28" />
            <SkeletonLine className="text-caption w-32" />
            <SkeletonLine className="text-caption w-24" />
            <SkeletonLine className="text-caption w-28" />
          </div>

          {/* The two clubs either side of the score — stacked below `md`,
              because a 320px line leaves about 136px for two club names. */}
          <div className="flex flex-col items-center gap-3 px-4 py-5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
            <span className="flex items-center gap-3 md:justify-self-end">
              <SkeletonBox className="size-10 shrink-0" />
              <SkeletonLine className="text-heading w-32" />
            </span>
            <SkeletonBox className="h-10 w-20" />
            <span className="flex items-center gap-3 md:justify-self-start">
              <SkeletonLine className="text-heading w-32" />
              <SkeletonBox className="size-10 shrink-0" />
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 md:grid-rows-[auto_auto] md:gap-x-6">
        <SkeletonSquad />
        <SkeletonSquad />
      </div>
    </Skeleton>
  )
}
