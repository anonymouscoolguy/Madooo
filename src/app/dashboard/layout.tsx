import { UserButton } from '@clerk/nextjs'
import { requireDbUser } from '@/lib/auth'

/**
 * Wraps every route under `/dashboard`, so this is where the local `User` row
 * gets created: `requireDbUser()` upserts on the first request into the section
 * and the row is there for everything below it.
 *
 * The provisioning is a side effect of needing the email for the header, not a
 * guard. The guard is inside `requireDbUser()` itself — see the note there
 * about layouts not re-running on client-side navigation.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireDbUser()

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-end gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.email ?? 'no email on file'}
        </span>
        {/* Clerk's own account menu, and the only way to sign out. */}
        <UserButton />
      </header>
      {children}
    </div>
  )
}
