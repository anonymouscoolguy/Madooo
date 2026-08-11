# Roadmap

Where the project stands and what happens next. Update this as things land —
it is the file that lets a fresh session pick up without the previous
conversation.

How the system *works* is not here. That is
[`architecture.md`](architecture.md), organised by subsystem: read the section
you are about to touch before writing code in it.

**Last updated:** 2026-08-11 (the app is on the paid tier and pointed at the
live 2026-27 season, whose calendar is in the database and whose first match is
on 21 August; the next thing is step 10 — scheduling the sync)

---

## Current state

**The app is pointed at football that has not been played yet.** It runs on
API-Football's Pro tier against `SEASON=2026` — the 2026-27 Premier League, which
kicks off on 21 August 2026 — and the whole 380-match calendar is in the
database. None of it is hydrated, because none of it has happened: every fixture
is `NS`, every screen's tallies are zero, and **no fixture is clickable** — 6.2
decided that a card with no squad does not navigate, which was a rare state then
and is every card now. So `/fixtures` is effectively the whole app until the
first round is pulled after the opening weekend; `/matches/[id]` still renders
correctly, but only if the URL is typed. The 2024 judgements are still in the
database and no longer on any screen, since every read filters by season; they
were the author's own test data.

What was built against 2024 is unchanged and still true of the frame: `/fixtures`
drawn as the design asks — a card per
fixture with venue, crest chips, score and date, under a league row and a
matchday pager, server-rendered out of Neon on every request. A fixture with a
squad opens onto both matchday squads — each club's starting eleven above its
bench, goalkeeper first, with shirt numbers and positions, each panel headed by
its club's crest — and one without says so instead. The match opens with a card
rather than a title: the competition, ground, date and referee on a strip, over
the two clubs either side of the score. It sits in a responsive app shell whose
four destinations — Fixtures, Players, Teams and Diary — are all built; none is a
placeholder any more.

**And there is a front door.** `/` is the page the design draws: a header
carrying both ways in, a hero beside a mock match card, three features each
showing a piece of the real interface, and a "Free, forever." block over a
GitHub button. It reads nothing — no database, no session — which is what keeps
it the one route that prerenders, so the fixture on it was never played and the
three numbers under "Build a database" are a sample rather than anyone's totals.
It is only ever seen signed out: a visitor who already has a session is
redirected to `/fixtures`, because the sign-in buttons it offers are inert once
there is one. What it claims is now true — the repository carries an MIT licence
and a README, in place of the `create-next-app` boilerplate that had survived
since step 1.

**The app writes.** Every player on a match page carries three chips — standout,
flop, MVP — and tapping one records a private judgement against that player in
that match; tapping it again clears it. A match has one MVP at most, and
awarding it again moves it. Each panel header counts its own
verdicts, and a "Your verdicts" panel under both benches lists what the match was
judged to be, MVP first. Nothing is shared: the read is filtered to the signed-in
user, so a second account opening the same match sees an unjudged team sheet.

**A judgement can also be words.** A fourth control on every row opens a dialog —
the app's first form, and its first `<dialog>` — and what is typed there is saved
against that player in that match and read back under the row it belongs to. A
note stands on its own: a player can carry one with no tag at all. Clearing the
box and saving takes it away, and takes the whole judgement with it if there was
nothing else on it.

**And the app adds it up.** `/fixtures` opens on four tiles — matches watched
this season, standouts, flops, notes — and every fixture card carries a footer
counting the verdicts and the notes on that match. A match is *watched* once
anything has been recorded against it. Every tally is the signed-in user's own,
so a second account sees four zeroes and a page of empty footers. The fixtures
page is now the screen the design draws.

**And it can be read back.** `/diary` is no longer a placeholder: every
judgement of the season, newest first, cut into calendar months with a count
against each, over four tiles and a row of filter pills that live in the URL.
An entry is dated by **when it was written**, not by when the match was played —
agreed explicitly, and the reason the fixture is named on every row. A note with
no tag is an entry too, drawn with a fourth badge in the informational blue that
exists nowhere in the database. Its scoreline links back to the match.

