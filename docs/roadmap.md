# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

**Last updated:** 2026-08-02 (step 6.1; the app shell and the design tokens)

---

## Current state

Real football is in the database and behind a login, inside the frame the
designs ask for: the 2024 season's full fixture list, one gameweek hydrated down
to individual players, and `/fixtures` server-rendering the first twenty
fixtures out of Neon on every request for a signed-in user. It sits in an app
shell — fixed sidebar, fixed top bar, scrolling content — alongside Players,
Teams and Diary, which exist as placeholders. `/` is a public landing page and
is the one screen still on scaffold styling.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Clerk 7.x for auth, with Google and email/password enabled
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a `slice/*` branch flow
  squash-merged into `main`
- Deployed on Vercel from `main`, built with `prisma generate && next build`
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema was designed against
- `npm run db:check` proves the database layer works end to end
- Visual designs exist in a Claude Design project, handed off into
  [`design/`](design/): [`foundations.md`](design/foundations.md) is the token
  set and the rules around it, with `colour.png` and `type-and-space.png` as its
  reference sheets and [`screenshots/`](design/screenshots/) showing the
  fixtures page as intended. The tokens are now CSS, in
  [`src/app/globals.css`](../src/app/globals.css)
- Archivo and JetBrains Mono come from `next/font/google`; the Material Symbols
  subset is committed and refreshed by `npm run icons`
- `npm run sync -- --round 1` fills the database from API-Football; `npm test`
  runs Vitest over the mapper
- `.env.local` holds `API_FOOTBALL_KEY`, `SEASON`, `DATABASE_URL`,
  `DATABASE_URL_DEV` and four Clerk variables; `.env.example` documents the full
  set

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

### What the sync job does

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

### How auth is wired

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

`src/proxy.ts` — Next 16's name for what used to be `middleware.ts` — runs
`clerkMiddleware()` on every matched request and redirects signed-out visitors
away from each of the four signed-in destinations. That redirect is an
optimistic check. The check that guards data is `requireDbUser()` itself,
because Next's own guidance is that a proxy may run separately from the render,
and because a check placed in a layout would not re-run on client-side
navigation.

`src/app/(app)/layout.tsx` calls it, which is what provisions the row for
everything below it. Since 6.1 nothing there renders anything from the result —
Clerk supplies the name in the sidebar — so the call is now purely the upsert
plus the redirect. Server Actions render no layout, so anything that writes will
have to call `requireDbUser()` itself; the upsert is idempotent and memoised per
request with React's `cache()`, so the duplication costs one indexed lookup.

### How the design tokens work

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

**The corollary is a rule: no `dark:` utilities anywhere.** A `dark:` class
keys off `prefers-color-scheme`, so it would be a second theming mechanism that
disagrees with the first the moment the toggle exists. The landing page still
has some; it is the one screen not yet converted.

Tailwind gets the tokens through `@theme inline` — `inline` is required, not
stylistic, because only it makes `bg-surface` emit `var(--surface)` rather than
copying the value into a variable of Tailwind's own that would not re-point.
Spacing is deliberately not tokenised: foundations' scale *is* Tailwind's
default 4px scale, so `--sp-6` is `p-4` and inventing tokens would give every
value two names. Frame sizes stay plain variables, used as `w-(--sidebar-w)`.

The type scale is ten `@utility` classes rather than font-size tokens, because
each role in foundations is a set of five properties — family, size, weight,
line-height, tracking — and a `text-title` that left the weight to the caller
would be a different design.

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

Steps 6 to 8 are cut into slices, each its own branch and squash-merge. The
designs are what cut them: the sidebar asks for four destinations where the
roadmap had three, and several tiles and counts on the fixtures page have no
data behind them yet. **Every slice owns its own empty state** — what its screen
says when it has nothing to show is part of the slice, not a later pass.

- [x] **0 — Verify the data source.** Done; see
      [`api-football-findings.md`](api-football-findings.md).
- [x] **1 — Scaffold.** App scaffolded and on GitHub.
- [x] **2 — Database and schema.** Neon project, Prisma schema, first migration.
      Verified by `npm run db:check`.
- [x] **3 — Sync job.** Pulls the season's fixtures in one request and hydrates
      a round from `/fixtures/lineups` and `/fixtures/players`. Verified by
      `npm test` and by reading the rows.
- [x] **4 — Deploy to Vercel.** Live, with `/` reading fixtures from Neon at
      request time so the deployment proves the database path and not just the
      hosting. Sync is still a local CLI; no cron.
- [x] **5 — Auth.** Clerk wired up, with Google and email/password, signed in
      through a modal on the landing page. `/` is public and the fixture list
      moved to `/dashboard`, which shows the signed-in user's email. The `User`
      row is created on first sight.
