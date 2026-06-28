/**
 * calculator.js
 * Scoring engine for the World Cup prediction league.
 *
 * Rules:
 *  - 1 point for correctly predicting the winning team (or draw).
 *  - +1 bonus point for predicting the exact score.
 *  - Maximum 2 points per match.
 *  - Penalties: only the score after 90/120 mins counts for scoring;
 *    but the team that advances (via penalties) determines bracket progression.
 */

/**
 * Determine the match outcome category.
 * @param {number} home - Home goals
 * @param {number} away - Away goals
 * @returns {'home'|'away'|'draw'}
 */
export function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Calculate points earned for a single match prediction.
 * @param {object} prediction - { home, away }
 * @param {object} result     - { home_score, away_score }
 * @returns {{ points: number, exactScore: boolean, correctWinner: boolean }}
 */
export function calcMatchPoints(prediction, result) {
  // If no result yet, return null
  if (result.home_score === null || result.away_score === null) {
    return { points: null, exactScore: false, correctWinner: false };
  }
  if (!prediction) {
    return { points: 0, exactScore: false, correctWinner: false };
  }

  const predOutcome   = getOutcome(prediction.home, prediction.away);
  const actualOutcome = getOutcome(result.home_score, result.away_score);

  const correctWinner = predOutcome === actualOutcome;
  const exactScore    = prediction.home === result.home_score &&
                        prediction.away === result.away_score;

  let points = 0;
  if (correctWinner) points += 1;
  if (exactScore)    points += 1;

  return { points, exactScore, correctWinner };
}

/**
 * Calculate total points for a participant across all matches.
 * @param {string}  participant  - Participant name
 * @param {object}  predictions  - Full predictions object (all participants)
 * @param {object}  results      - Full results object
 * @returns {{ total: number, breakdown: object, exactScores: number, correctWinners: number, playedMatches: number }}
 */
export function calcTotalPoints(participant, predictions, results) {
  const myPreds = predictions[participant] || {};
  let total          = 0;
  let exactScores    = 0;
  let correctWinners = 0;
  let playedMatches  = 0;
  const breakdown    = {};

  for (const matchId of Object.keys(results)) {
    const result = results[matchId];
    if (result.home_score === null) continue; // Not played yet

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

/**
 * Build a sorted leaderboard array.
 * @param {string[]} participants
 * @param {object}   predictions
 * @param {object}   results
 * @returns {Array<{ name, total, exactScores, correctWinners, playedMatches }>}
 */
export function buildLeaderboard(participants, predictions, results) {
  const board = participants.map(name => {
    const stats = calcTotalPoints(name, predictions, results);
    return { name, ...stats };
  });

  // Sort: highest points first; ties broken alphabetically
  board.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });

  // Assign ranks (ties share same rank)
  let rank = 1;
  for (let i = 0; i < board.length; i++) {
    if (i > 0 && board[i].total !== board[i - 1].total) {
      rank = i + 1;
    }
    board[i].rank = rank;
  }

  return board;
}
