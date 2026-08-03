import { positionLabel } from '@/lib/squad'
import { countVerdicts, verdictOf } from '@/lib/verdicts'
import { VerdictControls } from './verdict-controls'
import type { SquadEntry } from '@/lib/matches'

/**
 * One list of players: a club's starting eleven, or its bench.
 *
 * The same card as `FixtureCard` — a bordered surface with a header strip — so
 * the two screens read as one system. The fourth control the reference
 * screenshots draw on each row, `edit_note`, is 6.5's: a control that does
 * nothing is worse than no control.
 */

function Row({ entry }: { entry: SquadEntry }) {
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
    */
    <li className="grid min-h-(--row-h-lg) grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 md:grid-cols-[2rem_1fr_auto_auto]">
      <span className="text-right text-data text-muted">{entry.shirtNumber ?? '—'}</span>
      <span className="truncate text-body">{entry.player.name}</span>
      {position ? <span className="text-caps text-faint">{position}</span> : null}
      {/*
        `col-end-[-1]` is the last grid line whichever layout is in force, so one
        pair of classes covers both: below `md` the controls span columns 2–3 on
        a second row, and at `md` they are the fourth column of the first.
      */}
      <div className="col-start-2 col-end-[-1] justify-self-start md:col-start-4 md:justify-self-end">
        <VerdictControls
          matchSquadId={entry.id}
          playerName={entry.player.name}
          tag={verdictOf(entry)}
        />
      </div>
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
}

export function SquadPanel({ title, team, entries }: Props) {
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
          <Row key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}
