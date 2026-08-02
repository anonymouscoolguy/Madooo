import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * The signed-in user, as a row in our own database, created on first sight.
 *
 * Clerk owns identity and mints ids like `user_2abc…`, but `Judgement.userId`
 * points at our own autoincrementing `User.id`. This upsert on `clerkId` is the
 * only place the two are joined, so nothing else needs to know Clerk exists.
 *
 * Get-or-create rather than a signup webhook: it needs no public URL, so it
 * behaves the same on a laptop as on Vercel, and a user can never end up
 * without a row.
 *
 * The auth check lives in here rather than in a layout on purpose. Layouts do
 * not re-render on client-side navigation, so a check placed in one is not run
 * again on a route change; putting it at the point the data is read means every
 * caller is covered, including Server Actions, which render no layout at all.
 *
 * `cache()` is React's per-request memo: several callers in one render — the
 * header, a page, an action — share a single upsert. It is not a cache across
 * requests, so it never serves one user's row to another.
 */
export const requireDbUser = cache(async () => {
  // To the landing page, where the sign-in modal lives — the same destination
  // the proxy uses, so a signed-out caller lands in one place however it got
  // here. `redirect()` throws, so nothing below runs without a session.
  const { userId } = await auth()
  if (!userId) redirect('/')

  const clerkUser = await currentUser()
  if (!clerkUser) throw new Error('session has a userId but no user')

  // `User.email` is nullable, so an account with no primary address is a real
  // row rather than a failure. Google always supplies one; email/password
  // signup does too, but the type allows for neither.
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null

  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: { email },
    create: { clerkId: clerkUser.id, email },
  })
})
