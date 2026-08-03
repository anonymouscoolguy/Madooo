import { positionLabel } from '@/lib/squad'
import type { SquadEntry } from '@/lib/matches'

/**
 * One list of players: a club's starting eleven, or its bench.
 *
 * The same card as `FixtureCard` — a bordered surface with a header strip — so
 * the two screens read as one system. Rows carry no controls yet: the three
 * verdict buttons and the note button in the reference screenshots are step 6.4,
 * and a control that does nothing is worse than no control.
 */

function Row({ entry }: { entry: SquadEntry }) {
  const position = positionLabel(entry.position)

  return (
    // `min-h` rather than a fixed height: 6.4 drops 32px controls into this row
    // and it will have to grow. The touch row height is the floor either way.
    //
    // A fixed 2rem first column keeps every shirt number on the same right edge
    // however many digits it has, which is the whole reason it is monospaced.
    <li className="grid min-h-(--row-h-lg) grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-2">
      <span className="text-right text-data text-muted">{entry.shirtNumber ?? '—'}</span>
      <span className="truncate text-body">{entry.player.name}</span>
      {position ? <span className="text-caps text-faint">{position}</span> : null}
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

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <h2 className="bg-surface-header px-4 py-2 text-caps">
        {team ? <span className="sr-only">{team} — </span> : null}
        {title}
      </h2>
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <Row key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}
