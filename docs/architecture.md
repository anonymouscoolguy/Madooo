# Architecture

How the system works, by subsystem. This file answers "I am about to touch X —
what do I need to know first?", so read the section you are about to work in.

Everything here states what *is* true of the code as it stands. What is built,
what is next, and what is still undecided is in [`roadmap.md`](roadmap.md); the
binding rules are in [`AGENTS.md`](../AGENTS.md) and, for anything that renders,
[`design/foundations.md`](design/foundations.md).

---

## Database and Prisma

### How the database is addressed

Two Neon branches, one connection string each — a branch is a separate endpoint,
so no single URL can select between them. **Development is the default,
always.** Production is reached only by setting `DATABASE_TARGET=production`,
which should never exist on a development machine. This deliberately inverts
Prisma's own default, where the plainly named `DATABASE_URL` wins and a stray
`prisma migrate dev` would migrate production from a laptop.

The direct (unpooled) URL that migrations need is derived from the pooled one by
dropping `-pooler` from the hostname, so only two variables exist. Both endpoints
are required: the app runs through the pooler, but Prisma's migration engine
takes an advisory lock that pgbouncer in transaction mode does not support.

All of this lives in [`src/lib/env.ts`](../src/lib/env.ts).

**The Vercel deployment reads the development branch**, by decision, until a
production branch is worth filling. So of the database variables it sets
`DATABASE_URL_DEV` and nothing else — no `DATABASE_TARGET`, no `DATABASE_URL` —
and the default above carries it to the right place with no code involved.
(It also carries `SEASON` and the four Clerk variables.) Pointing a deployment
at the dev branch by putting the dev connection string in `DATABASE_URL` would
work equally well and label it a lie; this way the variable names stay true.

Switching to production later means creating the Neon branch, running
`prisma migrate deploy` against its direct endpoint, syncing it, then setting
`DATABASE_TARGET=production` and `DATABASE_URL` on Vercel's production
environment and removing `DATABASE_URL_DEV` there. Preview deployments should
keep pointing at development.

`API_FOOTBALL_KEY` is deliberately absent from Vercel. Nothing may call
API-Football during a page render, and withholding the key makes any code that
tries fail loudly rather than quietly spend the day's quota.

### Prisma 7 differs from most writing about it

`.env` is not loaded automatically ([`prisma.config.ts`](../prisma.config.ts)
does it), a driver adapter is mandatory (`@prisma/adapter-pg`), and the generator
is `prisma-client` writing TypeScript into `src/generated/` — build output,
gitignored, recreated by `npm run db:generate`.

**Run `npm run db:generate` after any schema change.** `prisma migrate dev` has
been seen to leave a stale generated client while `tsc --noEmit` passed anyway:
TypeScript only rejects unknown properties on object *literals*, and the write
data was a variable. The failure surfaced at runtime as "Unknown argument
`goals`".

`npm run db:check` is the fastest way to confirm the database still works end to
end. It refuses to run against production and cleans up after itself.

### Two columns are seeded by hand and never synced

`Team.code` and `Team.colour` — the three-letter abbreviation and the club colour
the design puts where a crest would go. API-Football publishes neither, so
[`scripts/seed-team-identity.ts`](../scripts/seed-team-identity.ts) holds the
table, keyed by API-Football id, and `npm run db:seed-teams` writes it. Run it
after any sync that introduces a club.

- **It only ever `update`s.** A club that is not already in the database means
  the sync has not run, not that there is a row to invent.
- **The provider's spelling of the name is a guard, not a value.** The script
  refuses to write to a row whose stored name does not match its table, so an id
  typed wrong paints nothing rather than painting some other club.
- **The sync cannot undo it**, because `upsertTeams` lists its update columns one
  by one rather than spreading an object. That narrow list is now load-bearing:
  widening it to a spread would blank both columns on the next sync.
