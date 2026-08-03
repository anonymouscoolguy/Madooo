'use client'

import { startTransition, useOptimistic } from 'react'

import { Icon } from './icon'
import { setVerdict } from '@/lib/actions'
import type { IconName } from './icon-names'
import type { JudgementTag } from '@/lib/verdicts'

/**
 * The three verdict chips on a squad row.
 *
 * A small client island per row; the row around it stays a server component, so
 * nothing but this goes into the browser bundle. `'use client'` marks the
 * boundary — everything imported from here down is client code, and importing a
 * Server Action across it is the one exception, because what crosses is a
 * reference rather than the function body.
 */

/**
 * Left to right as the design draws them, each with the glyph and the word.
 *
 * The selected classes are written out per verdict rather than composed from the
 * tag, because Tailwind finds class names by scanning the source as text — a
 * name built at runtime is a name it never sees, and the CSS for it is never
 * generated.
 *
 * `satisfies` rather than a type annotation: it checks the shape without
 * widening it, so `tag` stays the three literals TypeScript can narrow on and
 * does not decay into `string`.
 */
const CHIPS = [
  {
    tag: 'STANDOUT',
    icon: 'trending_up',
    label: 'Standout',
    selected: 'border-standout bg-standout-bg text-standout',
  },
  {
    tag: 'FLOP',
    icon: 'trending_down',
    label: 'Flop',
    selected: 'border-flop bg-flop-bg text-flop',
  },
  {
    tag: 'MVP',
    icon: 'star',
    label: 'MVP',
    selected: 'border-mvp bg-mvp-bg text-mvp',
  },
] as const satisfies readonly {
  tag: JudgementTag
  icon: IconName
  label: string
  selected: string
}[]

/**
 * Resting is a plain outlined chip in muted grey, and it has to be: most players
 * stay unrated, so this is the state the page is mostly made of.
 *
 * The hover here is foundations' standard one — the surface darkens a step, the
 * border strengthens, muted ink goes to full. A **selected** chip deliberately
 * gets none of it: foundations' hover rule is "surfaces darken one step", and a
 * verdict tint has no step below it to darken to. Inventing a hex for one would
 * break the rule the whole token system exists for. Press and the focus ring
 * apply to both states, which is affordance enough.
 */
const RESTING =
  't-hover border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-alt hover:text-text'

type Props = {
  matchSquadId: number
  /** Only for the group's accessible name — the buttons are icons and say nothing on their own. */
  playerName: string
  tag: JudgementTag | null
}

export function VerdictControls({ matchSquadId, playerName, tag }: Props) {
  /*
    `useOptimistic` holds the verdict the user just tapped while the round trip
    is in flight, then drops it the moment the server's own answer arrives in the
    re-render `refresh()` triggers. It is the hook that exists specifically
    because the server is the source of truth: no `useState` copy of the tag is
    kept, so there is nothing to fall out of step with the database.
  */
  const [shown, setShown] = useOptimistic(tag)

  function choose(next: JudgementTag) {
    // Tapping the active verdict clears it. The decision is made here rather
    // than in the action because this is what knows the current state, which is
    // what lets the action be a plain idempotent "set it to this".
    const value = shown === next ? null : next

    // Both calls have to be inside the transition: `setShown` because an
    // optimistic update outside one has nothing to be discarded against, and the
    // action because that is how React knows the transition is still pending.
    startTransition(async () => {
      setShown(value)
      await setVerdict(matchSquadId, value)
    })
  }

  return (
    // `role="group"` with a name, so a screen reader reaching three identically
    // shaped buttons is told whose they are before hearing them.
    <div role="group" aria-label={`Verdict for ${playerName}`} className="flex gap-1">
      {CHIPS.map((chip) => {
        const selected = shown === chip.tag

        return (
          <button
            key={chip.tag}
            type="button"
            onClick={() => choose(chip.tag)}
            // A toggle, not a radio: a radio group cannot be un-chosen, and
            // clearing a verdict is the requirement.
            aria-pressed={selected}
            className={[
              // 40px for a thumb, 32px from `md` up as drawn — the same
              // arrangement-not-scaling move the rows themselves make.
              'flex size-(--control-h-lg) items-center justify-center rounded-md border',
              'active:translate-y-px focus-visible:focus-ring md:size-(--control-h)',
              selected ? chip.selected : RESTING,
            ].join(' ')}
          >
            {/* FILL 1 means "on", and an applied verdict is the example
                foundations gives for it. */}
            <Icon name={chip.icon} size="md" filled={selected} />
            <span className="sr-only">{chip.label}</span>
          </button>
        )
      })}
    </div>
  )
}
