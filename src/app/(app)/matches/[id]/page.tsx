import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { kickoffDate, kickoffTime } from '@/lib/dates'
import { CrestChip } from '@/components/crest-chip'
import { PageHeader } from '@/components/page-header'

export const dynamic = 'force-dynamic'

/**
 * A placeholder. Step 6.3 puts both squads here; this exists so that 6.2's
 * fixture cards link somewhere real, and so their hover, press and focus states
 * are exercised against an actual navigation rather than against a dead anchor.
 *
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

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, colour: true } },
      awayTeam: { select: { id: true, name: true, code: true, colour: true } },
    },
  })
  if (match === null) notFound()

  return (
    <>
      <PageHeader title={`${match.homeTeam.name} v ${match.awayTeam.name}`}>
        {match.venueName ?? 'Venue unknown'} — {kickoffDate(match.kickoff)},{' '}
        {kickoffTime(match.kickoff)}
      </PageHeader>

      <div className="mb-8 flex items-center gap-3">
        <CrestChip team={match.homeTeam} />
        <span className="text-stat">
          {match.homeGoals === null || match.awayGoals === null
            ? '—'
            : `${match.homeGoals}–${match.awayGoals}`}
        </span>
        <CrestChip team={match.awayTeam} />
      </div>

      <p className="text-body text-muted">Both squads arrive in step 6.3.</p>
    </>
  )
}
