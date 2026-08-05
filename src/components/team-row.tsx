import Link from 'next/link'
import { verdictMix } from '@/lib/verdict-split'
import { Icon } from './icon'
import { CrestChip } from './crest-chip'
import { SplitBar } from './split-bar'
import type { TeamIndexRow } from '@/lib/teams-index'

/**
 * One club as a row in a list: crest, name, its competition, how many of its
 * players the reader has judged, the mix of what they gave them, and how many of
 * its matches they watched.
 *
 * `PlayerRow`'s club-shaped counterpart, and deliberately a separate component
 * rather than a widened one. The two share a silhouette but not a single field:
 * a shirt tile is a number in a club's colour where a crest is a club's letters,
 * a position column has no analogue, and the bar means a different thing on each
 * — `verdictSplit` there, `verdictMix` here. One component taking a union of the
 * two would be a longer file than both, and every prop would be optional.
 *
 * Only one screen draws it today. It is its own file because the row is what a
 * reader recognises across a product, and `PlayerRow` earned its extraction the
 * moment a second screen wanted it — this one starts where that one ended up.
 *
 * No `'use client'`. It holds no state, so it joins the bundle inside
 * `teams-browser` and would render on the server anywhere else. Nothing here
 * imports Prisma.
 */
export function TeamRow({ team, href }: { team: TeamIndexRow; href: string }) {
  const segments = verdictMix(team)

  return (
    <li>
      {/*
        The whole row is the link, because the chevron promises it is. Ink rather
        than the link colour and `no-underline` in both states: the base
        stylesheet styles every <a> as prose, which is right for a sentence and
        wrong for a row. `PlayerRow`'s reasoning, and its arrangement — two lines
        below `md`, one from `md` up, `min-h` so the touch height is a floor the
        row may grow past rather than a ceiling.
      */}
      <Link
        href={href}
        className="t-hover grid min-h-(--row-h-lg) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring md:grid-cols-[auto_minmax(0,1fr)_6rem_12rem_auto]"
      >
        {/* 40px, foundations' "crest mark, square" in a list — the size the
            scoreline gives it, and the size the drawing puts here. */}
        <CrestChip team={team} size="lg" />

        <span className="min-w-0">
          <span className="block truncate text-body font-medium">{team.name}</span>
          {/* A club with no competition draws nothing rather than an empty
              bullet — the club profile's own empty state, in a row. */}
          <span className="block truncate text-caption text-muted">{team.league}</span>
        </span>

        {/*
          The drawing's own column. Hidden below `md`, where the same fact is
          worth less than the width — `PlayerRow` hides its position column for
          the same reason rather than moving it under the name.

          "3 players" is what the drawing writes, and it is ambiguous on its own:
          it could be read as squad size. The visible text stays the drawing's,
          and the screen reader gets the whole of it.
        */}
        <span className="hidden text-caption text-muted md:block">
          <span className="text-data text-text">{team.players}</span>{' '}
          {team.players === 1 ? 'player' : 'players'}
          <span className="sr-only"> judged</span>
        </span>

        {/*
          `SplitBar` is aria-hidden and carries `CrestChip`'s contract, so the
          counts are stated here — otherwise they would leave the accessibility
          tree entirely and the row would announce a name and a number with
          nothing between them.

          The bar spans the full width on line two below `md`, and takes its own
          column at `md`.
        */}
        <span className="col-start-2 -col-end-1 md:col-start-4 md:col-end-auto">
          <SplitBar segments={segments} />
          <span className="sr-only">
            {team.mvps} MVP, {team.standouts} standout, {team.flops} flop
          </span>
        </span>

        <span className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 justify-self-end md:col-start-5 md:row-start-auto">
          <span className="text-data">{team.seen}</span>
          <span className="text-caption text-muted">seen</span>
          <Icon name="chevron_right" size="md" className="text-faint" />
        </span>
      </Link>
    </li>
  )
}
