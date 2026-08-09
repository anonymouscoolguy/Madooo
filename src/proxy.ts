import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Runs before every matched request, in Next 16's `proxy.ts` — the file that
 * used to be called `middleware.ts`. Nearly all published Clerk guidance still
 * says `middleware.ts`; that convention is deprecated here.
 *
 * Two jobs: `clerkMiddleware()` reads the session cookie so that `auth()` works
 * during rendering, and the callback keeps each visitor on the side of the login
 * they belong on — signed-out visitors off the app, signed-in ones off `/`.
 *
 * The signed-out redirect goes to `/` rather than to a sign-in page, because
 * there is no sign-in page — the form is a modal on the landing page. Clerk's
 * own `auth.protect()` would redirect to its hosted account portal on another
 * domain, which is why it is not used here.
 *
 * That modal is also why the redirect has to run in both directions. Clerk's
 * `<SignInButton>` is inert once a session exists, so a signed-in user who
 * reaches `/` gets a page whose only two controls do nothing, and no other
 * navigation — the sidebar belongs to the app shell. The bounce to `/fixtures`
 * lives here rather than in the page itself because reading the session during
 * render would make `/` dynamic, and it is the one route that prerenders.
 *
 * This is an optimistic check, not the security boundary. Next's guide is
 * explicit that proxy "should not be used as a full session management or
 * authorization solution" — it can be deployed to a CDN, separately from the
 * render. The check that actually guards data is `requireDbUser()` in
 * `src/lib/auth.ts`, which every reader of user data goes through.
 */
/**
 * Every route inside the `(app)` group, listed one by one rather than matched by
 * a shared prefix: the route group is invisible in the URL, so there is no path
 * segment to match on. Anything added under `(app)` has to be added here too, or
 * it ships unprotected.
 *
 * Note that this is longer than the sidebar: `/matches/[id]` is a destination
 * with no nav item, reached only from a fixture card.
 */
const isProtectedRoute = createRouteMatcher([
  '/fixtures(.*)',
  '/matches(.*)',
  '/players(.*)',
  '/teams(.*)',
  '/diary(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  /**
   * An exact match rather than a `createRouteMatcher` entry: there is no pattern
   * to express, and the rule must not reach any path below `/`.
   */
  const isLanding = req.nextUrl.pathname === '/'
  if (!isLanding && !isProtectedRoute(req)) return

  const { userId } = await auth()

  if (isLanding) {
    return userId ? NextResponse.redirect(new URL('/fixtures', req.url)) : undefined
  }
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
