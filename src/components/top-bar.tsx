'use client'

import { Icon } from './icon'

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
 * The top bar, and it is still almost empty on purpose.
 *
 * The design puts a search field and a dark-mode toggle in here, but the search
 * belongs to step 8.2 and the toggle to 8.1 — and a search box that does nothing
 * is worse than no search box. What is left is still doing work: it is the fixed
 * boundary the content scrolls under, and it holds the frame at the height every
 * later slice will drop its controls into.
 *
 * The menu button is the exception, and it is here because the design has no
 * mobile state to have put it anywhere else. It exists only below `md`, where
 * the sidebar has become a drawer and needs something to open it.
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
    </header>
  )
}