- Codes are the league's own abbreviations, not the first three letters of the
  name. The reference screenshots draw `MAN` on both Manchester clubs and `AST`
  on Aston Villa; a badge whose only job is to identify a club has to be able to.
- Both are nullable and both have a fallback, in
  [`src/lib/teams/identity.ts`](../src/lib/teams/identity.ts). An unseeded club
  gets a neutral grey chip, which reads as missing data rather than as a wrong
  fact about the club.

### The connection strings pin `sslmode=verify-full`

Surfaced as a runtime warning from `pg` 8.22, which currently treats the
`sslmode=require` Neon hands out as `verify-full` but will adopt libpq's weaker
meaning in v9 — encrypt without verifying who answered. Nothing about the
connection changed; the parameter now says what was already happening, so the v9
upgrade cannot quietly downgrade it.

---

## Sync and the provider boundary

`npm run sync -- --round 1` costs 21 requests: one for the season's whole
fixture list, then two per fixture for lineups and player statistics.

The provider boundary is [`src/lib/api-football/`](../src/lib/api-football/) —
raw types, a thin client, and a pure mapper. [`src/lib/sync.ts`](../src/lib/sync.ts)
turns mapped objects into rows, and [`scripts/sync.ts`](../scripts/sync.ts) is
the CLI. Nothing under `src/app/` imports any of it.

**Every write is an upsert on a natural key, and nothing is ever deleted.**
`Judgement` cascades off `MatchSquad`, so rewriting squad rows by deleting them
would destroy a user's diary on the next sync. Re-running the sync has been
verified to leave `MatchSquad` ids untouched and a judgement written against one
intact.

### What the API does that its own docs do not say

Read [`api-football-findings.md`](api-football-findings.md) before touching
anything that talks to API-Football. Two findings bind the client's design:

- **There is an undocumented per-minute limit**, found the hard way when a full
  round died after two fixtures with an HTTP 429. The client paces itself at one
  request every 6.5s, so a ten-fixture round takes about two minutes to pull.
- **The daily counter in the response headers is not monotonic** — it was seen
  going 77, 75, 78, 76 in one run.

Quota is 100 requests/day *and* about 10 per minute, and is not generous during
backfills. Sync one or two gameweeks in development, never a whole season.
`npm run sync -- --round 1 --limit 2` is the cheap way to try it.

### What is deliberately unmapped

`penalty.commited` and the wider statistics block. `MatchSquad` carries
`minutes`, `goals`, `assists`, `yellow`, `red` and `rating`; shots, passes,
tackles, duels, dribbles and fouls are parsed by nothing. The API's misspelling
is reproduced only in [`types.ts`](../src/lib/api-football/types.ts) and
corrected at the boundary.

### Anything a page needs from a round string lives in `src/lib/rounds.ts`

`Match.round` holds API-Football's own label, `"Regular Season - 1"`, and the
fixtures page has to order and display it. It may not get that from
[`sync.ts`](../src/lib/sync.ts), which imports the provider client — constraint
#2 is about the import graph, not about intent. So `roundLabel` moved out to
[`rounds.ts`](../src/lib/rounds.ts) and the sync re-exports it for the CLI.

The general shape: **when a page and the sync need the same pure function, it
moves to a third module and both import it.** Dependencies point into the shared
module; nothing ever points out of the sync.

The provider's vocabulary still stops at the boundary in the place that counts —
URLs carry `?matchday=6`, not the label.

### The tests read `scratch/`, which is gitignored

`npm test` runs Vitest over the sync mapper and over the pure helpers the pages
use, reading the real captured payloads at runtime — never JSON invented for the
test. If the same author writes the code and its fixture from one
misunderstanding, they agree with each other and both are wrong. The API response
is ground truth; recollection is not.

That rule pays out beyond the mapper. `dates.ts` was written against remembered
month abbreviations and the payload disagreed: `en-GB` renders September as
`Sept`, four letters where every other month gets three.

