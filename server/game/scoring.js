// scoring.js — Scoring formulas per PRD §2.7

function calculatePoints(bid, actualWins) {
  if (bid === 0) {
    if (actualWins === 0) return 0;
    return actualWins * 1; // overwin on nil bid
  }
  if (actualWins === bid) {
    return bid * 10;
  }
  if (actualWins < bid) {
    return (bid - actualWins) * -10;
  }
  // actualWins > bid
  return (bid * 10) + (actualWins - bid) * 1;
}

function calculateRoundScores(bids, tricksWon, playerIds) {
  const roundScores = {};
  for (const playerId of playerIds) {
    roundScores[playerId] = calculatePoints(bids[playerId], tricksWon[playerId] || 0);
  }
  return roundScores;
}

module.exports = { calculatePoints, calculateRoundScores };
