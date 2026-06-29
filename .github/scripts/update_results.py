import json, os, time, urllib.request
from pathlib import Path

API_KEY = os.environ["FOOTBALL_API_KEY"]
BASE_URL = "https://api.football-data.org/v4"
RESULTS_PATH = Path("data/results.json")
MATCHES_PATH = Path("data/matches.json")

TEAM_ALIASES = {
    "South Africa": ["South Africa"], "Canada": ["Canada"],
    "Brazil": ["Brazil"], "Japan": ["Japan"],
    "Germany": ["Germany"], "Paraguay": ["Paraguay"],
    "Netherlands": ["Netherlands"], "Morocco": ["Morocco"],
    "Ivory Coast": ["Ivory Coast", "Côte d'Ivoire"], "Norway": ["Norway"],
    "France": ["France"], "Sweden": ["Sweden"],
    "Mexico": ["Mexico"], "Ecuador": ["Ecuador"],
    "England": ["England"], "DR Congo": ["DR Congo", "Congo DR", "Democratic Republic of Congo"],
    "Belgium": ["Belgium"], "Senegal": ["Senegal"],
    "USA": ["USA", "United States"],
    "Bosnia & Herzegovina": ["Bosnia-Herzegovina", "Bosnia & Herzegovina", "Bosnia and Herzegovina"],
    "Spain": ["Spain"], "Austria": ["Austria"],
    "Portugal": ["Portugal"], "Croatia": ["Croatia"],
    "Switzerland": ["Switzerland"], "Algeria": ["Algeria"],
    "Australia": ["Australia"], "Egypt": ["Egypt"],
    "Argentina": ["Argentina"], "Cape Verde": ["Cape Verde"],
    "Colombia": ["Colombia"], "Ghana": ["Ghana"],
}

KNOCKOUT_STAGES = {"LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"}

def fetch(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"X-Auth-Token": API_KEY})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def normalize(name):
    if not name:
        return None
    for k, v in TEAM_ALIASES.items():
        if name in v:
            return k
    return None

def main():
    with open(MATCHES_PATH) as f:
        matches_def = json.load(f)
    with open(RESULTS_PATH) as f:
        results = json.load(f)
    clean = {k: v for k, v in results.items() if not k.startswith("_")}

    print("Fetching from API...")
    data = fetch("/competitions/WC/matches?season=2026")
    api_matches = data.get("matches", [])
    print(f"Got {len(api_matches)} matches")

    # Build lookup from knockout matches only
    lookup = {}
    for m in api_matches:
        if m.get("stage") not in KNOCKOUT_STAGES:
            continue
        h = normalize(m["homeTeam"].get("name"))
        a = normalize(m["awayTeam"].get("name"))
        if h and a:
            lookup[(h, a)] = m
        elif h or a:
            print(f"  Unmatched: {m['homeTeam'].get('name')} vs {m['awayTeam'].get('name')} (stage: {m.get('stage')})")

    print(f"Mapped {len(lookup)} knockout matches")

    updated = 0
    for round_data in matches_def["rounds"].values():
        for m in round_data["matches"]:
            mid = m["id"]
            home = m.get("home")
            away = m.get("away")
            if not home or not away:
                continue

            api_m = lookup.get((home, away))
            if not api_m:
                print(f"  Not found: {mid} ({home} vs {away})")
                continue

            status = api_m.get("status")
            if status != "FINISHED":
                continue

            score = api_m.get("score", {})
            ft = score.get("fullTime", {})
            h_score = ft.get("home")
            a_score = ft.get("away")
            if h_score is None or a_score is None:
                continue

            pen_winner = None
            pens = score.get("penalties", {})
            if pens.get("home") is not None:
                pen_winner = home if pens["home"] > pens["away"] else away

            result = {"home_score": h_score, "away_score": a_score, "penalties_winner": pen_winner}
            cur = clean.get(mid, {})
            if cur.get("home_score") != h_score or cur.get("away_score") != a_score or cur.get("penalties_winner") != pen_winner:
                clean[mid] = result
                print(f"  Updated {mid}: {home} {h_score}-{a_score} {away}{' (pen: '+pen_winner+')' if pen_winner else ''}")
                updated += 1

    print(f"\nUpdated {updated} match(es)")
    if updated == 0:
        print("No changes")
        return

    all_ids = [m["id"] for rd in matches_def["rounds"].values() for m in rd["matches"]]
    output = {"_comment": "results.json — auto-updated by GitHub Actions"}
    for mid in all_ids:
        output[mid] = clean.get(mid, {"home_score": None, "away_score": None, "penalties_winner": None})

    with open(RESULTS_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("results.json saved")

if __name__ == "__main__":
    main()
