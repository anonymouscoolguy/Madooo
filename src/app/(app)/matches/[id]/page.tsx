import { notFound } from 'next/navigation'
import { requireDbUser } from '@/lib/auth'
import { kickoffDate, kickoffTime } from '@/lib/dates'
import { matchWithSquads, type MatchTeam, type SquadEntry } from '@/lib/matches'
import { roundNumber } from '@/lib/rounds'
import { splitSquad } from '@/lib/squad'
import { PageHeader } from '@/components/page-header'
import { SquadPanel } from '@/components/squad-panel'
import { VerdictSummary } from '@/components/verdict-summary'

export const dynamic = 'force-dynamic'

/**
 * The split is made once, in the page, rather than by each column: the summary
 * panel below needs the same players in the same order the panels draw them,
 * and splitting twice would leave two orders to keep in step.
 */
type Squad = ReturnType<typeof splitSquad<SquadEntry>>

/**
 * One team's half of the page: its starting eleven above its bench.
 *
 * The two clubs are two nested columns rather than four panels dropped into one
 * grid, and that is a layout decision with a reason. Auto-placement would put
 * the home bench into the away column, and below `md` it would stack as
 * home XI → away XI → home bench → away bench, which reads as nothing at all.
 * Nesting gives the drawn desktop layout and a narrow layout of one whole club
 * followed by the other.
 */
function TeamSquad({ team, squad }: { team: MatchTeam; squad: Squad }) {
  const { starters, substitutes } = squad

  if (starters.length === 0 && substitutes.length === 0) {
    // The sync's merge is a union over two endpoints, so a fixture with only one
    // published lineup produces rows for one club and nothing for the other.
    return (
      <p className="text-body text-muted">No squad published for {team.name}.</p>
    )
  }

  // With no eleven above it, the bench is the only panel in this column and has
  // to name the club itself rather than leaving it to a screen reader.
  const orphanedBench = starters.length === 0

  return (
    <div className="flex flex-col gap-4">
      <SquadPanel title={`${team.name} — Starting XI`} entries={starters} />
      <SquadPanel
        title={orphanedBench ? `${team.name} — Substitutes` : 'Substitutes'}
        team={orphanedBench ? undefined : team.name}
        entries={substitutes}
      />
    </div>
  )
}

/**
 * `[id]` is a **dynamic segment** — the folder name in square brackets makes the
 * path variable, and its value arrives in `params`. Like `searchParams` it is a
 * Promise and must be awaited.
 */
export default async function MatchPage({ params }: PageProps<'/matches/[id]'>) {
  const { id } = await params

  // Our own primary key, not API-Football's. A non-numeric or unknown id is a
  // 404 rather than a crash: the URL is user-editable.
  const matchId = Number(id)
  if (!Number.isInteger(matchId)) notFound()

  // The verdicts on this page belong to one user, so the read needs our own
  // `User.id`. The upsert behind this is memoised per request, so calling it
  // here as well as in the shell layout costs one indexed lookup.
  const user = await requireDbUser()

  const match = await matchWithSquads(matchId, user.id)
  if (match === null) notFound()

  // Null goals means no result recorded, not a goalless draw — the same reading
  // `FixtureCard` takes, where the kickoff time stands in for the score.
  const score =
    match.homeGoals === null || match.awayGoals === null
      ? null
      : `${match.homeGoals}–${match.awayGoals}`

  // Back to the matchday the reader came from, not to whichever one `/fixtures`
  // opens on by default.
  const matchday = roundNumber(match.round)

  const home = splitSquad(match.squadEntries, match.homeTeam.id)
  const away = splitSquad(match.squadEntries, match.awayTeam.id)

  return (
    <>
      <PageHeader
        back={{
          href: matchday === null ? '/fixtures' : `/fixtures?matchday=${matchday}`,
          label: 'Back to fixtures',
        }}
        title={
          score === null ? (
            `${match.homeTeam.name} v ${match.awayTeam.name}`
          ) : (
            <>
              {match.homeTeam.name}{' '}
              {/* `font-mono` overrides only the family that `text-title` sets,
                  so the size, weight and tracking of the heading survive. */}
              <span className="font-mono">{score}</span> {match.awayTeam.name}
            </>
          )
        }
      >
        {match.league.name} ·{' '}
        <span className="text-data uppercase">{kickoffDate(match.kickoff)}</span>
        {score === null ? (
          <>
            {' · '}
            <span className="text-data">{kickoffTime(match.kickoff)}</span>
          </>
        ) : null}
      </PageHeader>

      {match.squadEntries.length === 0 ? (
        // Reachable by typing the URL — 6.2's cards refuse to link here — and
        // permanent, because fixtures are published long before team news.
        <p className="text-body text-muted">No squad has been published for this match yet.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <TeamSquad team={match.homeTeam} squad={home} />
            <TeamSquad team={match.awayTeam} squad={away} />
          </div>
          {/* Below both benches and across both clubs, so it is the one place
              that reads as a verdict on the match rather than on a team. The
              entries arrive in reading order — home eleven, home bench, away
              eleven, away bench — because `summariseVerdicts` groups by verdict
              and leaves the order inside each group alone. */}
          <VerdictSummary
            entries={[...home.starters, ...home.substitutes, ...away.starters, ...away.substitutes]}
          />
        </>
      )}
    </>
  )
}
