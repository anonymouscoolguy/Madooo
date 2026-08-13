# API-Football: what we verified before building

**Verified:** 2026-08-01 on the free tier, re-verified 2026-08-11 on Pro, leagues 94 and 140 added 2026-08-12 · **Script:** [`scripts/verify_api.py`](../scripts/verify_api.py) · **Raw payloads:** `scratch/` (gitignored)

Madooo cannot exist without knowing which matches happened and who played in
them. That makes API-Football a single point of failure, so we probed it before
writing any application code. This document records what the API actually does,
as opposed to what its documentation and its own metadata imply.

Re-run with `python3 scripts/verify_api.py`. It costs about 5 requests per league
in `LEAGUES`; `--league <id>` probes one, which is how a league is checked before
being added.

---

## Account

| | |
|---|---|
| Plan | **Pro** (was Free until 2026-08-11) |
| Quota | 7,500 requests/day **and 300 per minute** |
| Subscription ends | 2026-09-11 — **monthly**, unlike the free tier's year |
| Base URL | `https://v3.football.api-sports.io` |
| Auth header | `x-apisports-key` |

Bought direct from `dashboard.api-football.com`, which keeps the existing key.
**Not through RapidAPI**, which resells the same data behind a different host and
a different auth header and would make the client's two constants wrong.

**There are two limits, and both are in the response headers**, which is what
the client paces itself against:

| Header | Means |
|---|---|
| `x-ratelimit-limit` | requests allowed per **minute** (300 on Pro) |
| `x-ratelimit-remaining` | left in this minute |
| `x-ratelimit-requests-limit` | requests allowed per **day** (7,500 on Pro) |
| `x-ratelimit-requests-remaining` | left today |

The per-minute pair was recorded here as absent, on the evidence of the free
tier, where the limit announced itself only as an **HTTP 429** with
`{"errors": {"rateLimit": "..."}}` — discovered when the first full-round sync
died after two fixtures. On Pro both headers are present and populated. Whether
the free tier omits them or they were simply not looked for cannot now be
established, and does not matter: **the client reads the per-minute header and
derives its pacing from it**, falling back to the free tier's safe 6.5s when it
is missing. So the interval is no longer a fact about the plan written into the
code, and changing plan again needs no code change.

The daily counter is **not monotonic across consecutive calls** — observed going
77, 75, 78, 76 during a single run. Treat it as approximate, and do not build
anything that assumes it only ever decreases.

## The main trap: coverage flags are not entitlements

`GET /leagues?id=39` returns a `seasons` array with per-season `coverage` flags.
For the Premier League it advertises **2010 through 2025 all with
`coverage.fixtures.lineups = true`**, and 2026 flagged false.

**Coverage describes what data exists. Entitlement — what this key may ask for —
is a separate thing, only discoverable by asking.** The two come apart in both
directions, and each direction has cost us something:

**Coverage true, entitlement false.** On the free tier, requesting fixtures for
2025 returned HTTP 200 with an error in the body:

```json
{"errors": {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}}
```

Anyone reading `/leagues` alone would reasonably conclude 2025 was available and
build against it. Hence: **probe seasons downwards** until one succeeds, never
trust the flags. And hence the sharper rule — **API-Football reports errors
inside HTTP 200 responses**, so a client that only checks status codes reads a
refusal as "no fixtures this season". Every call must check `errors`. This is
constraint #4 in `AGENTS.md`, and it applies to the sync job, not just the probe.

**Coverage false, entitlement true.** The inverse, found on 2026-08-11. A season
that has not kicked off has no lineups, so its coverage flags are all false —
but its fixture list is published months ahead and fetches perfectly. **That is
the season the app most wants**, and `verify_api.py` could not see it, because it
probed only the seasons coverage had flagged. It now probes every listed season
and falls back to an older one when the newest has no played match to check the
payload shape against. Filtering on coverage would have hidden the live season
every summer.

**Entitlement is per league as well as per season.** The third face of the same
trap, and the one the document had not tested: every finding above was taken
against league 39 alone, which proves nothing about any other. Checked on
2026-08-12 by asking, because asking is the only way — `verify_api.py` now takes
`--league` and loops over `LEAGUES`.

