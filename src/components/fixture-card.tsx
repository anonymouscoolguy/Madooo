import Link from 'next/link'
import { CrestChip } from './crest-chip'
import { kickoffDate, kickoffTime } from '@/lib/dates'
import type { Fixture } from '@/lib/fixtures'

/**
 * One fixture: a header strip carrying the venue and the date, then the match
 * itself — both clubs' crest chips, their names, and the score between them.
 *
 * A match with no squad rows is **not openable**, and the roadmap's long-term
 * remark says that case is real and permanent: fixtures are published long
 * before team news, so an unplayed match has nobody to judge even once the
 * backfill is complete.
 */

function Score({ match }: { match: Fixture }) {
  // Null goals means no result recorded, not a goalless draw — so the kickoff
  // time stands in, which is the thing a reader of an unplayed fixture wants.
  if (match.homeGoals === null || match.awayGoals === null) {
    return <span className="text-data text-muted">{kickoffTime(match.kickoff)}</span>
  }
  return (
    // Monospaced and large: a score is the most counted number on the page.
    // An en dash, not a hyphen — it is a span between two numbers.
    <span className="text-stat">
      {match.homeGoals}–{match.awayGoals}
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
