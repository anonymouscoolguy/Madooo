# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

How the system *works* is not here. That is
[`architecture.md`](architecture.md), organised by subsystem: read the section
you are about to touch before writing code in it.

**Last updated:** 2026-08-03 (6.4 — tagging)

---

## Current state

Real football is in the database and behind a login, inside the frame the
designs ask for: the 2024 season's full fixture list, one gameweek hydrated down
to individual players, and `/fixtures` drawn as the design asks — a card per
fixture with venue, crest chips, score and date, under a league row and a
matchday pager, server-rendered out of Neon on every request. A fixture with a
squad opens onto both matchday squads — each club's starting eleven above its
bench, goalkeeper first, with shirt numbers and positions — and one without says
so instead. It sits in a responsive app shell alongside Players, Teams and Diary,
which exist as placeholders. `/` is a public landing page, now on the same tokens
as everything else.

**The app writes.** Every player on a match page carries three chips — standout,
flop, MVP — and tapping one records a private judgement against that player in
that match; tapping it again clears it. A match has one MVP at most, and
awarding it again moves it. Each panel header counts its own
verdicts, and a "Your verdicts" panel under both benches lists what the match was
judged to be, MVP first. Nothing is shared: the read is filtered to the signed-in
user, so a second account opening the same match sees an unjudged team sheet.

Notes are not written yet, so a judgement is still only ever a tag.

Every screen renders in light or dark. Light is the default for everyone — the
app no longer follows the operating system — and the top bar's toggle switches
it, remembered across visits. Clerk's own modals follow it too.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Clerk 7.x for auth, with Google and email/password enabled
- Pushed to `github.com:anonymouscoolguy/Madooo`, now on a `slice/*` branch flow
  squash-merged into `main`
- Deployed on Vercel from `main`, built with `prisma generate && next build`
- `scripts/verify_api.py` proves the API works; raw payloads sit in `scratch/`
  (gitignored) and are what the schema was designed against
