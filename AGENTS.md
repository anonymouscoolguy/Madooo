<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Madooo

A match-diary app for football fans. After a match, a user tags players as
**MVP**, **STANDOUT** or **FLOP** and can attach a note to any player. Later they
can open a player's profile, or their own diary, and read those judgements back
as dated, diary-like entries.

Scope: Premier League only to start, other top leagues afterwards. Diaries are
**private** — single-user, no sharing, no public profiles, no moderation.

Product rules settled so far:

- **Any player in the matchday squad can be judged, including unused
  substitutes.** A diary is a private judgement, so it needs no justification
  in minutes played.
- **Logos and player photos are stored but never displayed.** `League.logo`,
  `Team.logo` and `Player.photo` keep API-Football's `media.api-sports.io` URLs
  so the option stays open, but nothing renders them. Storing a URL is inert;
  rendering club crests is a trademark question we have not cleared.

## Working with the author

The author is fluent in Python and reads other languages comfortably, but is not
deep in the JS/TS ecosystem. Working on this project is partly a way to learn it.

- **Explain TypeScript- and Next-specific concepts the first time they appear** —
  server vs client components, file conventions, the type system, build tooling,
  module resolution. Two or three sentences in chat, not buried in code comments.
- **Do not explain general programming logic.** Assume Python fluency and use it
  as the reference point for what is genuinely different.
- Prefer explaining *why* a convention exists over just naming it.

## Non-negotiable constraints

1. **The season is configuration, never a literal.** `SEASON` comes from the
   environment. Development runs against an older season because the
   API-Football free tier only exposes seasons roughly two years in the past;
   production will run against the current one on a paid tier. A hardcoded year
   anywhere turns that switch into a refactor.
2. **Never call API-Football on page load.** A scheduled sync job writes into our
   own Postgres; the app only ever reads our own tables. This is what keeps us
   inside the free tier's request budget and keeps pages fast.
3. **One translation boundary.** The sync job is the only code that sees
   API-Football's JSON shape. It maps their payloads onto our schema. Everything
   else reads our schema, so a provider change touches one place.
4. **Every API-Football response must have its `errors` field checked.** The API
   reports refusals inside HTTP 200 bodies, so status-code-only error handling
   silently turns a refusal into "no results".

Verified facts about the data source, including the free tier's real season
entitlement and the per-endpoint request costs, are in
[`docs/api-football-findings.md`](docs/api-football-findings.md). Development
runs on `SEASON=2024`.

**Start here:** [`docs/roadmap.md`](docs/roadmap.md) records what is built, what
is next, and which decisions are still open. Read it before proposing work, and
update it when something lands.

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

## Known noise

`npm audit` reports high-severity issues in `postcss` and `sharp`. Both are
transitive dependencies of Next itself, and npm's suggested fix downgrades Next
to version 9. Do not run `npm audit fix --force`. Re-evaluate before launch.
`sharp` matters less than it looks: nothing renders remote images, so Next's
image optimiser never proxies `media.api-sports.io`.
