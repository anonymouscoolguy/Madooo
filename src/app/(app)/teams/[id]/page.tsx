import { notFound } from 'next/navigation'
import { requireDbUser } from '@/lib/auth'
import { TEAMS, backLink, playerHref } from '@/lib/back'
import { season } from '@/lib/env'
import { foldPlayerRows } from '@/lib/players-index'
import { compareRosterEntries, positionLabel } from '@/lib/squad'
import { teamHeader, teamJudgements, teamSeen, teamSquad, teamTotals } from '@/lib/teams/profile'
import { CrestChip } from '@/components/crest-chip'
import { PageHeader } from '@/components/page-header'
import { PlayerRow } from '@/components/player-row'
import { StatTiles, TEAM_TILES } from '@/components/stat-tiles'

/**
 * Render on every request rather than once during `next build`, for the reason
 * every screen under `(app)` does: a prerendered profile would freeze whatever
 * the database held when the deployment was built.
 */
export const dynamic = 'force-dynamic'

/**
 * One club's season: who they are, how often the reader watched them, what their
 * players were judged to be, and the whole squad.
 *
 * **A directory, not a diary.** The list is every player with a squad row for
 * this club this season, most of whom will have nothing on them — the reading
 * `/players` settled, applied to one club. A list of only the judged ones would
 * be a second diary, and the diary is `/diary`.
 *
 * Reached from a match page's squad headers and from a player's profile, so the
 * way back travels in the URL; see [`back.ts`](../../../../lib/back.ts). The
 * fallback is Teams rather than Players, because a club typed into the address
 * bar belongs back at the clubs.
 */
export default async function TeamPage({ params, searchParams }: PageProps<'/teams/[id]'>) {
  const { id } = await params
  const { from } = await searchParams

  // Our own primary key, not API-Football's. A non-numeric or unknown id is a
  // 404 rather than a crash: the URL is user-editable.
  const teamId = Number(id)
  if (!Number.isInteger(teamId)) notFound()

  const currentSeason = season()

  // Everything below is one user's own activity, so all of it needs our own
  // `User.id`. The upsert behind this is memoised per request and the shell
  // layout already calls it, so it costs one indexed lookup.
  const user = await requireDbUser()

  // All five together rather than the header first: the 404 below is reachable
  // only by typing a URL, and making every real club wait a second round trip to
  // rule it out would be paying for the rare case on every request. The other
  // four come back empty for a club that does not exist.
  const [header, totals, squad, seen, judgements] = await Promise.all([
    teamHeader(teamId, currentSeason),
    teamTotals(teamId, currentSeason, user.id),
    teamSquad(teamId, currentSeason),
    teamSeen(teamId, currentSeason, user.id),
    teamJudgements(teamId, currentSeason, user.id),
  ])
  if (header === null) notFound()

  // The same fold the players index uses: squad rows are who exists, and the two
  // reads of the user's own activity are merged onto them with zero defaults. A
  // club whose players have never been judged is the ordinary case here, not an
  // edge one.
  const players = foldPlayerRows(squad, seen, judgements).sort(compareRosterEntries)

  return (
    <>
      <PageHeader
        back={backLink(from, TEAMS)}
        // 64px, the size a player profile's shirt tile takes in this slot, so the
        // two profiles open the same way. `CrestChip` is aria-hidden; the club's
        // name is the title beside it, which is the contract it asks of callers.
        mark={<CrestChip team={header} size="xl" />}
        title={header.name}
      >
        {/* The competition, which is a fact about the matches they played rather
            than a column on the club. Absent for a club with no fixture this
            season — reachable by typing a URL, and by a league the sync has not
            reached yet. */}
        {header.league ?? 'No matches this season.'}
      </PageHeader>

      <StatTiles tiles={TEAM_TILES} totals={totals} />

      {players.length === 0 ? (
        // Its own sentence, and a real state: every match of the season exists as
        // a row from the moment it is scheduled, but a squad appears only once
        // team news is published. Nobody can be judged for a club until then.
        <p className="text-body text-muted">
          No squad has been published for this club yet.
        </p>
      ) : (
        // The `SquadPanel` card, so the club's squad and the match page's read as
        // one system.
        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
            <h2 className="truncate text-caps">Squad</h2>
            <span className="shrink-0 text-data text-muted">
              {players.length}
              <span className="sr-only"> players</span>
            </span>
          </header>
          <ul className="divide-y divide-border">
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                href={playerHref(player.id, `/teams/${header.id}`)}
                team={header}
                shirtNumber={player.shirtNumber}
                name={player.name}
                // What the index puts here is the club, which this screen has
                // already said in its own title. So it says what he has been
                // given instead — the one number a squad row can carry that the
                // bar beside it cannot, since a note has no colour.
                subtitle={player.total === 0 ? 'Never judged' : `${player.total} judged`}
                position={positionLabel(player.position)}
                counts={{
                  watched: player.seen,
                  mvps: player.mvps,
                  standouts: player.standouts,
                  flops: player.flops,
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
