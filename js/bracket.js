/**
 * bracket.js
 * Resolves the knockout bracket based on actual match results.
 * Automatically fills future round slots with the winners of previous matches.
 */

import { getOutcome } from './calculator.js';

/**
 * Determine the advancing (winning) team from a match result.
 * Handles penalties: if penalties_winner is set, that team advances
 * regardless of the 90/120-min score.
 * @param {object} match  - Match definition { home, away }
 * @param {object} result - { home_score, away_score, penalties_winner }
 * @returns {string|null} - Winning team name or null if not played
 */
export function getWinner(match, result) {
  if (!match || !match.home || !match.away) return null;
  if (result.home_score === null || result.away_score === null) return null;

  // Penalty shootout override
  if (result.penalties_winner) return result.penalties_winner;

  const outcome = getOutcome(result.home_score, result.away_score);
  if (outcome === 'home') return match.home;
  if (outcome === 'away') return match.away;
  return null; // Draw — only valid in group stage, handled via penalties in knockout
}

/**
 * Resolve the full bracket: for each round after round_of_32,
 * propagate winners into the next match slots.
 *
 * @param {object} matchesDef - The structure from matches.json
 * @param {object} results    - The flat results map from results.json
 * @returns {object} resolvedMatches - Same shape as matchesDef with teams filled in
 */
export function resolveBracket(matchesDef, results) {
  // Deep-clone to avoid mutating the original
  const resolved = JSON.parse(JSON.stringify(matchesDef));

  const roundOrder = [
    'round_of_32',
    'round_of_16',
    'quarter_finals',
    'semi_finals',
    'final'
  ];

  // Build a quick lookup from matchId → resolved match (for winner propagation)
  const matchById = {};
  for (const roundKey of roundOrder) {
    const round = resolved.rounds[roundKey];
    if (!round) continue;
    for (const match of round.matches) {
      matchById[match.id] = match;
    }
  }

  // For each round after the first, propagate winners into home/away slots
  for (let ri = 1; ri < roundOrder.length; ri++) {
    const roundKey = roundOrder[ri];
    const round    = resolved.rounds[roundKey];
    if (!round) continue;

    for (const match of round.matches) {
      if (!match.from || match.from.length !== 2) continue;

      const [fromHome, fromAway] = match.from;
      const matchHome = matchById[fromHome];
      const matchAway = matchById[fromAway];

      const resultHome = results[fromHome];
      const resultAway = results[fromAway];

      const winnerHome = matchHome && resultHome
        ? getWinner(matchHome, resultHome)
        : null;
      const winnerAway = matchAway && resultAway
        ? getWinner(matchAway, resultAway)
        : null;

      // Fill in teams if winners are known
      if (winnerHome) match.home = winnerHome;
      if (winnerAway) match.away = winnerAway;
    }
  }

  return resolved;
}

/**
 * Get tournament champion (winner of the final).
 * @param {object} resolvedMatches
 * @param {object} results
 * @returns {string|null}
 */
export function getChampion(resolvedMatches, results) {
  const finalMatch = resolvedMatches.rounds?.final?.matches?.[0];
  if (!finalMatch) return null;
  const finalResult = results['final_m1'];
  if (!finalResult) return null;
  return getWinner(finalMatch, finalResult);
}

/**
 * Count how many total matches have been played.
 * @param {object} results
 * @returns {number}
 */
export function countPlayedMatches(results) {
  return Object.values(results).filter(r => r.home_score !== null).length;
}
