import { requireDbUser } from '@/lib/auth'
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
 * `requireDbUser()` is called here for the same reason the old dashboard layout
 * called it: this is the first thing to run inside the signed-in section, so it
 * is where the local `User` row gets provisioned on first sight. Nothing on this
 * page renders anything from it any more — Clerk supplies the name in the
 * sidebar — so the call is now purely the upsert plus an optimistic redirect.
 * It is not the guard. The guard is `requireDbUser()` at the point data is read,
 * because a layout does not re-run on client-side navigation.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireDbUser()

  /*
    The frame itself lives in `AppFrame`, which is a client component because
    the drawer's open/closed state is shared between the top bar's menu button
    and the sidebar, and shared state has to sit above both.

    `<Sidebar />` is handed over as a **prop, not imported by `AppFrame`**. That
    is what keeps it a server component: `'use client'` pulls a module's imports
    into the browser bundle, but not the already-rendered output passed into it.
    So the sidebar and the Clerk `<UserButton>` it holds still render on the
    server, and only the frame's own logic ships.
  */
  return (
    <AppFrame sidebar={<Sidebar />}>{children}</AppFrame>
  )
}
