# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

**Last updated:** 2026-08-01

---

## Current state

Scaffold exists and runs. API-Football is verified end to end. No database, no
auth, no application code of our own yet.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Pushed to `github.com:anonymouscoolguy/Madooo`, working directly on `main`
- `npm run dev` serves the untouched starter page on port 3000
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema should be designed against
- `.env.local` holds `API_FOOTBALL_KEY`

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

- [x] **0 — Verify the data source.** Done; see
      [`api-football-findings.md`](api-football-findings.md).
- [x] **1 — Scaffold and deploy target.** App scaffolded and on GitHub.
      *Deploying the empty app to Vercel is still outstanding, and worth doing
      before there is anything complicated to debug.*
- [ ] **2 — Database and schema.** Neon project, Prisma schema, first migration.
      Nothing user-facing.
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

**Step 2.** Blocked on one thing only: a Neon account and connection string.

1. Create a free project at [neon.tech](https://neon.tech) — no card needed.
2. Copy the **pooled** connection string.
3. Add it to `.env.local` as `DATABASE_URL=...`.

Then, in order:

- Install Prisma, initialise it against Neon.
- Design the schema from the payloads in `scratch/`, not from memory. The
  entities are User, Team, Player, Match, MatchSquad (a player's involvement in
  one match) and Judgement.
- Key constraint to settle: one judgement per user per player per match, which
  is a unique index rather than application logic.
- Every entity sourced from the API carries an `apiFootballId` unique column
  alongside our own primary key — their IDs stop at the sync boundary.

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
  it. Not yet done.
- **Branching.** Currently committing directly to `main`. A branch-and-PR flow
  would add a review checkpoint where the whole diff can be read in one view,
  which suits the learning goal — worth adopting for larger pieces such as the
  sync job and auth. Would need `gh` installed (`brew install gh`).
- **Paid API tier.** Buy one to two weeks before launch, not on launch day.

## Notes for a fresh session

- Read [`api-football-findings.md`](api-football-findings.md) before touching
  anything that talks to API-Football. It records what the API *does*, which
  differs from what its own metadata advertises.
- The free tier serves seasons 2022–2024 only. Development is `SEASON=2024`.
- Quota is 100 requests/day and is not generous during backfills. Sync one or
  two gameweeks in development, never a whole season.