**And there is a way in to all of them.** `/players` is the season's whole
matchday-squad roster — every player, not only the judged ones — over four tallies
of what the reader has given out. A search box finds any of them as it is typed
in, including a player nobody has ever judged, because the list is held in the
browser rather than asked for a name at a time. A league filter, five sort orders
and a rows-or-cards toggle sit beside it, and **those three are remembered between
visits in `localStorage`** rather than in the URL — the first screen state in the
app that is not in the address bar. Sixty rows are drawn at a time under a "Show
more"; the count in the card's header is always the true one.

**And a way in to every club.** `/teams` is the same directory one level up:
every club that has played this season, with its competition, how many of its
players the reader has judged, the mix of what they gave them, and how many of
its matches they watched. The same four controls as the players index, drawn from
the same sort table and remembered under their own keys — nothing is shared
between the two lists but the vocabulary. No row cap: twenty clubs is not six
hundred players. A club's bar is the three verdicts as a proportion of **each
other** rather than of matches watched, because one match carries eleven of a
club's players and a remainder taken against it would not exist — which is the
reason the club profile still draws no bar at all.

**And so does a club.** `/teams/[id]` opens on the crest at shirt-tile size, the
competition it played in, four tallies of what its players were given, and the
squad — every player who turned out for the club this season, most of them
"Never judged", each row carrying his own split bar and seen count. *Watched*
here means matches of theirs the reader recorded anything in, even where all of
it was about the opponent, which is `/fixtures`' meaning of the word narrowed to
a club. Three ways in: either club in the match page's scoreline, the crest in a
squad panel header, and the club line on a player profile. Back returns to
whichever it was, and to the tab the profile was left on.

**And a player has a profile.** Every name in a squad list, in "Your verdicts",
in the diary and now on the index is a link to one: the club and shirt number he was last
named under, four tallies, a bar splitting his watched matches between the three
verdicts and the ones that got none, and his own diary under a Diary/Notes tab
strip. *Watched* means matches where something was recorded and he was in the
squad, which is what makes the bar's fourth segment read as "watched him and said
nothing". A profile has no single parent, so the way back travels in the URL and
is rebuilt from it rather than echoed. The diary's filters moved onto the same
tab strip; the league row keeps its pill.

Every screen renders in light or dark. Light is the default for everyone — the
app no longer follows the operating system — and the top bar's toggle switches
it, remembered across visits. Clerk's own modals follow it too. The chrome is
complete: the last gap in it was the filled button, which had no hover in either
theme and now has one, along with the token the design system was missing for it.

**Every screen in the design is built.** That claim was made once before the
landing page had a drawing; two arrived afterwards and 8.4 built it. What remains
between here and launch is data, scheduling and a checklist.

Auth is no longer provisional. `madooo.app` runs Clerk's production instance,
signing in through Madooo's own Google OAuth client and sending mail from
`notifications@madooo.app`; the development instance survives on the laptop and
on Vercel's preview environment. What remains of the launch checklist is the
`npm audit` judgement.

- Next 16.2.12 (App Router, Turbopack), React 19.2.4, Tailwind 4, TypeScript
- Prisma 7.9.1 against Neon Postgres, via the `@prisma/adapter-pg` driver adapter
- Clerk 7.x for auth, with Google and email/password enabled, on a production
  instance bound to `madooo.app`
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
  fixtures page, the match page, the diary, the player profile, the players
  index, the team profile, the teams index and the landing page as intended —
  all of them at desktop width only.
  The tokens are now CSS, in
  [`src/app/globals.css`](../src/app/globals.css)
- Archivo and JetBrains Mono come from `next/font/google`; the Material Symbols
  subset is committed and refreshed by `npm run icons`
