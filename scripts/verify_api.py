"""Phase 0: prove API-Football gives us what Madooo needs, before we build on it.

Answers three questions, per league:
  1. What does our key actually entitle us to (plan, daily quota)?
  2. Which seasons of this league can we reach, and which have lineup coverage?
  3. What is the newest season we can fetch, and does a real lineup come back?

Note that (2) and (3) are different questions: coverage says what data exists,
entitlement says what this key may ask for, and the newest fetchable season is
often one that has not kicked off and so has neither lineups nor coverage yet.

**Entitlement is per league as well as per season.** A key that can read the
Premier League is not thereby proved to read anything else, and the only way to
find out is to ask — which is what the loop over leagues is for.

Raw responses are dumped to scratch/ so we can design the schema against the
actual payload shape rather than guessing. Every dump is qualified by league,
because leagues share a season number and an unqualified name would have one
silently overwrite another.

`--fixture` answers a different question, and it is the reason this script grew
a second mode: **what do the two per-fixture endpoints return before a match has
kicked off?** The sync fetches a lineup when it is announced rather than only
after full time, and that policy rests on when the provider actually publishes
one — which no documentation states and only a match day can answer. Every dump
is stamped with the minutes to kickoff, so a series of runs across one afternoon
reads as a timeline rather than as four unrelated files.

Usage:  python3 scripts/verify_api.py            every league in LEAGUES
        python3 scripts/verify_api.py --league 94   one league, whatever LEAGUES says
        python3 scripts/verify_api.py --fixture 1390824   one fixture, right now
"""

import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = "https://v3.football.api-sports.io"

# Premier League. Only a fallback for a checkout whose .env.local predates
# LEAGUES — the configured list is the real source, the same way SEASON is.
DEFAULT_LEAGUE_ID = 39

SCRATCH = Path(__file__).resolve().parent.parent / "scratch"
ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"

# python.org builds on macOS ship without wiring the trust store into OpenSSL,
# so fall back to certifi's CA bundle rather than requiring a system fix.
try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()


class ApiError(Exception):
    """An error reported by API-Football in an otherwise successful response."""


def load_env(name: str) -> str | None:
    """Read one variable out of .env.local without needing python-dotenv."""
    if not ENV_PATH.exists():
        sys.exit(f"Missing {ENV_PATH}. Add API_FOOTBALL_KEY=... to it.")

    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == name:
            return value.strip().strip("\"'")
    return None


def load_key() -> str:
    key = load_env("API_FOOTBALL_KEY")
    if key is None:
        sys.exit("API_FOOTBALL_KEY not found in .env.local")
    return key


def parse_leagues(raw: str, source: str) -> list[int]:
    """Parse "39,94,140,135" into [39, 94, 140, 135]. Order is preserved."""
    ids: list[int] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        if not token.isdigit() or int(token) < 1:
            sys.exit(f"{source}: not a league id: {token!r}")
        if int(token) not in ids:
            ids.append(int(token))
    if not ids:
        sys.exit(f"{source} is empty — nothing to probe.")
    return ids


def target_fixture(argv: list[str]) -> int | None:
    """The fixture id for --fixture, or None for the ordinary league probe."""
    for index, arg in enumerate(argv):
        if arg == "--fixture":
            if index + 1 >= len(argv):
                sys.exit("--fixture takes a fixture id, e.g. --fixture 1390824")
            value = argv[index + 1]
            if not value.isdigit() or int(value) < 1:
                sys.exit(f"--fixture takes a fixture id, got {value!r}")
            return int(value)
    return None


def target_leagues(argv: list[str]) -> list[int]:
    """--league wins over LEAGUES, which wins over the Premier League."""
    for index, arg in enumerate(argv):
        if arg == "--league":
            if index + 1 >= len(argv):
                sys.exit("--league takes a league id, e.g. --league 94")
            return parse_leagues(argv[index + 1], "--league")
        sys.exit(f"Unrecognised argument: {arg}")

    configured = load_env("LEAGUES")
    if configured is None:
        print(f"  note  LEAGUES not set in .env.local; probing {DEFAULT_LEAGUE_ID} only")
        return [DEFAULT_LEAGUE_ID]
    return parse_leagues(configured, "LEAGUES")


