'use client'

import { createContext, useContext } from 'react'

/**
 * How a nav item tells the drawer to close, without the sidebar having to know
 * a drawer exists.
 *
 * React context is the escape hatch from passing a prop down through every
 * intervening component — the rough equivalent of a contextvar in Python, scoped
 * to a subtree of the UI rather than to a call stack. It is needed here because
 * `AppFrame` cannot hand props to `<Sidebar>` at all: the sidebar arrives as
 * already-rendered server output, so there is nothing left to pass props to.
 * Context reaches `NavItem` anyway, because it travels by position in the
 * rendered tree rather than through imports.
 *
 * It lives in its own module so that `NavItem` does not have to import
 * `AppFrame` — and with it the top bar and icons — just to read one function.
 *
 * The default is a no-op, which is what makes the sidebar usable outside a
 * drawer: at `md` and up there is nothing to close, and nothing has to care.
 */
const CloseDrawerContext = createContext<() => void>(() => {})

export const CloseDrawerProvider = CloseDrawerContext

export function useCloseDrawer() {
  return useContext(CloseDrawerContext)
}
