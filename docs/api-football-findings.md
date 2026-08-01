# API-Football: what we verified before building

**Date:** 2026-08-01 · **Script:** [`scripts/verify_api.py`](../scripts/verify_api.py) · **Raw payloads:** `scratch/` (gitignored)

Madooo cannot exist without knowing which matches happened and who played in
them. That makes API-Football a single point of failure, so we probed it before
writing any application code. This document records what the API actually does,
as opposed to what its documentation and its own metadata imply.

Re-run with `python3 scripts/verify_api.py`. It costs about 5 requests.

---

## Account

| | |
|---|---|
| Plan | Free |
| Quota | 100 requests/day |
| Subscription ends | 2027-08-01 |
| Base URL | `https://v3.football.api-sports.io` |
| Auth header | `x-apisports-key` |

There is no near-term expiry pressure. The constraint is the daily request
count, not the calendar.

## The main trap: coverage flags are not entitlements

`GET /leagues?id=39` returns a `seasons` array with per-season `coverage` flags.
For the Premier League it advertises **2010 through 2025 all with
`coverage.fixtures.lineups = true`**. (2026 is flagged false, correctly — that
season had not kicked off as of this writing.)

Those flags are **not** a statement about what our key may fetch. Requesting
fixtures for 2025 returns HTTP 200 with an error in the body:

```json
{"errors": {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}}
```

**Coverage describes what data exists. Entitlement is a separate thing, only
discoverable by asking.** Anyone reading `/leagues` alone would reasonably
conclude 2025 was available and build against it.

Two consequences, both already reflected in the script:

1. Entitlement is found by **probing seasons downwards** until one succeeds,
   never by trusting the flags.
2. **API-Football reports errors inside HTTP 200 responses.** A client that only
   checks status codes will treat a refusal as success and parse an empty
   `response` array as "no fixtures this season." Every call must check the
   `errors` field. This applies to the real sync job too, not just this script.

### Seasons actually fetchable

**2022, 2023 and 2024.** Development uses **`SEASON=2024`** — the 2024-25 season,
the newest the free plan allows.

Production needs the current season and therefore a paid plan. This is the
switch that constraint #1 in `AGENTS.md` exists to protect: the season must
never appear as a literal anywhere in the codebase.

> **Tentative observation:** the refused 2025 request did not appear to
> decrement `x-ratelimit-requests-remaining`, which would make probing
> effectively free. This rests on a single data point and should not be relied
> on when sizing a backfill.

---

## Endpoints, verified

### `GET /fixtures?league=39&season=2024` — one call, whole season

Returns **all 380 fixtures in a single response** (633 KB). Not paginated.

- 38 rounds, labelled `"Regular Season - 1"` … `"Regular Season - 38"`
- 20 distinct teams
- 2024-08-16 → 2025-05-25
- All 380 have `status.short = "FT"` — the season is closed, so this data is
  immutable. Re-syncing yields byte-identical results, which is exactly what we
  want from a development fixture set.

Each entry:

```json
{
  "fixture": {
    "id": 1208021,
    "referee": "R. Jones",
    "date": "2024-08-16T19:00:00+00:00",
    "timestamp": 1723834800,
    "venue": { "id": 556, "name": "Old Trafford", "city": "Manchester" },
    "status": { "long": "Match Finished", "short": "FT", "elapsed": 90 }
  },
  "league": { "id": 39, "season": 2024, "round": "Regular Season - 1" },
  "teams":  { "home": { "id": 33, ... }, "away": { ... } },
  "goals":  { "home": 1, "away": 0 },
  "score":  { "halftime": {...}, "fulltime": {...},
              "extratime": {...}, "penalty": {...} }
}
```

Dates are ISO 8601 with explicit UTC offset, plus a Unix timestamp. No timezone
guessing required.

### `GET /fixtures/lineups?fixture={id}` — one call, both teams

9 KB per fixture. Returns an array of two entries, one per team:

```json
{
  "team": { "id": 33, "name": "Manchester United", "logo": "...",
            "colors": { "player": {...}, "goalkeeper": {...} } },
  "formation": "4-2-3-1",
  "coach": { "id": 1993, "name": "E. ten Hag", "photo": "..." },
  "startXI": [ { "player": { "id": 526, "name": "A. Onana",
                             "number": 24, "pos": "G", "grid": "1:1" } } ],
  "substitutes": [ { "player": { "id": 284324, "name": "A. Garnacho",
                                 "number": 17, "pos": "F", "grid": null } } ]
}
```

