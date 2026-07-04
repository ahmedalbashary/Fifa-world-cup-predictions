/**
 * calculator.js
 * Scoring engine for the World Cup prediction league.
 *
 * Rules:
 *  - 1 point for correctly predicting the winning team (or draw outcome).
 *  - +1 bonus point for predicting the exact score (90 min score).
 *  - Maximum 2 points per match.
 *
 * Winner logic:
 *  - Actual winner = team with more goals after 90 min.
 *  - If draw after 90 min → actual winner = penalties_winner (team name).
 *  - Predicted winner = team with more goals in prediction.
 *  - If predicted draw → predicted winner = pen_winner (team name) if set, else null.
 *
 * "Correct winner" = predicted winner matches actual winner.
 * Predicted a win → team wins by any means (normal or pens) = ✅
 * Predicted a draw + correct pen winner → ✅
 */

export function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Convert penalties_winner team name to 'home'/'away' using match definition.
 * @param {string} teamName - e.g. "Morocco"
 * @param {object} match - { home: "Netherlands", away: "Morocco" }
 */
function penWinnerSide(teamName, match) {
  if (!teamName || !match) return null;
  if (teamName === match.home) return 'home';
  if (teamName === match.away) return 'away';
  return null;
}

/**
 * @param {object} prediction - { home, away, pen_winner? }
 * @param {object} result     - { home_score, away_score, penalties_winner }
 * @param {object} match      - { home, away } team names from matches.json
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

  // Actual winner side ('home'/'away'), accounting for penalties
  let actualWinnerSide;
  if (actualOutcome !== 'draw') {
    actualWinnerSide = actualOutcome;
  } else {
    // Draw after 90 min — winner is pen winner
    actualWinnerSide = penWinnerSide(result.penalties_winner, match);
  }

  // Predicted winner side
  let predWinnerSide;
  if (predOutcome !== 'draw') {
    predWinnerSide = predOutcome; // 'home' or 'away'
  } else {
    // Predicted draw — use pen_winner name to get side
    predWinnerSide = penWinnerSide(prediction.pen_winner, match);
  }

  // Correct winner check
  let correctWinner;
  if (predWinnerSide && actualWinnerSide) {
    // Both have a winner → compare sides
    correctWinner = predWinnerSide === actualWinnerSide;
  } else if (!predWinnerSide && !actualWinnerSide) {
    // Both predicted draw with no pen, actual draw with no pen (group stage)
    correctWinner = predOutcome === 'draw' && actualOutcome === 'draw';
  } else {
    correctWinner = false;
  }

  const exactScore = prediction.home === result.home_score &&
                     prediction.away === result.away_score;

  let points = 0;
  if (correctWinner) points += 1;
  if (exactScore)    points += 1;

  return { points, exactScore, correctWinner };
}

export function calcTotalPoints(participant, predictions, results, matchesById) {
  const myPreds = predictions[participant] || {};
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
    const match  = matchesById ? matchesById[matchId] : null;
    const scored = calcMatchPoints(pred, result, match);
    breakdown[matchId] = scored;

    if (scored.points !== null) {
      total          += scored.points;
      if (scored.exactScore)    exactScores++;
      if (scored.correctWinner) correctWinners++;
    }
  }

  return { total, breakdown, exactScores, correctWinners, playedMatches };
}

export function buildLeaderboard(participants, predictions, results, matchesById) {
  const board = participants.map(name => {
    const stats = calcTotalPoints(name, predictions, results, matchesById);
    return { name, ...stats };
  });

  board.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });

  let rank = 1;
  for (let i = 0; i < board.length; i++) {
    if (i > 0 && board[i].total !== board[i - 1].total) {
      rank = i + 1;
    }
    board[i].rank = rank;
  }

  return board;
}
