/**
 * calculator.js
 *
 * SCORING RULES:
 * ─────────────────────────────────────────────────────────────
 * Case 1 — Predicted DRAW + pen winner:
 *   • pen winner correct → 2 pts  (regardless of exact score)
 *   • pen winner wrong   → 1 pt   (got the draw right)
 *
 * Case 2 — Predicted WIN (no draw):
 *   • predicted winner == actual winner (by any means) → 1 pt
 *   • + exact 90-min score correct                    → +1 pt (total 2)
 *   • winner wrong                                    → 0 pts
 * ─────────────────────────────────────────────────────────────
 */

export function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/** Convert a team name to 'home'/'away' using match definition */
function toSide(teamName, match) {
  if (!teamName || !match) return null;
  if (teamName === match.home) return 'home';
  if (teamName === match.away) return 'away';
  return null;
}

/**
 * @param {object} prediction  { home, away, pen_winner? }
 * @param {object} result      { home_score, away_score, penalties_winner }
 * @param {object} match       { home, away }  — team names from matches.json
 */
export function calcMatchPoints(prediction, result, match) {
  if (result.home_score === null || result.away_score === null) {
    return { points: null, exactScore: false, correctWinner: false };
  }
  if (!prediction) {
    return { points: 0, exactScore: false, correctWinner: false };
  }

  const predOutcome   = getOutcome(prediction.home, prediction.away);
  const actualOutcome = getOutcome(result.home_score, result.away_score);

  // Actual winner side ('home'/'away'), or null if no pen decided it
  const actualWinnerSide = actualOutcome !== 'draw'
    ? actualOutcome
    : toSide(result.penalties_winner, match);

  // ── CASE 1: Predicted a draw ──────────────────────────────
  if (predOutcome === 'draw') {
    // Actual result must also be a draw (pen or not)
    if (actualOutcome !== 'draw') {
      // Predicted draw but match was decided in 90 min → 0
      return { points: 0, exactScore: false, correctWinner: false };
    }

    // Both draw — check pen winner
    const predPenSide    = toSide(prediction.pen_winner, match);
    const correctWinner  = predPenSide !== null && predPenSide === actualWinnerSide;
    const exactScore     = prediction.home === result.home_score &&
                           prediction.away === result.away_score;

    if (correctWinner) {
      // pen winner correct → 2 pts always
      return { points: 2, exactScore, correctWinner: true };
    } else if (predPenSide === null || actualWinnerSide === null) {
      // No pen winner specified (group stage draw), or match had no pens
      // Give 1 pt for correct draw outcome + bonus if exact score
      return { points: 1 + (exactScore ? 1 : 0), exactScore, correctWinner: false };
    } else {
      // pen winner wrong → 1 pt for draw
      return { points: 1, exactScore: false, correctWinner: false };
    }
  }

  // ── CASE 2: Predicted a win ───────────────────────────────
  const predWinnerSide = predOutcome; // 'home' or 'away'
  const correctWinner  = predWinnerSide === actualWinnerSide;

  if (!correctWinner) {
    return { points: 0, exactScore: false, correctWinner: false };
  }

  // Winner correct — check exact score (only meaningful if won in 90 min)
  const exactScore = actualOutcome !== 'draw' &&
                     prediction.home === result.home_score &&
                     prediction.away === result.away_score;

  return { points: 1 + (exactScore ? 1 : 0), exactScore, correctWinner: true };
}

export function calcTotalPoints(participant, predictions, results, matchesById) {
  const myPreds      = predictions[participant] || {};
  let total          = 0;
  let exactScores    = 0;
  let correctWinners = 0;
  let playedMatches  = 0;
  const breakdown    = {};

  for (const matchId of Object.keys(results)) {
    if (matchId.startsWith('_')) continue;
    const result = results[matchId];
    if (result.home_score === null) continue;

    playedMatches++;
    const pred   = myPreds[matchId];
    const match  = matchesById?.[matchId] ?? null;
    const scored = calcMatchPoints(pred, result, match);
    breakdown[matchId] = scored;

    if (scored.points !== null) {
      total += scored.points;
      if (scored.exactScore)    exactScores++;
      if (scored.correctWinner) correctWinners++;
    }
  }

  return { total, breakdown, exactScores, correctWinners, playedMatches };
}

export function buildLeaderboard(participants, predictions, results, matchesById) {
  const board = participants.map(name => ({
    name,
    ...calcTotalPoints(name, predictions, results, matchesById),
  }));

  board.sort((a, b) => b.total !== a.total
    ? b.total - a.total
    : a.name.localeCompare(b.name));

  let rank = 1;
  for (let i = 0; i < board.length; i++) {
    if (i > 0 && board[i].total !== board[i - 1].total) rank = i + 1;
    board[i].rank = rank;
  }

  return board;
}