def api_get(key: str, path: str, **params) -> dict:
    """GET a v3 endpoint. Returns the parsed body; exits loudly on API errors."""
    url = f"{BASE_URL}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    request = urllib.request.Request(url, headers={"x-apisports-key": key})
    try:
        with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
            body = json.loads(response.read())
            remaining = response.headers.get("x-ratelimit-requests-remaining")
            limit = response.headers.get("x-ratelimit-requests-limit")
    except urllib.error.HTTPError as exc:
        sys.exit(f"HTTP {exc.code} on {path}: {exc.read()[:400].decode(errors='replace')}")
    except urllib.error.URLError as exc:
        sys.exit(f"Network error on {path}: {exc.reason}")

    # API-Football reports its own errors in a 200 body, so check explicitly.
    errors = body.get("errors")
    if errors:
        raise ApiError(f"{errors}")

    quota = f"{remaining}/{limit} daily requests left" if remaining else "quota unknown"
    print(f"  GET /{path} -> {body.get('results', 0)} results ({quota})")
    return body


def finished(body: dict) -> list:
    """The fixtures in a /fixtures response that have been played."""
    return [
        f for f in body.get("response", [])
        if f.get("fixture", {}).get("status", {}).get("short") == "FT"
    ]


def rounds_of(body: dict) -> list[str]:
    """The distinct round labels in a season's fixture list, in first-seen order."""
    labels: list[str] = []
    for fixture in body.get("response", []):
        label = fixture.get("league", {}).get("round")
        if label and label not in labels:
            labels.append(label)
    return labels


def dump(name: str, body: dict) -> None:
    SCRATCH.mkdir(exist_ok=True)
    path = SCRATCH / f"{name}.json"
    path.write_text(json.dumps(body, indent=2))
    print(f"  wrote {path.relative_to(Path.cwd())} ({path.stat().st_size:,} bytes)")


