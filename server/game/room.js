// room.js — Room state machine

const { createMultiDeck, shuffle, calcNumDecks, dealCards, pickTrumpSuit } = require('./deck');
const { calculateRoundScores } = require('./scoring');
const { selectAutoPlayCard, getLegalCards } = require('./autoplay');

const PHASES = {
  WAITING: 'waiting',
  BIDDING: 'bidding',
  PLAYING: 'playing',
  ROUND_END: 'round_end',
  GAME_OVER: 'game_over',
};

class Room {
  constructor(roomCode, hostId, hostName, config) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.players = [{ id: hostId, name: hostName, connected: true, socketId: null }];
    this.config = {
      numPlayers: config.numPlayers,
      numRounds: Math.min(config.numRounds || 10, 20),
    };
    this.chatLog = [];
    this.gameState = {
      phase: PHASES.WAITING,
      currentRound: 0,
      currentSubRound: 0,
      trumpSuit: null,
      bids: {},
      tricksWon: {},
      hands: {},
      table: [], // cards played this sub-round: [{playerId, card, autoPlayed}]
      scores: [], // array of round score objects
      currentPlayerIndex: 0, // index in players array of whose turn it is
      leadPlayerIndex: 0, // who leads this sub-round
      bidOrder: [], // player ids in bid/play order for this round
      subRoundLeaderIndex: 0, // index in bidOrder of sub-round leader
    };
    this.autoPlayTimers = {};
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getPlayerIndex(playerId) {
    return this.players.findIndex(p => p.id === playerId);
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= this.config.numPlayers) {
      return { error: 'Room is full' };
    }
    if (this.gameState.phase !== PHASES.WAITING) {
      return { error: 'Game already started' };
    }
    if (this.players.find(p => p.name === playerName)) {
      return { error: 'Name already taken' };
    }
    this.players.push({ id: playerId, name: playerName, connected: true, socketId: null });
    return { success: true };
  }

  setSocketId(playerId, socketId) {
    const p = this.getPlayer(playerId);
    if (p) p.socketId = socketId;
  }

  setConnected(playerId, connected) {
    const p = this.getPlayer(playerId);
    if (p) p.connected = connected;
  }

  canStart() {
    return this.players.length === this.config.numPlayers && this.gameState.phase === PHASES.WAITING;
  }

  startGame() {
    if (!this.canStart()) return { error: 'Cannot start yet' };
    this.gameState.scores = [];
    this.startRound(1);
    return { success: true };
  }

  startRound(roundNum) {
    const gs = this.gameState;
    gs.currentRound = roundNum;
    gs.currentSubRound = 0;
    gs.bids = {};
    gs.tricksWon = {};
    gs.table = [];

    // Calculate decks and deal
    const numDecks = calcNumDecks(this.players.length, this.config.numRounds);
    const pool = shuffle(createMultiDeck(numDecks));
    const dealtHands = dealCards(pool, this.players.length, roundNum);

    // Assign hands by playerId
    gs.hands = {};
    this.players.forEach((p, i) => {
      gs.hands[p.id] = dealtHands[i];
    });

    gs.trumpSuit = pickTrumpSuit();

    // Bidding order: first bidder = (roundNum - 1) % numPlayers (0-indexed)
    const firstBidderIdx = (roundNum - 1) % this.players.length;
    gs.bidOrder = [];
    for (let i = 0; i < this.players.length; i++) {
      gs.bidOrder.push(this.players[(firstBidderIdx + i) % this.players.length].id);
    }

    gs.currentPlayerIndex = 0; // index into bidOrder
    gs.phase = PHASES.BIDDING;

    return { success: true };
  }

  submitBid(playerId, bid) {
    const gs = this.gameState;
    if (gs.phase !== PHASES.BIDDING) return { error: 'Not in bidding phase' };
    if (gs.bidOrder[gs.currentPlayerIndex] !== playerId) return { error: 'Not your turn to bid' };
    if (bid < 0 || bid > gs.currentRound || !Number.isInteger(bid)) return { error: 'Invalid bid' };

    gs.bids[playerId] = bid;
    gs.currentPlayerIndex++;

    if (gs.currentPlayerIndex >= this.players.length) {
      // All bids in — start play
      this.startSubRound(0);
    }

    return { success: true };
  }

  startSubRound(subRoundIndex) {
    const gs = this.gameState;
    gs.currentSubRound = subRoundIndex + 1;
    gs.table = [];
    gs.phase = PHASES.PLAYING;

    if (subRoundIndex === 0) {
      // First sub-round: leader is first bidder (index 0 in bidOrder)
      gs.subRoundLeaderIndex = 0;
    }
    // currentPlayerIndex = subRoundLeaderIndex (who leads)
    gs.currentPlayerIndex = gs.subRoundLeaderIndex;
  }

  isLegalCard(playerId, cardId) {
    const gs = this.gameState;
    const hand = gs.hands[playerId];
    const card = hand?.find(c => c.id === cardId);
    if (!card) return { legal: false, error: 'Card not in hand' };

    if (gs.table.length === 0) return { legal: true }; // leading — any card

    const baseSuit = gs.table[0].card.suit;
    const hasBaseSuit = hand.some(c => c.suit === baseSuit);
    if (hasBaseSuit && card.suit !== baseSuit) {
      return { legal: false, error: `You must play a ${baseSuit} card` };
    }
    return { legal: true };
  }

  playCard(playerId, cardId, autoPlayed = false) {
    const gs = this.gameState;
    if (gs.phase !== PHASES.PLAYING) return { error: 'Not in playing phase' };

    const currentPlayerId = gs.bidOrder[gs.currentPlayerIndex % this.players.length];
    if (!autoPlayed && currentPlayerId !== playerId) return { error: 'Not your turn' };

    const legalCheck = this.isLegalCard(playerId, cardId);
    if (!legalCheck.legal) return { error: legalCheck.error };

    // Remove card from hand
    const hand = gs.hands[playerId];
    const cardIdx = hand.findIndex(c => c.id === cardId);
    const [card] = hand.splice(cardIdx, 1);

    gs.table.push({ playerId, card, autoPlayed });
    gs.currentPlayerIndex = (gs.currentPlayerIndex + 1) % this.players.length;

    // Check if all players have played
    if (gs.table.length === this.players.length) {
      return this.resolveSubRound();
    }

    return { success: true, cardPlayed: card };
  }

  resolveSubRound() {
    const gs = this.gameState;
    const baseSuit = gs.table[0].card.suit;
    const trumpSuit = gs.trumpSuit;

    // Find winner per §2.5.3
    let winner = null;
    let winnerEntry = null;

    for (const entry of gs.table) {
      const { card } = entry;
      const isTrump = card.suit === trumpSuit;
      const isBase = card.suit === baseSuit;

      if (!winner) {
        winner = entry;
        winnerEntry = entry;
        continue;
      }

      const winIsTrump = winnerEntry.card.suit === trumpSuit;
      const winIsBase = winnerEntry.card.suit === baseSuit;

      if (isTrump && winIsTrump) {
        if (card.value > winnerEntry.card.value) {
          winner = entry; winnerEntry = entry;
        }
      } else if (isTrump && !winIsTrump) {
        winner = entry; winnerEntry = entry;
      } else if (isBase && !winIsTrump) {
        if (card.value > winnerEntry.card.value) {
          winner = entry; winnerEntry = entry;
        }
      }
      // waste card — cannot win
    }

    const winnerId = winnerEntry.playerId;
    gs.tricksWon[winnerId] = (gs.tricksWon[winnerId] || 0) + 1;

    // Next sub-round leader
    gs.subRoundLeaderIndex = gs.bidOrder.indexOf(winnerId);

    const subRoundResult = {
      winnerId,
      winnerName: this.getPlayer(winnerId)?.name,
      table: [...gs.table],
      baseSuit,
    };

    // Check if round is done
    if (gs.currentSubRound >= gs.currentRound) {
      return this.endRound(subRoundResult);
    }

    this.startSubRound(gs.currentSubRound); // increment sub-round
    return { success: true, subRoundEnd: true, subRoundResult };
  }

  endRound(lastSubRoundResult) {
    const gs = this.gameState;
    const playerIds = this.players.map(p => p.id);
    const roundScores = calculateRoundScores(gs.bids, gs.tricksWon, playerIds);

    gs.scores.push({
      round: gs.currentRound,
      bids: { ...gs.bids },
      tricksWon: { ...gs.tricksWon },
      points: roundScores,
    });

    gs.phase = PHASES.ROUND_END;

    const cumulativeScores = this.getCumulativeScores();

    if (gs.currentRound >= this.config.numRounds) {
      gs.phase = PHASES.GAME_OVER;
      return {
        success: true,
        roundEnd: true,
        lastSubRoundResult,
        roundScores,
        cumulativeScores,
        gameOver: true,
      };
    }

    return {
      success: true,
      roundEnd: true,
      lastSubRoundResult,
      roundScores,
      cumulativeScores,
      gameOver: false,
    };
  }

  advanceToNextRound() {
    const gs = this.gameState;
    if (gs.phase !== PHASES.ROUND_END) return { error: 'Not at round end' };
    this.startRound(gs.currentRound + 1);
    return { success: true };
  }

  getCumulativeScores() {
    const totals = {};
    this.players.forEach(p => { totals[p.id] = 0; });
    for (const round of this.gameState.scores) {
      for (const [pid, pts] of Object.entries(round.points)) {
        totals[pid] = (totals[pid] || 0) + pts;
      }
    }
    return totals;
  }

  getCurrentPlayerInfo() {
    const gs = this.gameState;
    if (gs.phase === PHASES.BIDDING || gs.phase === PHASES.PLAYING) {
      const pid = gs.bidOrder[gs.currentPlayerIndex % this.players.length];
      return this.getPlayer(pid);
    }
    return null;
  }

  getAutoPlayCard(playerId) {
    const gs = this.gameState;
    const hand = gs.hands[playerId];
    const baseSuit = gs.table.length > 0 ? gs.table[0].card.suit : null;
    return selectAutoPlayCard(hand, baseSuit, gs.trumpSuit);
  }

  getPublicState() {
    const gs = this.gameState;
    return {
      phase: gs.phase,
      currentRound: gs.currentRound,
      currentSubRound: gs.currentSubRound,
      trumpSuit: gs.trumpSuit,
      bids: gs.bids,
      tricksWon: gs.tricksWon,
      table: gs.table,
      scores: gs.scores,
      currentPlayerId: gs.bidOrder?.[gs.currentPlayerIndex % this.players.length],
      bidOrder: gs.bidOrder,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.id === this.hostId,
      })),
      config: this.config,
      cumulativeScores: this.getCumulativeScores(),
    };
  }

  getStateForPlayer(playerId) {
    return {
      ...this.getPublicState(),
      myHand: this.gameState.hands[playerId] || [],
      myId: playerId,
    };
  }

  addChatMessage(playerId, text) {
    const player = this.getPlayer(playerId);
    const msg = {
      playerName: player?.name || 'Unknown',
      playerId,
      text: text.slice(0, 500),
      ts: Date.now(),
    };
    this.chatLog.push(msg);
    if (this.chatLog.length > 60) this.chatLog.shift();
    return msg;
  }
}

module.exports = { Room, PHASES };
