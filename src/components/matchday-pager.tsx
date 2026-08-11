import Link from 'next/link'
import { Icon } from './icon'
import { dateRange } from '@/lib/dates'
import { roundDisplay } from '@/lib/rounds'
import type { Round } from '@/lib/fixtures'

type Props = {
  rounds: Round[]
  index: number
  /** The selected league's slug, which every link here has to carry. */
  league: string
}

/** An arrow at the end of the season: present, so nothing shifts, but inert. */
function Edge({ direction }: { direction: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 cursor-not-allowed items-center justify-center opacity-40"
    >
      <Icon name={direction === 'left' ? 'chevron_left' : 'chevron_right'} size="md" />
    </span>
  )
}

function Step({
  round,
  direction,
  league,
}: {
  round: Round
  direction: 'left' | 'right'
  league: string
}) {
  return (
    <Link
      href={`/fixtures?league=${league}&matchday=${matchdayParam(round)}`}
      aria-label={`${direction === 'left' ? 'Previous' : 'Next'} matchday, ${roundDisplay(round.round)}`}
      // size-8 is --control-h, foundations' default icon button. `no-underline`
      // and an explicit colour because the base stylesheet styles every <a> as a
      // prose link, which is right for body copy and wrong for chrome.
      className="t-hover inline-flex size-8 items-center justify-center rounded-md text-muted no-underline hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
    >
      <Icon name={direction === 'left' ? 'chevron_left' : 'chevron_right'} size="md" />
    </Link>
  )
}

/**
 * The matchday number, which is what the URL carries. A number rather than the
 * provider's `"Regular Season - 6"` because it is what a person would type, and
 * because it keeps API-Football's own vocabulary out of our URLs — the same
 * boundary the sync draws, applied to the address bar.
 *
 * The league travels beside it for the same reason and as the same kind of
 * thing: a slug off the competition's name, neither our database's id nor the
 * provider's. [`leagues.ts`](../lib/leagues.ts) owns that half. A matchday is
 * meaningless without it — round 6 is a different weekend in each competition,
 * and the two do not even have the same number of rounds.
 */
function matchdayParam(round: Round): string {
  return roundDisplay(round.round).replace(/^Matchday /, '')
}

export function MatchdayPager({ rounds, index, league }: Props) {
  const current = rounds[index]
  const previous = rounds[index - 1]
  const next = rounds[index + 1]

  return (
    <div className="flex items-center gap-1">
      {previous ? (
        <Step round={previous} direction="left" league={league} />
      ) : (
        <Edge direction="left" />
      )}

      <div className="min-w-36 text-center">
        <div className="text-label">{roundDisplay(current.round)}</div>
        {/* Monospaced because a date is counted, not spoken. */}
        <div className="text-data uppercase text-muted">
          {dateRange(current.firstKickoff, current.lastKickoff)}
        </div>
      </div>

      {next ? (
        <Step round={next} direction="right" league={league} />
      ) : (
        <Edge direction="right" />
      )}
    </div>
  )
}
