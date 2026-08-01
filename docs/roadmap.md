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
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a branch-and-PR flow
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

All of this lives in [`src/lib/env.ts`](../src/lib/env.ts).

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

- [x] **0 — Verify the data source.** Done; see
      [`api-football-findings.md`](api-football-findings.md).
- [x] **1 — Scaffold and deploy target.** App scaffolded and on GitHub.
      *Deploying the empty app to Vercel is still outstanding, and worth doing
      before there is anything complicated to debug.*
- [x] **2 — Database and schema.** Neon project, Prisma schema, first migration.
      Verified by `npm run db:check`.
- [ ] **3 — Sync job.** Pull one gameweek of the 2024 season into Postgres and
      inspect the rows directly. This is the first genuinely satisfying
      milestone.
- [ ] **4 — Auth.** Clerk wired up. Success looks like logging in and seeing
      your own email on screen. Nothing more.
- [ ] **5 — The core loop.** Pick a match, see both squads, tag players
      MVP/STANDOUT/FLOP, and have it persist.
- [ ] **6 — Diary and player views.** Both are queries over what step 5 already
      wrote; no new concepts.

## Next action

**Step 3 — the sync job.** Nothing blocks it. Pull one gameweek of the 2024
season into Postgres and read the rows back.

- Add `SEASON` to `.env.local` (`SEASON=2024`) and a config module that reads
  it. `.env.example` already documents it; nothing reads it yet.
- Add the injectable `now()` helper before anything needs it. It is cheap now
  and painful to retrofit — see constraint 4 in `AGENTS.md`.
- Write the mapper: API-Football JSON in, our schema out. This is the one
  translation boundary, and the only code that ever sees their shape.
- Fetch a single round, not a season. `/fixtures` costs 1 request for all 380
  fixtures; lineups and player stats cost 1 each per fixture, so one gameweek is
  roughly 20 requests against a 100/day budget.
- Check the `errors` field on every response. Refusals arrive inside HTTP 200.
- **Set up Vitest here**, against the captured payloads in `scratch/`. The
  mapper is the first code in the project with a real assertion surface.

Three things in the payloads that the mapper must get right, all recorded in
[`api-football-findings.md`](api-football-findings.md): `rating` arrives as a
string, `penalty.commited` is misspelled by the API, and most statistics are
null. Only the first is currently mapped — see below.

### Carried over from step 2

- **Per-match player statistics are not in the schema.** `MatchSquad` holds
  `minutes`, `shirtNumber`, `position`, `isStarter` and `grid` only. Goals,
  assists, cards and rating are all still unmapped. Adding them is a migration
  plus a re-sync of the development gameweek.
- **`Judgement.createdAt` uses `@default(now())`, which is database time** and
  cannot be overridden. That collides with the injectable clock: a replayed
  historical season would stamp diary entries with the real wall clock. Once the
  clock helper exists, writes should pass `createdAt` explicitly.
- **Nothing imports `src/lib/prisma.ts` from a route yet**, so `npm run build`
  does not currently prove the generated client bundles. It was verified once
  with a throwaway route; step 3 or 5 should give it a real consumer.

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

- **Hosting.** Vercel is the obvious default and nothing so far argues against
  it. Not yet done. When it happens, set `DATABASE_TARGET=production` and
  `DATABASE_URL` there, and *not* `DATABASE_URL_DEV`.
- **May we display the logos and photos we store?** `League.logo`, `Team.logo`
  and `Player.photo` hold `media.api-sports.io` URLs. Storing a URL is inert;
  rendering the image is the question, and club crests are trademarks that
  API-Football redistributes under arrangements that may not extend to us. Their
  terms and FAQ pages refuse automated fetches, so this needs reading by hand.
  **Answer before step 6 renders any of them.** Also bears on the `sharp` note
  in `AGENTS.md`, since Next's image optimiser is what would proxy them.
- **Paid API tier.** Buy one to two weeks before launch, not on launch day.

Settled by step 2:

- **Branching.** Adopted. `gh` 2.97.0 is installed and work lands as
  `slice/*` branches merged by squash, so `main` keeps one commit per slice.

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
