import { notFound } from 'next/navigation'
import { requireDbUser } from '@/lib/auth'
import { backLink } from '@/lib/back'
import { season } from '@/lib/env'
import { playerEntries, playerHeader, playerTotals } from '@/lib/players'
import { PLAYER_VIEWS, parseView } from '@/lib/player-views'
import { positionLabel } from '@/lib/squad'
import { PageHeader } from '@/components/page-header'
import { PlayerEntry } from '@/components/player-entry'
import { PLAYER_TILES, StatTiles } from '@/components/stat-tiles'
import { ShirtTile } from '@/components/shirt-tile'
import { TabStrip } from '@/components/tab-strip'
import { VerdictSplit } from '@/components/verdict-split'

/**
 * Render on every request rather than once during `next build`, for the same
 * reason `/fixtures` and `/diary` do: a prerendered profile would freeze
 * whatever the database held when the deployment was built.
 */
export const dynamic = 'force-dynamic'

/**
 * One player's season: who he is, how often he was watched, what he was judged
 * to be, and every entry written about him.
 *
 * Reached from a squad list, from the match page's "Your verdicts" panel and
 * from the diary — which is why the way back travels in the URL rather than
 * being a fixed parent; see [`back.ts`](../../../../lib/back.ts). Both that and
 * the view live in the query string, which is what keeps this a server component
 * with no JavaScript of its own.
 */
export default async function PlayerPage({ params, searchParams }: PageProps<'/players/[id]'>) {
  const { id } = await params
  const { from, view } = await searchParams

  // Our own primary key, not API-Football's. A non-numeric or unknown id is a
  // 404 rather than a crash: the URL is user-editable.
  const playerId = Number(id)
  if (!Number.isInteger(playerId)) notFound()

  const currentSeason = season()
  const current = parseView(view)

  // A profile shows one user's judgements, so both reads below need our own
  // `User.id`. The upsert behind this is memoised per request and the shell
  // layout already calls it, so it costs one indexed lookup.
  const user = await requireDbUser()

  // All three together rather than the header first: the 404 below is reachable
  // only by typing a URL, and making every real profile wait a second round trip
  // to rule it out would be paying for the rare case on every request. The two
  // tallies simply come back empty for a player who does not exist.
  const [header, totals, entries] = await Promise.all([
    playerHeader(playerId, currentSeason),
    playerTotals(playerId, currentSeason, user.id),
    playerEntries(playerId, currentSeason, user.id, current),
  ])
  if (header === null) notFound()

  // The club and shirt he was last named under. Absent for a player in the
  // database with no squad row this season — every match of the season exists as
  // a row from the moment it is scheduled, but only hydrated rounds have squads.
  const latest = header.squadEntries[0] ?? null
  const position = latest === null ? null : positionLabel(latest.position)

  return (
    <>
      <PageHeader
        back={backLink(from)}
        mark={<ShirtTile team={latest?.team ?? null} shirtNumber={latest?.shirtNumber ?? null} />}
        title={header.name}
      >
        {/*
          `MID`, not the drawing's "Attacking midfielder". The finer position is
          in no provider response — `MatchSquad.position` is one of four letters —
          and 6.3 settled that inventing one prints a confident falsehood about a
          real person. See architecture.md.
        */}
        {latest === null
          ? 'Not named in a squad this season.'
          : [latest.team.name, position].filter(Boolean).join(' · ')}
      </PageHeader>

      <StatTiles tiles={PLAYER_TILES} totals={totals} />
      <VerdictSplit counts={totals} />

      <TabStrip
        label="View"
        tabs={PLAYER_VIEWS.map((candidate) => ({
          // The origin rides along, so switching tabs does not lose the way back.
          href: `/players/${header.id}?view=${candidate.slug}${
            typeof from === 'string' ? `&from=${encodeURIComponent(from)}` : ''
          }`,
          label: candidate.label,
          current: candidate.slug === current.slug,
        }))}
      />

      {entries.length === 0 ? (
        // Each view carries its own sentence, so "no notes on this player" does
        // not read as "nothing on this player" to someone who has tagged him ten
        // times.
        <p className="text-body text-muted">{current.empty}</p>
      ) : (
        <ul className="divide-y divide-border border-b border-border">
          {entries.map((entry) => (
            <PlayerEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </>
  )
}
