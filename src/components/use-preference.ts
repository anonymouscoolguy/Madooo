'use client'

import { useSyncExternalStore } from 'react'

/**
 * A preference remembered in `localStorage`, read without a hydration mismatch.
 *
 * **This is the app's second answer to "the server cannot see what the browser
 * saved", and it exists because the first one does not generalise.** The theme
 * toggle solves it by holding no state at all: `data-theme` on `<html>` is the
 * state, CSS is the only reader, and an inline script in the document head
 * restores it before the first paint. Nothing here can do that, because a
 * preference that reorders a list cannot be expressed in CSS.
 *
 * The shapes that do not work, and why, since all three are the obvious thing to
 * reach for:
 *
 *   - `useState(() => localStorage.getItem(key))` renders one thing on the
 *     server and another in the browser, which is a hydration mismatch.
 *   - `useState(default)` plus an effect paints the default first and
 *     `react-hooks/set-state-in-effect` rejects the shape outright.
 *   - Reading storage during render is the same mismatch as the first, wearing a
 *     different hat.
 *
 * `useSyncExternalStore` is React's own answer for exactly this: a browser API
 * that is not React state and differs between server and client. It takes a
 * separate server snapshot, so the server and the first client render agree by
 * construction, and React re-renders with the real value immediately afterwards.
 *
 * **The cost, stated rather than hidden: the first paint shows the default.** A
 * reader who chose Grid sees the list for one frame after a cold load. That is
 * the trade the localStorage decision buys, and the only thing that would remove
 * it is a store the server can read.
 */

/**
 * Writers in *this* document, which the `storage` event does not cover — it
 * fires in other tabs only, by design, on the theory that the tab that wrote the
 * value already knows. React has to be told either way.
 */
const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

/**
 * **A string or null — a primitive, and that is load-bearing.** React calls this
 * on every render and compares the result with `Object.is`; returning a fresh
 * object each time would never compare equal and would re-render forever.
 *
 * `try` because `localStorage` throws outright in some privacy modes rather than
 * returning null.
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * The server has no storage, and neither does a first-time visitor — both are
 * `null`, both mean "the default", so the two renders agree.
 */
function serverSnapshot(): string | null {
  return null
}

/** The stored string, unvalidated. Every caller runs it through its own parser. */
export function usePreference(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), serverSnapshot)
}

/**
 * Save a preference and tell every hook reading that key.
 *
 * The notify happens whether or not the write succeeded, which is deliberate: if
 * storage is unavailable the choice still applies for this visit, exactly as the
 * theme toggle's does. It simply will not survive a reload — which beats
 * throwing out of a click.
 */
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be disabled or full.
  }
  for (const listener of listeners) listener()
}
