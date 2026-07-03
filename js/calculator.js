/**
 * calculator.js
 * Scoring engine for the World Cup prediction league.
 *
 * Rules:
 *  - 1 point for correctly predicting the winning team (or draw).
 *  - +1 bonus point for predicting the exact score.
 *  - Maximum 2 points per match.
 *
 * Winner logic:
 *  - If match decided in 90/120 min → winner = team with more goals.
 *  - If draw after 90/120 min → winner = penalties_winner.
 *
 * Prediction winner logic:
 *  - If predicted score is a draw → pen_winner field determines predicted winner.
 *  - If predicted score is not a draw → higher score side is predicted winner.
 *
 * "Correct winner" = predicted winner matches actual winner (regardless of how match ended).
 */

export function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function calcMatchPoints(prediction, result) {
  if (result.home_score === null || result.away_score === null) {
    return { points: null, exactScore: false, correctWinner: false };
  }
  if (!prediction) {
    return { points: 0, exactScore: false, correctWinner: false };
  }

  const predOutcome   = getOutcome(prediction.home, prediction.away);
  const actualOutcome = getOutcome(result.home_score, result.away_score);

  // Actual winner: pen winner if draw, otherwise score winner
  const actualWinner = actualOutcome === 'draw'
    ? (result.penalties_winner || null)  // null = draw with no pens (group stage)
    : actualOutcome; // 'home' or 'away'

  // Predicted winner: pen_winner if predicted draw, otherwise score outcome
  const predWinner = predOutcome === 'draw'
    ? (prediction.pen_winner || null)
    : predOutcome; // 'home' or 'away'

  // Correct winner: predicted winner matches actual winner
  const correctWinner = predWinner !== null && actualWinner !== null
    ? predWinner === actualWinner
    : predOutcome === actualOutcome; // fallback for group stage draws

  const exactScore = prediction.home === result.home_score &&
                     prediction.away === result.away_score;

  let points = 0;
  if (correctWinner) points += 1;
  if (exactScore)    points += 1;

  return { points, exactScore, correctWinner };
}

export function calcTotalPoints(participant, predictions, results) {
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
    const scored = calcMatchPoints(pred, result);
    breakdown[matchId] = scored;

    if (scored.points !== null) {
      total          += scored.points;
      if (scored.exactScore)    exactScores++;
      if (scored.correctWinner) correctWinners++;
    }
  }

  return { total, breakdown, exactScores, correctWinners, playedMatches };
}

export function buildLeaderboard(participants, predictions, results) {
  const board = participants.map(name => {
    const stats = calcTotalPoints(name, predictions, results);
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