- [ ] **6 — The core loop.** Pick a match, see both squads, tag players
      MVP/STANDOUT/FLOP, and have it persist.
  - [x] **6.1 — App shell.** Done. The sidebar, top bar and shared design
        tokens. `/dashboard` became `/fixtures` inside an `(app)` route group,
        with Players, Teams and Diary as siblings behind placeholders, and the
        signed-in identity moved into the sidebar's foot. The search field was
        deliberately left out — a box that does nothing is worse than no box —
        which leaves the top bar empty until 8.1 and 8.2 fill it.
  - [ ] **6.2 — The fixtures page.** Fixture cards with venue, score and team
        badges; the league tab row; the matchday pager. A match with no squad
        rows is visibly not openable.
  - [ ] **6.3 — Match page.** Both squads, read-only: starters, substitutes,
        shirt numbers, positions.
  - [ ] **6.4 — Tagging.** A Server Action writing `Judgement`. Tapping the
        active tag clears it.
  - [ ] **6.5 — Notes.** Free text on any player, on the same row as the tag.
        A note with no tag is valid; clearing both deletes the row.
  - [ ] **6.6 — Counts.** The four stat tiles and the per-fixture
        "N verdicts · N notes" footer. Last deliberately, so the aggregates are
        read against real judgements rather than against zeroes.
- [ ] **7 — Diary, players and teams.** Queries over what step 6 wrote, plus the
      two destinations the sidebar adds.
  - [ ] **7.1 — Diary.** Judgements reverse-chronological, dated, grouped by
        match.
  - [ ] **7.2 — Player profile.** One player's judgements across matches,
        linked from every squad list.
  - [ ] **7.3 — Players index.** The sidebar's Players destination, linking
        into 7.2.
  - [ ] **7.4 — Teams.** A team index and a team profile carrying the user's
        verdicts on that club's players. The one slice here likely to want
        splitting in two.
- [ ] **8 — Chrome.** In the design, needed by nothing above it.
  - [ ] **8.1 — Dark-mode toggle.** The moon icon in the top bar. Until it
        lands, the app follows the operating system and offers no choice.
  - [ ] **8.2 — Search.** Matches, teams and players.

## Remarks that might be important

### Carried over from step 3

- **API-Football has an undocumented per-minute limit**, found the hard way when
  a full round died after two fixtures with an HTTP 429. The client now paces
  itself at one request every 6.5s, so a ten-fixture round takes about two
  minutes to pull. The daily counter in the response headers is also not
  monotonic — it was seen going 77, 75, 78, 76 in one run. Both are recorded in
  [`api-football-findings.md`](api-football-findings.md).
- **`prisma migrate dev` left a stale generated client**, and `tsc --noEmit`
  passed anyway: TypeScript only rejects unknown properties on object *literals*,
  and the write data was a variable. The failure surfaced at runtime as "Unknown
  argument `goals`". Run `npm run db:generate` after any schema change.
- **`penalty.commited` and the wider statistics block are still unmapped**, by
  choice. `MatchSquad` carries `minutes`, `goals`, `assists`, `yellow`, `red` and
  `rating`; shots, passes, tackles, duels, dribbles and fouls are parsed by
  nothing. The API's misspelling is reproduced only in
  [`types.ts`](../src/lib/api-football/types.ts) and corrected at the boundary.
- **The mapper's tests read the payloads in `scratch/`**, which is gitignored.
  A fresh clone has no fixtures and `npm test` will fail with a message saying
  to re-run `scripts/verify_api.py` (about 5 requests). This is why `npm test`
  is not part of the Vercel build and must not become part of one: every
  deployment builds from a fresh clone, so the tests would fail every time.

### Carried over from step 4

- **`npm run build` is `prisma generate && next build`, and has to be.**
  `src/generated/` is gitignored build output, so a fresh checkout has no client
  and `next build` type-checks `src/lib/prisma.ts` straight into a missing
  module. The consequence worth knowing: **`prisma generate` now needs a
  database URL in the environment**, because
  [`prisma.config.ts`](../prisma.config.ts) calls `migrationDatabaseUrl()` at
  module load. A build with no `DATABASE_URL_DEV` fails before Next starts.
- **Pages that read the database need `export const dynamic = 'force-dynamic'`.**
  Next prerenders at build time by default, which would freeze the data into the
  deployment and, worse, prove only that the *build container* could reach Neon.
  `cacheComponents` is off, so the older route-segment config is the mechanism
  that applies; the newer `use cache` model does not.
- **Scheduling the sync is an unsolved problem, not an unstarted one.** The
  client paces at one request every 6.5s, so a round takes about two minutes —
  past a serverless function's timeout. A cron route needs chunking or
  resumability first, so sync deliberately remains a local CLI.
