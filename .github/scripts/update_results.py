print("NEW VERSION")
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

def fetch(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"X-Auth-Token": API_KEY})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def normalize(name):
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

    stages = set(m.get("stage") for m in api_matches)
    print(f"Stages: {stages}")

    team_names = set()
    for m in api_matches:
        team_names.add(m["homeTeam"]["name"])
        team_names.add(m["awayTeam"]["name"])
    print(f"Team names: {sorted(team_names)}")

if __name__ == "__main__":
    main()