- `.env.local` holds `API_FOOTBALL_KEY`, `SEASON`, `DATABASE_URL`,
  `DATABASE_URL_DEV` and four Clerk variables — the development instance's test
  keys, which are what a laptop must use; `.env.example` documents the full set

## Build order

Each step ends with something runnable and a commit. Do not run ahead.

Steps 6 to 8 are cut into slices, each its own branch and squash-merge. The
designs are what cut them: the sidebar asked for four destinations where the
roadmap had three. **Every slice owns its own empty state** — what its screen
says when it has nothing to show is part of the slice, not a later pass.

Steps 9 to 12 are not screens. They are what stands between a working app and a
launched one: real current data, a sync that runs without a laptop, and the last
of the accounts to buy. Two of the three are done — what is left is the sync, and
the season starting on 21 August is what gives it a deadline rather than an
ordering.

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
      hosting. Sync is still a local CLI; scheduling it is step 10.
- [x] **5 — Auth.** Clerk wired up, with Google and email/password, signed in
      through a modal on the landing page. `/` is public and the fixture list
      moved to `/dashboard`, which shows the signed-in user's email. The `User`
      row is created on first sight.
- [x] **6 — The core loop.** Pick a match, see both squads, tag players
      MVP/STANDOUT/FLOP, and have it persist.
  - [x] **6.1 — App shell.** Done. The sidebar, top bar and shared design
        tokens. `/dashboard` became `/fixtures` inside an `(app)` route group,
        with Players, Teams and Diary as siblings behind placeholders, and the
        signed-in identity moved into the sidebar's foot. The search field the
        design draws in the bar was deliberately left out — a box that does
        nothing is worse than no box — and **search has since been settled the
        other way: it belongs to the screens that have something to search.**
        `/players` and `/teams` each carry their own box in their filter row,
        where it sits beside the filters it works with and can say what it is
        searching. The top bar keeps the theme toggle and, below `md`, the menu
        button; nothing further is coming to it. A knowing departure from the
        reference images.
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
        benches. Player names were not links either; 7.2 made them so.
  - [x] **6.3b — The scoreline card.** Done, against a redrawn reference and out
        of order — it landed after 7.2. The header stops being a title and
        becomes a card: a strip carrying the competition, the ground, the date
        and the referee, over the two clubs either side of the score, each with a
        40px crest mark. Every squad panel header gained its club's crest, which
        **removed** the orphaned-bench special case rather than adding one. The
        venue and referee were already synced and already arriving on the page —
        this slice changed no query, no schema and no sync. It cost the token set
        one new type role, `text-score`, and the icon subset two glyphs. The
        referee renders as the provider spells it, `J. Gillett`, not the mock's
        "Jarred Gillett". Deliberately absent: the reference's finer positions,
        still `GK`/`DEF`/`MID`/`FWD` for 6.3's reason.
  - [x] **6.4 — Tagging.** Done. Three chips on every squad row, a Server Action
        writing `Judgement`, and tapping the active chip clears it. MVP transfers
        rather than duplicating — the rule is now in
        [`AGENTS.md`](../AGENTS.md). The panel
        header counts and the "Your verdicts" panel came with it, since all three
        read the same judgements. Below `md` the chips drop to their own line at
        40px, which is the narrow-width decision the reference screens have no
        drawing for. Deliberately absent: the fourth button the screenshots draw
        on each row, `edit_note`, which is 6.5's — and links on the summary's
        player names, which are 7.2's.
  - [x] **6.5 — Notes.** Done. A borderless `edit_note` button on every row
        opens a native `<dialog>`; `setNote` writes the text, and saving an empty
        box is how a note is deleted. The note reads back under the row, and
        appears there the moment it is saved — the note line and the button that
        writes it are one client island, which is what lets `useOptimistic` cover
        both. Deliberately absent: the note is not in the "Your verdicts" panel
        and not in the panel header counts, because a note is not a verdict and
        the reference screens show neither.
  - [x] **6.6 — Counts.** Done. The four season stat tiles and a footer strip on
        every fixture card. "Watched" became a query over judgements rather than
        a column — the open decision it needed is settled and gone from the list
        below. The per-card tallies ride the query that was already fetching the
        cards, as a filtered relation beside its unfiltered `_count`. Plurals are
        real, unlike in the reference screenshot. The tiles were the last thing
        step 6 had to resolve at narrow width without a drawing. This entry once
        predicted that step 7's screens would have no drawing at all; every one
        of them arrived with a desktop drawing, and the narrow-width remark
        stayed for the opposite reason — the drawings are desktop-only.
