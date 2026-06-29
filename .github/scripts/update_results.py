"""
update_results.py
Fetches World Cup 2026 knockout results from football-data.org
and updates data/results.json automatically.
"""

import json
import os
import time
import urllib.request
from pathlib import Path

API_KEY  = os.environ["FOOTBALL_API_KEY"]
BASE_URL = "https://api.football-data.org/v4"
RESULTS_PATH = Path("data/results.json")
MATCHES_PATH = Path("data/matches.json")

# ── Mapping: team name in our JSON → possible names in the API ──────────
TEAM_ALIASES = {
    "South Africa":         ["South Africa"],
    "Canada":               ["Canada"],
    "Brazil":               ["Brazil"],
    "Japan":                ["Japan"],
    "Germany":              ["Germany"],
    "Paraguay":             ["Paraguay"],
    "Netherlands":          ["Netherlands"],
    "Morocco":              ["Morocco"],
    "Ivory Coast":          ["Ivory Coast", "Côte d'Ivoire"],
    "Norway":               ["Norway"],
    "France":               ["France"],
    "Sweden":               ["Sweden"],
    "Mexico":               ["Mexico"],
    "Ecuador":              ["Ecuador"],
    "England":              ["England"],
    "DR Congo":             ["DR Congo", "Congo DR", "Democratic Republic of Congo"],
    "Belgium":              ["Belgium"],
    "Senegal":              ["Senegal"],
    "USA":                  ["USA", "United States"],
    "Bosnia & Herzegovina": ["Bosnia-Herzegovina", "Bosnia & Herzegovina", "Bosnia and Herzegovina"],
    "Spain":                ["Spain"],
    "Austria":              ["Austria"],
    "Portugal":             ["Portugal"],
    "Croatia":              ["Croatia"],
    "Switzerland":          ["Switzerland"],
    "Algeria":              ["Algeria"],
    "Australia":            ["Australia"],
    "Egypt":                ["Egypt"],
    "Argentina":            ["Argentina"],
    "Cape Verde":           ["Cape Verde"],
    "Colombia":             ["Colombia"],
    "Ghana":                ["Ghana"],
}

def fetch(path, retries=3):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": API_KEY})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                # Respect rate-limit headers
                remaining = r.headers.get("X-Requests-Available-Minute", "")
                if remaining and int(remaining) < 3:
                    time.sleep(12)
                return json.loads(r.read())
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(5)

def normalize(name):
    """Return canonical team name from our JSON, or None."""
    for our_name, aliases in TEAM_ALIASES.items():
        if name in aliases:
            return our_name
    return None

def build_lookup(api_matches):
    """
    Build {(home_canonical, away_canonical): api_match} lookup.
    Only knockout stage matches (ROUND_OF_32 onwards).
    """
    knockout_stages = {
        "ROUND_OF_32", "ROUND_OF_16",
        "QUARTER_FINALS", "SEMI_FINALS", "FINAL"
    }
    lookup = {}
    for m in api_matches:
        if m.get("stage") not in knockout_stages:
            continue
        h = normalize(m["homeTeam"]["name"])
        a = normalize(m["awayTeam"]["name"])
        if h and a:
            lookup[(h, a)] = m
    return lookup

def parse_result(api_match):
    """Extract home_score, away_score, penalties_winner from API match."""
    status = api_match.get("status", "")
    if status not in ("FINISHED",):
        return None  # not played yet

    score = api_match.get("score", {})
    ft    = score.get("fullTime", {})
    h_score = ft.get("home")
    a_score = ft.get("away")

    if h_score is None or a_score is None:
        return None

    pen_winner = None
    penalties  = score.get("penalties", {})
    if penalties.get("home") is not None:
        ph = penalties["home"]
        pa = penalties["away"]
        home_name = normalize(api_match["homeTeam"]["name"])
        away_name = normalize(api_match["awayTeam"]["name"])
        pen_winner = home_name if ph > pa else away_name

    return {
        "home_score":       h_score,
        "away_score":       a_score,
        "penalties_winner": pen_winner,
    }

def main():
    # Load our matches definition
    with open(MATCHES_PATH) as f:
        matches_def = json.load(f)

    # Load current results
    with open(RESULTS_PATH) as f:
        results = json.load(f)

    # Remove comment keys before processing
    clean_results = {k: v for k, v in results.items() if not k.startswith("_")}

    # Fetch from API
    print("Fetching WC 2026 matches from API...")
    try:
        data = fetch("/competitions/WC/matches?season=2026")
    except Exception as e:
        print(f"API fetch failed: {e}")
        return

    api_matches = data.get("matches", [])
    print(f"Got {len(api_matches)} matches from API")

    lookup = build_lookup(api_matches)
    print(f"Mapped {len(lookup)} knockout matches")

    # Walk our matches and update results
    updated = 0
    for round_key, round_data in matches_def["rounds"].items():
        for m in round_data["matches"]:
            match_id = m["id"]
            home = m.get("home")
            away = m.get("away")

            # Skip TBD matches (later rounds not yet determined)
            if not home or not away:
                continue

            api_m = lookup.get((home, away))
            if not api_m:
                # Try reversed (shouldn't happen but just in case)
                api_m = lookup.get((away, home))
                if api_m:
                    # Swap perspective
                    pass

            if not api_m:
                print(f"  No API match found for {match_id}: {home} vs {away}")
                continue

            result = parse_result(api_m)
            if result is None:
                continue  # match not finished yet

            current = clean_results.get(match_id, {})
            if (current.get("home_score") != result["home_score"] or
                current.get("away_score") != result["away_score"] or
                current.get("penalties_winner") != result["penalties_winner"]):
                clean_results[match_id] = result
                print(f"  Updated {match_id} ({home} vs {away}): "
                      f"{result['home_score']}-{result['away_score']}"
                      f"{' pen:'+result['penalties_winner'] if result['penalties_winner'] else ''}")
                updated += 1

    print(f"\nUpdated {updated} match(es)")

    if updated == 0:
        print("No changes — skipping write")
        return

    # Preserve comment keys at top, then write clean results
    output = {
        "_comment": results.get("_comment", "results.json — auto-updated by GitHub Actions"),
    }
    # Keep all match IDs in original order
    all_ids = []
    for round_data in matches_def["rounds"].values():
        for m in round_data["matches"]:
            all_ids.append(m["id"])

    for mid in all_ids:
        output[mid] = clean_results.get(mid, {
            "home_score": None,
            "away_score": None,
            "penalties_winner": None
        })

    with open(RESULTS_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("results.json written successfully")

if __name__ == "__main__":
    main()