- **`public/next.svg` and `public/vercel.svg` are now unreferenced.** Left in
  place; they cost nothing and deleting them was not what this slice was for.

### Carried over from step 5

- **Next 16 renamed `middleware.ts` to `proxy.ts`, and almost every Clerk guide
  still says otherwise.** The file lives at `src/proxy.ts` — alongside `app`,
  not at the repo root. Clerk's current quickstart has caught up; most
  third-party writing and most model training data has not. The same applies to
  `<ClerkProvider>`, which now belongs inside `<body>` rather than wrapped
  around `<html>`.
- **Tailwind 4 and Clerk share a cascade via a named layer.** `globals.css`
  declares `@layer theme, base, clerk, components, utilities;` *before* the
  Tailwind import, because layer order is fixed by first appearance — declared
  after, `clerk` would append last and outrank every utility class. The
  matching `cssLayerName: 'clerk'` is on `<ClerkProvider>`. There is no
  `tailwind.config.js` to configure this from; v4 is CSS-first.
- **`User.email` is nullable and the code respects that.** Google always
  supplies a verified address, so in practice it is populated — but the schema
  permits an account without one and nothing coerces it. Since 6.1 nothing
  renders it: the sidebar shows Clerk's name instead.
- **The app shell holds `{children}` behind an `await`.** Fine at this size, but
  the session read is a top-level await in a layout, so it delays the first
  streamed chunk for the whole segment. Next's guide describes pushing that into
  a nested component behind `<Suspense>` if it ever matters.
- **Clerk is on a development instance.** Its keys work on Vercel, but sessions
  are capped and Clerk's components show a development badge.
- **The Neon connection strings pin `sslmode=verify-full`.** Surfaced as a
  runtime warning from `pg` 8.22, which currently treats the `sslmode=require`
  Neon hands out as `verify-full` but will adopt libpq's weaker meaning in v9 —
  encrypt without verifying who answered. Nothing about the connection changed;
  the parameter now says what was already happening, so the v9 upgrade cannot
  quietly downgrade it. Unrelated to auth, found while testing this slice.

### Carried over from step 6.1

- **`next/font/google` has no entry for Material Symbols at all**, and the full
  variable font is 3.96 MB. What works instead: Google's `css2` endpoint accepts
  `icon_names=` *together with* an axis selector, and returns only those glyphs
  with the FILL axis intact — 5.6 kB for the whole vocabulary in
  [`icon-names.ts`](../src/components/icon-names.ts). `npm run icons` fetches it
  into `src/app/fonts/`, which is **committed**: unlike `src/generated/` it is
  build input, and a fresh clone must build without reaching Google.
  - **`icon_names` must be sorted alphabetically**, and axis names lowercase
    first then uppercase (`opsz,wght,FILL,GRAD`). Either wrong gives a bare
    `400: Invalid selector` naming neither. This cost most of the time the icon
    work took.
  - The script sends a browser User-Agent on purpose. Google serves the old
    static `Material Icons` font to clients it does not recognise, and that font
    silently has no FILL axis.
- **Lightning CSS polyfills `light-dark()` rather than passing it through**, into
  a pair of `--lightningcss-light` / `--lightningcss-dark` toggle variables. It
  gets the cascade right — the `[data-theme]` rules are emitted after the
  `prefers-color-scheme` media query, so forcing a theme beats the OS — but the
  compiled CSS looks nothing like the source, which is worth knowing before
  debugging a colour in devtools.
- **The base stylesheet styles every `<a>`**, so chrome links need
  `no-underline` and an explicit colour or they render as blue underlined prose
  links. `NavItem` does this; anything else linking outside body copy will have
  to.
- **`createRouteMatcher` is deprecated by Clerk**, with "use resource-based auth
  checks instead" as the guidance. The dev server says so on every boot. This
  app is already resource-based — `requireDbUser()` is the real guard and the
  proxy check is documented as optimistic — so removing the matcher would cost
  little, but it is a behaviour change (the bounce moves from the edge to the
  render) and was not part of this slice.
- **The fixtures list is still the old markup on new tokens.** Cards, badges,
  the league tab row and the matchday pager are 6.2, and the four stat tiles and
  per-fixture counts are 6.6. The page currently says "first 20 fixtures"
  because that is what it does.
- **The `(app)` route group is invisible to the proxy.** `src/proxy.ts` lists
  the four destinations one by one, because there is no shared URL segment to
  match on. A fifth destination has to be added there as well as to the sidebar,
  or it ships unprotected.

## Long-term remarks

Standing constraints that were agreed explicitly, cannot be read off the code,
and outlive any one slice. Each names what would resolve it. A high bar — an
empty list is the expected state.

