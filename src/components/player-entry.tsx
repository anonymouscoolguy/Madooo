import Link from 'next/link'
import { scoreline } from '@/lib/text'
import { JudgementEntry } from './judgement-entry'
import type { PlayerEntry as Entry } from '@/lib/players'

/**
 * One row of a player's diary: the date, the verdict, the match it was given in,
 * and the note.
 *
 * The mirror of [`diary-entry.tsx`](./diary-entry.tsx) — the same row from
 * [`judgement-entry.tsx`](./judgement-entry.tsx), with the match beside the badge
 * where the diary puts the player. The player is not named, because the page is
 * about him and repeating the name on every row would say nothing.
 */
export function PlayerEntry({ entry }: { entry: Entry }) {
  const { match } = entry.matchSquad

  return (
    <JudgementEntry createdAt={entry.createdAt} tag={entry.tag} note={entry.note}>
      {/* Ink rather than the link colour, as the design draws it, with the base
          stylesheet's hover underline as the whole of the affordance. A profile
          that cannot reach the match it judges is a dead end. */}
      <Link
        href={`/matches/${match.id}`}
        className="rounded-sm text-body text-text focus-visible:focus-ring"
      >
        {scoreline(match)}
      </Link>
    </JudgementEntry>
  )
}
