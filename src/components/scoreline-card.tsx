import { BackLink } from './back-link'
import { CrestChip } from './crest-chip'
import { Icon } from './icon'
import { kickoffDate, kickoffTime } from '@/lib/dates'
import { scoreline } from '@/lib/text'
import type { IconName } from './icon-names'
import type { MatchWithSquads } from '@/lib/matches'

/**
 * The match page's header: a strip of the facts about the fixture, over the
 * scoreline itself.
 *
 * It owns the whole header block including the back link, which is the contract
 * `PageHeader` has on every other screen — so exactly one component per screen
 * holds an opinion about header spacing, and this page's rhythm cannot drift
 * from the other five.
 *
 * `MatchWithSquads` rather than a hand-written `Pick<>`, following `FixtureCard`
 * and its `Fixture`: the query decides the shape, and a second copy of it here
 * would be free to drift from what the page actually selects.
 */

/** One fact in the meta strip: a 14px glyph, and the value beside it. */
function Fact({
  icon,
  label,
  children,
}: {
  icon: IconName
  label: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon name={icon} size="xs" />
      {/*
        Two flex children, not three, and the same reason as `FixtureCard`'s
        tallies: the label and its value are one span, or the label would become
        an anonymous flex item and take the gap.

        The label is `sr-only` because every icon in this design is `aria-hidden`
        — without it a screen reader gets four bare values in a row and no way to
        tell the ground from the referee.
      */}
      <span>
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </span>
  )
}

/** The result, or the kickoff time when there is not one yet. */
function Score({ match }: { match: MatchWithSquads }) {
  // Null goals means no result recorded, not a goalless draw — so the kickoff
  // time stands in, which is `FixtureCard`'s reading and the thing a reader of
  // an unplayed fixture wants.
  if (match.homeGoals === null || match.awayGoals === null) {
    return <span className="text-data text-muted">{kickoffTime(match.kickoff)}</span>
  }

  // An en dash, not a hyphen — it is a span between two numbers.
  return (
    <span className="text-score">
      {match.homeGoals}–{match.awayGoals}
    </span>
  )
}

export function ScorelineCard({
  match,
  back,
}: {
  match: MatchWithSquads
  back: { href: string; label: string }
}) {
  const played = match.homeGoals !== null && match.awayGoals !== null

  // The one name for a match anywhere in this app — the same helper the diary
  // and the player profile use, so all three say it the same way.
  const name = played
    ? scoreline(match)
    : `${scoreline(match)}, kick-off ${kickoffTime(match.kickoff)}`

  return (
    <header className="mb-8">
      <BackLink {...back} />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {/*
          The card's header strip, one step off `--surface` — the same treatment
          as `FixtureCard`'s and `SquadPanel`'s, so the three read as one system.
          No bottom border: the colour step is the separator, and the border is
          the card's own outline.

          `text-caption` because foundations names that role "Sub-labels, meta"
          outright. Sentence case throughout — caps appear in exactly two places
          and a venue is neither of them. The date is the exception the whole app
          already makes, monospaced and uppercased because it is counted rather
          than spoken; `font-mono` overrides only the family `text-caption` sets,
          so it stays 12px beside its neighbours.

          It wraps below `md` rather than dropping a fact or scrolling sideways.
          Four facts are around 420px of text and a 320px screen has 288px of
          line, so they cannot share one; hiding data at a breakpoint is the one
          thing the responsive rules never do, and a horizontal scroller hides
          its own overflow.
        */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-surface-header px-4 py-2 text-caption text-muted md:gap-x-6">
          <Fact icon="trophy" label="Competition">
            {match.league.name}
          </Fact>
          {/* Both nullable columns are omitted rather than filled. `FixtureCard`
              says "Venue unknown" because its strip is `justify-between` with
              two children and dropping one leaves the date against empty space;
              this one is a centred run that simply closes up. And "Referee
              unknown" would be a sentence about an official who does not exist,
              which is the reasoning that made a position read `MID` rather than
              the design's invented `AM`. */}
          {match.venueName ? (
            <Fact icon="stadium" label="Venue">
              {match.venueName}
            </Fact>
          ) : null}
          <Fact icon="calendar_today" label="Date">
            <span className="font-mono uppercase">{kickoffDate(match.kickoff)}</span>
          </Fact>
          {match.referee ? (
            <Fact icon="sports" label="Referee">
              {match.referee}
            </Fact>
          ) : null}
        </div>

        <h1>
          {/*
            The name is a string, and the drawn arrangement below is hidden from
            the accessibility tree entirely. Left visible it would arrive as two
            club names split around a bare "1–2", and an unplayed match would
            read as "Manchester United 15:00 Leeds" — a scoreline that never
            happened. The hidden subtree holds nothing focusable.
          */}
          <span className="sr-only">{name}</span>
          <span
            aria-hidden
            /*
              Three columns with the middle sized to its content, so the score
              sits on the card's centre line however long the club names are —
              `FixtureCard`'s trick, and `md:justify-end` on the home block is
              what pins both blocks against that middle column.

              Below `md` it stacks instead, each crest staying inboard beside the
              score. At 320px the row is arithmetically impossible: about 136px
              left for two 24px club names. `FixtureCard` shrinks its names at
              that width, and this deliberately does not — a dense repeated card
              *becomes* a fixture line on a phone, a different element with a
              different job, but a page's `<h1>` is still the thing the page is
              about, and shrinking it would be scaling for its own sake.

              `items-center` is written once and does double duty: `align-items`
              on the flex column below `md`, and on the grid from `md` up.
            */
            className="flex flex-col items-center gap-3 px-4 py-5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4"
          >
            {/*
              No `truncate` anywhere here, and `min-w-0` so the 1fr columns may
              shrink: at exactly 768px the content box is about 488px, and a pair
              like Wolverhampton Wanderers against Manchester United genuinely
              does not fit on one line. A long name wraps and the row grows.
              Truncating a heading loses half the name instead.
            */}
            <span className="flex min-w-0 items-center gap-3 md:justify-end">
              <span className="text-right text-title">{match.homeTeam.name}</span>
              <CrestChip team={match.homeTeam} size="lg" />
            </span>

            <Score match={match} />

            <span className="flex min-w-0 items-center gap-3">
              <CrestChip team={match.awayTeam} size="lg" />
              <span className="text-title">{match.awayTeam.name}</span>
            </span>
          </span>
        </h1>
      </div>
    </header>
  )
}
