/**
 * The pieces every `loading.tsx` is built from.
 *
 * A skeleton exists so a click changes the screen at once instead of leaving the
 * previous page up while the server works. Next swaps it for the real page as
 * soon as the queries land, so the one thing it must get right is **geometry**:
 * a fallback whose boxes sit where the content will sit reads as the page
 * arriving, and one whose boxes sit anywhere else reads as the page jumping.
 *
 * Two rules from [`foundations.md`](../../docs/design/foundations.md) bind here
 * and are worth naming, because both are easy to break by reflex:
 *
 *   - **Nothing animates.** No pulse, no shimmer. The motion inventory is
 *     closed, and it says so: "no skeleton choreography". A static block is also
 *     the honest thing — a shimmer implies progress nobody is measuring.
 *   - **No hex, no raw px.** Blocks are `--surface-alt`, one step off the
 *     surface they sit on, and their heights come from the type roles below
 *     rather than from numbers.
 */

/**
 * One block standing in for one line of text.
 *
 * **The height is the type role's own line box, not a number.** The role class
 * is applied to a block containing a non-breaking space, so the box comes out
 * exactly as tall as the line it replaces — `text-title` is 24px over a 1.25
 * line-height whether or not anyone here knows that, and it stays right if the
 * scale is ever retuned.
 *
 * `className` is one string passed whole rather than a `role` prop assembled
 * inside, for the reason `stat-tiles.tsx` states about its `ink` field:
 * **Tailwind finds class names by scanning source as text**, so a name built at
 * runtime is one it never sees. Every caller writes its roles out in full.
 */
export function SkeletonLine({ className }: { className: string }) {
  return <span className={`block rounded-sm bg-surface-alt ${className}`}>&nbsp;</span>
}

/**
 * A block standing in for something that is not text — a crest chip, a shirt
 * tile, a control. Sized by the caller, since there is no type role to inherit.
 */
export function SkeletonBox({ className }: { className: string }) {
  return <span className={`block rounded-sm bg-surface-alt ${className}`} />
}

/**
 * The wrapper every `loading.tsx` returns.
 *
 * **A screen reader is told a state, not read a dozen empty boxes.** The blocks
 * carry no text, so without this they announce as nothing at all — the fallback
 * would be silence between the click and the content. `role="status"` with a
 * single `sr-only` line says the one true thing instead, and `aria-hidden` on
 * the visual half keeps the boxes out of the accessibility tree.
 */
export function Skeleton({ children }: { children: React.ReactNode }) {
  return (
    <div role="status">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/**
 * The page header: a title, and the sentence under it.
 *
 * The wrapper's `mb-8` is `PageHeader`'s own, copied rather than approximated —
 * the whole value of a skeleton is that the content does not move when it is
 * replaced, and matching the spacing by eye is how that goes wrong.
 */
export function SkeletonHeader() {
  return (
    <header className="mb-8">
      <SkeletonLine className="text-title w-48" />
      <SkeletonLine className="text-body mt-2 w-2/3 max-w-md" />
    </header>
  )
}

/**
 * The four stat tiles.
 *
 * `StatTiles`' own grid and card classes, so the row is the same height and the
 * same four boxes in the same places at every width. The number inside is
 * `text-stat` — 32px of monospace — which is most of a tile's height and the
 * reason a tile skeleton cannot be a plain square.
 *
 * Four `<li>`s written as a loop over a fixed-length array rather than four
 * copies: the count is `StatTiles`' constant too, and every screen that has
 * tiles has exactly four.
 */
export function SkeletonTiles() {
  return (
    <ul className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="rounded-md border border-border bg-surface p-4">
          <SkeletonLine className="text-caps w-20" />
          <SkeletonLine className="text-stat mt-2 w-12" />
        </li>
      ))}
    </ul>
  )
}
