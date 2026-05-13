// utils/cardHelpers.js

export const RED_SUITS = ['♥', '♦'];
export const BLACK_SUITS = ['♠', '♣'];

// On cards (cream background): red=crimson, black=very dark navy
// On dark UI backgrounds (trump badge, base suit label): red=bright red, black=WHITE so it's readable
export function getSuitColor(suit) {
  return RED_SUITS.includes(suit) ? 'suit-red' : 'suit-black';
}

// Use this when the suit symbol appears on the dark game background (not on a card)
export function getSuitColorUI(suit) {
  return RED_SUITS.includes(suit) ? 'text-red-400' : 'text-white';
}

export function getSuitLabel(suit) {
  const labels = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' };
  return labels[suit] || suit;
}

export function isLegalToPlay(card, hand, baseSuit) {
  if (!baseSuit) return true;
  const hasBaseSuit = hand.some(c => c.suit === baseSuit);
  if (hasBaseSuit) return card.suit === baseSuit;
  return true;
}

export function sortHand(hand, trumpSuit) {
  const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
  return [...hand].sort((a, b) => {
    if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
    if (b.suit === trumpSuit && a.suit !== trumpSuit) return -1;
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return a.value - b.value;
  });
}
