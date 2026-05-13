// autoplay.js — Auto-play card selection for disconnected players

function getLegalCards(hand, baseSuit, trumpSuit) {
  const baseSuitCards = hand.filter(c => c.suit === baseSuit);
  if (baseSuitCards.length > 0) return baseSuitCards;
  // no base suit — any card is legal
  return hand;
}

function selectAutoPlayCard(hand, baseSuit, trumpSuit) {
  if (!hand || hand.length === 0) return null;

  // If leading (no base suit yet), play lowest non-trump or lowest trump
  if (!baseSuit) {
    const nonTrump = hand.filter(c => c.suit !== trumpSuit);
    if (nonTrump.length > 0) return lowestCard(nonTrump);
    return lowestCard(hand);
  }

  const baseSuitCards = hand.filter(c => c.suit === baseSuit);
  if (baseSuitCards.length > 0) {
    // Must play base suit — pick lowest
    return lowestCard(baseSuitCards);
  }

  // No base suit cards — play lowest non-trump (waste), or lowest trump if only trumps remain
  const nonTrump = hand.filter(c => c.suit !== trumpSuit);
  if (nonTrump.length > 0) return lowestCard(nonTrump);
  return lowestCard(hand);
}

function lowestCard(cards) {
  return cards.reduce((min, c) => c.value < min.value ? c : min, cards[0]);
}

module.exports = { selectAutoPlayCard, getLegalCards };
