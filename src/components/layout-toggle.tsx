import { Icon } from './icon'
import type { Layout } from '@/lib/rankings'

/**
 * Rows or cards: the app's first segmented control.
 *
 * Two buttons rather than a third `<select>`, because the choice is between two
 * things and both fit on screen — foundations' own reason for preferring tabs to
 * a dropdown wherever the options are few.
 *
 * **The selected one fills with `--surface-inverse`**, which is what foundations
 * gives a selected pill tab and what the filled button uses. The glyph does *not*
 * take `FILL 1`: foundations scopes the fill axis to an applied verdict, the
 * active nav item and a favourited player, and the inverse fill already says
 * "on" here without borrowing a signal that means something else. The two
 * reference frames happen to disagree with each other on this button's selected
 * state, so it was a decision either way.
 *
 * `aria-pressed` rather than `role="tablist"`: these do not switch between
 * panels, they redraw one. A tablist would promise arrow-key navigation between
 * tab stops that do not exist.
 */

const OPTIONS: readonly { layout: Layout; icon: 'view_list' | 'grid_view'; label: string }[] = [
  { layout: 'list', icon: 'view_list', label: 'Show as rows' },
  { layout: 'grid', icon: 'grid_view', label: 'Show as cards' },
]

/** Written out per state, since Tailwind reads class names as source text. */
const SELECTED = 'bg-surface-inverse text-inverse'
const RESTING = 't-hover text-muted hover:bg-surface-alt hover:text-text'

export function LayoutToggle({
  layout,
  onChange,
}: {
  layout: Layout
  onChange: (layout: Layout) => void
}) {
  return (
    <div role="group" aria-label="Layout" className="flex items-center gap-1">
      {OPTIONS.map((option) => {
        const current = option.layout === layout

        return (
          <button
            key={option.layout}
            type="button"
            aria-pressed={current}
            onClick={() => onChange(option.layout)}
            className={`flex size-(--control-h-lg) items-center justify-center rounded-md focus-visible:focus-ring md:size-(--control-h) ${
              current ? SELECTED : RESTING
            }`}
          >
            <Icon name={option.icon} size="md" />
            {/* The icon is `aria-hidden`, as every icon in this app is, so the
                button would otherwise have no accessible name at all. */}
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
