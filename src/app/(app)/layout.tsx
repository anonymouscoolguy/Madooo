import { AppFrame } from '@/components/app-frame'
import { Sidebar } from '@/components/sidebar'

/**
 * The app shell: everything a signed-in user sees is rendered inside this.
 *
 * `(app)` is a **route group** — a folder in parentheses organises files without
 * appearing in the URL, so `(app)/fixtures/page.tsx` still serves `/fixtures`.
 * It exists so one layout can wrap all four destinations without inventing an
 * `/app` path segment nobody would ever type.
 *
 * **This reads nothing, and that is what lets `loading.tsx` work.** It used to
 * `await requireDbUser()`, which provisioned the local `User` row for everything
 * below it. Next's `loading.js` guide is explicit that a layout reading runtime
 * data gets no fallback — without Cache Components, navigation blocks until the
 * layout has finished — so a session read here held back the skeleton for every
 * route in the group. Nothing is lost by removing it: the call was never the
 * guard, and every page and both Server Actions call `requireDbUser()` for
 * themselves already, so the row is still provisioned on first sight and every
 * reader of user data is still checked at the point it reads.
 *
 * What remains is a static shell — sidebar, top bar, frame — which Next can send
 * immediately while the page's own queries are still running.
 *
 * `<Sidebar />` is handed over as a **prop, not imported by `AppFrame`**. That
 * is what keeps it a server component: `'use client'` pulls a module's imports
 * into the browser bundle, but not the already-rendered output passed into it.
 * So the sidebar and the Clerk `<UserButton>` it holds still render on the
 * server, and only the frame's own logic ships.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AppFrame sidebar={<Sidebar />}>{children}</AppFrame>
  )
}
