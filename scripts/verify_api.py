"""Phase 0: prove API-Football gives us what Madooo needs, before we build on it.

Answers three questions:
  1. What does our key actually entitle us to (plan, daily quota)?
  2. Which Premier League seasons can we reach, and which have lineup coverage?
  3. What is the newest season we can fetch, and does a real lineup come back?

Note that (2) and (3) are different questions: coverage says what data exists,
entitlement says what this key may ask for, and the newest fetchable season is
often one that has not kicked off and so has neither lineups nor coverage yet.

Raw responses are dumped to scratch/ so we can design the schema against the
actual payload shape rather than guessing.

Usage:  python3 scripts/verify_api.py
"""

import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://v3.football.api-sports.io"
PREMIER_LEAGUE_ID = 39
SCRATCH = Path(__file__).resolve().parent.parent / "scratch"

# python.org builds on macOS ship without wiring the trust store into OpenSSL,
# so fall back to certifi's CA bundle rather than requiring a system fix.
try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()


class ApiError(Exception):
    """An error reported by API-Football in an otherwise successful response."""


def load_key() -> str:
    """Read API_FOOTBALL_KEY from .env.local without needing python-dotenv."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        sys.exit(f"Missing {env_path}. Add API_FOOTBALL_KEY=... to it.")

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == "API_FOOTBALL_KEY":
            return value.strip().strip("\"'")

    sys.exit("API_FOOTBALL_KEY not found in .env.local")


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


def dump(name: str, body: dict) -> None:
    SCRATCH.mkdir(exist_ok=True)
    path = SCRATCH / f"{name}.json"
    path.write_text(json.dumps(body, indent=2))
    print(f"  wrote {path.relative_to(Path.cwd())} ({path.stat().st_size:,} bytes)")


def main() -> None:
    key = load_key()

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

    print("\n[2] Premier League seasons available to this key")
    leagues = api_get(key, "leagues", id=PREMIER_LEAGUE_ID)
    dump("leagues_premier_league", leagues)

    entries = leagues.get("response", [])
    if not entries:
        sys.exit("No league data returned — cannot continue.")

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
        sys.exit("\nNo season exposes lineup coverage. This is a blocker — stop and rethink.")

    print("\n      NOTE: coverage flags describe what data exists, not what this")
    print("      plan may fetch. Probing downwards to find the real entitlement.")

    print("\n[3] Newest fetchable season")
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
            fixtures = api_get(key, "fixtures", league=PREMIER_LEAGUE_ID, season=candidate)
        except ApiError as exc:
            print(f"      {candidate}: refused -> {exc}")
            continue
        season = candidate
        print(f"      {candidate}: OK")
        break

    if season is None:
        sys.exit("No season is fetchable on this plan — stop and rethink.")

    dump(f"fixtures_{season}", fixtures)

    played = finished(fixtures)
    print(f"      {len(played)} finished matches of {len(fixtures.get('response', []))} total")

    # The newest season is the one to run against, but it may not have kicked
    # off, and the payload-shape checks below need a match that has been played.
    # Drop to the newest season that has one; the shape is not season-specific.
    sample_season = season
    if not played:
        print(f"      {season} has not started — falling back for the shape checks.")
        for candidate in (year for year in listed if year < season):
            try:
                older = api_get(key, "fixtures", league=PREMIER_LEAGUE_ID, season=candidate)
            except ApiError as exc:
                print(f"      {candidate}: refused -> {exc}")
                continue
            played = finished(older)
            if played:
                sample_season = candidate
                dump(f"fixtures_{candidate}", older)
                print(f"      sampling {candidate} instead ({len(played)} finished)")
                break

    if not played:
        sys.exit("No finished fixtures in any fetchable season — cannot test lineups.")

    sample = played[0]
    fixture_id = sample["fixture"]["id"]
    home = sample["teams"]["home"]["name"]
    away = sample["teams"]["away"]["name"]
    print(f"      sample: {home} vs {away} (fixture {fixture_id})")

    print(f"\n[4] Lineup for fixture {fixture_id}")
    lineups = api_get(key, "fixtures/lineups", fixture=fixture_id)
    dump(f"lineup_{fixture_id}", lineups)

    for team in lineups.get("response", []):
        starters = team.get("startXI", [])
        subs = team.get("substitutes", [])
        print(f"      {team['team']['name']}: {len(starters)} starters, {len(subs)} subs")
        if starters:
            player = starters[0]["player"]
            print(f"        first player object -> {json.dumps(player)}")

    print(f"\n[5] Player match stats for fixture {fixture_id}")
    stats = api_get(key, "fixtures/players", fixture=fixture_id)
    dump(f"players_{fixture_id}", stats)

    for team in stats.get("response", []):
        players = team.get("players", [])
        appeared = [
            p for p in players
            if (p["statistics"][0].get("games", {}).get("minutes") or 0) > 0
        ]
        print(f"      {team['team']['name']}: {len(players)} listed, {len(appeared)} played")

    print("\nDone. Inspect scratch/ for the full payloads.")
    print(f"Set SEASON={season} — the newest season this key can fetch.")
    if sample_season != season:
        print(f"The shape checks above ran against {sample_season}; {season} has no played matches yet.")


if __name__ == "__main__":
    main()
