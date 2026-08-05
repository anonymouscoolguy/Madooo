'use client'

import { Icon } from './icon'
import { ThemeToggle } from './theme-toggle'

type Props = {
  menuOpen: boolean
  onMenuClick: () => void
  /**
   * Forwarded to the menu button so `AppFrame` can return focus here when the
   * drawer closes. A `ref` is React's escape hatch to the real DOM node — the
   * one thing JSX otherwise keeps you away from — and since React 19 it is an
   * ordinary prop rather than something `forwardRef` has to wrap.
   */
  ref?: React.Ref<HTMLButtonElement>
}

/**
 * The top bar: the theme toggle, and below `md` a menu button.
 *
 * The design puts a search field in here too, and it is deliberately not here:
 * search belongs to the screen that has something to search, next to the filters
 * it works with, which is where `/players` and `/teams` each carry their own.
 * The bar is doing work without it: it is the fixed boundary the content scrolls
 * under, and it holds the frame at the height the page's own controls line up to.
 *
 * The menu button is not in the design at all. It is here because the reference
 * images have no mobile state to have put it in, and it exists only below `md`,
 * where the sidebar has become a drawer and needs something to open it. Which
 * is why the toggle carries `ml-auto` rather than the header carrying
 * `justify-between`: at `md` and up the menu button is not there to be spaced
 * away from, and the toggle would drift to the left edge.
 */
export function TopBar({ menuOpen, onMenuClick, ref }: Props) {
  return (
    <header className="flex h-(--rail-w) items-center border-b border-border bg-surface px-2 md:px-5">
      <button
        ref={ref}
        type="button"
        onClick={onMenuClick}
        // `<Icon>` is always aria-hidden, because in this design every icon sits
        // beside a label that already says the same thing. This one does not, so
        // the control around it carries the name instead.
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="t-hover flex size-(--control-h-lg) items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring md:hidden"
      >
        <Icon name={menuOpen ? 'close' : 'menu'} size="lg" />
      </button>

      <ThemeToggle />
    </header>
  )
}
