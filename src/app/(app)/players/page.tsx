import { requireDbUser } from '@/lib/auth'
import { season } from '@/lib/env'
import {
  leaguesInSeason,
  playerJudgements,
  playersInSeason,
  playersSeen,
  playersTotals,
  teamsInSeason,
} from '@/lib/players'
import { foldPlayerRows } from '@/lib/players-index'
import { PageHeader } from '@/components/page-header'
import { PlayersBrowser } from '@/components/players-browser'
import { PLAYERS_TILES, StatTiles } from '@/components/stat-tiles'

/**
 * Render on every request rather than once during `next build`, for the same
 * reason `/fixtures`, `/diary` and a profile do: a prerendered index would
 * freeze both the squads and the reader's own tallies at whatever the database
 * held when the deployment was built.
 */
export const dynamic = 'force-dynamic'

/**
 * Every player in the season's matchday squads, over four tallies of what the
 * reader has given out.
 *
 * **A directory, not a diary.** Unlike every other screen built so far, the list
 * is not the user's own activity — it is the league, and most of it will have
 * nothing on it. That is deliberate: the point of the screen is that the search
 * box reaches a player who has never been judged.
 *
 * The six queries are each bounded and go out together, so the page waits for the
 * slowest rather than for the sum. The fold that turns three of them into rows is
 * pure and lives in [`players-index.ts`](../../../lib/players-index.ts) with its
 * tests.
 *
 * Everything below the tiles is one client island, because the search box has to
 * filter as it is typed in and the three controls are remembered in
 * `localStorage` rather than in the URL — see
 * [`players-browser.tsx`](../../../components/players-browser.tsx) for why this
 * screen is the exception to the app's URL-state convention.
 */
export default async function Players() {
  const currentSeason = season()

  // The tallies and the seen counts belong to one reader. The upsert behind this
  // is memoised per request and the shell layout already called it, so it costs
  // one indexed lookup.
  const user = await requireDbUser()

  const [squads, seen, judgements, teams, leagues, totals] = await Promise.all([
    playersInSeason(currentSeason),
    playersSeen(currentSeason, user.id),
    playerJudgements(currentSeason, user.id),
    teamsInSeason(currentSeason),
    leaguesInSeason(currentSeason),
    playersTotals(currentSeason, user.id),
  ])

  const players = foldPlayerRows(squads, seen, judgements)

  return (
    <>
      <PageHeader title="Players">
        {/*
          The second sentence answers the question the search box provokes: a
          reader who types a name and finds nothing has to be able to tell "not
          in our leagues" from "not named yet". `playersInSeason` reads
          `MatchSquad`, so a signing with no squad row is genuinely absent until
          a round he is named in has been synced — and "named in a squad" rather
          than "played" is the accurate line, because an unused substitute is
          listed here and can be judged.
        */}
        Here you can find all the players in the leagues we cover. A player
        appears once they have been named in a matchday squad, unused
        substitutes included.
      </PageHeader>

      {/* Drawn on the empty branch too, the same as `/fixtures`: a page that hid
          its tallies while saying it has no players would be hiding two
          different failures behind one message. */}
      <StatTiles tiles={PLAYERS_TILES} totals={totals} />

      {players.length === 0 ? (
        /*
          Reachable whenever no round of the configured season has been hydrated.
          Every fixture exists as a row from the moment it is scheduled, but only
          a synced round has squads — so this is the state of a fresh database,
          and of one whose SEASON has just been switched.

          The controls are not drawn on this branch at all: a search box over
          nothing is the box that does nothing which 6.1 refused to ship.
        */
        <p className="text-body text-muted">
          No players yet. They appear here once a matchday&rsquo;s squads have been published.
        </p>
      ) : (
        <PlayersBrowser players={players} teams={teams} leagues={leagues} />
      )}
    </>
  )
}
