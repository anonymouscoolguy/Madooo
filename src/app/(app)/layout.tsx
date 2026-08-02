import { requireDbUser } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'

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

  return (
    /*
      Two columns, two rows, with the sidebar spanning both rows. `h-dvh` pins
      the whole thing to the viewport and only <main> is allowed to scroll, which
      is what makes the sidebar and top bar fixed without any of them leaving the
      normal flow via `position: fixed` — no magic offsets to keep in sync.

      `dvh` rather than `vh` so that a mobile browser's collapsing address bar
      does not leave the sidebar's foot below the fold.
    */
    <div className="grid h-dvh grid-cols-[auto_1fr] grid-rows-[auto_1fr] overflow-hidden">
      <Sidebar />
      <TopBar />
      <main className="overflow-y-auto bg-page">
        <div className="mx-auto max-w-(--container) p-6">{children}</div>
      </main>
    </div>
  )
}
