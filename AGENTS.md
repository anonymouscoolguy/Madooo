<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Madooo

A match-diary app for football fans. After a match, a user tags players as
**MVP**, **STANDOUT** or **FLOP** and can attach a note to any player. Later they
can open a player's profile, or their own diary, and read those judgements back
as dated, diary-like entries.

Scope: the Premier League, the Primeira Liga and La Liga, other top leagues
afterwards.
Diaries are
**private** — single-user, no sharing, no public profiles, no moderation.

Product rules settled so far:

- **Any player in the matchday squad can be judged, including unused
  substitutes.** A diary is a private judgement, so it needs no justification
  in minutes played.
- **MVP is exclusive within a match; STANDOUT and FLOP are not.** A match has at
  most one MVP across *both* squads — it is a verdict on the match, not on a
  club. Awarding it to a second player takes it off the first, who is left with
  no judgement at all, or with their note and no tag if they have one. Any
  number of players can be a standout or a flop.
- **Logos and player photos are stored but never displayed.** `League.logo`,
  `Team.logo` and `Player.photo` keep API-Football's `media.api-sports.io` URLs
  so the option stays open, but nothing renders them. Storing a URL is inert;
  rendering club crests is a trademark question we have not cleared. A
  competition's **national flag is not its logo** — it is drawn from
  `League.country` out of files we vendor, carries no trademark question, and is
  governed by `docs/design/foundations.md`. `League.logo` still renders nowhere.

## Working with the author

The author is fluent in Python and reads other languages comfortably, but is not
deep in the JS/TS ecosystem.

- Prefer explaining *why* a project convention exists over just naming it.

## Non-negotiable constraints

1. **The season and the leagues are configuration, never literals.** `SEASON`
   and `LEAGUES` come from the environment. The season ran against an older one
   while API-Football's free tier exposed only seasons roughly two years past; on
   the paid tier it runs against the live one, and that switch cost one variable
   and no code. The second league then cost one variable and one parameter, and
   the third cost the variable alone. All three are the whole point — a
   hardcoded year or league id anywhere would have made any of them a refactor.
   The next season and the fourth league go the same way.

   **`LEAGUES` is read by the sync alone.** Every page discovers its leagues from
   our own `League` table, so nothing under `src/app/` may read it; a page that
   did would have two sources for which leagues exist.
2. **Never call API-Football on page load.** A scheduled sync job writes into our
   own Postgres; the app only ever reads our own tables. The request budget this
   once protected is no longer scarce, but the rule is not really about quota: a
   page that reaches a third party waits on it, fails with it, and is rate-limited
   by its own traffic.
3. **One translation boundary.** The sync job is the only code that sees
   API-Football's JSON shape. It maps their payloads onto our schema. Everything
   else reads our schema, so a provider change touches one place.
4. **Every API-Football response must have its `errors` field checked.** The API
   reports refusals inside HTTP 200 bodies, so status-code-only error handling
   silently turns a refusal into "no results".

Verified facts about the data source, including the real season entitlement, the
rate-limit headers and the per-endpoint request costs, are in
[`docs/api-football-findings.md`](docs/api-football-findings.md). The app runs on
the **Pro** tier with `SEASON=2026` and `LEAGUES=39,94,140`. Entitlement is per
league as well as per season, so check a new id with
`python3 scripts/verify_api.py --league <id>` before adding it.

**Start here:** [`docs/roadmap.md`](docs/roadmap.md) records what is built, what
is next, and which decisions are still open. Read it before proposing work, and
update it when something lands.

**Before writing code:** [`docs/architecture.md`](docs/architecture.md) records
how the system works, by subsystem — database, sync, auth and routing, design
tokens, the app shell, build and deploy. Read the section you are about to touch
first. It exists so the roadmap can stay a record of progress rather than
accumulating everything ever learned; keep facts on the correct side of that
line.

**Anything that renders:** [`docs/design/`](docs/design/) is the design source of
truth — `foundations.md` holds the tokens (colour, type, spacing, elevation,
motion, states, icons) and the rules about when each applies, alongside the
reference images and screenshots of the intended screens. Read it before writing
markup or CSS, not after. Its own first rule is the one most easily broken by
accident: **never hard-code a hex or a raw px value in product code — always a
semantic token.**

## Stack

Decided:

- Next 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind 4
- Postgres on **Neon**, accessed through **Prisma**
- Auth via **Clerk** — managed rather than hand-rolled, because this holds real
  users' accounts and hand-rolled session handling is where beginners ship
  security holes
- Data source: API-Football, using `/fixtures`, `/fixtures/lineups` and
  `/fixtures/players`
- Hosting on **Vercel**

## Conventions

- **Commit messages carry no `Co-Authored-By` trailer.**
- Commit at every working state; each commit should run.
- Build in vertical slices — one thin feature end to end, verified in the
  browser, then the next. Do not build whole layers speculatively.
- Use plan mode for anything non-trivial: agree the approach before writing code.
- Secrets live in `.env.local`, which is gitignored. Never echo their values.
- **A doc correction is never local.** When a claim in one document turns out to
  be wrong, grep the other docs — `AGENTS.md`, `docs/*.md`, `docs/design/`,
  `.claude/skills/` — for the same claim and fix it everywhere, then report
  every file touched. Docs drift, and a fix applied in one place leaves the
  project contradicting itself.

## Known noise

`npm audit` reports high-severity issues in `postcss` and `sharp`. Both are
transitive dependencies of Next itself, and npm's suggested fix downgrades Next
to version 9. Do not run `npm audit fix --force`. Re-evaluate before launch.
`sharp` matters less than it looks: nothing renders remote images, so Next's
image optimiser never proxies `media.api-sports.io`.
