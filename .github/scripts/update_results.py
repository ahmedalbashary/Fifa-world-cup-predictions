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
                remaining = r.headers.get("X-Requests-Available-Minute", "")
                if remaining and int(remaining) < 3:
                    time.sleep(12)
                return json.loads(r.read())
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(5)

def normalize(name):
    for our_name, aliases in TEAM_ALIASES.items():
        if name in aliases:
            return our_name
    return None

def build_lookup(api_matches):
    # Print all unique stages for debugging
    stages = set(m.get("stage") for m in api_matches)
    print(f"  API stages found: {stages}")

    # Accept any stage name that isn't group stage
    group_stages = {"GROUP_STAGE", "PRELIMINARY_ROUND", "QUALIFICATION"}
    
    lookup = {}
    for m in api_matches:
        stage = m.get("stage", "")
        if stage in group_stages:
            continue
        h = normalize(m["homeTeam"]["name"])
        a = normalize(m["awayTeam"]["name"])
        # Print unmatched team names to debug
        if not h:
            print(f"  Unknown home team: {m['homeTeam']['name']} (stage: {stage})")
        if not a:
            print(f"  Unknown away team: {m['awayTeam']['name']} (stage: {stage})")
        if h and a:
            lookup[(h, a)] = m
    return lookup

def parse_result(api_match):
    status = api_match.get("status", "")
    if status not in ("FINISHED",):
        return None

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
    with open(MATCHES_PATH) as f:
        matches_def = json.load(f)

    with open(RESULTS_PATH) as f:
        results = json.load(f)

    clean_results = {k: v for k, v in results.items() if not k.startswith("_")}

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

    updated = 0
    for round_key, round_data in matches_def["rounds"].items():
        for m in round_data["matches"]:
            match_id = m["id"]
            home = m.get("home")
            away = m.get("away")

            if not home or not away:
                continue

            api_m = lookup.get((home, away))
            if not api_m:
                print(f"  No API match found for {match_id}: {home} vs {away}")
                continue

            result = parse_result(api_m)
            if result is None:
                continue

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

    output = {
        "_comment": "results.json — auto-updated by GitHub Actions",
    }
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
