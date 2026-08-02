import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Runs before every matched request, in Next 16's `proxy.ts` — the file that
 * used to be called `middleware.ts`. Nearly all published Clerk guidance still
 * says `middleware.ts`; that convention is deprecated here.
 *
 * Two jobs: `clerkMiddleware()` reads the session cookie so that `auth()` works
 * during rendering, and the callback bounces signed-out visitors off `/dashboard`.
 *
 * The redirect goes to `/` rather than to a sign-in page, because there is no
 * sign-in page — the form is a modal on the landing page. Clerk's own
 * `auth.protect()` would redirect to its hosted account portal on another
 * domain, which is why it is not used here.
 *
 * This is an optimistic check, not the security boundary. Next's guide is
 * explicit that proxy "should not be used as a full session management or
 * authorization solution" — it can be deployed to a CDN, separately from the
 * render. The check that actually guards data is `requireDbUser()` in
 * `src/lib/auth.ts`, which every reader of user data goes through.
 */
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) return

  const { userId } = await auth()
  if (!userId) return NextResponse.redirect(new URL('/', req.url))
})

export const config = {
  /**
   * Without a matcher this runs on every request, including `_next/static` and
   * everything in `public/` — which would put an auth redirect in front of the
   * CSS. The first pattern excludes static assets by extension, the second
   * forces it back on for API routes, which have no extension to match.
   */
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
