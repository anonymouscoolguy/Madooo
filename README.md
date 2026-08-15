# Madooo

A match diary for football fans. After a match you tag the players who left an
impression — **MVP**, **STANDOUT** or **FLOP** — and write a note against anyone
worth remembering. Later you read it back: as a player's own history, as a
club's, or as a diary of the season in the order you wrote it.

Diaries are **private**. Single user, no sharing, no public profiles. The app is
free to use and the code is here to read, fork or self-host.

Live at [madooo.app](https://madooo.app). Premier League, Primeira Liga and La
Liga.

## Stack

Next 16 (App Router, Turbopack) and React 19 in TypeScript, Tailwind 4, Prisma
against Postgres on Neon, Clerk for auth, hosted on Vercel. Fixtures, lineups
and squads come from [API-Football](https://www.api-football.com), pulled by a
sync job into our own database — no page ever calls the provider.

## Running your own copy

You need Node 24, a Postgres database (Neon or otherwise), a Clerk application
and an API-Football key. **The free tier only serves seasons roughly two years
back**, so it is enough to run the app and see it work, but not to follow a
season as it happens — set `SEASON` to a season your key can actually fetch.
Madooo itself runs on the Pro tier against the current season.

```sh
npm install
cp .env.example .env.local     # then fill it in — it documents every variable
npm run db:migrate             # create the schema
npm run db:seed-teams          # club codes and colours the provider does not publish
npm run sync -- --round 1      # pull a matchday's fixtures, lineups and players
npm run dev
```

`.env.local` is gitignored and is the only place secrets belong.

`npm run sync -- --due` is the other way in: it refreshes every configured
league's calendar and then reads whatever finished matches it has not read yet,
so it needs no matchday. Add `--dry-run` to see what it would fetch without
spending a request.

Other scripts: `npm test` runs Vitest over the sync mapper and the pages' pure
helpers, `npm run db:check` proves the database layer end to end, `npm run
icons` refetches the Material Symbols subset from the vocabulary in
`src/components/icon-names.ts`.

## Documentation

The project documents itself as it goes, and these are worth reading before
changing anything:

- [`AGENTS.md`](AGENTS.md) — the product rules and the four non-negotiables.
- [`docs/roadmap.md`](docs/roadmap.md) — what is built, what is next, what is
  still undecided.
- [`docs/architecture.md`](docs/architecture.md) — how each subsystem works, and
  the things that were surprising enough to write down.
- [`docs/design/foundations.md`](docs/design/foundations.md) — the design tokens
  and the rules about when each applies.
- [`docs/api-football-findings.md`](docs/api-football-findings.md) — what the
  provider actually does, as opposed to what its documentation says.

## Licence

[MIT](LICENSE).
