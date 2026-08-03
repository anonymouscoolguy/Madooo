'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseDrawerProvider } from './drawer-context'
import { TopBar } from './top-bar'

/**
 * The shell's layout, and the one piece of state it needs: is the drawer open.
 *
 * That state has to live here because two separate things share it — the menu
 * button in the top bar opens the drawer, and the sidebar is the thing opened.
 * React state only flows downwards, so the owner must sit above both.
 *
 * `sidebar` arrives as a **prop rather than an import**, and that distinction is
 * the whole reason this file can be `'use client'` without dragging the sidebar
 * into the browser bundle with it. Marking a module `'use client'` pulls in
 * everything it imports, but *not* components handed to it as props or children:
 * those were already rendered on the server, and what arrives here is their
 * output. So `<Sidebar>` — and the Clerk `<UserButton>` inside it — stay server
 * components, exactly as `nav-item.tsx` describes keeping the boundary narrow.
 */

/**
 * Mirrors Tailwind's `md`, which every `md:` class below is keyed to. 48rem is
 * 768px at the default root size.
 *
 * This is the one place the frame breakpoint is written in JavaScript instead of
 * in a class, and it exists only because `inert` cannot be driven by a media
 * query — see the resize effect. If the frame breakpoint ever moves, it moves
 * here and in the `md:` prefixes together.
 */
const FRAME_BREAKPOINT = '(min-width: 48rem)'

type Props = {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function AppFrame({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  // Whether the drawer was open on the previous render, so that focus is only
  // pulled back to the menu button on an actual close. Without it the effect
  // below would fire on first mount and steal focus on every page load.
  const wasOpen = useRef(false)

  const close = useCallback(() => setOpen(false), [])

  // Widening past the breakpoint while the drawer is open would strand <main>
  // inert on a desktop layout — an unusable page with no visible cause. The
  // drawer is a small-screen affordance, so crossing into the large-screen
  // layout simply ends it.
  useEffect(() => {
    const query = window.matchMedia(FRAME_BREAKPOINT)
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false)
    }

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Escape closes, which users expect of anything overlaying the page.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // Focus follows the drawer in and back out again, or a keyboard user is left
  // with their focus on a control that is no longer where they are.
  useEffect(() => {
    if (open) drawerRef.current?.focus()
    else if (wasOpen.current) menuButtonRef.current?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open])

  return (
    /*
      Two columns, two rows, with the sidebar spanning both rows — but only from
      `md` up. Below it the grid is a single column: the sidebar is `fixed`, so
      it leaves the flow entirely and the top bar and <main> fall into the two
      rows on their own.

      `h-dvh` pins the whole thing to the viewport and only <main> is allowed to
      scroll, which is what makes the sidebar and top bar fixed without any of
      them leaving the normal flow via `position: fixed` at desktop widths — no
      magic offsets to keep in sync.

      `dvh` rather than `vh` so that a mobile browser's collapsing address bar
      does not leave the sidebar's foot below the fold.
    */
    <div className="grid h-dvh grid-cols-[1fr] grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[auto_1fr]">
      {/*
        Below `md` this is an off-canvas drawer: fixed to the left edge and
        translated fully out of view, sliding back in when open. At `md` it
        returns to being an ordinary grid column and the transform is switched
        off, so the desktop layout is exactly what it was before.

        `tabIndex={-1}` makes it focusable programmatically without adding it to
        the tab order — it is the target the focus effect above moves to.
      */}
      <div
        id="app-sidebar"
        ref={drawerRef}
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-(--dur-3) ease-out md:static md:z-auto md:row-span-2 md:translate-x-0 md:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/*
          Tapping a nav item has to close the drawer, or the new page loads
          behind it. Done on the click rather than by watching the URL, because
          tapping the item that is *already* active navigates nowhere — there
          would be no URL change to react to, and the drawer would stay open.
        */}
        <CloseDrawerProvider value={close}>{sidebar}</CloseDrawerProvider>
      </div>

      {/*
        The backdrop. Dismisses on click, and being drawn over <main> it also
        catches the scroll and touch events that would otherwise reach the page
        behind the drawer.
      */}
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={close}
          className="fixed inset-0 z-40 bg-overlay md:hidden"
        />
      ) : null}

      <TopBar ref={menuButtonRef} menuOpen={open} onMenuClick={() => setOpen((v) => !v)} />

      {/*
        `inert` while the drawer is open removes this whole subtree from the tab
        order, from the accessibility tree and from pointer events, in one
        attribute — the job a focus-trap library would otherwise do. React 19
        supports it as a real boolean prop.

        The top bar is deliberately *not* inert: it holds the menu button, which
        has to stay reachable to close what it opened.

        **`relative` is load-bearing and is not a positioning decision.** It
        makes <main> a containing block for absolutely positioned descendants.
        Tailwind's `sr-only` is `position: absolute` with no offsets, so without
        this those spans resolve against the *initial containing block* — the
        document — instead of against the element that scrolls them. They then
        escape this scroll container entirely and add their own position to the
        document's scrollable height, one per label, the lowest one winning. The
        symptom is a page that scrolls a second time after <main> has reached its
        end, into empty space below the frame. One screen-reader label at the
        foot of a long list is enough to cause it.
      */}
      <main inert={open} className="relative overflow-y-auto bg-page">
        <div className="mx-auto max-w-(--container) p-4 md:p-6">{children}</div>
      </main>
    </div>
  )
}
