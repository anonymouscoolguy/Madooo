import { Skeleton, SkeletonBox, SkeletonHeader, SkeletonLine, SkeletonTiles } from '@/components/skeleton'

/**
 * `/diary` while its two queries run.
 *
 * The screen is a header, the four season tiles, the filter tabs, then the
 * entries grouped under a month rule. One month's worth is drawn: the grouping
 * is by when each entry was *written*, so how many months a diary spans is not
 * knowable before it has been read, and a second rule under a fallback would
 * assert a shape the data may not have.
 */
export default function Loading() {
  return (
    <Skeleton>
      <SkeletonHeader />
      <SkeletonTiles />

      {/* `TabStrip`'s row: the filter names on one line, each the height of a
          large control and sitting on the underline that marks the current one.

          Four tabs written out rather than mapped over a list of widths, for the
          reason `skeleton.tsx` gives about `className`: a width assembled into a
          template literal is a name Tailwind may never see as text. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6">
        <span className="inline-flex h-(--control-h-lg) items-center">
          <SkeletonBox className="h-3 w-16" />
        </span>
        <span className="inline-flex h-(--control-h-lg) items-center">
          <SkeletonBox className="h-3 w-14" />
        </span>
        <span className="inline-flex h-(--control-h-lg) items-center">
          <SkeletonBox className="h-3 w-12" />
        </span>
        <span className="inline-flex h-(--control-h-lg) items-center">
          <SkeletonBox className="h-3 w-14" />
        </span>
      </div>

      <section className="mb-8 last:mb-0">
        {/* The month heading: the label, a rule taking whatever width is left,
            and the count of what is under it in its own sunken chip. */}
        <div className="flex items-center gap-3">
          <SkeletonLine className="text-caps w-28" />
          <span className="flex-1 border-t border-border" />
          <SkeletonBox className="h-5 w-8 rounded-sm" />
        </div>

        {/* `JudgementEntry`'s row: the date in its own column at `md`, the
            player and verdict beside it, and the note under both. */}
        <ul className="divide-y divide-border border-b border-border">
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 py-4 md:grid md:grid-cols-[auto_1fr] md:gap-x-6 md:gap-y-2"
            >
              <SkeletonLine className="text-data w-24" />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SkeletonLine className="text-body w-40" />
                <SkeletonBox className="h-5 w-20 rounded-sm" />
              </div>
              <SkeletonLine className="text-body-lg w-3/4 md:col-start-2" />
            </li>
          ))}
        </ul>
      </section>
    </Skeleton>
  )
}
