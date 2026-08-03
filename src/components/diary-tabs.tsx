import Link from 'next/link'
import { DIARY_FILTERS, type DiaryFilter } from '@/lib/diary-filters'

/**
 * The diary's filter row: All, MVPs, Standouts, Flops, With notes.
 *
 * **The selected filter lives in the URL**, and that one choice is what keeps
 * `/diary` a server component — the same reasoning as the matchday pager. These
 * are links, no JavaScript ships, and a filtered diary can be bookmarked and
 * reached with the back button.
 *
 * Which one is on arrives as a prop rather than being read from the location,
 * because the page has already parsed the parameter to run its query. Asking a
 * second time, in a client hook, would give the answer two sources.
 *
 * The pill styling is [`league-tabs.tsx`](./league-tabs.tsx)'s, unchanged:
 * 28px and `rounded-full`, which foundations grants to exactly two things, of
 * which a pill tab is one.
 */
export function DiaryTabs({ current }: { current: DiaryFilter }) {
  return (
    // Wraps below `md` rather than scrolling sideways: five pills need ~420px
    // and a phone has less, and a horizontal scroller hides its own overflow.
    <nav aria-label="Filter" className="mb-6 flex flex-wrap items-center gap-1">
      {DIARY_FILTERS.map((filter) =>
        filter.slug === current.slug ? (
          // Not a link to the page you are on. `aria-current` says what the
          // fill already says visually.
          <span
            key={filter.slug}
            aria-current="page"
            className="inline-flex h-7 items-center rounded-full bg-surface-inverse px-4 text-label text-inverse"
          >
            {filter.label}
          </span>
        ) : (
          <Link
            key={filter.slug}
            href={`/diary?filter=${filter.slug}`}
            // Muted going to full ink on hover, which is foundations' rule for
            // muted text, and `no-underline` in both states because the base
            // stylesheet's link treatment is right for prose and wrong for a tab.
            className="t-hover inline-flex h-7 items-center rounded-full px-4 text-label text-muted no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring"
          >
            {filter.label}
          </Link>
        ),
      )}
    </nav>
  )
}
