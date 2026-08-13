/**
 * The league row: which competition the screen is drawn for.
 *
 * **The second of the app's two tab vocabularies.** An underline tab changes the
 * view of the screen you are on — that is [`tab-strip.tsx`](./tab-strip.tsx). A
 * pill chooses the *scope the server drew the page for*, which is this. The
 * distinction is `foundations.md`'s, and its own test is what the control
 * changes: a pill never appears in a filter row, and a select never decides what
 * the server queried.
 *
 * It extends `TabStrip`'s own `Tab` rather than declaring a type of its own. The
 * two differ in rendering rule, not in what a tab is, and building on the type
 * is what keeps that true — a league tab is a tab *plus* the one fact its mark
 * reads. The country goes here rather than into `Tab` because a view tab has no
 * use for it, and `TabStrip` should not carry a field it ignores. Which pill is
 * on arrives as a prop for `TabStrip`'s reason: the page has already parsed the
 * parameter to run its query, and asking again in a client hook would give the
 * answer two sources.
 *
 * One league in the database draws one selected pill and nothing beside it.
 * That is correct rather than degenerate — a scope with a single option is still
 * a fact about the page.
 */

import Link from 'next/link'
import { LeagueFlag } from './league-flag'
import type { Tab } from './tab-strip'

export interface LeagueTab extends Tab {
  /** `League.country` — the one fact a league tab carries that a view tab does not. */
  country: string
}

export function LeagueTabs({ tabs }: { tabs: readonly LeagueTab[] }) {
  return (
    <nav aria-label="League" className="flex flex-wrap items-center gap-1">
      {tabs.map((tab) =>
        tab.current ? (
          /*
            Not a link to the scope you are already in, the same rule `TabStrip`
            follows. `aria-current` says what the fill says visually.

            28px and rounded-full: foundations gives the pill tab that height,
            and --radius-pill belongs to exactly two things, of which this is
            one.
          */
          <span
            key={tab.href}
            aria-current="page"
            className="inline-flex h-7 items-center gap-2 rounded-full bg-surface-inverse px-4 text-label text-inverse"
          >
            {/* The label needs no wrapper: flexbox makes a contiguous run of
                text an anonymous flex item, and `gap` applies between one of
                those and an element exactly as between two elements. */}
            <LeagueFlag league={tab} />
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            // foundations draws the pill selected and disabled but never
            // unselected, so this state is set here: muted going to full ink on
            // a --surface-alt fill, which is the treatment `TabStrip`'s inactive
            // tab and the pager's arrows already use for chrome links.
            // `no-underline` in both states because the base stylesheet gives
            // every <a> the link colour and a hover underline, right for prose
            // and wrong inside a pill.
            className="t-hover inline-flex h-7 items-center gap-2 rounded-full px-4 text-label text-muted no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring"
          >
            <LeagueFlag league={tab} />
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  )
}
