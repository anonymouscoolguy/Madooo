import { requireDbUser } from '@/lib/auth'
import { season } from '@/lib/env'
import { defaultRound, fixturesForRound, listRounds, seasonTotals } from '@/lib/fixtures'
import { roundNumber } from '@/lib/rounds'
import { FixtureCard } from '@/components/fixture-card'
import { LeagueTabs } from '@/components/league-tabs'
import { MatchdayPager } from '@/components/matchday-pager'
import { PageHeader } from '@/components/page-header'
import { FIXTURE_TILES, StatTiles } from '@/components/stat-tiles'

/**
 * Render on every request rather than once during `next build`.
 *
 * Next prerenders pages at build time by default, which here would freeze
 * whatever the database held the moment the deployment was built. It would also
 * prove the wrong thing: that the build container could reach Neon, not that the
 * running server can.
 */
export const dynamic = 'force-dynamic'

/**
 * The selected matchday lives in the URL — `/fixtures?matchday=6` — rather than
 * in React state, and that one choice is what keeps this whole page a server
 * component. The pager is two `<Link>`s, no JavaScript ships, and a matchday can
 * be linked to, bookmarked and reached with the back button.
 *
 * Two Next specifics. `searchParams` is a **Promise** and has to be awaited:
 * Next 15 made request-time inputs async so rendering can start before the
 * request is fully parsed, and reading it synchronously is deprecated.
 * `PageProps<'/fixtures'>` is a globally available helper that derives the prop
 * types from the route literal, so the path and its types cannot drift apart.
 */
export default async function Fixtures({ searchParams }: PageProps<'/fixtures'>) {
  const currentSeason = season()
  const { matchday } = await searchParams

  // The tallies below belong to one user, so the page needs our own `User.id`
  // for the first time. The upsert behind this is memoised per request and the
  // shell layout already calls it, so it costs one indexed lookup.
  const user = await requireDbUser()

  const [rounds, totals] = await Promise.all([
    listRounds(currentSeason),
    seasonTotals(currentSeason, user.id),
  ])

  if (rounds.length === 0) {
    return (
      <>
        <PageHeader title="Fixtures">
          Pick a league and matchday, then open any fixture to rate the players.
        </PageHeader>
        {/* The tiles are drawn on this branch too. A page that hid its tallies
            while saying the database is empty would be hiding two different
            failures behind one message. */}
        <StatTiles tiles={FIXTURE_TILES} totals={totals} />
        {/* Said out loud rather than rendered as an empty list: a deployment
            pointed at the wrong database should look broken, not merely quiet. */}
        <p className="text-body text-muted">No fixtures in the database for this season.</p>
      </>
    )
  }

  // A repeated `?matchday=` gives an array; take the first rather than refusing,
  // since a malformed parameter falls through to the default anyway.
  const requested = Number(Array.isArray(matchday) ? matchday[0] : matchday)
  let index = rounds.findIndex((round) => roundNumber(round.round) === requested)

  if (index === -1) {
    // Only asked when the URL says nothing usable, so paging through the season
    // does not pay for it on every click.
    const fallback = await defaultRound(currentSeason)
    index = Math.max(
      0,
      rounds.findIndex((round) => round.round === fallback),
    )
  }

  const current = rounds[index]
  const fixtures = await fixturesForRound(currentSeason, current.round, user.id)

  return (
    <>
      <PageHeader title="Fixtures">
        Pick a league and matchday, then open any fixture to rate the players.
      </PageHeader>

      <StatTiles tiles={FIXTURE_TILES} totals={totals} />

      {/* Stacked below `md` — the tabs and the pager together need more width
          than a phone has, and wrapping them keeps both at full size rather than
          squeezing either. */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <LeagueTabs />
        <MatchdayPager rounds={rounds} index={index} />
      </div>

      {fixtures.length === 0 ? (
        <p className="text-body text-muted">No fixtures on this matchday.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {fixtures.map((match) => (
            <li key={match.id}>
              <FixtureCard match={match} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
