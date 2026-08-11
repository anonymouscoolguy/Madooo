import { Badge, VERDICT_BADGE } from './badge'
import { entryDate } from '@/lib/dates'
import type { JudgementTag } from '@/lib/verdicts'

/**
 * One judgement read back: the date it was written, what was said, and the note
 * underneath.
 *
 * The row itself, shared by the two screens that list judgements — `/diary`,
 * where the subject is the player, and a player profile, where it is the match.
 * What differs between them is one line of markup, so it arrives as `children`
 * rather than as a second copy of everything around it.
 *
 * Takes primitives rather than a query row: the two callers select different
 * shapes, and a component that named either would drag the other's query into
 * its types.
 */

type Props = {
  createdAt: Date
  tag: JudgementTag | null
  note: string | null
  /** The line beside the badge: a player, a fixture, or both. */
  children: React.ReactNode
}

export function JudgementEntry({ createdAt, tag, note, children }: Props) {
  // A tagless entry always has a note — the schema's CHECK constraint requires
  // one of the two, so there is no third case to draw.
  const badge = VERDICT_BADGE[tag ?? 'NOTE']

  return (
    /*
      A column below `md`, two columns from there up. The date is ~85px of
      monospace, which on a 320px screen leaves too little beside it for a player
      and a fixture — so it moves above rather than shrinking, which is
      foundations' rule for what a breakpoint is allowed to change.
    */
    <li className="flex flex-col gap-2 py-4 md:grid md:grid-cols-[auto_1fr] md:gap-x-6 md:gap-y-2">
      {/* A date is counted, not spoken, so it is monospaced. */}
      <span className="text-data uppercase text-muted">{entryDate(createdAt)}</span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Filled by default, and right to be: every entry in this list is a
            verdict that was applied. */}
        <Badge icon={badge.icon} label={tag ?? 'NOTE'} classes={badge.classes} />

        {children}
      </div>

      {note === null ? (
        // Said out loud rather than left blank, as the design draws it: a row
        // with nothing under it would read as a note that failed to load.
        <p className="text-body-lg text-faint italic md:col-start-2">No note — just the verdict.</p>
      ) : (
        // `whitespace-pre-line` keeps the line breaks that were typed — the
        // textarea allows them, so dropping them here would silently rewrite
        // what the reader wrote. `--text-body-lg` because foundations reserves
        // that role for exactly this: a note where it stands alone as prose.
        <p className="text-body-lg whitespace-pre-line md:col-start-2">{note}</p>
      )}
    </li>
  )
}
