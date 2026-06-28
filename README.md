# ⚽ World Cup 2026 — Knockout Prediction League

A beautiful, fully static prediction league website for the FIFA World Cup 2026 knockout stage — hosted on **GitHub Pages** with zero backend required.

---

## 🚀 How to Host on GitHub Pages

1. **Fork or create** a new GitHub repository.
2. **Upload all files** (or push this folder) to the repository root.
3. Go to **Settings → Pages** in your GitHub repo.
4. Under "Source", select **Deploy from a branch** → `main` → `/ (root)`.
5. Click **Save**. Your site will be live at `https://yourusername.github.io/repo-name/` within a minute.

> ⚠️ **Important:** The site uses ES Modules and `fetch()`, so it will **not work** when opened directly as a local file (`file://`). Use GitHub Pages, or run a local server:
> ```bash
> # Python 3
> python -m http.server 8080
> # Node.js (if you have npx)
> npx serve .
> ```

---

## 📂 Project Structure

```
/
├── index.html              — Single page app shell
├── css/
│   └── style.css           — All styles (dark scoreboard theme)
├── js/
│   ├── app.js              — Main app controller & UI rendering
│   ├── calculator.js       — Scoring engine (points calculation)
│   └── bracket.js          — Bracket resolution & winner propagation
├── data/
│   ├── teams.json          — Team names & flag emojis
│   ├── matches.json        — Tournament structure & match IDs
│   ├── results.json        — ⭐ ADMIN EDITS THIS after each game
│   └── predictions.json    — ⭐ ADMIN EDITS THIS with player predictions
└── README.md
```

---

## ✏️ How to Update Predictions

Open `data/predictions.json`. Each participant has predictions for every match ID.

```json
{
  "Tweety": {
    "r32_m1": { "home": 2, "away": 1 },
    "r32_m2": { "home": 2, "away": 0 }
  }
}
```

- `home` = predicted goals for the home team
- `away` = predicted goals for the away team
- Match IDs follow the pattern: `r32_m1`–`r32_m16`, `r16_m1`–`r16_m8`, `qf_m1`–`qf_m4`, `sf_m1`–`sf_m2`, `final_m1`

**Predictions should be entered before each match starts.**

---

## 📋 How to Enter Match Results

Open `data/results.json`. After each game, fill in the scores:

```json
{
  "r32_m1": {
    "home_score": 2,
    "away_score": 1,
    "penalties_winner": null
  }
}
```

- `home_score` / `away_score` = goals after **90 or 120 minutes** (NOT penalties)
- `penalties_winner` = set to the **team name** that won the shootout, e.g. `"Argentina"`. Leave `null` if match was decided in normal/extra time.
- Leave scores as `null` for unplayed matches.

**After you commit and push**, the website automatically:
- Calculates points for all players
- Updates the leaderboard
- Propagates winners into the next round bracket
- Highlights exact scores and correct predictions

---

## 🏆 Scoring Rules

| Scenario | Points |
|---|---|
| Correct exact score (e.g. 2-1 = 2-1) | 2 pts |
| Correct winner, wrong score (e.g. predicted 3-1, actual 2-1) | 1 pt |
| Correct draw, wrong score (e.g. predicted 1-1, actual 0-0) | 1 pt |
| Wrong winner / outcome | 0 pts |

**Penalty note:** The score used for points calculation is the 90/120-minute score only. The team that advances via penalties is used for bracket progression but does **not** affect the score prediction scoring.

---

## 🔄 Automatic Bracket Generation

The bracket auto-populates based on results:

```
Round of 32  →  Round of 16  →  Quarter Finals  →  Semi Finals  →  Final  →  Champion
```

- When a match result is entered in `results.json`, the winner automatically appears in the next round's slot in the bracket.
- No manual editing of `matches.json` is needed for bracket progression.
- If a match goes to penalties, set `penalties_winner` and the correct team advances.

---

## 👥 Participants

| Tab | Player |
|---|---|
| Tweety | Admin / You |
| Omy | — |
| Honda | — |
| K. Embaby | — |
| O. Embaby | — |
| Khaled Alaa | — |
| Karim | — |
| Swariekh | — |

---

## 🎨 Customization Guide

### Add or remove participants
1. Edit `data/predictions.json` — add/remove the participant's name and their predictions.
2. In `js/app.js`, update the `PARTICIPANTS` constant at the top of the file:
   ```js
   const PARTICIPANTS = ['Tweety', 'Omy', 'Honda', 'K. Embaby', 'O. Embaby', 'Khaled Alaa', 'Karim', 'Swariekh'];
   ```

### Change team names or flags
Edit `data/teams.json`. Use real emoji flags (🇦🇷) or any Unicode character.

### Change match fixtures
Edit `data/matches.json` — update the `home` and `away` team names in `round_of_32` matches.

### Styling changes
All CSS variables are in `css/style.css` under `:root { }`. Change `--gold`, `--green`, `--bg-primary` etc. to retheme the entire site instantly.

---

## 🌐 Features

| Feature | Status |
|---|---|
| Automatic point calculation | ✅ |
| Leaderboard (live sorted) | ✅ |
| Visual knockout bracket | ✅ |
| Auto bracket progression | ✅ |
| Penalties support | ✅ |
| Per-player prediction table | ✅ |
| Round filter per player | ✅ |
| Statistics page | ✅ |
| Player search | ✅ |
| Tournament progress bar | ✅ |
| Champion display | ✅ |
| Responsive (mobile/tablet) | ✅ |
| Dark mode | ✅ |
| No backend required | ✅ |
| GitHub Pages compatible | ✅ |

---

## 💡 Tips

- **Commit often** — every time you update `results.json`, commit and push to update the live site.
- **JSON must be valid** — use [jsonlint.com](https://jsonlint.com) to validate your JSON before pushing if you're unsure.
- **GitHub Pages cache** — changes may take 1–3 minutes to appear after pushing.
- **Incognito mode** — if you don't see updates, open in a private browser window to bypass cache.
