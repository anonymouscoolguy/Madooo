import { requireDbUser } from '@/lib/auth'
import { season } from '@/lib/env'
import { foldTeamRows } from '@/lib/teams-index'
import {
  clubIdentities,
  clubJudgements,
  clubLeagues,
  clubsSeen,
  leaguesWithMatches,
} from '@/lib/teams/directory'
import { PageHeader } from '@/components/page-header'
import { TeamsBrowser } from '@/components/teams-browser'

/**
 * Render on every request rather than once during `next build`, for the same
 * reason `/fixtures`, `/players` and both profiles do: a prerendered index would
 * freeze both the fixture list and the reader's own tallies at whatever the
 * database held when the deployment was built.
 */
export const dynamic = 'force-dynamic'

/**
 * Every club that has played this season, over the mix of what the reader has
 * given their players.
 *
 * **A directory, not a diary**, the same as `/players` and a club's own squad
 * list: the list is the competition, and on a fresh diary none of it has anything
 * on it. Which is why the header keeps its sentence rather than the drawing's
 * "You have judged N teams so far" — that number would describe something other
 * than the list beneath it.
 *
 * No `StatTiles` row, which the drawing also omits and which is the same
 * decision: a tally of the reader's own season says nothing about a directory,
 * and `/diary` already counts it.
 *
 * The five queries are each bounded and go out together, so the page waits for
 * the slowest rather than for the sum. The fold that turns four of them into rows
 * is pure and lives in [`teams-index.ts`](../../../lib/teams-index.ts) with its
 * tests.
 *
 * Everything below the header is one client island, because the search box has to
 * filter as it is typed in and the three controls are remembered in
 * `localStorage` rather than in the URL — see
 * [`players-browser.tsx`](../../../components/players-browser.tsx) for the whole
 * of that argument.
 */
export default async function Teams() {
  const currentSeason = season()

  // The seen counts and the tallies belong to one reader. The upsert behind this
  // is memoised per request and the shell layout already called it, so it costs
  // one indexed lookup.
  const user = await requireDbUser()

  const [clubs, identities, leagues, seen, judgements] = await Promise.all([
    clubLeagues(currentSeason),
    clubIdentities(currentSeason),
    leaguesWithMatches(currentSeason),
    clubsSeen(currentSeason, user.id),
    clubJudgements(currentSeason, user.id),
  ])

  const teams = foldTeamRows(clubs, identities, leagues, seen, judgements)

  return (
    <>
      <PageHeader title="Teams">
        Each club, and your verdicts on the players who turned out for it.
      </PageHeader>

      {teams.length === 0 ? (
        /*
          Reachable whenever no fixture of the configured season has been synced —
          the state of a fresh database, and of one whose SEASON has just been
          switched. A narrower state than the players index's, which needs a
          *round* hydrated before it has squads; a club exists here from the
          moment its fixtures do.

          The controls are not drawn on this branch at all: a search box over
          nothing is the box that does nothing which 6.1 refused to ship.
        */
        <p className="text-body text-muted">
          No teams yet. They appear here once a season&rsquo;s fixtures have been synced.
        </p>
      ) : (
        <TeamsBrowser teams={teams} leagues={leagues} />
      )}
    </>
  )
}