def probe_league(key: str, league_id: int) -> int | None:
    """Steps 2 to 5 for one league. Returns the newest fetchable season, or None."""
    print(f"\n[2] League {league_id}: seasons available to this key")
    try:
        leagues = api_get(key, "leagues", id=league_id)
    except ApiError as exc:
        print(f"      refused -> {exc}")
        print(f"      league {league_id} is NOT entitled on this key.")
        return None
    dump(f"leagues_{league_id}", leagues)

    entries = leagues.get("response", [])
    if not entries:
        print(f"      no league data for {league_id} — is the id right?")
        return None

    identity = entries[0].get("league", {})
    country = entries[0].get("country", {})
    print(f"      name      : {identity.get('name')}")
    print(f"      country   : {country.get('name')}")
    print(f"      type      : {identity.get('type')}")

    seasons = entries[0].get("seasons", [])
    usable = []
    for season in seasons:
        coverage = season.get("coverage", {})
        fixtures_coverage = coverage.get("fixtures", {})
        has_lineups = bool(fixtures_coverage.get("lineups"))
        if has_lineups:
            usable.append(season["year"])
        print(
            f"      {season['year']}  lineups={str(has_lineups):5}  "
            f"events={str(bool(fixtures_coverage.get('events'))):5}  "
            f"players={str(bool(coverage.get('players'))):5}"
        )

    if not usable:
        print("      no season exposes lineup coverage for this league.")

    print("\n      NOTE: coverage flags describe what data exists, not what this")
    print("      plan may fetch. Probing downwards to find the real entitlement.")

    print(f"\n[3] League {league_id}: newest fetchable season")
    # Probe *every* listed season, not only those flagged for lineup coverage.
    # A season that has not kicked off has no lineups and so no coverage, but
    # its fixture list is published months ahead — and that is precisely the
    # season the app wants to run against. Filtering on coverage here would hide
    # the live season every summer, which is the same trap as trusting coverage
    # for entitlement, sprung from the other side.
    listed = sorted((s["year"] for s in seasons), reverse=True)
    season, fixtures = None, None
    for candidate in listed[:8]:
        try:
            fixtures = api_get(key, "fixtures", league=league_id, season=candidate)
        except ApiError as exc:
            print(f"      {candidate}: refused -> {exc}")
            continue
        season = candidate
        print(f"      {candidate}: OK")
        break

    if season is None:
        print(f"      no season of league {league_id} is fetchable on this plan.")
        return None

    dump(f"fixtures_{league_id}_{season}", fixtures)

    total = len(fixtures.get("response", []))
    played = finished(fixtures)
    labels = rounds_of(fixtures)
    print(f"      {len(played)} finished matches of {total} total")
    # The round vocabulary is not decoration: src/lib/rounds.ts reads a matchday
    # number off the end of these labels, and the sync's --round builds one. A
    # league that names its rounds differently changes both.
    print(f"      {len(labels)} distinct rounds, e.g. {labels[:2]} … {labels[-1:]}")

    # The newest season is the one to run against, but it may not have kicked
    # off, and the payload-shape checks below need a match that has been played.
    # Drop to the newest season that has one; the shape is not season-specific.
    sample_season = season
    if not played:
        print(f"      {season} has not started — falling back for the shape checks.")
        for candidate in (year for year in listed if year < season):
            try:
                older = api_get(key, "fixtures", league=league_id, season=candidate)
            except ApiError as exc:
                print(f"      {candidate}: refused -> {exc}")
                continue
            played = finished(older)
            if played:
                sample_season = candidate
                dump(f"fixtures_{league_id}_{candidate}", older)
                print(f"      sampling {candidate} instead ({len(played)} finished)")
                break

    if not played:
        print(f"      no finished fixtures in any fetchable season of {league_id}.")
        return season

    sample = played[0]
    fixture_id = sample["fixture"]["id"]
    home = sample["teams"]["home"]["name"]
    away = sample["teams"]["away"]["name"]
    print(f"      sample: {home} vs {away} (fixture {fixture_id})")

    # Fixture ids are global, so these two dumps need no league qualifier.
    print(f"\n[4] League {league_id}: lineup for fixture {fixture_id}")
    lineups = api_get(key, "fixtures/lineups", fixture=fixture_id)
    dump(f"lineup_{fixture_id}", lineups)

    for team in lineups.get("response", []):
        starters = team.get("startXI", [])
        subs = team.get("substitutes", [])
        print(f"      {team['team']['name']}: {len(starters)} starters, {len(subs)} subs")
        if starters:
            player = starters[0]["player"]
            print(f"        first player object -> {json.dumps(player)}")

    print(f"\n[5] League {league_id}: player match stats for fixture {fixture_id}")
    stats = api_get(key, "fixtures/players", fixture=fixture_id)
    dump(f"players_{fixture_id}", stats)

    for team in stats.get("response", []):
        players = team.get("players", [])
        appeared = [
            p for p in players
            if (p["statistics"][0].get("games", {}).get("minutes") or 0) > 0
        ]
        print(f"      {team['team']['name']}: {len(players)} listed, {len(appeared)} played")

    if sample_season != season:
        print(f"      shape checks ran against {sample_season}; {season} has no played matches yet.")

    return season


def minutes_to_kickoff(fixture: dict) -> int:
    """Signed minutes from now to kickoff: negative once the match has started."""
    kickoff = datetime.fromisoformat(fixture["fixture"]["date"])
    now = datetime.now(timezone.utc)
    return round((kickoff - now).total_seconds() / 60)


