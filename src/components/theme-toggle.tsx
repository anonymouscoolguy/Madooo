'use client'

import { Icon } from './icon'
import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * Light and dark, in the top bar.
 *
 * **It holds no React state**, which is unusual enough to be worth saying why.
 * The theme lives in one place — `data-theme` on `<html>` — and the only thing
 * that reads it is CSS: the attribute sets `color-scheme`, and every
 * `light-dark()` in `globals.css` re-resolves against it, including the two
 * rules that decide which of this button's icons is displayed. So there is
 * nothing for React to re-render, and nothing for it to remember. The click
 * handler reads the current theme back off the DOM.
 *
 * That is also what keeps the component free of the usual persisted-state
 * problems. The server has no way of knowing what the browser saved, so a
 * `useState` seeded from `localStorage` would render light on the server and
 * dark on the client and trip a hydration mismatch; seeding it in an effect
 * instead would paint the wrong icon first, and `react-hooks/set-state-in-effect`
 * rejects that shape anyway. With no state, none of it arises.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const goDark = root.dataset.theme !== 'dark'

    // The visible change first, so it still happens if storage is unavailable.
    if (goDark) root.dataset.theme = 'dark'
    else delete root.dataset.theme

    try {
      if (goDark) localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      else localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {
      // Storage can be disabled or full. The theme still changed; it just will
      // not survive the next page load, which beats throwing out of a click.
    }
  }

  return (
    /*
      No `aria-label` here, deliberately: the two spans below carry the name
      instead, and a label on the button would override them. Only one span is
      ever displayed, and `display: none` removes an element from the
      accessibility tree as well as from the page — so the button's computed
      name is always the one matching the theme actually on screen, with no
      JavaScript involved in keeping the two in step.

      Sized as a large icon button at every width rather than dropping to
      `--control-h` at `md`, because it sits alone in a 56px rail and because
      `.icon-lg` is a component class that a `md:` prefix cannot reach.
    */
    <button
      type="button"
      onClick={toggle}
      className="t-hover flex size-(--control-h-lg) items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
    >
      <span className="theme-icon-light">
        <Icon name="dark_mode" size="lg" />
        <span className="sr-only">Switch to dark theme</span>
      </span>
      <span className="theme-icon-dark">
        <Icon name="light_mode" size="lg" />
        <span className="sr-only">Switch to light theme</span>
      </span>
    </button>
  )
}
