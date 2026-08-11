import { Badge, VERDICT_BADGE } from './badge'
import { ShirtTile } from './shirt-tile'
import type { IconName } from './icon-names'

/**
 * The mock match card the landing page's hero is drawn beside: four players out
 * of a fixture that was never played, judged the way the app judges them.
 *
 * **It is fiction, and it has to be.** `/` is the one route that prerenders, and
 * it stays that way by touching no database at all — a signed-out visitor has no
 * diary to show, and a stranger's would be private. So the rows are a constant
 * in this file rather than a query, and the result is invented.
 *
 * Not `SquadPanel`, for the same reason: that component's types are shaped by
 * the match page's query, and naming them here would drag Prisma onto a page
 * that must never reach it. What the two do share is the objects — the card, the
 * header strip, the shirt tile, the note's rule and the badge are all the app's
 * own, so what a visitor is shown is what they will get.
 *
 * The positions read `FWD`/`MID`/`DEF` rather than the drawing's `RW`/`CM`/`CB`.
 * The finer position is in no provider response, so the app has never had one to
 * show; a landing page promising a detail the product cannot render would be
 * advertising the mock rather than the app. Same decision as 6.3, 6.3b and 7.2.
 */

/**
 * `UNRATED` exists in no enum: the app has no such state, because an unrated
 * player is simply one carrying no judgement, and the match page draws that as
 * three chips nobody has pressed. It exists here because a card showing only
 * judged players would misrepresent what a real one looks like — most players
 * stay unrated — and because the fourth row is what the "Left blank" line is for.
 *
 * Its badge is foundations' resting chip exactly: outlined and muted. It carries
 * no glyph, because the three verdicts own the three glyphs and there is none
 * for the absence of a verdict — foundations' own instruction for that case is
 * to use a word.
 */
const UNRATED = { classes: 'border-border text-muted' } as const

type Row = {
  shirtNumber: number
  name: string
  position: string
  note: string | null
  /** A `VERDICT_BADGE` entry or `UNRATED`, plus the word and the fill state. */
  badge: { icon?: IconName; label: string; classes: string; filled: boolean }
}

const ROWS: Row[] = [
  {
    shirtNumber: 7,
    name: 'Bukayo Saka',
    position: 'FWD',
    note: 'Beat his man every time one-on-one.',
    badge: { ...VERDICT_BADGE.STANDOUT, label: 'STANDOUT', filled: true },
  },
  {
    shirtNumber: 41,
    name: 'Declan Rice',
    position: 'MID',
    note: 'Ran the game from deep. Never gave it away.',
    badge: { ...VERDICT_BADGE.MVP, label: 'MVP', filled: true },
  },
  {
    shirtNumber: 11,
    name: 'Robert Peyras',
    position: 'FWD',
    note: 'Dispossessed multiple times, could have done more.',
    badge: { ...VERDICT_BADGE.FLOP, label: 'FLOP', filled: true },
  },
  {
    shirtNumber: 17,
    name: 'Cristian Romero',
    position: 'DEF',
    note: null,
    badge: { ...UNRATED, label: 'UNRATED', filled: false },
  },
]

export function LandingPreview() {
  return (
    /*
      The same card as `FixtureCard` and `SquadPanel` — a bordered `--surface` at
      `--radius-md` with a `--surface-header` strip — so a visitor who signs up
      lands on a page made of what they were just shown.

      `aria-hidden`, and the whole point of it: this is a picture of the product,
      not information. Read aloud it would announce four strangers and their
      invented verdicts between the hero's heading and the first real content.
    */
    <div aria-hidden className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
        <span className="truncate text-caps">Arsenal 2–1 Tottenham</span>
        {/* A date is counted rather than spoken, so it is monospaced — the same
            role `/diary` gives the date on every entry. */}
        <span className="shrink-0 text-data uppercase text-muted">Sat 14 Sep</span>
      </div>

      <ul className="divide-y divide-border">
        {ROWS.map((row) => (
          /*
            The squad row's own arrangement: a fixed first column for the tile, a
            flexible one for the name, and the verdict at the right-hand edge,
            with the note on a second line indented under the name. Written as a
            grid rather than nested flexes for exactly that last part — the note
            has to start where the name starts, and a column template is what
            makes that true without a margin repeating the tile's width.
          */
          <li
            key={row.shirtNumber}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3"
          >
            {/* No club, so no club colour: the tile falls back to the neutral it
                draws for a player with no squad row. Grey is what the drawing
                shows, and here it is also the truthful answer. */}
            <ShirtTile team={null} shirtNumber={row.shirtNumber} size="sm" />

            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-body font-medium">{row.name}</span>
              <span className="shrink-0 text-caps text-faint">{row.position}</span>
            </span>

            <Badge icon={row.badge.icon} label={row.badge.label} classes={row.badge.classes} filled={row.badge.filled} />

            {row.note === null ? (
              // The fourth row's whole job: most players are never judged, and
              // this says so in the mock rather than leaving a gap that reads as
              // something failing to load.
              <span className="col-start-2 -col-end-1 text-caption text-faint">
                Left blank — average.
              </span>
            ) : (
              // Foundations' rule for a note on a dense row: body text in muted
              // ink, indented under the name behind a rule.
              <span className="col-start-2 -col-end-1 border-l-2 border-border pl-3 text-body text-muted">
                {row.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