The consequence: a fresh clone has no fixtures and `npm test` fails with a
message saying to re-run `scripts/verify_api.py` (about 5 requests). **This is
why `npm test` is not part of the Vercel build and must not become part of one** —
every deployment builds from a fresh clone, so the tests would fail every time.

### Scheduling the sync is an unsolved problem, not an unstarted one

The 6.5s pacing puts a round at about two minutes, past a serverless function's
timeout. A cron route needs chunking or resumability first, so sync deliberately
remains a local CLI.

---

## Auth and routing

Clerk owns identity; the database owns the `User` row. The two meet in exactly
one place, [`src/lib/auth.ts`](../src/lib/auth.ts), where `requireDbUser()`
upserts on `clerkId` and returns our own row. Get-or-create on first sight
rather than a signup webhook, so no public URL is involved and a laptop behaves
like the deployment.

**Sign-in and sign-up are modals on the landing page, not routes.** There is no
`/sign-in` page, so both the proxy and `requireDbUser()` send a signed-out
visitor to `/`, where the buttons are. Clerk's `auth.protect()` is deliberately
unused: with no sign-in URL to go to it redirects to Clerk's hosted account
portal on another domain.

**Next 16 renamed `middleware.ts` to `proxy.ts`, and almost every Clerk guide
still says otherwise.** The file lives at `src/proxy.ts` — alongside `app`, not
at the repo root. Clerk's current quickstart has caught up; most third-party
writing and most model training data has not. The same applies to
`<ClerkProvider>`, which now belongs inside `<body>` rather than wrapped around
`<html>`.

`src/proxy.ts` runs `clerkMiddleware()` on every matched request and redirects
signed-out visitors away from each of the four signed-in destinations. That
redirect is an optimistic check. The check that guards data is `requireDbUser()`
itself, because Next's own guidance is that a proxy may run separately from the
render, and because a check placed in a layout would not re-run on client-side
navigation.

**The `(app)` route group is invisible to the proxy.** `src/proxy.ts` lists every
route inside it one by one, because there is no shared URL segment to match on.
Anything added under `(app)` has to be added there too, or it ships unprotected.
The list is already longer than the sidebar — `/matches/[id]` has no nav item and
is reached only from a fixture card — so "did I add the nav item?" is not the
question to check it against.

**Screen state that survives a reload belongs in the URL, not in React state.**
`/fixtures?matchday=6` is why that page is still a server component: the pager is
two `<Link>`s, no JavaScript ships, and the matchday can be linked to and reached
with the back button. `searchParams` is a Promise in Next 16 and has to be
awaited; `PageProps<'/fixtures'>` derives the prop types from the route literal,
so a path and its types cannot drift apart.

`src/app/(app)/layout.tsx` calls `requireDbUser()`, which is what provisions the
row for everything below it. Nothing there renders anything from the result —
Clerk supplies the name in the sidebar — so the call is purely the upsert plus
the redirect. Server Actions render no layout, so anything that writes will have
to call `requireDbUser()` itself; the upsert is idempotent and memoised per
request with React's `cache()`, so the duplication costs one indexed lookup.

**The shell holds `{children}` behind an `await`.** Fine at this size, but the
session read is a top-level await in a layout, so it delays the first streamed
chunk for the whole segment. Next's guide describes pushing that into a nested
component behind `<Suspense>` if it ever matters.

**`User.email` is nullable and the code respects that.** Google always supplies a
verified address, so in practice it is populated — but the schema permits an
account without one and nothing coerces it. Nothing currently renders it.

**`createRouteMatcher` is deprecated by Clerk**, with "use resource-based auth
checks instead" as the guidance; the dev server says so on every boot. This app
is already resource-based — `requireDbUser()` is the real guard and the proxy
check is documented as optimistic — so removing the matcher would cost little,
but it is a behaviour change: the bounce moves from the edge to the render.

**Clerk is on a development instance.** Its keys work on Vercel, but sessions are
capped and Clerk's components show a development badge.

---

## Design tokens and CSS