- **A `Match` can exist with no squad rows, and code must cope with that.**
  Right now only round 1 is hydrated: all 380 matches exist as rows, but the
  other 370 have no `MatchLineup` and no `MatchSquad`. Anything that lets a user
  pick a match therefore has to handle a match nobody can be judged in, rather
  than assuming a squad is there. Hydrating one more round costs 21 requests.
  *Can be resolved when the entire database is produced.*

  Kept here by explicit decision rather than because it clears the bar above —
  the current hydration state is readable from the database, and the entry is a
  reminder that the empty case is real. Note that fixtures are published long
  before team news, so a match with no squad will still occur in production for
  anything not yet played, even once the backfill is complete.

## Testing

**Vitest is set up.** `npm test` runs 19 tests over the sync mapper, reading the
real captured payloads from `scratch/` at runtime — never JSON invented for the
test. If the same author writes the mapper and its fixture from one
misunderstanding, they agree with each other and both are wrong. The API
response is ground truth; recollection is not.

- **Playwright** later, for one flow only: log in → tag a player → see it in the
  diary.
- Do not test Prisma, Next's rendering, or other third-party code.

## Open decisions

- **Where team codes and club colours come from.** The design puts a three-letter
  code on a club-coloured rectangle where a crest would go — a substitute for
  crests, not a step towards them, so `Team.logo` still renders nowhere. Neither
  field is in the schema. Two known problems: the screenshots show `MAN` for both
  Manchester clubs, so the codes have to distinguish them; and API-Football does
  not publish club colours at all. `MatchLineup` does carry kit colours, but
  those are the kit worn in one match — possibly a third kit in a colour the club
  is not known by — so they describe a shirt, not an identity. Needed by 6.2.
- **What "watched" counts.** The first tile on `/fixtures` reads "WATCHED 14 this
  season" and no such concept exists. The obvious reading is matches in which
  this user has recorded at least one judgement, which makes it a query rather
  than a new column, but it has not been agreed. Needed by 6.6.
- **The sidebar's avatar contradicts the design.** The foot is Clerk's
  `<UserButton showName />`, chosen because its menu is the only way to sign
  out. Its avatar is the Google profile photo, or a coloured gradient when there
  is none, and `foundations.md` forbids both photography and gradients. The
  design draws a grey circle with the user's initials. Replacing it means either
  restyling Clerk's internals or rendering our own chip and finding somewhere
  else for sign-out. Not urgent, but it is a knowing breach rather than an
  oversight.
- **The landing page `/` is still on scaffold styling** — `zinc-*` palette
  classes, `rounded-full` buttons, `dark:` utilities. Left out of 6.1 by
  decision to keep that slice to the signed-in shell. Nothing depends on it, but
  it means the app currently speaks two visual languages and is the only place a
  `dark:` utility survives.
- **Paid API tier.** Buy one to two weeks before launch, not on launch day.
- **Clerk production instance.** A development instance uses Clerk's shared
  Google OAuth credentials, which a production one may not. Promoting it means
  creating a Google Cloud project and an OAuth client, and swapping the keys on
  Vercel. Same timing as the API tier — before launch, not on launch day.

## Notes for a fresh session

- Read [`api-football-findings.md`](api-football-findings.md) before touching
  anything that talks to API-Football. It records what the API *does*, which
  differs from what its own metadata advertises.
- The free tier serves seasons 2022–2024 only. Development is `SEASON=2024`.
- Quota is 100 requests/day *and* about 10 per minute, and is not generous
  during backfills. Sync one or two gameweeks in development, never a whole
  season. `npm run sync -- --round 1 --limit 2` is the cheap way to try it.
- Prisma is on 7.x, which differs from most writing about it: `.env` is not
  loaded automatically (`prisma.config.ts` does it), a driver adapter is
  mandatory, and the generator is `prisma-client` writing TypeScript into
  `src/generated/` — build output, gitignored, recreated by `npm run db:generate`.
- `npm run db:check` is the fastest way to confirm the database still works. It
  refuses to run against production and cleans up after itself.
- To reproduce what Vercel does, `rm -rf src/generated && npm run build`. Only
  that proves the build regenerates the client rather than leaning on a stale
  local copy. `/fixtures`, `/players`, `/teams` and `/diary` should all appear as
  `ƒ` (dynamic) in the route summary — even the placeholders, because the shell
  layout reads the session. `/` is `○` (static) and should stay that way, since
  the landing page reads no database.
- `rm -rf .next` after renaming or moving a route. Next writes typed-route
  definitions into `.next/types`, and a stale copy makes `tsc --noEmit` fail
  citing files that no longer exist.
