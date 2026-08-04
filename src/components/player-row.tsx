import Link from 'next/link'
import { verdictSplit, type VerdictCounts } from '@/lib/verdict-split'
import { Icon } from './icon'
import { ShirtTile } from './shirt-tile'
import { SplitBar } from './split-bar'
import type { TeamIdentity } from '@/lib/teams/identity'

/**
 * One player as a row in a list: shirt tile, name, a subtitle, his position, the
 * split of what he has been given, and how many matches he was seen in.
 *
 * Two screens draw it — the players index and a club's squad — and they differ
 * in one line, so `subtitle` is the caller's and everything else is fixed here.
 * The index puts his club and position under the name; a club's squad already
 * names the club in its own header, so it puts what he has been judged. One
 * component rather than two copies, for the reason `PageHeader` and `StatTiles`
 * are one: two lists that are meant to be the same row cannot drift apart if
 * there is only one of them.
 *
 * No `'use client'`. It holds no state, so it renders on the server inside a
 * club's squad and joins the bundle inside `players-browser`, which is a client
 * component. Nothing here imports Prisma — `VerdictCounts` and `TeamIdentity`
 * are structural, and `import type` is erased.
 */
export function PlayerRow({
  href,
  team,
  shirtNumber,
  name,
  subtitle,
  position,
  counts,
}: {
  href: string
  team: TeamIdentity | null
  shirtNumber: number | null
  name: string
  subtitle: React.ReactNode
  /** Already expanded — `GK`, `DEF`, `MID`, `FWD` — or null, which draws nothing. */
  position: string | null
  /** `watched` is his `seen`: the bar is a proportion of the matches he was in. */
  counts: VerdictCounts
}) {
  const segments = verdictSplit(counts)

  return (
    <li>
      {/*
        The whole row is the link, because the chevron promises it is. Ink rather
        than the link colour and `no-underline` in both states: the base
        stylesheet styles every <a> as prose, which is right for a sentence and
        wrong for a row.

        Two lines below `md`, one from `md` up. The reference is desktop-only, so
        the narrow arrangement is a decision: at 320px a single line leaves no
        room for a bar between a name and a count. `min-h` rather than a fixed
        height, 6.3's choice — the touch row height is a floor the row may grow
        past.
      */}
      <Link
        href={href}
        className="t-hover grid min-h-(--row-h-lg) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring md:grid-cols-[auto_minmax(0,1fr)_4rem_12rem_auto]"
      >
        <ShirtTile team={team} shirtNumber={shirtNumber} size="sm" />

        <span className="min-w-0">
          <span className="block truncate text-body font-medium">{name}</span>
          <span className="block truncate text-caption text-muted">{subtitle}</span>
        </span>

        {/* The drawing's own position column. Hidden below `md`, where the same
            fact is either under the name or not worth the width. */}
        <span className="hidden text-caps text-faint md:block">{position}</span>

        {/*
          The bar spans the full width on line two below `md`, and takes its own
          column at `md`. `SplitBar` is aria-hidden, so the counts are stated
          here — otherwise they would leave the accessibility tree entirely, and
          the row would announce a name and a number with nothing between them.
        */}
        <span className="col-start-2 -col-end-1 md:col-start-4 md:col-end-auto">
          <SplitBar segments={segments} />
          <span className="sr-only">
            {counts.mvps} MVP, {counts.standouts} standout, {counts.flops} flop
          </span>
        </span>

        <span className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 justify-self-end md:col-start-5 md:row-start-auto">
          <span className="text-data">{counts.watched}</span>
          <span className="text-caption text-muted">seen</span>
          <Icon name="chevron_right" size="md" className="text-faint" />
        </span>
      </Link>
    </li>
  )
}
