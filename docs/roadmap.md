# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

How the system *works* is not here. That is
[`architecture.md`](architecture.md), organised by subsystem: read the section
you are about to touch before writing code in it.

**Last updated:** 2026-08-02 (docs split; roadmap and architecture separated)

---

## Current state

Real football is in the database and behind a login, inside the frame the
designs ask for: the 2024 season's full fixture list, one gameweek hydrated down
to individual players, and `/fixtures` server-rendering the first twenty
fixtures out of Neon on every request for a signed-in user. It sits in a
responsive app shell alongside Players, Teams and Diary, which exist as
placeholders. `/` is a public landing page and is the one screen still on
scaffold styling.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Clerk 7.x for auth, with Google and email/password enabled
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a `slice/*` branch flow
  squash-merged into `main`
- Deployed on Vercel from `main`, built with `prisma generate && next build`
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema was designed against
- `npm run db:check` proves the database layer works end to end
- `npm run sync -- --round 1` fills the database from API-Football; `npm test`
  runs Vitest over the mapper
- Visual designs exist in a Claude Design project, handed off into
  [`design/`](design/): [`foundations.md`](design/foundations.md) is the token
  set and the rules around it, with `colour.png` and `type-and-space.png` as its
  reference sheets and [`screenshots/`](design/screenshots/) showing the
  fixtures page as intended. The tokens are now CSS, in
  [`src/app/globals.css`](../src/app/globals.css)
- Archivo and JetBrains Mono come from `next/font/google`; the Material Symbols
  subset is committed and refreshed by `npm run icons`
- `.env.local` holds `API_FOOTBALL_KEY`, `SEASON`, `DATABASE_URL`,
  `DATABASE_URL_DEV` and four Clerk variables; `.env.example` documents the full
  set

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
  - [x] **6.1b — Responsive shell.** Done. The sidebar becomes an off-canvas
        drawer below `md`. Nothing at `md` and above changed. The rules it was
        written against are now a `### Responsive` section in `foundations.md`,
        which had none.
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

## Long-term remarks

Standing constraints that were agreed explicitly, cannot be read off the code,
and outlive any one slice. Each names what would resolve it. A high bar — an
empty list is the expected state.

- **The design covers desktop only, and every screen must be designed narrow
  without a reference.** The export from Claude Design carries no breakpoints and
  no mobile mockups; both reference screenshots are ~2060px captures. 6.1b agreed
  the frame's rules and wrote them into `foundations.md`'s `### Responsive`
  section, but that settles the frame alone. The fixture card, the squad list,
  the tag controls and the stat tiles each still have to be resolved at narrow
  width by judgement, against those rules rather than against a drawing.
  *Can be resolved when narrow-width reference designs exist for the app's
  screens.*

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

**Vitest is set up**, running over the sync mapper against the real captured
payloads — never JSON invented for the test. The mechanics, and why `npm test`
must stay out of the Vercel build, are in
[`architecture.md`](architecture.md#the-mappers-tests-read-scratch-which-is-gitignored).

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
- **Nothing identifies the app below `md`.** The "Madooo" wordmark lives at the
  head of the sidebar, so on a narrow screen it is inside the closed drawer and
  the top bar is a menu button on an otherwise empty 56px rail. Putting the
  wordmark in the top bar below `md` is the obvious answer and was deliberately
  left out of 6.1b, which was scoped to the drawer. It interacts with 8.1 and
  8.2, which add the theme toggle and the search field to that same bar and will
  have to decide what a narrow top bar holds.
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
