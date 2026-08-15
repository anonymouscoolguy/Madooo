import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * The signed-in user, as a row in our own database, created on first sight.
 *
 * Clerk owns identity and mints ids like `user_2abc…`, but `Judgement.userId`
 * points at our own autoincrementing `User.id`. This is the only place the two
 * are joined, so nothing else needs to know Clerk exists.
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
 * `cache()` is React's per-request memo: several callers in one render — a page
 * and an action — share a single lookup. It is not a cache across requests, so
 * it never serves one user's row to another.
 *
 * **There are two paths, and which one a request takes is the whole of this
 * function's cost.** The fast one is a single indexed read and no network call
 * at all; the slow one runs once per user, ever. Before they were split, every
 * render of every page paid for the slow one — a round trip to Clerk's Backend
 * API plus a write to Postgres, measured together at over 200ms, to re-derive a
 * row that had not changed since the user first signed in.
 */
export const requireDbUser = cache(async () => {
  // `auth()` reads the session cookie that `clerkMiddleware` verified. It is
  // local — no request leaves the server — and its `userId` is the same Clerk
  // id `currentUser()` would return as `.id`, which is what makes the fast path
  // below possible without asking Clerk anything.
  //
  // To the landing page, where the sign-in modal lives — the same destination
  // the proxy uses, so a signed-out caller lands in one place however it got
  // here. `redirect()` throws, so nothing below runs without a session.
  const { userId } = await auth()
  if (!userId) redirect('/')

  // The fast path, and the one every request after a user's first ever visit
  // takes. `User.clerkId` is `@unique`, so this is one indexed lookup.
  const existing = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (existing !== null) return existing

  // The slow path, reached once per user in the app's lifetime: the row does
  // not exist yet, and `User.email` is the one column Clerk alone can supply.
  const clerkUser = await currentUser()
  if (!clerkUser) throw new Error('session has a userId but no user')

  // `User.email` is nullable, so an account with no primary address is a real
  // row rather than a failure. Google always supplies one; email/password
  // signup does too, but the type allows for neither.
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null

  // Still an upsert rather than a create, and the `findUnique` above does not
  // make it redundant: two requests from one new user can both miss and race to
  // insert, and `clerkId` being unique would make the loser throw.
  //
  // **What this no longer does is refresh the email on every render.** Nothing
  // reads the column — the sidebar's identity comes from Clerk's own
  // `<UserButton>` — so a stored address that goes stale after someone changes
  // it in Clerk is invisible. Should anything ever render it, it needs a
  // webhook or a re-read here, not a return to asking Clerk every time.
  return prisma.user.upsert({
    where: { clerkId: userId },
    update: { email },
    create: { clerkId: userId, email },
  })
})