[`foundations.md`](design/foundations.md) is the source; `globals.css` is the
only file in the project allowed to hold a hex or a raw px. It has two tiers —
base tokens that never change, semantic tokens that say what a colour is *for* —
and product code names only the second.

**Theming is one `light-dark()` call per semantic token.** That single mechanism
covers both requirements at once: with `color-scheme: light dark` on `:root` the
app follows the operating system, and once step 8.1 writes `data-theme` the
attribute wins, because `[data-theme]` also sets `color-scheme`. Resolution
happens where a variable is *used*, not where it is declared, so the attribute
re-points any subtree.

**The corollary is a rule: no `dark:` utilities anywhere.** A `dark:` class keys
off `prefers-color-scheme`, so it would be a second theming mechanism that
disagrees with the first the moment the toggle exists. The landing page still has
some; it is the one screen not yet converted.

Tailwind gets the tokens through `@theme inline` — `inline` is required, not
stylistic, because only it makes `bg-surface` emit `var(--surface)` rather than
copying the value into a variable of Tailwind's own that would not re-point.
Spacing is deliberately not tokenised: foundations' scale *is* Tailwind's default
4px scale, so `--sp-6` is `p-4` and inventing tokens would give every value two
names. Frame sizes stay plain variables, used as `w-(--sidebar-w)`.

The type scale is ten `@utility` classes rather than font-size tokens, because
each role in foundations is a set of five properties — family, size, weight,
line-height, tracking — and a `text-title` that left the weight to the caller
would be a different design.

### Responsive rules are in `foundations.md` and are binding

Its `### Responsive` section fixes the breakpoints as Tailwind's defaults, states
that chrome changes arrangement rather than scaling, and explains why utilities
are written unprefixed-then-`md:`. Read it before writing markup, the same way as
the rest of the file.

`--row-h-lg` means the same rows, below `md`. Anything tappable follows
`h-(--row-h-lg) md:h-(--row-h)`.

### Things the toolchain does that the source does not show

- **Tailwind 4 and Clerk share a cascade via a named layer.** `globals.css`
  declares `@layer theme, base, clerk, components, utilities;` *before* the
  Tailwind import, because layer order is fixed by first appearance — declared
  after, `clerk` would append last and outrank every utility class. The matching
  `cssLayerName: 'clerk'` is on `<ClerkProvider>`. There is no
  `tailwind.config.js` to configure this from; v4 is CSS-first.
- **Lightning CSS polyfills `light-dark()` rather than passing it through**, into
  a pair of `--lightningcss-light` / `--lightningcss-dark` toggle variables. It
  gets the cascade right — the `[data-theme]` rules are emitted after the
  `prefers-color-scheme` media query, so forcing a theme beats the OS — but the
  compiled CSS looks nothing like the source, which is worth knowing before
  debugging a colour in devtools.
- **The base stylesheet styles every `<a>`**, so chrome links need `no-underline`
  and an explicit colour or they render as blue underlined prose links. `NavItem`,
  `FixtureCard` and the matchday pager all do this. One class is enough despite
  `a:hover` having the higher specificity, because the utilities layer is
  declared after `base` and layer order beats specificity.
- **Club colour is the only colour in product code that is not a token**, and
  `foundations.md` records the exception under Colour. It arrives from
  `Team.colour` as an inline style on the crest chip; the chip's ink is picked by
  WCAG luminance and is `--gray-0` or `--gray-9` — base tokens, because the chip
  sits on a fixed colour and its ink must not flip with the theme.
- **Every date the app renders goes through
  [`src/lib/dates.ts`](../src/lib/dates.ts)**, pinned to `Europe/London`. Vercel
  runs in UTC and a laptop does not, so an unpinned formatter renders one kickoff
  as two different times and, late enough, two different dates. It builds its
  output from `formatToParts` rather than `format` so the month can be cut to
  three letters — see the `Sept` finding above.

### The icon font is a subset, fetched by script

