# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

**Last updated:** 2026-08-01

---

## Current state

Scaffold runs, API-Football is verified, and the database exists with its schema
migrated. No sync job, no auth, nothing user-facing yet.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a `slice/*` branch flow
  squash-merged into `main`
- `npm run dev` serves the untouched starter page on port 3000
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema was designed against
- `npm run db:check` proves the database layer works end to end
- `.env.local` holds `API_FOOTBALL_KEY`, `DATABASE_URL` and `DATABASE_URL_DEV`;
  `.env.example` documents the full set

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

All of this lives in [`src/lib/env.ts`](../src/lib/env.ts). A deployed
environment therefore needs `DATABASE_TARGET=production` and `DATABASE_URL`
set, and must *not* have `DATABASE_URL_DEV`.

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

- [x] **0 — Verify the data source.** Done; see
      [`api-football-findings.md`](api-football-findings.md).
- [x] **1 — Scaffold.** App scaffolded and on GitHub.
- [x] **2 — Database and schema.** Neon project, Prisma schema, first migration.
      Verified by `npm run db:check`.
- [ ] **3 — Sync job.** Pull one gameweek of the 2024 season into Postgres and
      inspect the rows directly. This is the first genuinely satisfying
      milestone.
- [ ] **4 — Deploy to Vercel.** Get the app onto real hosting while it is still
      small enough that a deployment problem is the only problem.
- [ ] **5 — Auth.** Clerk wired up. Success looks like logging in and seeing
      your own email on screen. Nothing more.
- [ ] **6 — The core loop.** Pick a match, see both squads, tag players
      MVP/STANDOUT/FLOP, and have it persist.
- [ ] **7 — Diary and player views.** Both are queries over what step 6 already
      wrote; no new concepts.

## Remarks that might be important

### Carried over from step 2

- **`SEASON` is documented in `.env.example` but nothing reads it yet**, and it
  is absent from `.env.local`. There is no config module for it.
- **Three payload gotchas the mapper will meet**, all recorded in
  [`api-football-findings.md`](api-football-findings.md): `rating` arrives as a
  string, `penalty.commited` is misspelled by the API, and most statistics are
  null. Only `rating` is currently mapped.
- **Per-match player statistics are not in the schema.** `MatchSquad` holds
  `minutes`, `shirtNumber`, `position`, `isStarter` and `grid` only. Goals,
  assists, cards and rating are all still unmapped. Adding them is a migration
  plus a re-sync of the development gameweek.
- **Nothing imports `src/lib/prisma.ts` from a route yet**, so `npm run build`
  does not currently prove the generated client bundles. It was verified once
  with a throwaway route, and has had no real consumer since.

## Long-term remarks

Standing constraints that were agreed explicitly, cannot be read off the code,
and outlive any one slice. Each names what would resolve it. A high bar — an
empty list is the expected state.

## Testing

Agreed but not yet set up. Deliberate: there is nothing worth testing until the
sync mapper exists.

- **Vitest** for the sync mapper, which is the highest-risk code we will write —
  `rating` arrives as a string, their penalty key is misspelled `commited`, and
  most statistics are null.
- **Fixtures must be the real captured payloads from `scratch/`**, never JSON
  invented for the test. If the same author writes the mapper and its test from
  one misunderstanding, they agree with each other and both are wrong. The API
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
- Quota is 100 requests/day and is not generous during backfills. Sync one or
  two gameweeks in development, never a whole season.
- Prisma is on 7.x, which differs from most writing about it: `.env` is not
  loaded automatically (`prisma.config.ts` does it), a driver adapter is
  mandatory, and the generator is `prisma-client` writing TypeScript into
  `src/generated/` — build output, gitignored, recreated by `npm run db:generate`.
- `npm run db:check` is the fastest way to confirm the database still works. It
  refuses to run against production and cleans up after itself.
