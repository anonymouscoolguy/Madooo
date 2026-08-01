import { season } from '@/lib/env'
import { prisma } from '@/lib/prisma'

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
 * A fixed zone rather than the server's. Vercel runs in UTC and a laptop does
 * not, so without this the same kickoff renders as two different local times —
 * and, for a late one, two different dates.
 */
const kickoffFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
})

export default async function Home() {
  const currentSeason = season()

  const matches = await prisma.match.findMany({
    where: { season: currentSeason },
    orderBy: { kickoff: 'asc' },
    take: 20,
    include: { homeTeam: true, awayTeam: true },
  })

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Madooo
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Premier League {currentSeason}/{currentSeason + 1} — first 20 fixtures
        </p>

        {matches.length === 0 ? (
          // Said out loud rather than rendered as an empty list: a deployment
          // pointed at the wrong database should look broken, not merely quiet.
          <p className="mt-10 text-zinc-600 dark:text-zinc-400">
            No fixtures in the database for this season.
          </p>
        ) : (
          <ul className="mt-10 divide-y divide-zinc-200 dark:divide-zinc-800">
            {matches.map((match) => (
              <li
                key={match.id}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span className="text-black dark:text-zinc-50">
                  {match.homeTeam.name} v {match.awayTeam.name}
                </span>
                <span className="shrink-0 text-right text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                  {/* null goals means the match has no result recorded, not
                      that it finished goalless. */}
                  {match.homeGoals === null || match.awayGoals === null
                    ? match.status
                    : `${match.homeGoals}–${match.awayGoals}`}
                  <span className="ml-3">
                    {kickoffFormat.format(match.kickoff)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
