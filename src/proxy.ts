import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { isLeagueSlug, LEAGUE_COOKIE } from '@/lib/leagues'

/**
 * Runs before every matched request, in Next 16's `proxy.ts` — the file that
 * used to be called `middleware.ts`. Nearly all published Clerk guidance still
 * says `middleware.ts`; that convention is deprecated here.
 *
 * Three jobs: `clerkMiddleware()` reads the session cookie so that `auth()`
 * works during rendering, the callback keeps each visitor on the side of the
 * login they belong on — signed-out visitors off the app, signed-in ones off
 * `/` — and it remembers which league was last opened on `/fixtures`.
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

/** A year. The choice being remembered is a habit, not a session. */
const A_YEAR = 60 * 60 * 24 * 365

/**
 * Remember the league this request names, so a later bare `/fixtures` can open
 * on it.
 *
 * **The write has to happen here, and nowhere else was available.** A league
 * pill is a plain `<Link>`, which is what keeps the fixtures page free of
 * JavaScript, so there is no click handler to write from; and a Server
 * Component cannot set a cookie at all — Next allows that only in a Server
 * Action or a Route Handler. The proxy is the one place that sees the
 * navigation and can answer it with a header. It sees the soft ones too: a
 * `<Link>` click fetches the RSC payload over the same request path.
 *
 * `undefined` for anything else, which leaves the response exactly as it was.
 * The cookie is only ever *added* to a navigation that was happening anyway.
 *
 * `isLeagueSlug` is a shape check, not an existence check — the proxy has no
 * database. It is here so an arbitrary query parameter cannot be copied into a
 * header we send back on every request; a slug naming no real league is
 * harmless, because `parseLeagueScope` compares it against the leagues it found
 * and falls back.
 */
function rememberLeague(req: NextRequest): NextResponse | undefined {
  if (req.nextUrl.pathname !== '/fixtures') return
  const league = req.nextUrl.searchParams.get('league')
  if (league === null || !isLeagueSlug(league)) return

  const response = NextResponse.next()
  response.cookies.set(LEAGUE_COOKIE, league, {
    path: '/',
    // Nothing in the browser reads it: the fixtures page reads it on the
    // server, which is the whole reason it is a cookie rather than
    // `localStorage`.
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: A_YEAR,
  })
  return response
}

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

  // Last, so it can never write a cookie for a request that was about to be
  // bounced to the landing page.
  return rememberLeague(req)
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