- `npm run db:check` proves the database layer works end to end
- `npm run sync -- --round 1` fills the database from API-Football;
  `npm run db:seed-teams` writes the club codes and colours the provider does not
  publish; `npm test` runs Vitest over the mapper and the pages' pure helpers
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
        and is still 8.2's to add.
  - [x] **6.1b — Responsive shell.** Done. The sidebar becomes an off-canvas
        drawer below `md`. Nothing at `md` and above changed. The rules it was
        written against are now a `### Responsive` section in `foundations.md`,
        which had none.
  - [x] **6.2 — The fixtures page.** Done. Fixture cards with venue, score and
        crest chips; the league row; the matchday pager, with the matchday in the
        URL so the page stays a server component. A match with no squad rows says
        "No squad yet" and does not navigate. The stat tiles and the per-card
        verdict counts are not here — they are 6.6, deliberately last.
  - [x] **6.3 — Match page.** Done. Both squads, read-only: each club's starting
        eleven above its bench, ordered goalkeeper-first by a pure helper rather
        than by the database, with shirt numbers and positions. The header
        carries the scoreline and a back link to the matchday it was opened from.
        Positions read `GK`/`DEF`/`MID`/`FWD`, not the designs' `RB`/`CB`/`AM` —
        agreed explicitly, because the finer position is in no provider response;
        see [`architecture.md`](architecture.md#a-position-is-one-of-four-letters-and-the-designs-ask-for-more).
        Deliberately absent, all of it 6.4's and 6.6's: the three verdict buttons
        and the note button on every row, the verdict count in each panel header,
        and the "Your verdicts" summary panel the screenshots show below the
        benches. Player names are not links either — 7.2 is what they would link
        to.
  - [x] **6.4 — Tagging.** Done. Three chips on every squad row, a Server Action
        writing `Judgement`, and tapping the active chip clears it. MVP transfers
        rather than duplicating — the rule is now in
        [`AGENTS.md`](../AGENTS.md). The panel
        header counts and the "Your verdicts" panel came with it, since all three
        read the same judgements. Below `md` the chips drop to their own line at
        40px, which is the narrow-width decision the reference screens have no
        drawing for. Deliberately absent: the fourth button the screenshots draw
        on each row, `edit_note`, which is 6.5's — and the summary's player names
        are plain text, because 7.2 is what they would link to.
  - [ ] **6.5 — Notes.** Free text on any player, on the same row as the tag.
        A note with no tag is valid; clearing both deletes the row.
  - [ ] **6.6 — Counts.** `/fixtures`: the four stat tiles and the per-fixture
        "N verdicts · N notes" footer. Last deliberately, so the aggregates are
        read against real judgements rather than against zeroes. The match page's
        own counts landed in 6.4.
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
  - [x] **8.1 — Dark-mode toggle.** Done, and taken out of order on purpose:
        it puts every screen through a second theme while there are three of
        them rather than a dozen. The moon icon in the top bar, light-first for
        everyone, remembered in `localStorage` and restored before first paint.
        The landing page came onto tokens with it, and Clerk's appearance
        variables were pointed at ours.
  - [ ] **8.2 — Search.** Matches, teams and players.

## Long-term remarks

Standing constraints that were agreed explicitly, cannot be read off the code,
and outlive any one slice. Each names what would resolve it. A high bar — an
empty list is the expected state.

- **The design covers desktop only, and every screen must be designed narrow
  without a reference.** The export from Claude Design carries no breakpoints and
  no mobile mockups; both reference screenshots are ~2060px captures. 6.1b agreed
  the frame's rules and wrote them into `foundations.md`'s `### Responsive`
  section, but that settles the frame alone. 6.2 resolved the fixture card the
  same way, 6.3 the squad panels and 6.4 the tag controls. The stat tiles are
  what is left: they still have to be resolved at narrow width by judgement,
  against those rules rather than against a drawing.
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

- **The club colours have no authority behind them.** Settled in 6.2: codes and
  colours are columns on `Team`, seeded by `npm run db:seed-teams`. The codes are
  the league's own abbreviations, which is a defensible external standard. The
  colours are not — each is that club's commonly published primary, entered by
  hand and never checked against anything. They are the one part of the seed
  table meant to be edited on sight, and a wrong one is wrong quietly.
- **What "watched" counts.** The first tile on `/fixtures` reads "WATCHED 14 this
  season" and no such concept exists. The obvious reading is matches in which
  this user has recorded at least one judgement, which makes it a query rather
  than a new column, but it has not been agreed. Needed by 6.6.
- **The demoted MVP's chip waits for the round trip.** Each squad row is its own
  client island holding its own optimistic state, so nothing tells one row that
  another has just taken the MVP: the player losing it keeps a filled star until
  `refresh()` lands, and for that moment two chips read as MVP. Making it instant
  means hoisting the optimistic state into a provider above the rows — which can
  still wrap server-rendered children, the way `AppFrame` wraps `<Sidebar />`.
  Two sizes were sketched: a narrow one holding only the current MVP, leaving the
  counts and the summary to settle on the refresh as everything does now; and a
  full one holding the whole verdict map, which makes the counts and the summary
  client components and gives the exclusivity rule a second implementation to
  keep in step with the server's. Raised and deliberately deferred in 6.4.
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
  left out of 6.1b, which was scoped to the drawer. 8.1 has since put the theme
  toggle in that bar without settling it; 8.2's search field is the other half,
  and whichever of them is built last should decide what a narrow top bar holds.
- **The inverse surface has no hover step.** The landing page's "Create an
  account" is the app's first filled button — `bg-surface-inverse`, black on
  light and white on dark — and `foundations.md`'s hover rule is "surfaces
  darken one step", which has nothing below it to darken to and no semantic
  token for one. It currently has no hover state at all.

  This was recorded as needed by 6.4's tag controls. It was not: a verdict chip
  fills with a *tint*, never with `--surface-inverse`, so nothing in 6.4 touched
  it. What 6.4 did hit is the same gap one level down — a verdict tint has no
  step below it either — and that half is settled; see
  [`architecture.md`](architecture.md#a-selected-verdict-chip-has-no-hover-state-and-that-is-the-decision).
  The landing page's filled button is what remains open, and nothing yet planned
  needs it.
- **Clerk's `colorNeutral` and `colorShadow` are unbound.** Every other
  appearance variable is a `var(--…)` pointing at our tokens, but Clerk derives
  alpha shades from those two in JavaScript and cannot interpolate a `var()`.
  Its greys and shadows are therefore still Clerk's own in both themes. Whether
  that is visible enough to be worth solving is a thing to look at with the user
  menu open in dark.
- **Paid API tier.** Buy one to two weeks before launch, not on launch day.
- **Clerk production instance.** A development instance uses Clerk's shared
  Google OAuth credentials, which a production one may not. Promoting it means
  creating a Google Cloud project and an OAuth client, and swapping the keys on
  Vercel. Same timing as the API tier — before launch, not on launch day.
