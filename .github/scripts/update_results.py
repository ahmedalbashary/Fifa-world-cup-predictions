import json, os, time, urllib.request
from pathlib import Path

API_KEY      = os.environ["FOOTBALL_API_KEY"]
BASE_URL     = "https://api.football-data.org/v4"
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

KNOCKOUT_STAGES = {
    "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL",
    "ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL",
}

def fetch(path):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"X-Auth-Token": API_KEY}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        remaining = r.headers.get("X-Requests-Available-Minute", "")
        if remaining and int(remaining) < 3:
            time.sleep(12)
        return json.loads(r.read())

def normalize(name):
    if not name: return None
    for k, v in TEAM_ALIASES.items():
        if name in v: return k
    return None

def get_winner(result, home_team, away_team):
    """Get actual winner of a match (including via penalties)."""
    if result.get("home_score") is None: return None
    h = result["home_score"]
    a = result["away_score"]
    if h > a: return home_team
    if a > h: return away_team
    return result.get("penalties_winner")  # draw → pen winner

def resolve_teams(matches_def, results):
    """
    Walk all rounds and resolve home/away team names
    for matches where they're null (later rounds).
    Returns dict: match_id -> {home, away}
    """
    resolved = {}

    # First pass: known teams from matches.json
    for round_data in matches_def["rounds"].values():
        for m in round_data["matches"]:
            if m.get("home") and m.get("away"):
                resolved[m["id"]] = {"home": m["home"], "away": m["away"]}

    # Second pass: resolve from previous round results
    changed = True
    while changed:
        changed = False
        for round_data in matches_def["rounds"].values():
            for m in round_data["matches"]:
                mid = m["id"]
                if mid in resolved:
                    continue
                froms = m.get("from", [])
                if len(froms) != 2:
                    continue
                w = []
                for prev_mid in froms:
                    prev = resolved.get(prev_mid)
                    if not prev: break
                    r = results.get(prev_mid, {})
                    winner = get_winner(r, prev["home"], prev["away"])
                    if winner: w.append(winner)
                if len(w) == 2:
                    resolved[mid] = {"home": w[0], "away": w[1]}
                    changed = True

    return resolved

def main():
    with open(MATCHES_PATH) as f:
        matches_def = json.load(f)
    with open(RESULTS_PATH) as f:
        results = json.load(f)

    clean = {k: v for k, v in results.items() if not k.startswith("_")}

    # Resolve actual team names for all rounds
    team_map = resolve_teams(matches_def, clean)
    print(f"Resolved teams for {len(team_map)} matches")

    # Fetch from API
    print("Fetching from API...")
    data = fetch("/competitions/WC/matches?season=2026")
    api_matches = data.get("matches", [])
    print(f"Got {len(api_matches)} matches from API")

    # Print all stages for debug
    stages = set(m.get("stage") for m in api_matches)
    print(f"Stages in API: {stages}")

    # Build API lookup: (home_canonical, away_canonical) -> api_match
    lookup = {}
    for m in api_matches:
        if m.get("stage") not in KNOCKOUT_STAGES:
            continue
        h = normalize(m["homeTeam"].get("name") or m["homeTeam"].get("shortName", ""))
        a = normalize(m["awayTeam"].get("name") or m["awayTeam"].get("shortName", ""))
        if h and a:
            lookup[(h, a)] = m
        else:
            hn = m["homeTeam"].get("name", "?")
            an = m["awayTeam"].get("name", "?")
            print(f"  Unmatched API team: '{hn}' vs '{an}' (stage: {m.get('stage')})")

    print(f"Mapped {len(lookup)} knockout matches in API")

    updated = 0
    all_ids = [m["id"] for rd in matches_def["rounds"].values() for m in rd["matches"]]

    for mid in all_ids:
        teams = team_map.get(mid)
        if not teams:
            continue  # teams not resolved yet (earlier rounds not finished)

        home = teams["home"]
        away = teams["away"]

        api_m = lookup.get((home, away)) or lookup.get((away, home))
        if not api_m:
            print(f"  Not in API: {mid} ({home} vs {away})")
            continue

        if api_m.get("status") != "FINISHED":
            continue

        score = api_m.get("score", {})

        # Use regularTime for 90-min score, fallback to fullTime
        ft = score.get("regularTime") or score.get("fullTime", {})
        h_score = ft.get("home")
        a_score = ft.get("away")
        if h_score is None or a_score is None:
            continue

        # Penalties
        pen_winner = None
        pens = score.get("penalties", {})
        if pens.get("home") is not None:
            # If API lookup was reversed, swap
            api_home = normalize(api_m["homeTeam"].get("name", ""))
            if api_home == home:
                pen_winner = home if pens["home"] > pens["away"] else away
            else:
                pen_winner = away if pens["home"] > pens["away"] else home

        result = {"home_score": h_score, "away_score": a_score, "penalties_winner": pen_winner}
        cur = clean.get(mid, {})
        if (cur.get("home_score") != h_score or
            cur.get("away_score") != a_score or
            cur.get("penalties_winner") != pen_winner):
            clean[mid] = result
            pen_str = f" pen:{pen_winner}" if pen_winner else ""
            print(f"  Updated {mid}: {home} {h_score}-{a_score} {away}{pen_str}")
            updated += 1

    print(f"\nUpdated {updated} match(es)")
    if updated == 0:
        print("No changes")
        return

    output = {"_comment": "results.json — auto-updated by GitHub Actions"}
    for mid in all_ids:
        output[mid] = clean.get(mid, {"home_score": None, "away_score": None, "penalties_winner": None})

    with open(RESULTS_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("results.json saved ✅")

if __name__ == "__main__":
    main()