def probe_fixture(key: str, fixture_id: int) -> None:
    """What both per-fixture endpoints return for one fixture, right now.

    Costs three requests. The point is the *timing*, so every dump is stamped
    with the minutes to kickoff and the run prints where in the timeline it sat.
    """
    print(f"\n[1] Fixture {fixture_id}: where it is in its own timeline")
    calendar = api_get(key, "fixtures", id=fixture_id)
    entries = calendar.get("response", [])
    if not entries:
        sys.exit(f"Fixture {fixture_id} is not in any fixture list this key can read.")

    fixture = entries[0]
    teams = fixture.get("teams", {})
    status = fixture["fixture"]["status"]
    delta = minutes_to_kickoff(fixture)
    # Negative reads as "after kickoff", so the sign is the information and the
    # stamp sorts a series of probes in the order they were taken.
    stamp = f"t{delta:+d}"

    print(f"      {teams.get('home', {}).get('name')} v {teams.get('away', {}).get('name')}")
    print(f"      kickoff   : {fixture['fixture']['date']}")
    print(f"      now       : {delta:+d} minutes from kickoff")
    print(f"      status    : {status.get('short')} ({status.get('long')}), elapsed={status.get('elapsed')}")
    dump(f"prematch_fixture_{fixture_id}_{stamp}", calendar)

    print(f"\n[2] Fixture {fixture_id}: /fixtures/lineups at {stamp}")
    lineups = api_get(key, "fixtures/lineups", fixture=fixture_id)
    dump(f"prematch_lineup_{fixture_id}_{stamp}", lineups)

    published = lineups.get("response", [])
    if not published:
        print("      EMPTY — no lineup published yet at this point.")
    for team in published:
        starters = team.get("startXI", [])
        subs = team.get("substitutes", [])
        print(
            f"      {team['team']['name']}: {len(starters)} starters, {len(subs)} subs, "
            f"formation={team.get('formation')}"
        )
        if starters:
            print(f"        first player object -> {json.dumps(starters[0]['player'])}")

    print(f"\n[3] Fixture {fixture_id}: /fixtures/players at {stamp}")
    stats = api_get(key, "fixtures/players", fixture=fixture_id)
    dump(f"prematch_players_{fixture_id}_{stamp}", stats)

    listed = stats.get("response", [])
    if not listed:
        print("      EMPTY — nothing from the statistics endpoint at this point.")
    for team in listed:
        print(f"      {team['team']['name']}: {len(team.get('players', []))} listed")

    # The one line the whole probe exists for.
    print(
        f"\n  VERDICT at {delta:+d} min: "
        f"lineups={len(published)} team(s), players={len(listed)} team(s), status={status.get('short')}"
    )


def main() -> None:
    key = load_key()

    fixture_id = target_fixture(sys.argv[1:])
    if fixture_id is not None:
        probe_fixture(key, fixture_id)
        print("\nDone. Inspect scratch/ for the full payloads.")
        return

    leagues = target_leagues(sys.argv[1:])

    print("\n[1] Account status")
    status = api_get(key, "status")
    dump("status", status)
    account = status.get("response", {})
    subscription = account.get("subscription", {})
    requests_info = account.get("requests", {})
    print(f"      plan      : {subscription.get('plan')}")
    print(f"      active    : {subscription.get('active')}")
    print(f"      ends      : {subscription.get('end')}")
    print(f"      today     : {requests_info.get('current')}/{requests_info.get('limit_day')}")

    print(f"\nProbing {len(leagues)} league(s): {', '.join(str(id) for id in leagues)}")
    seasons = {league_id: probe_league(key, league_id) for league_id in leagues}

    print("\nDone. Inspect scratch/ for the full payloads.")
    refused = [str(id) for id, season in seasons.items() if season is None]
    if refused:
        print(f"NOT entitled, or unreachable: {', '.join(refused)}")

    reachable = {id: season for id, season in seasons.items() if season is not None}
    if not reachable:
        sys.exit("No league is fetchable on this plan — stop and rethink.")

    newest = set(reachable.values())
    if len(newest) == 1:
        print(f"Set SEASON={newest.pop()} — the newest season these keys can fetch.")
    else:
        # SEASON is one variable for every league, so leagues disagreeing about
        # their newest fetchable season is a configuration problem, not a detail.
        print("Leagues disagree on their newest fetchable season:")
        for league_id, season in reachable.items():
            print(f"      {league_id}: {season}")


if __name__ == "__main__":
    main()