- [x] **7 — Diary, players and teams.** Done, in five slices. Queries over what
      step 6 wrote, plus the two destinations the sidebar adds. What the five
      have in common is worth stating once: three of them are **directories
      rather than diaries** — they list every player, every club, judged or not —
      and none of them carries a verdict control, because the place to change a
      verdict is the match it was given in. Every screen's numbers had to be
      *defined* rather than copied off its drawing, which is how *watched* came
      to mean one thing across four scopes.
  - [x] **7.1 — Diary.** Done, and grouped by **month** rather than by match,
        which is what the reference screenshots turned out to draw. Ordered by
        `Judgement.createdAt`; the schema's `@@index([userId, createdAt])` has
        been waiting for this query since step 2. `StatTiles` became generic over
        its key union so `/fixtures` and `/diary` share one set of markup.
        Deliberately absent: links on the player names, which are 7.2's, and a
        pager — a season's entries are bounded by how much one person typed, and
        the design draws none.
  - [x] **7.2 — Player profile.** Done, and the first screen with a desktop
        drawing whose numbers had to be defined rather than copied: the
        reference shows 14 watched against a split of 6+9+1+4. *Watched* was
        agreed to mean matches where the user recorded anything and the player
        was in the squad — `/fixtures`' own meaning, narrowed to one player —
        which makes the remainder mean "watched him and said nothing" and makes
        the bar fill exactly. The subtitle reads `MID`, not the drawing's
        "Attacking midfielder", for 6.3's reason. `?from=` carries the way back,
        since a profile is opened from four places and a server component cannot
        call `history.back()`. The diary's filter row moved onto the underline
        tab strip this slice introduced, which cost `foundations.md` a rule
        saying when each of the two tab kinds applies. Deliberately absent: no
        verdict controls — a profile reads a season back, and the place to change
        a verdict is the match it was given in.
  - [x] **7.3 — Players index.** Done, and it is a **directory rather than a
        diary** — the list is every player with a squad row this season, most of
        whom have nothing on them. That was a change of scope made during
        planning, and it took the design's first stat tile with it: "TRACKED"
        counted judged players, which stopped describing the list, so the row is
        MVPs / Standouts / Flops / Notes and the subtitle names the league rather
        than a number. Two desktop drawings arrived with the slice, which is why
        the standing remark below no longer claims 7.3 has none.

        The slice's own decisions, none of them drawn: the three controls are
        **preferences and live in `localStorage`**, not the URL, which made this
        the app's first client-rendered list and costs a default-first paint; the
        whole roster ships to the browser, because that is what makes search
        reach an unjudged player without a round trip; and only 60 rows are
        drawn at once, since ~600 would stutter on every keystroke — a control
        the reference does not have. It also cost the app its first raw query.
        Deliberately absent: no verdict controls, for 7.2's reason, and no
        server-side search — see the open decision below.
  - [x] **7.4 — Team profile.** Done, and a **directory** like 7.3 rather than a
        diary: every player with a squad row for the club this season, most of
        them never judged. A desktop drawing arrived with the slice, and like
        7.2's its numbers had to be defined rather than copied — every row draws
        `N judged` equal to `N seen` while the bars are part-filled, which no
        single definition satisfies. What was agreed: *watched* is matches of
        theirs the reader recorded anything in, so one word keeps one meaning
        across three scopes, and it needs one `some` clause where a player's
        needs two, because a club playing is a fact about `Match`'s own columns.
        Each row's bar is a proportion of **that player's own seen count**,
        identical to a players-index row, so grey still reads "watched him and
        said nothing".

        The slice's own decisions: the squad list is the players index's row,
        extracted so the two cannot drift — the subtitle is all that differs,
        and this screen puts what he has been judged where the index puts his
        club. The header's crest is 64px to match the shirt tile a player
        profile puts in the same slot, which cost `CrestChip` a third size and
        `foundations.md` an exception for its letters. `backLink` learned both
        profiles as origins and took its fallback from the caller. Deliberately
        absent: no verdict controls, for 7.2's reason; no search or sort over
        twenty-odd rows; no team-level split bar, since one match can carry
        eleven verdicts and the remainder would mean nothing.

        Three ways in, not the two first agreed: the scoreline's clubs were
        added on sight, which cost the match page's `<h1>` its shape. The
        arrangement moved out of the heading and beside it, because a link
        inside an `aria-hidden` subtree is reachable by keyboard and absent from
        the accessibility tree at once. Deliberately still absent: **no link
        from the fixture card**, whose whole card is already a link, so a club
        inside it would be a nested anchor.
  - [x] **7.5 — Teams index.** Done, and a **directory** like 7.3 and 7.4: every
        club that has played this season, most of them never judged. Two desktop
        drawings arrived with the slice and settled the shape against this
        entry's own prediction — it said none of what made 7.3 expensive would be
        needed, and the drawings show the whole filter row. Search and the three
        `localStorage` preferences are in; only the row cap stayed out, because
        twenty clubs is not six hundred players and a cap that never triggers is
        a control that does nothing.

        Its numbers had to be defined rather than copied, for the third slice
        running. *Seen* is `teamTotals`' *watched* unchanged, so one word now
        keeps one meaning across four scopes, and it is asked of every club at
        once in two `groupBy`s rather than twenty counts. **`N players` is how
        many distinct players of theirs the reader has judged** — the drawing
        leaves the phrase ambiguous and contradicts it on one row. The split bar
        is the decision 7.4 refused: the drawing's is a proportion of matches
        watched, which is exactly the shape that overruns its track once five of
        a club's players are tagged in one fixture. **Agreed instead that a
        club's bar is the mix of the three verdicts and nothing else** — always
        full width, so length carries no information there and colour does, with
        *how much* left to the `N seen` beside it.

        The slice's own decisions: the five sorts, the layout type, the search
        normaliser and the league parser were **extracted into one module both
        indexes read**, since a club is ranked on the same seven numbers as a
        player; the storage keys stay per screen, because the two lists are
        narrowed and sorted independently. Clubs are read from `Match` rather
        than `MatchSquad`, which is what keeps a club whose lineup was never
        published in the directory and what makes a row's league non-nullable.
        Deliberately absent: no stat tiles, which the drawing also omits and
        which would count the reader's own season over a list that is not about
        it; no verdict controls, for 7.2's reason; and the header keeps its
        directory sentence rather than the drawing's "You have judged N teams so
        far", which would describe something other than the list beneath it.
