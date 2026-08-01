# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

**Last updated:** 2026-08-01 (step 4)

---

## Current state

Real football is in the database and on a page: the 2024 season's full fixture
list, one gameweek hydrated down to individual players, and `/` server-rendering
the first twenty fixtures out of Neon on every request. No auth.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a `slice/*` branch flow
  squash-merged into `main`
- Deployed on Vercel from `main`, built with `prisma generate && next build`
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema was designed against
- `npm run db:check` proves the database layer works end to end
- `npm run sync -- --round 1` fills the database from API-Football; `npm test`
  runs Vitest over the mapper
- `.env.local` holds `API_FOOTBALL_KEY`, `SEASON`, `DATABASE_URL` and
  `DATABASE_URL_DEV`; `.env.example` documents the full set

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
production branch is worth filling. So it sets `DATABASE_URL_DEV` and `SEASON`
and nothing else — no `DATABASE_TARGET`, no `DATABASE_URL` — and the default
above carries it to the right place with no code involved. Pointing a deployment
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

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

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
- [ ] **5 — Auth.** Clerk wired up. Success looks like logging in and seeing
      your own email on screen. Nothing more.
- [ ] **6 — The core loop.** Pick a match, see both squads, tag players
      MVP/STANDOUT/FLOP, and have it persist.
- [ ] **7 — Diary and player views.** Both are queries over what step 6 already
      wrote; no new concepts.

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

- **Paid API tier.** Buy one to two weeks before launch, not on launch day.

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
  local copy. `/` should appear as `ƒ` (dynamic) in the route summary, not `○`.
