import Link from 'next/link'
import { Icon } from './icon'
import { entryDate } from '@/lib/dates'
import type { IconName } from './icon-names'
import type { DiaryEntry as Entry } from '@/lib/diary'
import type { JudgementTag } from '@/lib/verdicts'

/**
 * One diary entry: the date it was written, what was said, the player and the
 * fixture, and the note underneath.
 *
 * The player's name is plain text and not the link the reference screenshot
 * would suggest — 7.2 is the player profile it would point at, and it does not
 * exist yet. The scoreline beside it *is* a link, which is the one departure
 * from the drawing: a diary that cannot reach the match it judges is a dead end.
 */

/**
 * **A fourth badge over a three-value enum.** `NOTE` is not a `JudgementTag` and
 * never reaches the database — it is how a judgement that carries a note and no
 * tag is drawn, which 6.5 made a valid row and the reference screenshots have no
 * example of. It takes the informational blue for the same reason the Notes tile
 * does: a note is not a verdict.
 *
 * Written out per key rather than composed, for the reason Tailwind forces: it
 * finds class names by scanning source text, so a name assembled at runtime
 * never reaches the stylesheet. The three tags reuse the selected-chip
 * vocabulary from [`verdict-controls.tsx`](./verdict-controls.tsx) exactly.
 */
type BadgeKey = JudgementTag | 'NOTE'

const BADGE: Record<BadgeKey, { icon: IconName; classes: string }> = {
  MVP: { icon: 'star', classes: 'border-mvp bg-mvp-bg text-mvp' },
  STANDOUT: { icon: 'trending_up', classes: 'border-standout bg-standout-bg text-standout' },
  FLOP: { icon: 'trending_down', classes: 'border-flop bg-flop-bg text-flop' },
  NOTE: { icon: 'edit_note', classes: 'border-info bg-info-bg text-info' },
}

export function DiaryEntry({ entry }: { entry: Entry }) {
  const { match, player } = entry.matchSquad

  // A tagless entry always has a note — the schema's CHECK constraint requires
  // one of the two, so there is no third case to draw.
  const badge = BADGE[entry.tag ?? 'NOTE']

  // Null goals means no result recorded, not a goalless draw — the same reading
  // `FixtureCard` and the match page take.
  const scoreline =
    match.homeGoals === null || match.awayGoals === null
      ? `${match.homeTeam.name} v ${match.awayTeam.name}`
      : `${match.homeTeam.name} ${match.homeGoals}–${match.awayGoals} ${match.awayTeam.name}`

  return (
    /*
      A column below `md`, two columns from there up. The date is ~85px of
      monospace, which on a 320px screen leaves too little beside it for a player
      and a fixture — so it moves above rather than shrinking, which is
      foundations' rule for what a breakpoint is allowed to change.
    */
    <li className="flex flex-col gap-2 py-4 md:grid md:grid-cols-[auto_1fr] md:gap-x-6 md:gap-y-2">
      {/* A date is counted, not spoken, so it is monospaced. */}
      <span className="text-data uppercase text-muted">{entryDate(entry.createdAt)}</span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 28px, the chip height — this is the same object as a selected verdict
            chip, read back. `filled` because FILL 1 means "on", and every entry
            in this list is a verdict that was applied. */}
        <span
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-caps ${badge.classes}`}
        >
          <Icon name={badge.icon} size="sm" filled />
          {entry.tag ?? 'NOTE'}
        </span>

        {/* Not truncated. A diary should show the whole of a name it was trusted
            with, so a long one wraps instead. */}
        <span className="text-body">
          {player.name} ·{' '}
          {/* Ink rather than the link colour, as the design draws it. The
              underline the base stylesheet adds on hover is left in place, and
              is the whole of the affordance — a blue half-sentence in the middle
              of every row would be the louder thing on the page. */}
          <Link
            href={`/matches/${match.id}`}
            className="rounded-sm text-text focus-visible:focus-ring"
          >
            {scoreline}
          </Link>
        </span>
      </div>

      {entry.note === null ? (
        // Said out loud rather than left blank, as the design draws it: a row
        // with nothing under it would read as a note that failed to load.
        <p className="text-body-lg text-faint italic md:col-start-2">No note — just the verdict.</p>
      ) : (
        // `whitespace-pre-line` keeps the line breaks that were typed — the
        // textarea allows them, so dropping them here would silently rewrite
        // what the reader wrote. `--text-body-lg` because foundations reserves
        // that role for exactly this: a note where it stands alone as prose.
        <p className="text-body-lg whitespace-pre-line md:col-start-2">{entry.note}</p>
      )}
    </li>
  )
}
