import { SkeletonBox, SkeletonLine } from './skeleton'

/**
 * The two pieces `/players` and `/teams` draw identically.
 *
 * The indexes are two screens over two different things, but their chrome is one
 * design: the same control row, and the same bordered list under it. 7.5 built
 * the club index that way deliberately — "so the two grids read as one system
 * rather than as two" — so their fallbacks share a file for the same reason the
 * screens share a shape. What differs is a row's own contents, which each
 * `loading.tsx` passes in.
 */

/**
 * The filter row: a search field, two selects and the layout toggle.
 *
 * The heights are `--control-h-lg` below `md` and `--control-h` above, which is
 * what `SearchField`, `SelectField` and `LayoutToggle` each set on themselves.
 * Written as the same arbitrary-property classes rather than as numbers, so a
 * retuned control height moves the skeleton with it.
 *
 * The search field takes the whole first line below `md` and shares the row from
 * there up — `basis-full md:basis-0 md:grow`, copied off the real one, because
 * this is the wrap that decides whether the row is one line or two.
 */
export function SkeletonControls() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 md:gap-3">
      <SkeletonBox className="h-(--control-h-lg) basis-full rounded-md md:h-(--control-h) md:basis-0 md:grow" />
      <SkeletonBox className="h-(--control-h-lg) grow rounded-md md:h-(--control-h) md:w-44 md:grow-0" />
      <SkeletonBox className="h-(--control-h-lg) grow rounded-md md:h-(--control-h) md:w-44 md:grow-0" />
      <SkeletonBox className="size-(--control-h-lg) shrink-0 rounded-md md:size-(--control-h)" />
    </div>
  )
}

/**
 * The bordered list both indexes draw in their default layout: a strip carrying
 * the current sort and the count, over rows divided by a hairline.
 *
 * `children` is one row, rendered `rows` times. A React element is an immutable
 * description rather than a mounted thing, so repeating one is not sharing
 * state — and it keeps each caller writing its row once.
 *
 * **Eight rows, which is a drawing decision and not a prediction.** Both indexes
 * page in a batch at a time and hold hundreds of entries, so the real list is
 * always longer than this; eight fills a first screen without the fallback
 * running so far down that replacing it visibly collapses the page.
 */
export function SkeletonIndexList({
  children,
  rows = 8,
}: {
  children: React.ReactNode
  rows?: number
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
        <SkeletonLine className="text-caps w-32" />
        <SkeletonLine className="text-data w-8" />
      </header>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i}>{children}</li>
        ))}
      </ul>
    </section>
  )
}
