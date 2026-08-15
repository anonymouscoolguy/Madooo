# Architecture

How the system works, by subsystem. This file answers "I am about to touch X —
what do I need to know first?", so read the section you are about to work in.

Everything here states what *is* true of the code as it stands. What is built,
what is next, and what is still undecided is in [`roadmap.md`](roadmap.md); the
binding rules are in [`AGENTS.md`](../AGENTS.md) and, for anything that renders,
[`design/foundations.md`](design/foundations.md).

## Contents

- [Database and Prisma](#database-and-prisma)
  - [How the database is addressed](#how-the-database-is-addressed)
  - [Prisma 7 differs from most writing about it](#prisma-7-differs-from-most-writing-about-it)
  - [Two columns are seeded by hand and never synced](#two-columns-are-seeded-by-hand-and-never-synced)
  - [A relation can be counted whole and read filtered in one query](#a-relation-can-be-counted-whole-and-read-filtered-in-one-query)
  - [Prisma resolves `distinct` and a nested `take` in Node, so "latest row per group" is raw SQL](#prisma-resolves-distinct-and-a-nested-take-in-node-so-latest-row-per-group-is-raw-sql)
  - [The diary is ordered by when an entry was written](#the-diary-is-ordered-by-when-an-entry-was-written)
  - [The connection strings pin `sslmode=verify-full`](#the-connection-strings-pin-sslmodeverify-full)
- [Sync and the provider boundary](#sync-and-the-provider-boundary)
  - [A scheduled run asks our own table, not the provider, what to read](#a-scheduled-run-asks-our-own-table-not-the-provider-what-to-read)
  - [Nothing in the sync throws its way out of a run](#nothing-in-the-sync-throws-its-way-out-of-a-run)
  - [What the API does that its own docs do not say](#what-the-api-does-that-its-own-docs-do-not-say)
  - [A live season's calendar is provisional, and a closed one's is not](#a-live-seasons-calendar-is-provisional-and-a-closed-ones-is-not)
  - [What is deliberately unmapped](#what-is-deliberately-unmapped)
  - [A position is one of four letters, and the designs ask for more](#a-position-is-one-of-four-letters-and-the-designs-ask-for-more)
  - [Anything a page needs from a round string lives in `src/lib/rounds.ts`](#anything-a-page-needs-from-a-round-string-lives-in-srclibroundsts)
  - [The tests read `scratch/`, which is gitignored](#the-tests-read-scratch-which-is-gitignored)
  - [The sync knows what to run; nothing runs it yet](#the-sync-knows-what-to-run-nothing-runs-it-yet)
- [Auth and routing](#auth-and-routing)
  - [The landing page reads nothing, and everything on it is fiction](#the-landing-page-reads-nothing-and-everything-on-it-is-fiction)
  - [A location goes in the URL; a preference goes in `localStorage`](#a-location-goes-in-the-url-a-preference-goes-in-localstorage)
  - [The league is a slug in the URL, and is neither our id nor the provider's](#the-league-is-a-slug-in-the-url-and-is-neither-our-id-nor-the-providers)
- [Writing data](#writing-data)
- [Design tokens and CSS](#design-tokens-and-css)
  - [Responsive rules are in `foundations.md` and are binding](#responsive-rules-are-in-foundationsmd-and-are-binding)
  - [Hovering a filled surface and hovering a tint were resolved differently](#hovering-a-filled-surface-and-hovering-a-tint-were-resolved-differently)
  - [The dialog is the platform's, and so are the fields](#the-dialog-is-the-platforms-and-so-are-the-fields)
  - [Things the toolchain does that the source does not show](#things-the-toolchain-does-that-the-source-does-not-show)
  - [The icon font is a subset, fetched by script](#the-icon-font-is-a-subset-fetched-by-script)
  - [The three flags are vendored files under `public/`, not a dependency](#the-three-flags-are-vendored-files-under-public-not-a-dependency)
- [The app shell](#the-app-shell)
- [Build and deploy](#build-and-deploy)

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
(It also carries `SEASON` and the four Clerk variables, the last of which differ
between the Production and Preview environments — see
[Auth and routing](#auth-and-routing).) Pointing a deployment
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

### A relation can be counted whole and read filtered in one query

`fixturesForRound` asks for `_count.squadEntries` — the openable test, "does this
match have a squad at all" — and beside it, in the same query, the squad rows this
user has judged. **The two do not interfere.** A `_count` entry takes its own
optional `where` and has none here, so it counts the whole relation however its
sibling selection is filtered. That was verified against the database rather than
assumed, because the failure mode is silent: a `_count` that inherited the filter
would report no squad for every unjudged match, and every card would quietly stop
opening.

One relation carries only one `_count`, so a query cannot ask Postgres for two
different tallies over the same rows. That is why a fixture card's verdicts and
notes are folded in JavaScript, by `countVerdicts` and `countNotes` in
[`verdicts.ts`](../src/lib/verdicts.ts) — the rows are already in hand and bounded
by how much one user judged one match.

**Season totals go the other way**: `seasonTotals` and `diaryTotals` are each
four `count`s under a `Promise.all`, because a season's judgements are unbounded
and neither page wants the rows. A judgement reaches its season through two
relations — `matchSquad.match.season` — since `Judgement` points at a
`MatchSquad` and carries no match of its own.

The counts are deliberately not shared between the screens, and the third one
settled it: each of the three tile rows asks a different question. `/fixtures`
counts *matches watched*, `/diary` counts *entries written*, and a player profile
counts *matches watched of his* beside an MVP tally nothing else has and no notes
tally at all. One function returning every number so each caller could throw most
of them away would make all three pay for the others' questions.

**"Watched" is a match this user has recorded anything against**, tag or note.
A query over `Match`, never a column on it: nothing marks a match as watched, and
having had something to say about one is the only evidence there is.

**On a player profile the same word is scoped to him, and that takes two `some`
clauses rather than one.** `playerTotals` counts matches where the user recorded
something *and* this player was in the matchday squad, unused substitutes
included — the app's own rule is that anyone named can be judged. The two
conditions sit in separate entries under `AND`, because a single
`{ squadEntries: { some: { playerId, judgements: … } } }` demands one row
satisfying both and so asks whether the user judged *this player* — a different
and much smaller number. What is wanted is that he was named and that somebody
was judged, not necessarily him.

**On a club profile it is scoped again, and needs only one `some` — which is the
point rather than an oversight.** "This player was in the squad" can only be
asked of a squad row, which is what forces the player's version into two clauses.
"This club played in this match" is a fact about `Match`'s own `homeTeamId` and
`awayTeamId`, so `teamTotals` states it in the same `where` without ambiguity.
Reading it off squad rows instead would quietly drop a match whose lineup was
never published while the opponent's was: the reader recorded something, the club
played, and no `MatchSquad` row exists to prove it. So a club's *watched* is
matches of theirs the reader had something to say about, even where all of it was
about the opponent — one word, one meaning, four scopes. The teams index asks it
of every club at once as `clubsSeen`, which is that same `where` in two
`groupBy`s rather than twenty `count`s: Prisma has no `OR` across a `by`, so each
side of the fixture is grouped separately and the two halves are summed in the
fold.

That definition is what makes a *player's* split bar mean something: `unrated`
is `watched` minus the three tags, so it reads as "you watched him and had
nothing to say", which a count of entries could not express. It also cannot
overflow — `@@unique([userId, matchSquadId])` and `@@unique([matchId, playerId])`
between them make a tagged match necessarily a watched one. The arithmetic is in
[`verdict-split.ts`](../src/lib/verdict-split.ts), kept free of Prisma so it can
be tested. The query runs against `MatchSquad @@index([playerId])`, in the schema
since step 2 and unread until now.

**A club's bar is a different function, because at club scope the two numbers
stop being the same unit.** `watched` counts matches and the three tags count
judgements, and one match carries eleven of a club's players — so a reader who
tags five of them in one fixture has five judgements against one watched match.
`unrated` would clamp to zero and the segments would overrun their track, which
is why a club profile draws no bar at all. `verdictMix` is the teams index's
answer: the same three verdicts as a proportion of *each other*, with no
remainder. It is full width on any club with a verdict, so length carries no
information there and colour does — the *how much* is the `N seen` beside it.
Anything later that wants a bar over a scope wider than one player needs the same
question asked of it first.

**A player's club is a fact about a match, not a column.** `Player` holds a name,
an unrendered photo URL and API-Football's id; which club he plays for lives on
`MatchSquad`. A profile therefore reads its club, shirt number and position off
his most recent squad row of the season, `take: 1` after ordering by
`match.kickoff` — which is what makes a January transfer show the club he is at
now. The list comes back empty for a player with no squad row that season, which
is reachable by typing a URL and is a state the page has to draw.

**A club's competition is the same shape one level up.** `Team` carries no
`leagueId`; a club reaches a league only through the matches they share, so
`teamHeader` reads it off one of that club's matches this season, `OR`-ed across
both sides of the fixture because a club with no *home* match is a state
round-by-round hydration can produce. A club with no match at all draws no
league, which is the header's own empty state.

**That is also why the teams index reads its clubs from `Match` rather than from
`MatchSquad`**, where `/players` reads its players from squad rows. Two things
follow from the fixture that cannot follow from a lineup: a club whose lineup was
never published still played and still belongs in a directory, and the fixture is
the only row holding the club and its competition together. `clubLeagues` takes
both from one `groupBy`, which is what makes `leagueId` non-nullable on an index
row — two queries could disagree, and the fold would then have to draw a club
whose competition is unknown. It returns each club once per side, so the fold
dedupes and the first league wins.

**"First league wins" is safe because no club plays in two domestic leagues** —
not, as it used to be, because only one league was synced. The exit is the same
either way: a cup competition, where a club would legitimately hold two, and
where the directory would have to name one rather than list the club twice.

### Prisma resolves `distinct` and a nested `take` in Node, so "latest row per group" is raw SQL

`/players` needs that same club-and-shirt lookup for every player at once, and
that is where the idiom stops scaling. Both Prisma spellings of it were run
against the real database with `log: ['query']` and their SQL read back:

- `matchSquad.findMany({ distinct: ['playerId'] })` dedupes **in the query
  engine**, not in Postgres — `@prisma/query-plan-executor` has an
  `InMemoryOps.distinct` node that filters rows already fetched.
- `player.findMany` with a nested `take: 1` does the same thing less obviously.
  The child query it emits carries **no `LIMIT`, no `LATERAL` and no
  `ROW_NUMBER`**: it selects every squad row for every matched player and keeps
  the first in memory. `relationLoadStrategy: 'join'`, which used to force a
  LATERAL, is rejected outright by Prisma 7.

Postgres would do this with `DISTINCT ON`, and Prisma cannot emit it, because the
distinct column has to lead the `ORDER BY` and the order wanted is
`match.kickoff` — a column on a joined table. So `playersInSeason` in
[`players.ts`](../src/lib/players.ts) is `$queryRaw`, and `teamSquad` in
[`teams/profile.ts`](../src/lib/teams/profile.ts) is the same query with a club
in its `WHERE`. **They are the only raw SQL in the app**, and a third should
have to argue for itself the way these two did. `$queryRaw` is a tagged template
and binds its parameters; `$queryRawUnsafe` does not and has no business here.
The generic on it is an assertion rather than a check: raw SQL bypasses Prisma's
mapping, so the column names are the database's own — safe while no model carries
`@map`, and silently wrong the day one does. That hazard now has two call sites
to break at once.

**Development cannot show you any of this.** With five rounds hydrated a player
has at most five squad rows, so all three forms return 2,000 rows and only the
emitted SQL tells them apart; a full season is ~15,200 rows fetched to keep ~600,
on every request of a `force-dynamic` page. `defaultRound`'s `distinct: ['round']`
in [`fixtures.ts`](../src/lib/fixtures.ts) is the same in-memory dedupe and is
harmless at 380 tiny rows — it is not a precedent to copy at scale.

**The counterpart is that a judgement cannot be grouped by its player at all.**
`Judgement` points at a `MatchSquad`, so `playerId` is a column on the relation
rather than on the row, and `groupBy` cannot reach it. One `groupBy` per player
would be six hundred queries, so `/players` reads the user's own judgements as
rows and folds them in JavaScript — bounded by how much one person typed, the
same bound the diary accepts for having no pager.

### The diary is ordered by when an entry was written

`diaryEntries` sorts on `Judgement.createdAt` descending, not on the kickoff of
the match being judged, and that is a product decision rather than a convenience:
a diary entry is dated by the act of writing it. The consequence to hold onto is
that two verdicts on one match recorded a fortnight apart sit a fortnight apart
in the list, which is why every row names its fixture.

`@@index([userId, createdAt])` on `Judgement` is exactly that query's index. It
has been in the schema since step 2 and had no reader until the diary; anything
later that pages a user's judgements should sort the same way rather than adding
a second index. `id` breaks ties, because two judgements saved in the same
millisecond would otherwise come back in whatever order Postgres liked.

Cutting the sorted run into months is `groupByMonth` in
[`dates.ts`](../src/lib/dates.ts), which walks the list once and **never sorts**.
That is what keeps the `ORDER BY` the single opinion about order. It lives in
`dates.ts` rather than beside the screen because "which calendar month is this
in" is answered by the fixed `Europe/London` zone that file owns, and a second
file holding an opinion about the zone is one too many.

### The connection strings pin `sslmode=verify-full`

Surfaced as a runtime warning from `pg` 8.22, which currently treats the
`sslmode=require` Neon hands out as `verify-full` but will adopt libpq's weaker
meaning in v9 — encrypt without verifying who answered. Nothing about the
connection changed; the parameter now says what was already happening, so the v9
upgrade cannot quietly downgrade it.

---

## Sync and the provider boundary

A sync run costs one request per league for its whole season of fixtures, then
two per fixture for lineups and player statistics — 21 for a Premier League
round.

**There are two modes, and the split is which of them names its own work.**
`--round N` is told a matchday and fetches it; `--due` is told nothing and asks
our own table which finished matches have not been read yet. `--due` is what a
scheduler runs, `--round` is what a person runs, and `--round` stays because it
is the repair tool — it reaches a match the fortnight window below has dropped.

The provider boundary is [`src/lib/api-football/`](../src/lib/api-football/) —
raw types, a thin client, and a pure mapper. [`src/lib/sync.ts`](../src/lib/sync.ts)
turns mapped objects into rows, and [`scripts/sync.ts`](../scripts/sync.ts) is
the CLI. Nothing under `src/app/` imports any of it.

**Which leagues to sync is configuration, `LEAGUES=39,94,140`, and only the sync
reads it.** The asymmetry is the point: the sync *writes* `League` rows, while
every read side *discovers* leagues from Postgres — `leaguesWithMatches`,
`leaguesInSeason`, `parseLeague`. A page reading the variable would have two
sources for which leagues exist and could disagree with its own database, so
`syncLeagues()` is named for its one caller and sits beside `apiFootballKey()`,
which is withheld from the deployed app for the same kind of reason. Adding a
league is a variable and a sync run; no page and no Vercel environment is told.

`syncSeasonFixtures` takes one league and the CLI runs the loop, so a failure
names the competition that failed rather than reporting a count. **`--round N`
means matchday N of every league in scope**, and a league that does not have that
round is skipped rather than failing — the Primeira Liga plays 34 to the Premier
League's 38, so `--round 36` is a real asymmetry and only *no* league matching
means the label is wrong. `--league <id>` narrows a run to one configured id and
cannot reach outside the list, so a typo costs an error rather than a request.

**Every write is an upsert on a natural key, and nothing is ever deleted.**
`Judgement` cascades off `MatchSquad`, so rewriting squad rows by deleting them
would destroy a user's diary on the next sync. Re-running the sync has been
verified to leave `MatchSquad` ids untouched and a judgement written against one
intact — re-checked when `hydratedAt` arrived, since that column exists to make
a second reading of the same fixture routine rather than exceptional.

### A scheduled run asks our own table, not the provider, what to read

`--due` never asks which round is current. It asks Postgres which *fixtures* are
finished and not yet read, which is why three leagues at three different points
of their seasons — 38 rounds, 34 and 38, played on different weekends — produce
no branch anywhere. The question is asked per fixture, so the competitions never
have to be told apart. A round would have needed three answers and a rule for
combining them.

The policy is [`src/lib/hydration.ts`](../src/lib/hydration.ts), which imports
nothing, and the whole of it is under Vitest. `Match.hydratedAt` records when
the detail endpoints were last read, and one predicate decides everything:

```
hydratedAt IS NULL  OR  hydratedAt < kickoff + 6 hours
```

Read aloud: *a match is due until it has been read at least six hours after it
kicked off.* One expression covers "never read", "read too early to be final"
and "stop, this is finished", and it terminates by construction — no attempt
counter and no give-up list. The six hours exist because a reading taken minutes
after full time can catch API-Football mid-write; minutes and ratings settle
over the following hour, so every match gets one confirming re-read and no more.

Three things that are easy to get wrong here:

- **`hydratedAt` is stamped only when squad rows came back.** Stamping a fixture
  whose lineup the provider has not published yet retires it from every future
  run and leaves its card reading "No squad yet" forever. Two wasted requests is
  the correct price.
- **`AWD` and `WO` are not finished.** A match awarded 3–0 satisfies every plain
  reading of "the match is over" and never had a team sheet, so counting it
  would put a permanently unhydratable row in the queue for a fortnight.
  `hydration.ts` splits the provider's whole status vocabulary three ways, and
  `hydration.test.ts` asserts that every status the captured payloads contain is
  classified — the payloads only ever hold `FT` and `NS`, which is exactly why
  the rest is documented rather than trusted to memory.
- **The fourteen-day window is the give-up rule**, not just a bound on the
  queue. A fixture the provider never publishes a lineup for drops out on its
  own, so nothing has to decide it is hopeless. Its cost: a match missed because
  the job was broken for a fortnight is never picked up automatically, and the
  repair path is `--round N`.

The comparison `hydratedAt < kickoff + 6 hours` is row-to-row and has no Prisma
`where`, so `dueFixtures` does the coarse filter in Postgres — season, league,
finished status, inside the window — and folds the rest in Node. That was a
choice against a third `$queryRaw`, and the window is what makes it safe: the
candidate set is a few dozen rows, the same bound the diary and `/players`
already accept.

**The kickoff in that predicate is safe even though a live season's calendar is
provisional.** Placeholder Saturday-14:00 kickoffs only exist for matches that
have not been played; by the time a fixture is `FT` its kickoff is the real one.

### Nothing in the sync throws its way out of a run

A CLI a person watches and a job nobody watches want opposite things from a
failure, and the job's needs won:

- **A failed league or fixture is logged, counted and stepped over**, and the
  process exits non-zero at the end if anything failed. One league returning no
  fixtures used to throw before hydration began, which left two healthy
  competitions unread for a hiccup in a third.
- **The quota pre-flight clamps rather than refusing.** It used to throw and
  advise passing `--limit`, which has no reader in CI — and refusing outright
  hydrates nothing where hydrating some would have been right. A run spends at
  most half the reported daily remainder, because that counter is documented as
  non-monotonic and a scheduled job that drained it would starve the rest of the
  day's runs.
- **One summary line** ends every run: `calendars 3/3, hydrated 9/9, still due
  0, failed 0`. `still due` is what separates "nothing to do" from "ran out of
  room", which a count of zero hydrated would otherwise conflate.

`--due --dry-run` prints the selection and spends nothing. It deliberately skips
the calendar phase, so it reports against whatever statuses the last real run
left — which is the point when checking the policy, and a trap if mistaken for a
preview of the next run.

### What the API does that its own docs do not say

Read [`api-football-findings.md`](api-football-findings.md) before touching
anything that talks to API-Football. Two findings bind the client's design:

- **The client's pace is read off the response, not written into the code.**
  There are two ceilings, per-minute and per-day, and both arrive as headers.
  `intervalForLimit` in [`client.ts`](../src/lib/api-football/client.ts) turns
  `x-ratelimit-limit` into the gap to leave between requests — 80% of the stated
  rate, bounded at both ends, falling back to a slow 6.5s when the header is
  missing or unreadable. It was a constant until the plan changed underneath it
  and made both the number and its explanatory comment wrong. A missing header
  must fall back *slow*: an unparseable limit is not evidence of a generous plan.
- **The daily counter in the response headers is not monotonic** — it was seen
  going 77, 75, 78, 76 in one run.

Quota is no longer a design constraint. Pro allows 7,500 a day and 300 a minute,
against 21 requests for a round and 761 for an entire season. What still costs
something is wall clock, and API-Football's terms warn that sustained
over-consumption can get the key or the IP firewalled — which is why the pacing
keeps a margin rather than sitting on the limit.
`npm run sync -- --round 1 --limit 2` is the cheap way to try a change, and
`--due --dry-run` is the free one.

### A live season's calendar is provisional, and a closed one's is not

A finished season re-syncs byte-identically. A season in progress does not, and
the 2026-27 fixture list shows why: **only the first five rounds carry real
kickoff times.** From round 6 on, all ten fixtures of a round sit at exactly
14:00 on one Saturday — placeholders standing in until broadcast selections move
them. Round 1, already selected, spans Friday to Monday.

Three things follow, none of them true of the 2024 data everything was built
against:

- **The fixture list has to be re-read, not just read once.** Dates, kickoff
  times and `status` all change under us. It is one request for the whole season,
  so this is cheap; what it is not is optional.
- **A round is a poor unit of work.** It is not atomic in time — a selected round
  spans several days — and beyond round 5 its dates are not even the real ones.
- **Anything that groups or orders by date is standing on provisional data.**
  The matchday pager is safe, since it groups by the round label, which does not
  move. A screen that grouped by week or by date would reshuffle itself as
  selections land.

### What is deliberately unmapped

`penalty.commited` and the wider statistics block. `MatchSquad` carries
`minutes`, `goals`, `assists`, `yellow`, `red` and `rating`; shots, passes,
tackles, duels, dribbles and fouls are parsed by nothing. The API's misspelling
is reproduced only in [`types.ts`](../src/lib/api-football/types.ts) and
corrected at the boundary.

### A position is one of four letters, and the designs ask for more

`MatchSquad.position` only ever holds `G`, `D`, `M` or `F`. Both endpoints agree
on that vocabulary — `player.pos` on `/fixtures/lineups`, `games.position` on
`/fixtures/players` — and [`squad.test.ts`](../src/lib/squad.test.ts) asserts it
against the captured payload, so a fifth letter fails the suite rather than
reaching a page as a blank column.

The reference screenshots label players `RB`, `CB`, `AM`, `LW`. **That data does
not exist anywhere in the provider's responses.** `grid` carries enough to guess
a side, and the guess is deliberately not made: the column convention is
unverified against ground truth, and a wrong one prints a confident falsehood
about a real player. The match page expands the four letters to
`GK`/`DEF`/`MID`/`FWD` and infers nothing.

`grid` itself is a `"row:column"` **string** and has to be parsed into two
integers before it is compared. Sorted as text it puts row 10 ahead of row 2 —
which no captured fixture reaches, so nothing would catch it in passing.

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

The rule binds API-Football's JSON, which is where recollection is the unreliable
part. Our own data has no upstream to be wrong about: `verdicts.test.ts` attaches
invented verdicts to real captured players, because the claim under test is our
ordering, not the provider's shape.

**Vitest resolves no path aliases.** `vitest.config.ts` declares none, so `@/…`
fails at import time with "Cannot find package". Anything under `src/lib/` that a
test reaches has to import its neighbours relatively — including
`../generated/prisma/enums`, which is the one generated module a pure helper has
reason to touch.

### The sync knows what to run; nothing runs it yet

`--due` is the whole of what a scheduled run needs to do, and it is verified by
hand. What does not exist is the thing that calls it on a timer, so the deployed
app's data is still only as fresh as the last time a laptop was open.

**The trigger is going to GitHub Actions rather than Vercel Cron**, and the
reason is the one that shaped `apiFootballKey()` in the first place: the key is
withheld from the deployed environment, so a page that reached API-Football
fails loudly at the moment the mistake is made. A cron route under `src/app/`
would need `API_FOOTBALL_KEY` and `LEAGUES` on Vercel, and the guarantee would
stop being environmental and become a lint rule somebody has to keep running.
Running the existing CLI from Actions keeps it structural and adds no runtime
code. The costs, stated: Actions' cron fires late under load, the production
connection string gains a second home, and GitHub disables a scheduled workflow
after 60 days without repository activity.

Anything narrower than a whole-season calendar read is deliberately not built.
`/fixtures?from=&to=` and `?ids=` are the escape hatches if a run ever needs to
be cheaper, and the thing that would force it is a cadence below five minutes —
at which point Neon's compute stops suspending between runs, which is a larger
cost than the payload.

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

**A modal closes without navigating, so both buttons carry
`fallbackRedirectUrl="/fixtures"`.** By the time it closes the session exists,
and Clerk's `<SignInButton>` and `<SignUpButton>` are inert once it does — so
without a named destination a fresh sign-in leaves the user on `/` looking at
two controls that no longer do anything. `fallback` rather than `force` because
it yields to a `redirect_url` in the query string, which is what would carry a
protected deep link through the login. The proxy covers the other way in,
arriving at `/` with a session already in place; it cannot cover this one,
because no request is made.

**Next 16 renamed `middleware.ts` to `proxy.ts`, and almost every Clerk guide
still says otherwise.** The file lives at `src/proxy.ts` — alongside `app`, not
at the repo root. Clerk's current quickstart has caught up; most third-party
writing and most model training data has not. The same applies to
`<ClerkProvider>`, which now belongs inside `<body>` rather than wrapped around
`<html>`.

`src/proxy.ts` runs `clerkMiddleware()` on every matched request and redirects in
both directions: signed-out visitors away from each of the signed-in
destinations, and signed-in ones off `/` to `/fixtures`. The second half lives
here rather than in the landing page because reading the session during render
would make `/` dynamic, and it is [the one route that
prerenders](#build-and-deploy). It is also an exact path test rather than a
matcher entry, since it must not reach anything below `/`.

Its third job is to write the `madooo-league` cookie when a request names a
league on `/fixtures`, which is the [only kind of state the proxy
holds](#a-location-goes-in-the-url-a-preference-goes-in-localstorage). It runs
after both redirects, so a request about to be bounced never leaves a cookie
behind, and it returns `undefined` for everything else — the cookie is only ever
added to a navigation that was happening anyway. Soft navigations are covered
without special handling: a `<Link>` click fetches the RSC payload over the same
request path, through the same proxy.

Both redirects are optimistic checks. The check that guards data is
`requireDbUser()` itself, because Next's own guidance is that a proxy may run
separately from the render, and because a check placed in a layout would not
re-run on client-side navigation. Nothing is exposed if the signed-in redirect
fails to fire — it only shows a signed-in user the landing page.

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
so a path and its types cannot drift apart. `PageProps` is generated into
`.next/types` — after adding, renaming or moving a route, `tsc` cannot resolve
the name at all until a build has regenerated it.

**Where "Back" goes is URL state too, and `?from=` is rebuilt rather than
echoed.** A player profile is reached from a squad list, from the match page's
verdict summary and from the diary, so no single parent is right and a server
component cannot call `history.back()`. The origin therefore rides in the query
string. [`back.ts`](../src/lib/back.ts) parses it against a handful of our own
shapes and **reconstructs the href from the parsed parts**, so a value that is
not one of them cannot survive: `?from=https://…` written straight into a
`<Link>` is an open redirect, and reconstruction is a stronger guarantee than a
list of things to reject. The filter, the matchday or the profile's tab travels
with it, so Back returns to the screen the reader actually left rather than to an
unparameterised one. `playerHref` and `teamHref` do the `encodeURIComponent`,
once each, because a `from` carrying `?filter=mvp` has to survive being a value
inside another query string.

**The two profiles are origins for each other, and the fallback belongs to the
screen rather than to the value.** A club lists its players and a player names
his club, so `/teams/N` and `/players/N` are both recognised shapes and the loop
closes in either direction. What could not be shared is where an unrecognised
`?from=` lands: a club reached by typing its URL belongs back at Teams, not at
Players, so `backLink` takes the fallback as an argument and each screen passes
its own.

### The landing page reads nothing, and everything on it is fiction

`/` is the project's only public screen and its only prerendered one, and those
two facts are the same fact: it renders no database call, no `auth()` and no
`searchParams`, so there is nothing for a request to vary. Anything later that
wants a live number on it — a count of matches in the database, say — costs the
page its prerender, which is a trade to make deliberately rather than by
accident.

What it shows instead is a constant: a mock fixture, four players, their verdicts
and their notes, in
[`landing-preview.tsx`](../src/components/landing-preview.tsx), and three sample
totals in the page itself. A signed-out visitor has no diary to show and a
stranger's is private, so there was never a real answer to draw.

- **It sits on `--surface`, not `--page`.** Every other screen takes the page
  tone, which is what makes the cards on it read as raised off something. This
  one is flat — one card, separated by its border, which foundations calls the
  primary separator — and the drawing is white edge to edge, including behind
  the header. The two grounds differ only in light; in dark they are the same
  colour.
- **The mock is built from the app's own objects but not from its components.**
  The card, the header strip, `ShirtTile`, the note's rule and `Badge` are shared,
  so what a visitor is shown is what they get; `SquadPanel` is not, because its
  types are shaped by the match page's query and naming them here would drag
  Prisma onto a page that must never reach it.
- **It draws `FWD`/`MID`/`DEF`, not the drawing's `RW`/`CM`/`CB`.** Same decision
  as [everywhere else](#a-position-is-one-of-four-letters-and-the-designs-ask-for-more),
  and it binds hardest here: a landing page promising a detail the product cannot
  render would be advertising the mock rather than the app.
- **The whole card is `aria-hidden`.** It is a picture of the product, not
  information — read aloud it puts four strangers and their invented verdicts
  between the hero's heading and the first real content.
- **The page claims "free and open source", so the repository has to be.** MIT,
  in `LICENSE`, with the README the GitHub button lands on. The claim is in the
  markup twice and the URL appears three times, which is why the URL is a
  constant.

### A location goes in the URL; a preference goes in `localStorage`

The two indexes, `/players` and `/teams`, are the screens whose state is not in
the URL, and the distinction that admits them is the one to apply to anything
later.

A **location** answers *what am I looking at* — `?matchday=6`, `?filter=mvp`,
`?view=notes`. It belongs in the URL, which is what keeps those pages server
components and makes them linkable and reachable with the back button.

A **preference** answers *how do I like this drawn* — rows or cards, which sort,
which league to narrow to. Nobody bookmarks Grid, and the URL is the one store
that does **not** survive closing the tab, so a preference put there is forgotten
between visits and clutters a link that was never about it. Each index keeps its
three in `localStorage` and its search box in React state, since a search term is
neither: it is worth nothing on the next visit.

**A third store, and the narrow rule that admits it: a preference the server must
know *before* it renders lives in a cookie.** `/fixtures` has exactly one —
`madooo-league`, holding the slug of the competition last opened, which is what a
bare `/fixtures` falls back to. It cannot be a `localStorage` preference, because
what it defaults is a *location*: the league decides what the server queried, so
a client-side answer would arrive after the query it was meant to scope, painting
the wrong competition first and then replacing it. A cookie travels on the
request, so the first paint is already right and the page ships no JavaScript.
The write is [`src/proxy.ts`](../src/proxy.ts)'s, and it has to be — a league pill
is a plain `<Link>`, so there is no click handler, and a Server Component cannot
set a cookie at all. Next allows that only in a Server Action or a Route Handler.
The cost is the mirror of `localStorage`'s: a cookie is per browser, so a phone
and a laptop remember separately.

Reach for it only under that rule. A cookie rides on every matched request
whether or not anything reads it, which is a cost the two indexes' preferences
would pay for nothing — the server has no use for a sort order.

**Each screen owns its own keys** — `madooo-players-*` and `madooo-teams-*` —
rather than sharing one trio. The two lists are narrowed and sorted
independently: "Most flops" over twenty clubs is a different question from the
same words over six hundred players, and a reader who asked for cards on one has
said nothing about the other. What they *do* share is the vocabulary those keys
hold, in [`rankings.ts`](../src/lib/rankings.ts): a club and a player are ranked
on the same seven numbers and offered the same five sorts, so there is one sort
table and one set of parsers, and the two lists cannot drift out of step.

The cost is stated plainly because it is real: the server cannot read
`localStorage`, so the page is a client island and **the first paint shows the
default** before React re-renders with the stored choice. The theme toggle avoids
that with an inline script in the document head, which works because a theme is
one attribute and CSS does the rest; nothing can do it for a preference that
reorders a list.

**The hook is `useSyncExternalStore`, and the three obvious alternatives are all
wrong.** `useState` seeded from storage renders one thing on the server and
another in the browser — a hydration mismatch; seeding it in an effect paints the
default first *and* is rejected by `react-hooks/set-state-in-effect`; reading
storage during render is the first problem again. `useSyncExternalStore` takes a
separate server snapshot, so the two renders agree by construction. Two things it
requires: `getSnapshot` must return a **primitive**, since React compares it with
`Object.is` and a fresh object each call loops forever; and the `storage` event
fires only in *other* documents, so a writer has to notify its own listeners.
Both are in [`use-preference.ts`](../src/components/use-preference.ts).

A stored value is **exactly as untrusted as a URL parameter** — it outlives
deploys, it is editable in devtools, and it can name a league that no longer has
squads. So every one of them goes through a `parse*` that falls back, in the same
table-plus-parser shape `diary-filters.ts` established for the URL.

### The league is a slug in the URL, and is neither our id nor the provider's

`/fixtures?league=primeira-liga&matchday=6`. Three candidates were available and
the existing conventions ruled out two:

- **`League.id`** is our own autoincrement, assigned in sync order, so it is not
  stable across Neon branches — one bookmarked URL could name different
  competitions on a laptop and in production.
- **`apiFootballId`** is the provider's vocabulary, and the pager already keeps
  that out of our addresses deliberately: the same boundary the sync draws,
  applied to the address bar. It is also meaningless to a reader.

The slug is derived from `League.name` and never written down, which is the rule
`leaguesInSeason` and `parseLeague` already state for league identity. It is
built on `searchKey`, the app's one name-flattening rule, so a competition with
diacritics comes out typeable. Its risks — a provider rename, two leagues sharing
a name — degrade to the default league rather than to an error, exactly as
`parseFilter` and `backLink` treat unrecognised input.

`src/lib/leagues.ts` owns league identity beyond the URL: `flagClass` sits beside
the slug there and maps `League.country` onto a flag class, on the same
`searchKey` and with the same degrade-to-nothing posture. `leaguesWithMatches`
selects `country` for it, which is the only thing that reads that column.

**A league is a location here and a preference on the two indexes, and that is
not two answers to one question.** On `/fixtures` a pill decides what the server
queried; on `/players` a select narrows rows already shipped. `foundations.md`
draws that line and its test is what the control changes, not what it names.

**`parseLeagueScope` has three answers in order: the slug the URL named, the slug
in the `madooo-league` cookie, then the first league the database returned.** The
URL wins wherever it speaks, so a link or a bookmark still means what it says;
the cookie only fills the silence. Neither input is trusted further than the
other — a cookie outlives deploys and can name a competition that has stopped
playing, so both are matched against the leagues actually found and both fall
through when they miss. Before this, the silence fell to the alphabet, which is
how everyone came to open on La Liga.

Validation of a slug splits in two: **shape without the database, existence with
it.** `isLeagueSlug` in [`leagues.ts`](../src/lib/leagues.ts) is the first half,
and it is there rather than in either caller because both need it —
[`back.ts`](../src/lib/back.ts) to rebuild a "Back to fixtures" href without
echoing its input, and the proxy to refuse copying an arbitrary query parameter
into a cookie. The second half is `parseLeagueScope` falling back on arrival.
`back.ts` rebuilds the query rather than echoing it, which is what keeps the
open-redirect guarantee intact; both files are pure, and the proxy's import is a
third reason `leagues.ts` must stay so.

**A league pill carries no matchday.** Round 6 is a different weekend in each
competition and the two do not have the same number of rounds, so carrying the
number across is a false equivalence that can also land out of range. Dropping it
lets `defaultRound` choose for the league just switched to.

`src/app/(app)/layout.tsx` calls `requireDbUser()`, which is what provisions the
row for everything below it. Nothing there renders anything from the result —
Clerk supplies the name in the sidebar — so the call is purely the upsert plus
the redirect. **Every other caller calls it again for itself**, and must: Server
Actions render no layout at all, and a page that needs our `User.id` rather than
just the guard has to ask for it. The match page, the fixtures page and both
actions all do. The upsert is idempotent and memoised per request with React's
`cache()`, so a second call in one render costs one indexed lookup.

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

**`madooo.app` runs Clerk's production instance; everywhere else runs the
development one.** The two cannot be mixed, because live keys are locked to the
domain — Clerk refuses a `pk_live_` on any other host with *"Production Keys are
only allowed for domain madooo.app"*. So the keys are scoped per Vercel
environment: `pk_live_`/`sk_live_` on Production, the `_test_` pair on Preview,
and `.env.local` untouched so a laptop keeps the development instance. Two rows
per variable name in Vercel's panel is the intended end state, not a mistake.
Vercel classes `CLERK_SECRET_KEY` as sensitive and refuses to apply it to the
Development environment at all; nothing reads that environment, since local runs
take `.env.local` and `vercel dev` is not used.

**The production instance mints its own `clerkId`s, so signing in on
`madooo.app` creates a second `User` row.** Judgements recorded through the
development instance belong to the old id and are invisible to the live site,
though both rows sit in the same Neon development branch. Nothing is lost and
nothing needs migrating — an empty live diary is the expected reading, not a
bug.

**`x-clerk-auth-reason` and `x-clerk-auth-status` on any response are the first
thing to read when auth misbehaves.** `curl -sSI` against a protected route
gives them without a session. `session-token-and-uat-missing` is the ordinary
signed-out case; `unexpected-error` means the middleware *threw* while verifying
and points at `CLERK_SECRET_KEY` rather than at the browser, which is the
opposite of where instinct sends you.

**DNS for `madooo.app` is answered at Namecheap, not Vercel** — the nameservers
were never delegated, so Vercel serves the site from an apex `A` record while
every other record is added in Namecheap's Advanced DNS panel. Clerk's five
CNAMEs (`clerk`, `accounts`, `clkmail`, and the two `_domainkey` records) live
there. Namecheap's Host field takes the subdomain alone, so a pasted FQDN
becomes `clerk.madooo.app.madooo.app` and fails validation with nothing to
suggest why. The apex is the canonical host; `www` 308s to it, and the Clerk
instance is bound to the apex.

---

## Writing data

[`src/lib/actions.ts`](../src/lib/actions.ts) is the app's only `'use server'`
file and the only code that writes. Everything else reads.

**Every export of a `'use server'` file is a public POST endpoint.** Next
compiles the bodies out of the client bundle and leaves a reference that posts
back, so the route is reachable by anyone who can send that request — the UI is
not a boundary. Two rules follow, and both are load-bearing:

- Nothing but async actions may be exported from that file. A helper exported
  alongside them becomes an endpoint of its own.
- Each action calls `requireDbUser()` itself and validates its own arguments.
  `setVerdict` checks the id is an integer and the tag is one of the three, via
  the `isJudgementTag` type predicate in
  [`verdicts.ts`](../src/lib/verdicts.ts) — the thing that turns a string off the
  wire into an enum without a cast.

**`refresh()` from `next/cache`, not `revalidatePath()`.** Almost all writing
about Next says the latter, but `revalidatePath` invalidates a *cache*, and every
page under `(app)` is `force-dynamic` with nothing cached to invalidate.
`refresh()` says what is meant — re-render the current route — and Next streams
the new RSC payload back inside the action's own response, so one round trip
covers the write and the redraw. Next's own guide is
`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`.

**Actions take the state wanted, not "flip this".** `setVerdict(id, tag | null)`
is idempotent, needs no read before its write, and cannot race itself into the
opposite of what was tapped. Deciding that a second tap means `null` belongs to
the client, which is what knows the verdict it just drew. Any later toggle should
be shaped the same way.

**Clearing half a judgement is a delete *then* an update**, both inside one
`$transaction`, and that order is the whole of it. `judgement_has_content` — the
CHECK constraint added by hand in the initial migration — requires a tag or a
note, so blanking the tag on a judgement that has no note violates it, while
deleting outright would throw away a note that is there. So: delete the
judgements that are only a tag, then blank the tag on whatever survives, which
is exactly the ones carrying a note. Each statement leaves every row it touches
valid on its own. `clearTag` and `clearNote` are that pair in each direction,
written out twice rather than shared through a column-name parameter — what
differs between them is which column each statement reads and which it writes,
and the parameterised version says less than the four lines do.

**An empty string is how a note is deleted.** `setNote(id, '')` runs `clearNote`;
there is no delete action and the design draws no delete button. It is the same
set-semantics as the tag, so the one gesture is clear the box and save.

**MVP's exclusivity is enforced in the action, not by a constraint.** The rule is
in [`AGENTS.md`](../AGENTS.md); the mechanism is that awarding it runs the same
clear-a-tag pair over *the previous holder in this match*, in the same
transaction as the award, so a match is never left with two MVPs or none. The
filter reaches through the relation to `MatchSquad.matchId` and excludes the
player being awarded — without that exclusion the clear and the upsert fight over
one row. A partial unique index would be the database-level alternative and was
not taken: it would reject the second award rather than transfer it, which is the
opposite of the wanted behaviour.

**Which match a write belongs to is read from the squad row, never taken from the
caller.** `setVerdict` takes only a `matchSquadId` and looks the `matchId` up by
primary key. Accepting it as an argument would let a crafted POST scope the MVP
demotion to a different match and strip the tag off a player in it. The lookup
doubles as an existence check, turning a bogus id into a clear message instead of
a foreign-key violation — which is the only reason `setNote` makes it too, since
nothing there needs the match. Without it that action's two branches fail
differently and neither says much: the upsert with a raw foreign key error, and
the clear not at all, because a `deleteMany` that matches nothing succeeds.

**A demoted MVP's chip is un-filled by the `refresh()`, not by the click.** Each
row is its own client island with its own optimistic state and no knowledge of
the others, so for the length of one round trip two chips read as MVP. Making
that instant would mean lifting the whole match's verdicts into shared client
state, which is a much larger thing than the lag is worth.

**A `CHECK` constraint in Postgres is non-deferrable**, and no transaction
changes that. Only `UNIQUE`, foreign keys and `EXCLUDE` can be declared
`DEFERRABLE`; a `CHECK` is evaluated as each statement runs. Writing the pair in
the other order and expecting `$transaction` to hide the moment in between fails
with `23514` on the first statement — which is how this was found.

**Next dispatches Server Actions one at a time per client.** Tagging five players
quickly queues five round trips rather than overlapping them. That is the
framework's behaviour and not a bug to route around; `Promise.all` over actions
would not parallelise them.

**Optimistic state is `useOptimistic`, never a `useState` copy.**
[`verdict-controls.tsx`](../src/components/verdict-controls.tsx) holds the tapped
verdict only until the server's own answer arrives in the `refresh()` re-render,
so there is no second copy of the tag to fall out of step with the database.
Both the optimistic update and the action call have to sit inside the same
`startTransition` — outside one, the optimistic value has nothing to be discarded
against.

**The write reaches the client through a small island, not a client page.** A
squad row stays a server component and mounts its controls inside itself; the
match page ships nothing else to the browser. The same move as the shell's
`<Sidebar />` prop, in the other direction.

**Optimistic state decides where an island's boundary falls.** A squad row's note
appears on a line of its own *under* the row, in a different cell of the same
grid from the button that writes it — and the two share one `useOptimistic`
value, so one component has to own both. `PlayerControls` is that owner, and it
returns a **fragment of two grid children**: a fragment emits no DOM, so both stay
direct children of the `<li>` and the grid still places them. The verdict chips
are handed to it as `children` rather than imported, which keeps
`VerdictControls` free of any knowledge of notes. Anything later that wants
optimism across two separated parts of one row takes the same shape.

---

## Design tokens and CSS

[`foundations.md`](design/foundations.md) is the source; `globals.css` is the
only file in the project allowed to hold a hex or a raw px. It has two tiers —
base tokens that never change, semantic tokens that say what a colour is *for* —
and product code names only the second.

**Theming is one `light-dark()` call per semantic token**, and the whole of the
switch is `color-scheme`. `:root` declares `light`, so light is what every user
gets; `[data-theme="dark"]` on `<html>` declares `dark`, and because
`light-dark()` resolves where a variable is *used* rather than where it is
declared, that one attribute re-points every semantic in the subtree below it —
along with the browser's own scrollbars and form controls. Nothing else changes.

**The app does not follow the operating system.** It did until the toggle
existed; the decision is that a diary opens light unless its owner has said
otherwise, and `foundations.md` says the same in its own words. The consequence
worth knowing is that `prefers-color-scheme` no longer appears anywhere in the
compiled CSS, so it is not a signal anything can be keyed off any more.

**The corollary is a rule: no `dark:` utilities anywhere**, and as of the toggle
the repo contains none. A `dark:` class keys off `prefers-color-scheme`, the one
signal this stylesheet has stopped listening to, so it would disagree with the
user's actual choice rather than merely duplicating it.

Tailwind gets the tokens through `@theme inline` — `inline` is required, not
stylistic, because only it makes `bg-surface` emit `var(--surface)` rather than
copying the value into a variable of Tailwind's own that would not re-point.
Spacing is deliberately not tokenised: foundations' scale *is* Tailwind's default
4px scale, so `--sp-6` is `p-4` and inventing tokens would give every value two
names. Frame sizes stay plain variables, used as `w-(--sidebar-w)`.

The type scale is eleven `@utility` classes rather than font-size tokens, because
each role in foundations is a set of five properties — family, size, weight,
line-height, tracking — and a `text-title` that left the weight to the caller
would be a different design.

**A role is added when a screen needs a size the scale does not have, not when a
screen wants one.** Three have been added. Two were the same shape of problem:
foundations mandates monospace for a number you can add up, and its mono scale
has three sizes with large gaps between them.

- `text-score` — 40px — because `text-stat`'s 32px beside a 24px club name is too
  small a step for a scoreline to read as the subject of the page, and
  `text-display` is 40px but sans, so it would break the mono rule to get the size.
- `text-tally` — 20px — because the shirt tile has two sizes, 64px on a profile
  and 40px in a list row, and the 40px one has nothing to hold: `text-stat` puts
  two digits against the edges and `text-data`'s 13px reads as a caption on a
  colour swatch. 20-in-40 is the ratio the existing 32-in-64 tile has, which is
  what makes the two read as one object at two scales.

The third, `text-hero` — 48px — is the case the rule was written to be careful
about, since a landing page's opening line *wanting* to be large is not the same
as needing a size. What settled it was measuring instead of judging: in the
hero's own column, 40px sets that sentence in two lines and 56px in four, and
48px is the only value that holds three across the range of widths that column
takes. It cost the scale a size rather than only a role, which is the more
expensive of the two and is why 56px was tried first.

**Line count is a function of two numbers, and the column is the one that is
easy to forget.** The hero's is not `--container` halved: page padding comes off
first, then the grid gap, so at desktop it is about 512px rather than the 560 the
arithmetic suggests. Measuring a heading against the wrong width picks the wrong
size by a whole step.

The alternative in every case was `text-[40px]` at the call site — a raw px in
product code, the one thing the token system exists to prevent.

### Responsive rules are in `foundations.md` and are binding

Its `### Responsive` section fixes the breakpoints as Tailwind's defaults, states
that chrome changes arrangement rather than scaling, and explains why utilities
are written unprefixed-then-`md:`. Read it before writing markup, the same way as
the rest of the file.

`--row-h-lg` means the same rows, below `md`. Anything tappable follows
`h-(--row-h-lg) md:h-(--row-h)`. A row carrying controls takes it as `min-h-`
instead, so it can grow past the floor without the height being restated — which
is what let the squad row become two lines below `md` without touching it.

### Hovering a filled surface and hovering a tint were resolved differently

Both are the same gap in `foundations.md`'s "surfaces darken one step": neither
black nor a verdict tint has anything below it. The difference in how they were
closed is the useful part.

**The inverse surface got a token.** `--surface-inverse-hover` is `#333333` in
light and `#eeeeee` in dark — both existing ramp steps, so no hex was invented.
Every filled button carries the complete state set as one string:

```
t-hover … bg-surface-inverse … hover:bg-surface-inverse-hover
active:translate-y-px focus-visible:focus-ring
```

Press is the transform with no second colour step, and in light theme the hover
*lightens*; foundations' Interaction states says why both are the rule rather
than a breach of it. The landing page holds that string in a `FILLED` constant
because it draws two of them, one a `<button>` and one an `<a>` — which is also
why it is a string rather than a component. A link needs `no-underline` on top
of it, since the base stylesheet styles every `<a>` as prose.

**A tint did not get one.** `--mvp-bg` and friends still have nothing below them,
and nothing was invented: a **resting** verdict chip takes the standard hover
(surface to `--surface-alt`, border to `--border-strong`, muted ink to full) and
a **selected** one takes no colour change at all. Anything later that sits on a
tint should do the same.

The selected pill tab and the selected segmented button fill with
`--surface-inverse` too and were deliberately left outside the new token's scope.
They are selected states rather than buttons — clicking either again is a no-op —
which is the same reason a selected chip has no hover.

The note button on the same row is the rule applied one step up the ramp: resting
it is borderless and takes the standard hover to `--surface-alt`, and once there
is a note it sits on `--surface-sunken` with no hover of its own. Its glyph does
**not** fill — `FILL 1` means "on" for the states `foundations.md` lists, and a
note is not one of them, so the box carries it.

The chips' selected classes are written out one verdict at a time rather than
built from the tag. **Tailwind finds class names by scanning source as text**, so
a name assembled at runtime is one it never sees and never generates CSS for.
This applies to every future tinted thing, not just these.

**`NOTE` is a fourth badge over a three-value enum.** `JudgementTag` has three
members and a judgement list draws four badges: a judgement carrying a note and
no tag is a valid row, and it is rendered in the informational blue with
`edit_note` — the same distinction that keeps notes out of the match page's
header counts. The key type is `JudgementTag | 'NOTE'`, exported from
[`badge.tsx`](../src/components/badge.tsx) beside the table of tints. Nothing
named `NOTE` reaches the database, and nothing should: the reference screenshots
have no example of this case, so it is a drawing decision, not a schema one.

**The badge itself is one component, and callers with a key of their own write
it beside the table rather than into it.** The landing page draws an `UNRATED`
badge, which corresponds to nothing in the app — an unrated player is one
carrying no judgement, and the match page draws that as three chips nobody has
pressed. So `VERDICT_BADGE` stays the four a real judgement can be, and the
landing page's fifth lives in its own file. `<Badge>` takes an optional glyph for
it, because the three verdicts own the three glyphs and there is none for the
absence of one.

**A judgement row is one component and a `children` slot.** `/diary` and a player
profile draw the same row — date, badge, note underneath — and differ in one
line: the diary names the player and the fixture, the profile names the fixture
alone, because it *is* the player. `JudgementEntry` takes the date, tag and note
as primitives and the line as `children`, rather than taking a query row: the two
screens select different shapes, and a component naming either would drag the
other's query into its types.

**`--text-body-lg` is for a note that is the content**, not an annotation on
something. Both screens that list judgements use it, and nothing else does: on a
squad row the same text is `--text-body` in `--text-muted`, indented under the
name, so the row stays a row. A note's size is a fact about where it is read.

**A heading that is drawn as a layout gets its name as a string, and the drawn
version is its sibling rather than its content.** The match page's scoreline is
two club names, two crest marks and a score in three grid columns. Read as markup
that comes out as two names split around a bare `1–2`, and an unplayed match
reads as "Manchester United 15:00 Leeds", a scoreline that never happened. So the
`<h1>` is an `sr-only` string from `scoreline()` — already the app's one way of
naming a match, shared with the diary and the profile — and the arrangement sits
beside it with everything that is not a link `aria-hidden`, so the score is
announced once.

**The two were one element until the clubs became links, and that is the rule
worth keeping.** The arrangement used to live *inside* the heading under a single
`aria-hidden`, which is the simpler shape and was correct while it held nothing
focusable. A link inside a hidden subtree is the failure it cannot survive:
reachable by keyboard, absent from the accessibility tree, announced as nothing.
**Wrapping content in `aria-hidden` is a commitment that nothing in it will ever
be focusable** — when that stops being true, the hidden part has to shrink to the
decoration rather than the control being dropped in anyway.

**A club mark is `aria-hidden` wherever it appears, so whatever holds it has to
name the club.** `CrestChip` has three sizes — 20px in a row, 40px square in the
scoreline, 64px in a club profile's header — and all go through `crest()`, which
is what foundations requires of anything carrying a club colour. **The letter
role belongs to the size**, so it lives in the size table rather than in the
component's className: `text-caps` at 20 and 40px, because it is the only role
that is bold, tracked *and* capitalised, which is what three letters on a
saturated colour need; `text-title` at 64px, because 11px of type in a 64px box
reads as a smudge in the corner rather than as the identity of the screen. The
64px size exists to match the 64px `ShirtTile`, so the two profiles open with a
mark of one size.

**A club mark can be the link into a club, and then the `sr-only` name has to
move inside it.** The squad panel headers are one of the app's ways from a match
to a club, and a link wrapping an `aria-hidden` chip alone would announce nothing
at all — the name that was sitting beside the chip is what gives the link its
accessible name, so it goes in the anchor. The scoreline's clubs are the other
way, and there the visible name is already inside the link, so the crest joins it
rather than standing alone: a club is one thing to click.

**A link that has to sit exactly where static text sat takes padding and cancels
it.** Both club links need a hover surface worth aiming at — a 20px chip is below
anything tappable — and both sit in layouts tuned to the pixel, the squad
header's crest alignment and the scoreline's centre column. `p-2` with `-m-2`
grows the target without moving the content, which is the general answer whenever
existing text becomes a link.

**Putting the crest in every squad panel header deleted a special case rather
than adding one.** The panels used to compose their own title, and a bench with
no eleven above it — a real state, since the sync's merge is a union over two
endpoints — had to name its club in that title, while an ordinary bench named it
only for a screen reader. `SquadPanel` now takes the team itself and draws the
crest plus an unconditional `sr-only` club name, so the heading no longer depends
on whether a sibling panel exists. **A component that took a pre-composed string
had to be told about its own context; one that takes the thing itself does not.**

**A missing fact is dropped from a centred strip and stood in for in a justified
one.** The scoreline card omits the venue or the referee when the column is null;
`FixtureCard` prints "Venue unknown" instead. Not an inconsistency — that strip is
`justify-between` with two children, so dropping one leaves the date against empty
space, and the placeholder is holding a slot open. A centred wrapping run has no
slots to hold, so the remaining facts close up. Where there is a choice, prefer
dropping: "Referee unknown" is a sentence about an official who does not exist,
which is [the reasoning that keeps positions at four
letters](#a-position-is-one-of-four-letters-and-the-designs-ask-for-more).

**A screen whose header is not a title block still uses the shared back link.**
[`back-link.tsx`](../src/components/back-link.tsx) was extracted from `PageHeader`
when the match page's header became a card, and it carries its own `mb-3` — 12px
above whatever follows is a fixed relationship, not a per-caller decision. A
`PageHeader` variant would have had to suppress the title, the mark and the
subtitle, which is the whole component, and would have left `title` conditionally
required. **Every screen still has exactly one component owning its header
spacing**, which is what stops the six of them drifting apart.

**A screen's stat tiles are one component and a table each.** `StatTiles` is
generic over the union of keys it reads — `StatTiles<K extends string>` with
`Record<K, number>` totals — so four screens draw the same four boxes over
different numbers and a tile naming a key its totals lack is a compile error
rather than a blank. A new screen adds a table, not a component — including when
its labels coincide exactly with another's, as a club's do with a player's. The
word underneath differs even where the label does not: a player's *watched* is
matches he was named in, a club's is matches it played, and the queries share no
code. One table for both would hide that at both call sites.

**A list row is one component across the screens that draw it, and the subtitle
is what varies.** `PlayerRow` holds the shirt tile, the name, the `md:` position
column, the split bar with its `sr-only` counts, the seen count and the chevron —
everything except the one line under the name, which the caller passes. The
players index puts the club and position there; a club's squad, which has already
named the club in its own header, puts what the player has been judged. It
carries no `'use client'` of its own, so it renders on the server inside the club
profile and joins the bundle inside `players-browser`.

**Two tab vocabularies, and which is which.** `foundations.md` lists a 40px
`--control-h-lg` tab and a 28px pill tab as separate controls; the rule between
them is that an **underline tab changes the view of the screen you are on** —
the diary's filters, a player's Diary and Notes — while a **pill chooses the
scope the screen is drawn for**, which so far is only the league row.
[`tab-strip.tsx`](../src/components/tab-strip.tsx) is the first;
[`league-tabs.tsx`](../src/components/league-tabs.tsx) is the second.

They share `TabStrip`'s `Tab` type, because the two differ in rendering rule
rather than in what a tab is, and both take `current` as a prop for the same
reason: the page has already parsed the parameter to run its query, and asking
again in a client hook would give the answer two sources. Only the unselected
state differs — foundations draws the pill selected and disabled but never
unselected, so `league-tabs.tsx` sets that itself, borrowing the muted-to-ink
treatment the pager's arrows and the inactive underline tab already use.

The underline sits under the selected tab alone, with **no rule spanning the
strip**. That is how the design draws it and it is also what lets the strip wrap:
a continuous rule under a wrapped strip would underline the last row only,
leaving a selected tab on the first row detached from it. Wrapping rather than
scrolling sideways is 6.1b's decision and survives the change.

**A proportional bar takes an inline width, and that is not a token breach.** The
split bar sizes its segments from the database, so no semantic token could ever
express the value — and Tailwind could not generate the class anyway, since it
finds names by scanning source text and `w-[47%]` is assembled at runtime. The
bar's track is `--surface-sunken` and the unrated remainder is **the track showing
through** rather than a fourth filled box, which is what the design draws and also
means three rounded widths cannot leave a gap at the right-hand end. The segments
take the verdict *ink* tokens rather than the `--*-mark` trio, which foundations
scopes to a glyph on an inverse surface; the ink also makes each segment exactly
the colour of the legend label beneath it.

`SplitBar` and `SplitLegend` in [`split-bar.tsx`](../src/components/split-bar.tsx)
are the drawn parts; `VerdictSplit` is the profile's card around them, and a
players-index row draws the bar alone. **The bar is `aria-hidden` and carries the
crest chip's contract: whatever holds it has to name it.** In the card the legend
below states every count as text, so a bar announcing its own numbers would say
the whole thing twice; in a row there is no legend, so the row supplies an
`sr-only` sentence. The bar cannot know which of the two it is in, which is why
the obligation sits on the caller. Which segments a legend draws is the caller's
decision too — a profile passes all four, a grid card passes the three that are
verdicts, because `unrated` only reads as "watched him and said nothing" where the
watched count is on screen beside it.

**A two-column screen nests its columns rather than auto-placing into a grid.**
The match page draws four panels — each club's starting eleven and its bench.
Dropping all four into one `md:grid-cols-2` puts the home bench in the away
column, and below `md` stacks them home XI → away XI → home bench → away bench,
which reads as nothing at all. A `<div>` per club, each holding that club's two
panels, gives the drawn desktop layout *and* a narrow layout of one whole club
followed by the other. Any later screen pairing two of something wants the same
shape.

**What nesting costs is shared rows, and `grid-rows-subgrid` buys them back.**
Nested columns size independently, so a note on one club's eleven pushed only
that club's bench down and the two benches stopped starting at the same height.
The parent declares two rows; each column becomes a grid at `md` that spans both
and *adopts the parent's tracks* rather than declaring its own, which puts both
elevens in one row and both benches in the next. It takes `items-start` with it,
or the shorter panel stretches to fill the row and a bordered list card ends in
blank space. Below `md` the subgrid classes are inactive and the column is a flex
stack again, so the narrow layout is untouched.

**`grid-rows-2` does not mean "two rows".** Tailwind's numbered track utilities
expand to `repeat(n, minmax(0, 1fr))`, so it means two rows *of equal height* —
which padded the bench row out to the height of an eleven carrying notes and left
a hole above "Your verdicts". The match page asks for `grid-rows-[auto_auto]`.
Equal columns are wanted and equal rows are not, and the two read almost
identically in the markup.

### The dialog is the platform's, and so are the fields

The note dialog in [`player-controls.tsx`](../src/components/player-controls.tsx)
is a native `<dialog>` opened with `showModal()`, not a hand-rolled overlay: the
focus trap, Escape, the inert background and the top layer all come for free.
The top layer is the one that earns it — `<main>` is `position: relative`, so
anything fixed inside it would resolve against `<main>` rather than the viewport.

- **It is mounted only while it is open**, which is what makes the draft
  disposable — Cancel discards by unmounting, and there is no stale text to
  clear. It is also why the entrance in `globals.css` needs `@starting-style`: a
  transition needs a value to start from, and an element inserted a frame ago has
  no previous value at all. There is no exit animation, because React removes the
  element; foundations' motion inventory does not ask for one.
- **`m-auto` on the dialog is load-bearing.** Tailwind's preflight zeroes every
  margin, including the `margin: auto` the browser's own stylesheet uses to
  centre a modal dialog. Without it the dialog sits in the top-left corner.
- **`::backdrop` reads `--overlay` by inheritance**, which is a 2024 change to
  the spec. The browsers that took it are the same ones that took `light-dark()`,
  which every colour in this stylesheet already depends on, so the two stand or
  fall together.
- **Backdrop dismissal is on `mousedown`, not `click`.** A click's target after a
  drag is the nearest common ancestor of press and release, so selecting text in
  the textarea and releasing outside it would count as a click on the dialog and
  throw the draft away. The test — `event.target === event.currentTarget` — also
  only holds because the dialog itself carries no padding; the three sections
  inside it carry their own.
- **`showModal()` focuses the first focusable descendant**, which here is the
  close button. The dialog's callback ref moves focus to the textarea after it
  and puts the caret at the end, and it can reach the textarea from there because
  React attaches a child's ref before its parent's.
- **A field's focus state is not the ring.** `foundations.md` gives fields
  `--border-focus` plus an inset 1px of it, which reads as a 2px border without
  the element changing size and shifting the layout. That is the `focus-field`
  utility, and it is written `focus:` rather than `focus-visible:` — a field is
  focused in order to be typed in, so the state is real however the caret got
  there. It applies to all three fields the app now has.

The players index added the other two — a text input and a `<select>`, in
[`search-field.tsx`](../src/components/search-field.tsx) and
[`select-field.tsx`](../src/components/select-field.tsx) — and they take the same
"use the platform" line:

- **The select is native.** Keyboard behaviour, type-ahead, the wheel a phone
  shows instead of a menu, and the popup's own light or dark rendering all arrive
  for nothing, the last of them because `color-scheme` already re-points the
  browser's form controls. `appearance-none` removes the platform arrow so the
  closed box matches the field beside it; the open popup stays the platform's,
  which is the part that cannot be restyled and the part not worth rebuilding.
- **Both wrap their label rather than pointing at it with `htmlFor`**, so neither
  carries an `id`. An `id` baked into a shared component collides the moment two
  of them share a page, and a filter row is exactly where that happens — `/teams`
  already draws two selects side by side. That is also why both were built
  general rather than inside `players-browser.tsx`.
- **Neither carries `'use client'`.** A module imported by a client component
  joins the client graph on its own; the directive marks an *entry point* to the
  boundary, and a second one where it is not needed only invites the idea that
  every client-side file wants one. `icon.tsx` has the same shape.

### Things the toolchain does that the source does not show

- **Tailwind 4 and Clerk share a cascade via a named layer.** `globals.css`
  declares `@layer theme, base, clerk, components, utilities;` *before* the
  Tailwind import, because layer order is fixed by first appearance — declared
  after, `clerk` would append last and outrank every utility class. The matching
  `cssLayerName: 'clerk'` is on `<ClerkProvider>`. There is no
  `tailwind.config.js` to configure this from; v4 is CSS-first.
- **Clerk follows the theme because its `appearance.variables` are `var(--…)`
  references, not colours.** Clerk writes them onto its own elements, so they
  resolve in the DOM, under the same `data-theme` as everything else, and
  re-resolve when it flips — no React state syncing Clerk to the app. Passing
  resolved values would freeze its modals in whichever theme was current when
  the layout rendered. `colorNeutral` and `colorShadow` are deliberately left
  unbound: Clerk derives alpha shades from those two in JavaScript, and a
  `var()` is a string it cannot interpolate.
- **Lightning CSS polyfills `light-dark()` rather than passing it through**, into
  a pair of `--lightningcss-light` / `--lightningcss-dark` toggle variables set
  on `:root` and again on each `[data-theme]` rule. The cascade works out because
  those rules come after `:root` at equal specificity, so the later one wins —
  there is no media query in the output at all. The compiled CSS looks nothing
  like the source, which is worth knowing before debugging a colour in devtools.
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
- **A misspelled glyph name fails silently, and nothing in the toolchain catches
  it.** Google answers `200` and leaves the unknown name out of the font; the
  ligature then has no glyph, so the literal word renders — `trophy` in the middle
  of a sentence. The script's own "32 icons" line is `ICON_NAMES.length`, which is
  what we asked for rather than what came back, so it reports success either way.

  **Count distinct glyphs, not codepoints.** This entry used to say `len(cmap ≥
  0xE000)` should equal the array's length; it does not, and never did. Material
  Symbols gives many icons several private-use codepoints — deprecated names and
  aliases all mapping to one outline — so a 32-name subset answers with 47 PUA
  codepoints over 32 distinct glyphs. `len({cmap[c] for c in cmap if c ≥ 0xE000})`
  is the number that matches.

  The stronger check, and the one worth running, tests the mechanism instead:
  every name must have a **ligature**, since a ligature is what turns the word
  `grid_view` into a glyph. Walk `GSUB` — the lookups are `ExtensionSubst`, so
  unwrap `ExtSubTable` before looking for `ligatures` — rebuild each ligature's
  input string through the reverse cmap, and assert every entry of `ICON_NAMES`
  appears. `fontTools` reads `.woff2` directly given `brotli`.
- The script sends a browser User-Agent on purpose. Google serves the old static
  `Material Icons` font to clients it does not recognise, and that font silently
  has no FILL axis.

### The three flags are vendored files under `public/`, not a dependency

`flag-icons` is the obvious package and the wrong one here. Its CSS is only
27 kB, but it names 542 SVGs totalling some 3.8 MiB through `url()`, every one
of which a bundler resolves and emits into the build — a 4.13 MB dependency to
draw three of 271 flags. The three files are copied out of it instead, under its
MIT licence, with the notice in `public/flags/LICENSE`. `es.svg` keeps only the
two stripe paths: the coat of arms is 81 kB of the file and renders as a smudge
at 12px, and what is left is the Spanish civil flag rather than an invention.

A `background-image` rather than an inline `<svg>` or an `<img>`. Inline puts the
path data into the payload of every page that draws a pill; a background keeps
each flag a separately cached file, fetched only when a rule matches. An `<img>`
would want alt text a decorative mark must not have, and trips eslint's
`no-img-element`. Root-relative `url("/flags/pt.svg")` passes through Lightning
CSS unrewritten and resolves against `public/`, which is the point of writing it
that way — there is nothing for the toolchain to follow and get wrong.

**The entry that changes how later work goes:** a country and its class name live
in two files with nothing in the language binding them. `flagClass` returning
`flag-pt` while `globals.css` says `.flag-prt` draws an empty 16×12 box — no
console error, no failing build. That is the same silent failure as a misspelled
Material Symbols name above, and `leagues.test.ts` is where it is caught rather
than merely described: it asserts every class the map can return has a rule in
`globals.css` and a file on disk. Adding a flag means a file, a rule, a map entry
and nothing else; the test tells you which one you forgot.

---

## The app shell

`src/app/(app)/` is a fixed sidebar, a fixed top bar and scrolling content at
`md` (768px) and up; below `md` the sidebar becomes an off-canvas drawer opened
from a menu button in the top bar and closed by Escape, the backdrop or any nav
item.

- **`<main>` is `relative`, and that is a containing block, not a position.**
  Tailwind's `sr-only` is `position: absolute` with no offsets. Absolute
  positioning resolves against the nearest *positioned* ancestor, so with a
  static `<main>` those spans resolved against the initial containing block —
  the document — escaped the scroll container holding them, and each added its
  own offset to the document's scrollable height. The symptom was a page that
  scrolled a second time once `<main>` reached its end, into empty space below
  the frame, by as much as the lowest label's offset. One screen-reader label at
  the foot of a long list is enough. Any future scroll container has to be
  positioned for the same reason.
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
- **The theme toggle holds no React state**, and that is what keeps it free of
  the usual persisted-preference problems. `data-theme` on `<html>` is the
  state, CSS is the only reader, and the click handler reads the current theme
  back off the DOM. A `useState` seeded from `localStorage` would render light
  on the server and dark in the browser and trip a hydration mismatch; seeding
  it in an effect would paint the wrong icon first, and
  `react-hooks/set-state-in-effect` rejects that shape anyway. Any later
  preference that only CSS consumes can go the same way.
- **The preference is restored by an inline script in `<head>`**, built as a
  string in [`src/lib/theme.ts`](../src/lib/theme.ts) and injected in
  `app/layout.tsx`, which is why `<html>` carries `suppressHydrationWarning`.
  It has to run during HTML parsing: `useEffect` runs after paint and
  `useLayoutEffect` after React has loaded, and either one is a visible flash of
  light on a dark-preferring screen. Next documents the pattern in
  `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.
  Only `"dark"` is ever stored — light is the absence of the key and of the
  attribute, so the default has one spelling.
- **The toggle's icon is swapped in CSS, not in React**, by the only two rules
  outside the token block that read `data-theme`. Both glyphs are in the DOM and
  the attribute displays one, because the server cannot know which theme the
  browser is about to restore. `display: none` also drops the hidden branch out
  of the accessibility tree, which is what lets each branch carry its own
  `sr-only` label and gives the button a name that is always accurate without
  any JavaScript keeping the two in step.
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
Every route under `(app)` should appear as `ƒ` (dynamic) in the route summary,
because the shell layout reads the session. `/` is `○` (static) and should stay
that way, since the landing page reads no database. That is a live constraint,
not an observation: it is why the signed-in bounce off `/` sits in the proxy
rather than in the page, where an `auth()` call would flip it to `ƒ`.

`rm -rf .next` after adding, renaming or moving a route. Next writes typed-route
definitions into `.next/types`, and a stale copy makes `tsc --noEmit` fail — either
citing files that no longer exist, or rejecting `PageProps<'/new/[route]'>` as not
satisfying `AppRoutes` for a route that plainly does exist.
