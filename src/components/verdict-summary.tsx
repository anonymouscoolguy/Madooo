import { summariseVerdicts } from '@/lib/verdicts'
import type { JudgementTag } from '@/lib/verdicts'
import type { SquadEntry } from '@/lib/matches'

/**
 * "Your verdicts" — everything judged in this match, under the two benches.
 *
 * The same card as `SquadPanel`, full width. Player names are plain text and not
 * the links the reference screenshot draws in blue: 7.2 is the player profile
 * they would point at, and it does not exist yet.
 */

/**
 * Written out per verdict rather than composed, for the reason Tailwind forces:
 * it finds class names by scanning source text, so a name assembled at runtime
 * never reaches the stylesheet.
 */
const BADGE: Record<JudgementTag, string> = {
  MVP: 'bg-mvp-bg text-mvp',
  STANDOUT: 'bg-standout-bg text-standout',
  FLOP: 'bg-flop-bg text-flop',
}

export function VerdictSummary({ entries }: { entries: SquadEntry[] }) {
  const verdicts = summariseVerdicts(entries)

  return (
    <section className="mt-4 overflow-hidden rounded-md border border-border bg-surface md:mt-6">
      <header className="bg-surface-header px-4 py-2">
        <h2 className="text-caps">Your verdicts</h2>
      </header>

      {verdicts.length === 0 ? (
        // The panel stays rather than appearing on the first tap. A card that
        // materialises under the benches would shift the page exactly when the
        // reader is aiming at another row.
        <p className="px-4 py-3 text-body text-muted">
          Nothing judged yet. Tap a verdict beside any player.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {verdicts.map(({ entry, tag }) => (
            <li
              key={entry.id}
              className="flex min-h-(--row-h-lg) items-center justify-between gap-3 px-4 py-2 md:min-h-(--row-h)"
            >
              <span className="truncate text-body">{entry.player.name}</span>
              {/* A 20px badge, foundations' smallest tinted thing — the same
                  family as the crest chip, and one of the exactly two places
                  caps are allowed: the three verdict words. */}
              <span
                className={`inline-flex h-5 shrink-0 items-center rounded-sm px-2 text-caps ${BADGE[tag]}`}
              >
                {tag}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
