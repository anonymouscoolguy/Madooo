import Link from 'next/link'
import { BackLink } from './back-link'
import { Badge, CALLED_OFF_BADGE, LIVE_BADGE } from './badge'
import { CrestChip } from './crest-chip'
import { Icon } from './icon'
import { KickoffTime } from './kickoff-time'
import { teamHref } from '@/lib/back'
import { kickoffDate } from '@/lib/dates'
import { calledOffLabel, isInProgress } from '@/lib/match-status'
import { fixtureName, scoreline } from '@/lib/text'
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

/**
 * A called-off badge, the result, a live badge, or the kickoff time — in that
 * order of precedence.
 */
function Score({ match }: { match: MatchWithSquads }) {
  // First, as it is on `FixtureCard`: whether the match is happening at all comes
  // before whether it is happening now, and it has to come before the goals check
  // below — a called-off fixture has no goals recorded, so it used to draw a
  // kickoff time for a match that will not be played then.
  const calledOff = calledOffLabel(match.status)
  if (calledOff !== null) {
    return <Badge label={calledOff} classes={CALLED_OFF_BADGE} />
  }

  // Still before the goals check, and `FixtureCard`'s reading: a match kicks off
  // with a 0–0 recorded against it, so asking about goals first draws a live
  // match as a finished goalless draw. The page never polls either, so a live
  // score would be stale the moment it was painted.
  if (isInProgress(match.status)) {
    return <Badge label="Live" classes={LIVE_BADGE} />
  }

  // Null goals means no result recorded, not a goalless draw — so the kickoff
  // time stands in, which is `FixtureCard`'s reading and the thing a reader of
  // an unplayed fixture wants. On the reader's own clock, as that card's is; the
  // strip's date above stays on the competition's.
  if (match.homeGoals === null || match.awayGoals === null) {
    return <KickoffTime kickoff={match.kickoff} className="text-data text-muted" />
  }

  // An en dash, not a hyphen — it is a span between two numbers.
  return (
    <span className="text-score">
      {match.homeGoals}–{match.awayGoals}
    </span>
  )
}

/**
 * One club in the scoreline, as a link to its profile.
 *
 * The two sides differ only in which team they read and which way round the
 * crest and the name sit — the home block is mirrored so both crests stay
 * inboard, beside the score. A prop rather than two copies, because the link's
 * classes are the part that must not drift between them.
 */
function ClubLink({ match, side }: { match: MatchWithSquads; side: 'home' | 'away' }) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam

  const name = (
    <span className={`text-title ${side === 'home' ? 'text-right' : ''}`}>{team.name}</span>
  )
  const crest = <CrestChip team={team} size="lg" />

  return (
    <Link
      href={teamHref(team.id, `/matches/${match.id}`)}
      className={`-m-2 flex min-w-0 items-center gap-3 rounded-md p-2 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring ${
        side === 'home' ? 'md:justify-end' : ''
      }`}
    >
      {side === 'home' ? (
        <>
          {name}
          {crest}
        </>
      ) : (
        <>
          {crest}
          {name}
        </>
      )}
    </Link>
  )
}

export function ScorelineCard({
  match,
  back,
}: {
  match: MatchWithSquads
  back: { href: string; label: string }
}) {
  const calledOff = calledOffLabel(match.status)
  const live = isInProgress(match.status)
  const played = match.homeGoals !== null && match.awayGoals !== null

  // The one name for a match anywhere in this app — the same helper the diary
  // and the player profile use, so all three say it the same way. A live match
  // takes the clubs without a score, because the heading is the only place the
  // score is announced and stating one the page has chosen not to draw would
  // put a number in the accessibility tree that is nowhere on the screen.
  //
  // A called-off match takes the clubs and its word for the same reason, and it
  // has to be tested before the unplayed branch or it would land there and
  // announce a kick-off the badge beside it says will not happen. The word is
  // lowercased because this is the middle of a sentence where the badge is the
  // start of a label; `calledOffLabel` is the single source of it either way.
  //
  // The unplayed case is a node rather than a string, and that is the whole
  // reason: it announces the kickoff time, and the time on screen is the
  // reader's. Left as a server-formatted string it would say 15:00 into a screen
  // reader while the scoreline beside it drew 23:00 — a contradiction that lands
  // hardest on someone using magnification and a screen reader together.
  const name: React.ReactNode = calledOff !== null
    ? `${fixtureName(match)}, ${calledOff.toLowerCase()}`
    : live
      ? `${fixtureName(match)}, live`
      : played
        ? scoreline(match)
        : (
            <>
              {scoreline(match)}, kick-off <KickoffTime kickoff={match.kickoff} />
            </>
          )

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

        {/*
          The heading is the string and nothing else, and the drawn arrangement
          is its sibling rather than its content. It used to be one `<h1>` with
          the arrangement inside it and `aria-hidden` — which was right until the
          clubs became links, because a focusable element inside a hidden subtree
          is reachable by keyboard and absent from the accessibility tree at the
          same time. Splitting them keeps both halves honest: the heading still
          announces "Chelsea 1–1 Arsenal" as one name rather than two clubs
          around a bare "1–2", and the links are ordinary links outside it.

          Everything in the arrangement that is not a link stays hidden, so the
          score is announced once, by the heading. That also keeps an unplayed
          match from reading as "Manchester United 15:00 Leeds", a scoreline that
          never happened.
        */}
        <h1 className="sr-only">{name}</h1>
        <div
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
            different job, but the scoreline is still the thing the page is
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

            The crest and the name are one link, as they are in a squad panel
            header — a club is one thing to click. The padding is what makes the
            hover surface worth aiming at and the negative margin cancels it
            exactly, so the name sits where it always did against the score.
          */}
          <ClubLink match={match} side="home" />

          {/* Announced by the heading above, so it is not announced again here. */}
          <span aria-hidden>
            <Score match={match} />
          </span>

          <ClubLink match={match} side="away" />
        </div>
      </div>
    </header>
  )
}
