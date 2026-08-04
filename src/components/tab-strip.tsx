import Link from 'next/link'

/**
 * The app's tab strip: switching the view of the screen you are already on.
 *
 * **Two tab vocabularies, and this is one of them.** `foundations.md` lists a
 * 40px `--control-h-lg` "tab" and a 28px "pill tab" as separate controls; the
 * rule between them is what this component and [`league-tabs.tsx`](./league-tabs.tsx)
 * now divide up. An underline tab changes the *view* of the current screen — the
 * diary's filter, a player's Diary or Notes. A pill chooses the *scope* the
 * screen is drawn for, which so far is only the league row.
 *
 * **The underline sits under the selected tab alone, with no rule spanning the
 * strip.** That is how the reference screenshot draws it, and it is also what
 * lets the strip wrap: a continuous rule under a strip that had wrapped would
 * underline only the last row, leaving the selected tab on the first row
 * detached from it. Wrapping rather than scrolling sideways is 7.1's decision,
 * kept — a horizontal scroller hides its own overflow.
 *
 * Which tab is on arrives as a prop rather than being read from the location,
 * because every caller has already parsed the parameter to run its query.
 * Asking again in a client hook would give the answer two sources.
 */

export type Tab = {
  href: string
  label: string
  current: boolean
}

export function TabStrip({ label, tabs }: { label: string; tabs: readonly Tab[] }) {
  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap items-center gap-x-6">
      {tabs.map((tab) =>
        tab.current ? (
          /*
            Not a link to the page you are already on. `aria-current` says what
            the underline says visually.

            `border-text` rather than `border-border-focus`: the two resolve to
            the same value in both themes, but only one of them is honest about
            why — this is the selected mark in ink, not a focus ring.
          */
          <span
            key={tab.href}
            aria-current="page"
            className="inline-flex h-(--control-h-lg) items-center border-b-2 border-text text-label text-text"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            // Muted going to full ink on hover, foundations' rule for muted text.
            // `no-underline` in both states because the base stylesheet gives
            // every <a> the link colour and a hover underline, which is right for
            // prose and wrong for a tab — and here it would collide with the
            // selected tab's own underline.
            className="t-hover inline-flex h-(--control-h-lg) items-center border-b-2 border-transparent text-label text-muted no-underline hover:border-border-strong hover:text-text hover:no-underline focus-visible:focus-ring"
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  )
}