Confirmed: 11 starters and 9 substitutes per team.

Useful details:

- **`grid` is `"row:column"`** for starters and `null` for substitutes. A
  formation layout, handed to us. This makes a tappable pitch view — a natural
  interface for post-match tagging — cheap to build.
- **`pos`** is `G` / `D` / `M` / `F`.
- **Team kit colours** are included, so player chips can look correct with no
  design effort.
- **Coach identity** comes free with the lineup, should we ever want it.

### `GET /fixtures/players?fixture={id}` — identity and participation

69 KB per fixture, two entries (one per team), 20 players each — the matchday
squad, which is exactly the set a user may judge.

```json
{
  "player": { "id": 526, "name": "André Onana",
              "photo": "https://media.api-sports.io/football/players/526.png" },
  "statistics": [{
    "games": { "minutes": 90, "number": 24, "position": "G",
               "rating": "7.2", "captain": false, "substitute": false },
    "goals": { "total": null, "conceded": 0, "assists": 0, "saves": 2 },
    "cards": { "yellow": 0, "red": 0 },
    "shots": {...}, "passes": {...}, "tackles": {...}, "duels": {...},
    "dribbles": {...}, "fouls": {...}, "penalty": {...}, "offsides": null
  }]
}
```

In the sample fixture, 16 of 20 players per side had minutes above zero.

**This endpoint supersedes `/players/squads`.** It returns the *full* player name
and photo, unlike the lineup endpoint's abbreviated `"A. Onana"`. Since only
players in a matchday squad are judgeable, the squads endpoint has nothing to
add — 20 requests per season and an entire sync path avoided.

Three things to handle carefully:

- **`rating` is a string** (`"7.2"`), not a number. Parse it explicitly; do not
  let it reach the database as text.
- **`penalty.commited` is misspelled** in the API. Map it to a correctly spelled
  column at the sync boundary and never repeat the typo inland.
- **Most statistics are `null`** for most players. Every stat column must be
  nullable, and the UI must treat absent and zero as different things.

---

## Division of labour between endpoints

| Need | Source |
|---|---|
| Full name, photo, minutes, stats | `/fixtures/players` |
| Formation, pitch grid, coach, kit colours | `/fixtures/lineups` |
| Kickoff, venue, referee, score, status | `/fixtures` |

Both per-fixture endpoints are needed: only `/fixtures/lineups` carries `grid`
and formation, and only `/fixtures/players` carries full names and minutes.

## Other notes

**Lineups do not say who actually played.** `substitutes` lists the bench, not
who came on; `/fixtures/players` answers this via `games.minutes`.

This blocks nothing regardless: users may rate unused substitutes, since a diary
is a private judgement needing no justification in minutes. Minutes are context,
not a gate.

**Stable integer IDs on every entity** — fixture `1208021`, team `33`, player
`526`, venue `556`, coach `1993`. These become `apiFootballId` unique columns
alongside our own primary keys, confined to the sync boundary.

---

## Request budget

| Operation | Cost |
|---|---|
| All fixtures for a season | 1 |
| Lineups | 1 per fixture |
| Player match stats | 1 per fixture |

**Full-season backfill:** 761 requests — 8 days at the free limit. This is the
only place the free tier genuinely pinches.

**Development therefore syncs one or two gameweeks, not a season.** Twenty
matches is ample to build against and costs 10–20 requests.

**Steady state in production** is negligible: ~10 fixtures per gameweek, one
daily fixture poll for reschedules and results. Well inside 100/day even before
a paid plan raises the ceiling. Adding the other top leagues multiplies the
backfill, not the weekly load.

The reason this stays cheap is constraint #2 — sync into our own Postgres, never
call the API on page load. Querying live would put a hard user-traffic ceiling
on the app; syncing makes request cost a function of how much football is
played, which is fixed and small.

---

## Still open

- Timing of the paid-tier purchase. Buy one to two weeks before launch, not on
  launch day — response shapes and rate-limit headers may differ, and that is
  better discovered while nothing depends on it.