### Seasons actually fetchable

**2010 through 2026** — everything `/leagues` lists. Pro removes the free tier's
2022–2024 window entirely.

The app runs on **`SEASON=2026`**, the 2026-27 season, which kicks off
**2026-08-21**. This is the switch constraint #1 in `AGENTS.md` exists to
protect, and it cost exactly one variable in two places.

### Leagues actually fetchable

| id | `league.name` | Clubs | Rounds | Fixtures | Round labels |
|---|---|---|---|---|---|
| 39 | Premier League | 20 | 38 | 380 | `Regular Season - N` |
| 94 | **Primeira Liga** | 18 | 34 | 306 | `Regular Season - N` |
| 140 | **La Liga** | 20 | 38 | 380 | `Regular Season - N` |

All three are entitled on Pro for every season 2010–2026. Coverage is flagged
true throughout for 39 and 94; league 140 has every flag **false for 2026** and
true for 2010–2025, and fetches 2026 perfectly anyway — the clearest single
instance of the coverage-is-not-entitlement rule in this document.

**The provider's name for a competition is not the one a person would say, in
either direction.** League 94 is "Primeira Liga", not Liga Portugal, which is how
it is usually named; league 140 is "La Liga", not Primera División, which is its
own formal name. Since `League.name` is stored from the payload, that string is
what every label and the URL slug are built from — so neither can be written down
from memory, and both were read out of the dumps.

**All three label rounds identically**, which is what lets
[`rounds.ts`](../src/lib/rounds.ts) parse them with no change; a cup competition
would not, and is the thing to re-check before adding one.

> **Tentative observation:** on the free tier, a refused request did not appear
> to decrement `x-ratelimit-requests-remaining`, which would have made probing
> effectively free. It rested on a single data point. It is no longer
> load-bearing — probing a handful of seasons against 7,500 a day needs no
> justification.

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

**A live season is the same call and the opposite condition.** `season=2026`,
fetched ten days before kickoff, returns the same 380 fixtures in the same shape
with **every one of them `status.short = "NS"`** and every score null. The
calendar is complete long before any of it is played, which is what makes a
match with no squad a permanent state rather than a transitional one. The
payload shape was re-confirmed unchanged against 2025 and 2026 on 2026-08-11.

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

**Full-season backfill:** 761 requests — one round costs 21, being one for the
fixture list plus two per fixture. On the free tier's 100/day that was eight
days, and it was the only place the tier genuinely pinched: development synced a
few gameweeks rather than a season. On Pro it is **a tenth of one day's quota**,
and pacing puts it at around three minutes of wall clock. The constraint that
shaped the CLI's round-at-a-time discipline is gone.

**Steady state** is negligible either way: ~10 fixtures per gameweek, one daily
fixture poll for reschedules and results. Adding a league multiplies the
backfill, not the weekly load — and at 7,500/day there is room for several. The
Primeira Liga measured it rather than predicted it: **613 requests** for its full
306-fixture season, 8% of a day, and its calendar alone is one request like any
other league's.

What still costs something is **wall clock, not quota.** At 300/minute the pacing
is a quarter-second per request, so a ten-fixture round takes about five seconds
and a full backfill about three minutes. That is well inside a serverless
function's timeout, which eases but does not settle the scheduling problem —
see the architecture note on it.

The reason this stays cheap is constraint #2 — sync into our own Postgres, never
call the API on page load. Querying live would put a hard user-traffic ceiling
on the app; syncing makes request cost a function of how much football is
played, which is fixed and small.

---

## Still open

- **The Pro subscription is monthly and ends 2026-09-11**, three weeks after the
  season starts. The free tier ran a year at a time, so this is a new kind of
  deadline: if it lapses, the app stops being able to reach the live season while
  the season is underway. Confirm whether it renews automatically.

The paid-tier purchase itself was the other item here and is done. It was
written as "buy one to two weeks before launch, not on launch day — response
shapes and rate-limit headers may differ, and that is better discovered while
nothing depends on it." That paid off exactly as intended: the shapes turned out
identical, but the rate-limit headers did differ, and the probe script could not
see the live season at all.
