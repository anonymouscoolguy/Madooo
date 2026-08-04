import Link from 'next/link'
import { playerHref } from '@/lib/back'
import { positionLabel } from '@/lib/squad'
import { countVerdicts, noteOf, verdictOf } from '@/lib/verdicts'
import { PlayerControls } from './player-controls'
import { VerdictControls } from './verdict-controls'
import type { SquadEntry } from '@/lib/matches'

/**
 * One list of players: a club's starting eleven, or its bench.
 *
 * The same card as `FixtureCard` — a bordered surface with a header strip — so
 * the two screens read as one system. The header's count is verdicts only: a
 * note is not a verdict, and a player carrying nothing but a note is not part
 * of it.
 */

function Row({ entry, matchId }: { entry: SquadEntry; matchId: number }) {
  const position = positionLabel(entry.position)

  return (
    /*
      Two lines below `md`, one line at `md` and up.

      The reference screens are desktop-only, so this arrangement is a decision
      rather than a drawing, and the numbers force it: at 320px a single row
      leaves about 88px for a name, which truncates "Gabriel Magalhães" to
      nothing useful. Foundations' rule is that layout changes arrangement at a
      breakpoint rather than scaling, so the controls drop to their own line and
      grow to a thumb-sized 40px instead of shrinking to fit.

      `min-h` rather than a fixed height, which is what 6.3 chose it for: the
      touch row height is the floor, and the row is now free to grow past it.

      A fixed 2rem first column keeps every shirt number on the same right edge
      however many digits it has, which is the whole reason it is monospaced.

      **Which column takes the free space is what places the position label.** At
      `md` it is the position's own column, so the name is sized to its content
      and the label sits directly beside it, as the design draws it. Below `md`
      it is the name's, which pushes the label to the right-hand edge — right
      there, because the controls have moved off this line and the edge is empty.
      The name truncates in both, since `truncate` sets `overflow: hidden` and a
      grid item with that can shrink below its own content.
    */
    <li className="grid min-h-(--row-h-lg) grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 md:grid-cols-[2rem_auto_1fr_auto]">
      <span className="text-right text-data text-muted">{entry.shirtNumber ?? '—'}</span>
      {/*
        Still one grid child, which the column template depends on — `truncate`
        moves onto the link itself rather than a wrapper, or the position label's
        placement at `md` shifts by a column. Ink rather than the link colour, as
        the design draws it; the base stylesheet's hover underline is the whole
        of the affordance.
      */}
      <Link
        href={playerHref(entry.player.id, `/matches/${matchId}`)}
        className="truncate rounded-sm text-body text-text focus-visible:focus-ring"
      >
        {entry.player.name}
      </Link>
      {position ? <span className="text-caps text-faint">{position}</span> : null}
      {/*
        Two grid children, not one: the controls, and — when there is a note —
        the line it reads back on. `PlayerControls` places both, because the two
        share one piece of optimistic state; see its own comment.
      */}
      <PlayerControls
        matchSquadId={entry.id}
        playerName={entry.player.name}
        note={noteOf(entry)}
      >
        <VerdictControls
          matchSquadId={entry.id}
          playerName={entry.player.name}
          tag={verdictOf(entry)}
        />
      </PlayerControls>
    </li>
  )
}

type Props = {
  /** The visible micro-label, exactly as the design draws it. */
  title: string
  /**
   * Named for a screen reader when the visible title does not name the club.
   * Below `md` the panels stack, and a bare "SUBSTITUTES" heading is then
   * attached to nothing.
   */
  team?: string
  entries: SquadEntry[]
  /**
   * Where a player profile opened from this panel sends the reader back. A
   * prop rather than a field on the row: `SquadEntry` carries no `matchId`, and
   * the page it is drawn on knows perfectly well which match it is.
   */
  matchId: number
}

export function SquadPanel({ title, team, entries, matchId }: Props) {
  if (entries.length === 0) return null

  const verdicts = countVerdicts(entries)

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      {/*
        The count sits beside the heading rather than inside it. Inside, it would
        become part of the heading's accessible name — "Manchester United —
        Starting XI 3" — which reads as a squad numbered 3.
      */}
      <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
        <h2 className="truncate text-caps">
          {team ? <span className="sr-only">{team} — </span> : null}
          {title}
        </h2>
        {/* Zero is shown, not hidden: the screenshots draw `0` on both benches,
            and a number that disappears reads as something failing to load. */}
        <span className="shrink-0 text-data text-muted">
          {verdicts}
          <span className="sr-only"> verdicts</span>
        </span>
      </header>
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <Row key={entry.id} entry={entry} matchId={matchId} />
        ))}
      </ul>
    </section>
  )
}