- [x] **8 — Chrome.** In the design, needed by nothing above it. 8.2 was dropped
      rather than built — search settled onto the screens themselves — so the
      step closes on three children, and with it the last of the screen work.
  - [x] **8.1 — Dark-mode toggle.** Done, and taken out of order on purpose:
        it puts every screen through a second theme while there are three of
        them rather than a dozen. The moon icon in the top bar, light-first for
        everyone, remembered in `localStorage` and restored before first paint.
        The landing page came onto tokens with it, and Clerk's appearance
        variables were pointed at ours.
  - [x] **8.3 — The filled button's missing hover step.** One semantic token,
        `--surface-inverse-hover`, and both filled buttons onto it — the landing
        page's "Create an account" and 6.5's "Save note", neither of which had a
        hover state.

        What unlocked it was reading the rule properly rather than finding a
        colour. "Surfaces darken one step" has nothing below black, but the dark
        theme has always *lightened* on hover — `--surface` to `--surface-alt` —
        so the rule means one step along the ramp away from the page, and an
        inverse surface inverts that direction like everything else about it.
        Both values were already in the ramp; no hex was invented, which was the
        whole difficulty. Press stays `translateY(1px)` with no second colour
        step, because the step below it lands on `--text-muted`'s grey and reads
        as disabled. The selected pill tab and segmented button fill with
        `--surface-inverse` too and were deliberately left out: they are selected
        states, not buttons. See
        [`architecture.md`](architecture.md#hovering-a-filled-surface-and-hovering-a-tint-were-resolved-differently).
  - [x] **8.4 — The landing page.** Done, from two drawings that arrived long
        after the screen they replace. `/` had been a centred heading, a
        paragraph and two buttons since step 5; it is now a marketing page — a
        header, a hero beside a mock match card, three features, an open-source
        block and a footer.

        The whole of it is a constant, which is the point: `/` is the one route
        that prerenders, and it stays that way by reading nothing. So the fixture
        is invented and the three totals are a sample, agreed as such rather than
        dressed up as live. The mock is assembled from the app's own objects but
        not from `SquadPanel`, whose types would drag Prisma onto a page that
        must never reach it, and it draws `FWD`/`MID`/`DEF` rather than the
        drawing's `RW`/`CM`/`CB` for 6.3's reason — which binds harder here,
        since advertising a detail the product cannot render is advertising the
        mock. The badge that reads a verdict back was extracted out of
        `JudgementEntry` so the two screens cannot draw it differently; the
        landing page's fifth key, `UNRATED`, stays in its own file, because the
        app has no such state.

        It cost the icon subset two glyphs, `lock` and `code`, and
        `foundations.md` a description of the Tag — a 24px pill it had listed a
        height for and never defined. The header wraps to two lines below ~360px
        rather than shrinking its buttons, which is the narrow decision the
        drawings have no answer for.

        **The page claims "free and open source", so the repository had to
        become it**: an MIT `LICENSE`, and a README replacing the
        `create-next-app` boilerplate that had been there since step 1.
        Deliberately absent: no call to action in the hero, no theme toggle —
        the drawings have neither, and the toggle belongs to the app shell.
- [x] **9 — Move onto the paid tier and the current season.** Done. Pro,
      `SEASON=2026`, and the 2026-27 calendar in the database. **The season
      switch cost one variable in two places and no code at all**, which is the
      first real test of the non-negotiable that exists to make that true.

      What did cost code was everything the free tier had been quietly shaping.
      The client's 6.5s request interval was sized for 10 requests a minute and
      said so in its own comment; it now derives itself from the per-minute
      ceiling the response headers carry, so the next plan change needs no code
      either. `verify_api.py` probed only seasons flagged for lineup coverage,
      which can never include one that has not kicked off — the same
      coverage-is-not-entitlement trap as before, sprung from the other side, and
      it had recommended `SEASON=2025`. And two promoted clubs, Coventry and Hull
      City, had no code or colour in the identity seed.

      **This replaced the backfill, which was step 9 and is deleted.** That step
      would have spent 33 rounds' worth of requests hydrating the rest of 2024, a
      season the app has now stopped reading. Hydration did not move to this step
      either: on 11 August the live season had no played match to hydrate, so
      there was nothing to select and nothing to test a selection against. It is
      step 10's, entire.

      Two things learned that were not expected. The Pro subscription renews
      **monthly**, where the free tier ran a year — a lapse three weeks into the
      season would cut the app off mid-season, so it is now in the checklist. And
      the live fixture list is **provisional**: only the first five rounds carry
      real kickoff times, the rest sitting at a placeholder Saturday 14:00 until
      broadcast selections move them. See
      [`architecture.md`](architecture.md#a-live-seasons-calendar-is-provisional-and-a-closed-ones-is-not).
- [ ] **10 — Schedule the sync. The next thing, and now urgent.** The app's
      second non-negotiable assumes a scheduled job writes into Postgres, and it
      does not exist: `npm run sync` is a CLI the author runs by hand, so the
      deployed app's data is only as fresh as the last time a laptop was open.
      **The season starts on 21 August, which turns this from the largest piece
      of unbuilt work into the one with a date on it.** Nothing can be judged
      until a round is hydrated, and nobody's fixture list stays right without a
      daily re-read of a calendar that is still provisional past round 5.

      Step 9 removed the obstacle this step was blocked on — a round is now about
      five seconds rather than two minutes, comfortably inside a function's
      timeout, so resumability is no longer a precondition; see
      [`architecture.md`](architecture.md#scheduling-the-sync-is-unbuilt-and-the-obstacle-it-had-is-gone).
      What is unsettled is which matches a run should hydrate. Do the design
      before the plumbing.
- [ ] **12 — Launch checklist.** Not code, and not to be left to launch day.
      Each of these was recorded as an open decision before it was clear they are
      simply tasks with a date on them:
  - [x] **Clerk production instance.** Done, ahead of the "one to two weeks
        before launch" it was written for, because the domain was already live.
        Bound to `madooo.app`, with Madooo's own Google OAuth client and the
        five CNAMEs at Namecheap; see
        [`architecture.md`](architecture.md#auth-and-routing).
  - [ ] **Re-evaluate the `npm audit` warnings.** High-severity issues in
        `postcss` and `sharp`, both transitive dependencies of Next itself,
        whose suggested fix downgrades Next to 9. To be judged before launch,
        not "fixed" — see [`AGENTS.md`](../AGENTS.md)'s "Known noise".
  - [ ] **Confirm the API-Football subscription renews.** Pro is billed
        **monthly** and the current term ends 2026-09-11, three weeks into the
        season. The free tier ran a year at a time, so nothing in the project has
        ever had to think about this. A lapse stops the app reaching the live
        season while the season is being played.

## Long-term remarks

Standing constraints that were agreed explicitly, cannot be read off the code,
and outlive any one slice. Each names what would resolve it. A high bar — an
empty list is the expected state.

- **The design covers desktop only, and every screen must be designed narrow
  without a reference.** The export from Claude Design carries no breakpoints and
  no mobile mockups; both reference screenshots are ~2060px captures. 6.1b agreed
  the frame's rules and wrote them into `foundations.md`'s `### Responsive`
  section, but that settles the frame alone. Every screen since has resolved its
  own narrow layout by judgement against those rules — 6.2 the fixture card, 6.3
  the squad panels, 6.4 the tag controls, 6.6 the stat tiles, 7.1 the diary
  entry, whose date moves above the badge below `md` because 85px of monospace
  beside a player and a fixture does not fit on a phone, 7.2 the profile header
  and the split bar's legend, and 6.3b the scoreline, which stacks below `md`
  because a 320px line leaves about 136px for two 24px club names. The diary, the
  profile and the match page each arrived with a desktop drawing, so only half of
  each had to be invented; 7.3's two drawings arrived with the slice itself and
  are desktop-only like the rest, so its filter row, its two-line list row and its
  card grid were all decided narrow without one. 7.4's drawing arrived with the
  slice and is desktop-only like the rest, so its squad row inherited the
  players index's narrow arrangement rather than being drawn one, as did 7.5's
  club row and card grid from the same pair of drawings. 8.4's two drawings are
  desktop-only again, so the landing page's stacking order, and its header
  wrapping to two lines rather than shrinking its buttons, were decided the same
  way.
  *Can be resolved when narrow-width reference designs exist for the app's
  screens.*

- **A `Match` can exist with no squad rows, and code must cope with that.**
  Anything that lets a user pick a match has to handle a match nobody can be
  judged in, rather than assuming a squad is there. *Cannot be resolved.*

  It used to name the backfill as its exit, and read as a development condition —
  rounds 1 to 5 of 2024 hydrated, the other 330 matches bare. Moving to the live
  season made it permanent and, for now, total: all 380 of 2026-27 are in the
  database and none has a squad, because none has been played. Fixtures are
  published months before team news, so a season in progress always contains
  matches whose squads do not exist yet. The current hydration state is readable
  from the database; what this entry is for is the reminder that the empty case
  never stops being real.

## Testing

**Vitest is set up**, running over the sync mapper against the real captured
payloads — never JSON invented for the test. The mechanics, and why `npm test`
must stay out of the Vercel build, are in
[`architecture.md`](architecture.md#the-mappers-tests-read-scratch-which-is-gitignored).

- Do not test Prisma, Next's rendering, or other third-party code.

## Open decisions

- **The app now has two conventions for screen state, and the older one may be
  the wrong default. High priority — a refactor the author may want.** Every
  screen before 7.3 keeps its state in the URL: `/fixtures?matchday=6`,
  `/diary?filter=mvp`, `/players/44?view=notes`. Both indexes keep their three
  controls in `localStorage` instead, on the argument that they are
  *preferences* — how the reader likes a list drawn — where the others are
  *locations*. That distinction is written up in
  [`architecture.md`](architecture.md#a-location-goes-in-the-url-a-preference-goes-in-localstorage)
  and it holds; what is open is whether the older screens are on the right side
  of it.

  The reason to look again: **nothing in the app is shareable.** Diaries are
  private, single-user, no public profiles — so the URL's main advantage buys
  nothing today, while its main cost is real, because a filter in the URL is
  forgotten the moment the tab closes. A reader who always wants MVPs gets the
  unfiltered diary on every visit. Against moving them: the back button stops
  undoing a filter change, the pages stop being server components, and a future
  share feature would want them back in the URL.

  Deliberately not touched in 7.3 or 7.5, both scoped to one screen — though 7.5
  choosing `localStorage` again makes the newer convention the app's default in
  practice rather than its exception. Whoever settles it should decide for the
  diary's filter and the profile's view tab together, since they are the same
  question twice.

- **Search is in the browser's memory, and that stops being right somewhere past
  five leagues.** `/players` ships the season's whole roster — ~15 kB compressed
  for one league, ~60 kB for five — so a keystroke never waits on the network.
  At a few thousand players it is still the better trade; well past that, the box
  should ask Postgres instead. The swap is self-contained: the search field
  changes where it gets its answers and nothing else moves. It costs a route
  handler, debouncing, a loading state and out-of-order response handling, and it
  makes search visibly laggy, which is why it was not built now. *Revisit when a
  third league is synced.*

- **The club colours have no authority behind them.** Settled in 6.2: codes and
  colours are columns on `Team`, seeded by `npm run db:seed-teams`. The codes are
  the league's own abbreviations, which is a defensible external standard. The
  colours are not — each is that club's commonly published primary, entered by
  hand and never checked against anything. They are the one part of the seed
  table meant to be edited on sight, and a wrong one is wrong quietly.
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
  toggle in that bar, and with search settled onto the screens themselves rather
  than the bar, the wordmark is the only thing left that a narrow top bar might
  hold. *Resolved by putting it there, or by deciding the menu button is enough.*
- **Clerk's `colorNeutral` and `colorShadow` are unbound.** Every other
  appearance variable is a `var(--…)` pointing at our tokens, but Clerk derives
  alpha shades from those two in JavaScript and cannot interpolate a `var()`.
  Its greys and shadows are therefore still Clerk's own in both themes. Whether
  that is visible enough to be worth solving is a thing to look at with the user
  menu open in dark.

The paid API tier and the Clerk production instance used to sit here. Neither was
a decision — nothing about them was unsettled but the date — so both moved into
step 12, and the API tier moved again into step 9, which has now landed. Both are
done. What the tier left behind is a smaller thing of the same kind, back in the
checklist: the subscription is monthly now, so it has a date that recurs.
