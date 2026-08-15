import Link from 'next/link'
import { Badge, LIVE_BADGE } from './badge'
import { CrestChip } from './crest-chip'
import { Icon } from './icon'
import { KickoffTime } from './kickoff-time'
import { kickoffDate } from '@/lib/dates'
import { isInProgress } from '@/lib/match-status'
import { plural } from '@/lib/text'
import { countNotes, countVerdicts } from '@/lib/verdicts'
import type { Fixture } from '@/lib/fixtures'

/**
 * One fixture: a header strip carrying the venue and the date, then the match
 * itself — both clubs' crest chips, their names, and the score between them,
 * over a footer strip counting what this user has said about it.
 *
 * A match with no squad rows is **not openable**, and the roadmap's long-term
 * remark says that case is real and permanent: fixtures are published long
 * before team news, so a season in progress always holds matches with nobody to
 * judge, however current the sync is.
 */

function Score({ match }: { match: Fixture }) {
  // Before the goals check, and that order is the whole of it: a match kicks off
  // with a 0–0 recorded against it, so asking about goals first draws a live
  // match as a finished goalless draw. This page never polls, so a live score
  // would also be stale the moment it was painted — the badge is what the page
  // actually knows.
  if (isInProgress(match.status)) {
    return <Badge label="Live" classes={LIVE_BADGE} />
  }

  // Null goals means no result recorded, not a goalless draw — so the kickoff
  // time stands in, which is the thing a reader of an unplayed fixture wants.
  // On the reader's own clock, and the only date on this card that is: the
  // header's is the matchday, which is the competition's calendar rather than
  // theirs. `KickoffTime` is the whole element, so there is no span around it.
  if (match.homeGoals === null || match.awayGoals === null) {
    return <KickoffTime kickoff={match.kickoff} className="text-data text-muted" />
  }
  return (
    // Monospaced and large: a score is the most counted number on the page.
    // An en dash, not a hyphen — it is a span between two numbers.
    <span className="text-stat">
      {match.homeGoals}–{match.awayGoals}
    </span>
  )
}

type TallyProps = {
  /** Narrower than `IconName`: this footer draws these two and nothing else. */
  icon: 'how_to_reg' | 'edit_note'
  count: number
  noun: string
}

/** One icon and its count, in the footer strip. */
function Tally({ icon, count, noun }: TallyProps) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon name={icon} size="xs" />
      {/* Two flex children, not three: the numeral and its noun are one span, or
          the bare word would become an anonymous flex item and take the gap.
          `font-mono` overrides only the family `text-caption` sets, so a count
          you can add up is monospaced without changing size beside its word. */}
      <span>
        <span className="font-mono">{count}</span> {plural(count, noun)}
      </span>
    </span>
  )
}

function Card({ match, openable }: { match: Fixture; openable: boolean }) {
  return (
    /*
      `group-hover` and `group-active` throughout, with the group on the <Link>
      that may or may not be there. When the card is not openable there is no
      group ancestor, so those variants simply never match — which is exactly the
      wanted behaviour and needs no second set of classes.
    */
    // Press is one step darker again plus a 1px drop, exactly as foundations
    // states it. The transition covers colour only, so the drop is instant —
    // nothing in this design animates a transform.
    <article className="t-hover overflow-hidden rounded-md border border-border bg-surface group-hover:bg-surface-alt group-active:translate-y-px group-active:bg-surface-sunken">
      <header className="t-hover flex items-center justify-between gap-4 bg-surface-header px-4 py-2 group-hover:bg-surface-sunken">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-caps">{match.venueName ?? 'Venue unknown'}</span>
          {openable ? null : (
            // Not foundations' disabled treatment: the fixture is real
            // information and should stay readable. It is only the *action*
            // that is missing, and disabled styling is for controls.
            <span className="shrink-0 text-caps text-faint">No squad yet</span>
          )}
        </div>
        {/* A date is counted, not spoken, so it is monospaced. */}
        <span className="shrink-0 text-data uppercase">{kickoffDate(match.kickoff)}</span>
      </header>

      {/*
        Three columns with the middle one sized to its content, so the score sits
        on the card's centre line however long the club names are — and the two
        sides get an equal share of what is left rather than fighting over it.
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <CrestChip team={match.homeTeam} />
          {/* 13px below `md`, 18px from there up. foundations gives the larger
              size to team names on a match card and the smaller one to fixture
              lines; at narrow width, two long club names either side of a 32px
              score is a fixture line. */}
          <span className="truncate text-label md:text-heading">{match.homeTeam.name}</span>
        </div>

        <Score match={match} />

        <div className="flex min-w-0 items-center justify-end gap-3">
          <span className="truncate text-right text-label md:text-heading">
            {match.awayTeam.name}
          </span>
          <CrestChip team={match.awayTeam} />
        </div>
      </div>

      {/*
        The header strip's treatment, mirrored at the foot so the card stays one
        object: one step off `--surface`, darkening with the rest of it on hover
        and doing nothing when there is no group ancestor to hover.

        It is drawn on a match with no squad too. Nobody can be judged there yet,
        but zero is shown rather than hidden everywhere else in this app, and a
        card that dropped a band would change height against its neighbours.
      */}
      <footer className="t-hover flex items-center gap-4 border-t border-border bg-surface-alt px-4 py-2 text-caption text-muted group-hover:bg-surface-sunken">
        <Tally icon="how_to_reg" count={countVerdicts(match.squadEntries)} noun="verdict" />
        <Tally icon="edit_note" count={countNotes(match.squadEntries)} noun="note" />
      </footer>
    </article>
  )
}

export function FixtureCard({ match }: { match: Fixture }) {
  const openable = match._count.squadEntries > 0

  if (!openable) return <Card match={match} openable={false} />

  return (
    <Link
      href={`/matches/${match.id}`}
      // `no-underline` and an explicit colour because the base stylesheet gives
      // every <a> the link colour and a hover underline — right for prose, wrong
      // for a card. The utilities layer outranks it despite the lower
      // specificity, which is what makes one class enough.
      className="group block rounded-md text-text no-underline focus-visible:focus-ring"
    >
      <Card match={match} openable />
    </Link>
  )
}
