// deck.js — Deck creation, shuffle, deal

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

function createDeck(deckIndex = 0) {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}${suit}-${deckIndex}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
        suitName: SUIT_NAMES[suit],
      });
    }
  }
  return cards;
}

function createMultiDeck(numDecks) {
  let pool = [];
  for (let i = 0; i < numDecks; i++) {
    pool = pool.concat(createDeck(i));
  }
  return pool;
}

function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function calcNumDecks(numPlayers, numRounds) {
  return Math.ceil((numPlayers * numRounds) / 52);
}

function dealCards(shuffledDeck, numPlayers, cardsPerPlayer) {
  const hands = {};
  // hands keyed by player index
  for (let p = 0; p < numPlayers; p++) {
    hands[p] = shuffledDeck.slice(p * cardsPerPlayer, (p + 1) * cardsPerPlayer);
  }
  return hands;
}

function pickTrumpSuit() {
  return SUITS[Math.floor(Math.random() * SUITS.length)];
}

module.exports = { createMultiDeck, shuffle, calcNumDecks, dealCards, pickTrumpSuit, SUITS, RANKS, RANK_VALUES };
