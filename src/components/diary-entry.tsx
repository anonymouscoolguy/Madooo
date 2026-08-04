import Link from 'next/link'
import { playerHref } from '@/lib/back'
import { scoreline } from '@/lib/text'
import { JudgementEntry } from './judgement-entry'
import type { DiaryEntry as Entry } from '@/lib/diary'

/**
 * One diary entry: the date it was written, what was said, the player and the
 * fixture, and the note underneath.
 *
 * The row around it is [`judgement-entry.tsx`](./judgement-entry.tsx), shared
 * with the player profile. All this adds is the line beside the badge, which is
 * the only part the two screens draw differently.
 *
 * Both halves of that line are links, and both in ink rather than the link
 * colour, as the design draws them: the underline the base stylesheet adds on
 * hover is the whole of the affordance, because two blue half-sentences in every
 * row would be the loudest thing on the page.
 */
export function DiaryEntry({ entry, from }: { entry: Entry; from: string }) {
  const { match, player } = entry.matchSquad

  return (
    <JudgementEntry createdAt={entry.createdAt} tag={entry.tag} note={entry.note}>
      {/* Not truncated. A diary should show the whole of a name it was trusted
          with, so a long one wraps instead. */}
      <span className="text-body">
        {/* `from` carries the filter that was on, so Back returns to the diary
            the reader actually left rather than to an unfiltered one. */}
        <Link
          href={playerHref(player.id, from)}
          className="rounded-sm text-text focus-visible:focus-ring"
        >
          {player.name}
        </Link>{' '}
        ·{' '}
        <Link href={`/matches/${match.id}`} className="rounded-sm text-text focus-visible:focus-ring">
          {scoreline(match)}
        </Link>
      </span>
    </JudgementEntry>
  )
}