`next/font/google` has no entry for Material Symbols at all, and the full
variable font is 3.96 MB. What works instead: Google's `css2` endpoint accepts
`icon_names=` *together with* an axis selector, and returns only those glyphs
with the FILL axis intact — a few kB for the whole vocabulary in
[`icon-names.ts`](../src/components/icon-names.ts). `npm run icons` fetches it
into `src/app/fonts/`, which is **committed**: unlike `src/generated/` it is
build input, and a fresh clone must build without reaching Google. Treat the
file size as approximate — Google regenerates the upstream font, and a fetch has
been seen to get *smaller* while gaining a glyph.

- **`icon_names` must be sorted alphabetically**, and axis names lowercase first
  then uppercase (`opsz,wght,FILL,GRAD`). Either wrong gives a bare
  `400: Invalid selector` naming neither.
- The script sends a browser User-Agent on purpose. Google serves the old static
  `Material Icons` font to clients it does not recognise, and that font silently
  has no FILL axis.

---

## The app shell

`src/app/(app)/` is a fixed sidebar, a fixed top bar and scrolling content at
`md` (768px) and up; below `md` the sidebar becomes an off-canvas drawer opened
from a menu button in the top bar and closed by Escape, the backdrop or any nav
item.

- **`inert` on `<main>` replaces a focus-trap library**, and the resize listener
  in `app-frame.tsx` exists solely to stop it stranding: widening past `md` with
  the drawer open would otherwise leave the desktop layout inert and unusable
  with no visible cause. Any future overlay that uses `inert` needs the same
  escape hatch.
- **`app-frame.tsx` holds the only copy of the breakpoint written in JavaScript**
  (`FRAME_BREAKPOINT`, 48rem). It is duplicated from the `md:` classes because
  `inert` cannot be driven by a media query. Moving the frame breakpoint means
  changing both.
- **Server components can be handed to client components as props, and stay on
  the server.** `layout.tsx` passes `<Sidebar />` into `AppFrame` rather than
  letting `AppFrame` import it, which is what keeps the sidebar and its Clerk
  `<UserButton>` off the client bundle. The same move is available whenever a
  later slice needs client state wrapped around server-rendered UI.
- **Closing the drawer on navigation is a click handler, not a URL watcher.**
  `react-hooks/set-state-in-effect` rejects the effect version outright, and it
  is also wrong: tapping the already-active nav item navigates nowhere, so there
  would be no URL change to react to. `drawer-context.ts` carries the close
  function down to `NavItem` instead.

---

## Build and deploy

**`npm run build` is `prisma generate && next build`, and has to be.**
`src/generated/` is gitignored build output, so a fresh checkout has no client and
`next build` type-checks `src/lib/prisma.ts` straight into a missing module. The
consequence worth knowing: **`prisma generate` needs a database URL in the
environment**, because [`prisma.config.ts`](../prisma.config.ts) calls
`migrationDatabaseUrl()` at module load. A build with no `DATABASE_URL_DEV` fails
before Next starts.

**Pages that read the database need `export const dynamic = 'force-dynamic'`.**
Next prerenders at build time by default, which would freeze the data into the
deployment and, worse, prove only that the *build container* could reach Neon.
`cacheComponents` is off, so the older route-segment config is the mechanism that
applies; the newer `use cache` model does not.

To reproduce what Vercel does: `rm -rf src/generated && npm run build`. Only that
proves the build regenerates the client rather than leaning on a stale local copy.
Every route under `(app)` should appear as `ƒ` (dynamic) in the route summary —
even the placeholders, because the shell layout reads the session. `/` is `○`
(static) and should stay that way, since the landing page reads no database.

`rm -rf .next` after adding, renaming or moving a route. Next writes typed-route
definitions into `.next/types`, and a stale copy makes `tsc --noEmit` fail — either
citing files that no longer exist, or rejecting `PageProps<'/new/[route]'>` as not
satisfying `AppRoutes` for a route that plainly does exist.
