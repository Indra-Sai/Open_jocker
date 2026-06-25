// room.js — Room state machine

const { createMultiDeck, shuffle, calcNumDecks, dealCards, pickTrumpSuit, SUITS } = require('./deck');
const { calculatePoints, calculateRoundScores } = require('./scoring');
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
    const maxRoundsWith1Deck = Math.floor(52 / config.numPlayers);
    const requestedDecks = config.numDecks === 2 ? 2 : 1;
    const maxRounds = requestedDecks * maxRoundsWith1Deck;
    this.config = {
      numPlayers: config.numPlayers,
      numRounds: Math.min(config.numRounds || 10, maxRounds),
      numDecks:  requestedDecks,
      // Team mode only valid with an even player count
      mode: config.mode === 'team' && config.numPlayers % 2 === 0 ? 'team' : 'single',
    };
    this.teams = []; // populated by assignTeams() when game starts
    this.chatLog = [];
    this.gameState = {
      phase: PHASES.WAITING,
      currentRound: 0,
      currentSubRound: 0,
      trumpSuit: null,
      trumpCard: null,
      bids: {},
      tricksWon: {},
      hands: {},
      table: [],
      scores: [],
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      bidOrder: [],   // bidders only (N/2 in team mode, N in single mode)
      playOrder: [],  // all players in play rotation
      subRoundLeaderIndex: 0,
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

  // Assign teams by joining order: player[i] & player[i + N/2] are a team.
  // Called once at game start.
  assignTeams() {
    if (this.config.mode !== 'team') return;
    const n    = this.players.length;
    const half = n / 2;
    this.teams = Array.from({ length: half }, (_, i) => ({
      id:        `team-${i}`,
      name:      `Team ${i + 1}`,
      memberIds: [this.players[i].id, this.players[i + half].id],
      bidderId:  this.players[i].id, // lower-index member always bids
    }));
  }

  startGame() {
    if (!this.canStart()) return { error: 'Cannot start yet' };
    this.gameState.scores = [];
    this.assignTeams();
    this.startRound(1);
    return { success: true };
  }

  startRound(roundNum) {
    const gs = this.gameState;
    gs.currentRound    = roundNum;
    gs.currentSubRound = 0;
    gs.bids            = {};
    gs.tricksWon       = {};
    gs.table           = [];

    // Deal cards using the host-selected deck count
    const pool = shuffle(createMultiDeck(this.config.numDecks));
    const dealtHands = dealCards(pool, this.players.length, roundNum);
    gs.hands = {};
    this.players.forEach((p, i) => { gs.hands[p.id] = dealtHands[i]; });

    // Trump card: first undealt card after all players' hands
    const cardsDealt = this.players.length * roundNum;
    gs.trumpCard = pool[cardsDealt] || null;
    gs.trumpSuit = gs.trumpCard?.suit || pickTrumpSuit();

    if (this.config.mode === 'team') {
      // bidOrder: one bidder per team, team rotation shifts each round
      const firstTeamIdx = (roundNum - 1) % this.teams.length;
      gs.bidOrder = Array.from({ length: this.teams.length }, (_, i) =>
        this.teams[(firstTeamIdx + i) % this.teams.length].bidderId
      );
      // playOrder: all players starting from same position as the first bidder
      const firstBidderPos = this.players.findIndex(p => p.id === gs.bidOrder[0]);
      gs.playOrder = Array.from({ length: this.players.length }, (_, i) =>
        this.players[(firstBidderPos + i) % this.players.length].id
      );
    } else {
      const firstBidderIdx = (roundNum - 1) % this.players.length;
      gs.bidOrder = Array.from({ length: this.players.length }, (_, i) =>
        this.players[(firstBidderIdx + i) % this.players.length].id
      );
      gs.playOrder = [...gs.bidOrder];
    }

    gs.currentPlayerIndex = 0;
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

    if (gs.currentPlayerIndex >= gs.bidOrder.length) {
      this.startSubRound(0);
    }

    return { success: true };
  }

  startSubRound(subRoundIndex) {
    const gs = this.gameState;
    gs.currentSubRound = subRoundIndex + 1;
    gs.table           = [];
    gs.phase           = PHASES.PLAYING;

    if (subRoundIndex === 0) {
      gs.subRoundLeaderIndex = 0;
    }
    gs.currentPlayerIndex = gs.subRoundLeaderIndex;
  }

  isLegalCard(playerId, cardId) {
    const gs   = this.gameState;
    const hand = gs.hands[playerId];
    const card = hand?.find(c => c.id === cardId);
    if (!card) return { legal: false, error: 'Card not in hand' };

    if (gs.table.length === 0) return { legal: true };

    const baseSuit    = gs.table[0].card.suit;
    const hasBaseSuit = hand.some(c => c.suit === baseSuit);
    if (hasBaseSuit && card.suit !== baseSuit) {
      return { legal: false, error: `You must play a ${baseSuit} card` };
    }
    return { legal: true };
  }

  playCard(playerId, cardId, autoPlayed = false) {
    const gs = this.gameState;
    if (gs.phase !== PHASES.PLAYING) return { error: 'Not in playing phase' };

    const currentPlayerId = gs.playOrder[gs.currentPlayerIndex % this.players.length];
    if (!autoPlayed && currentPlayerId !== playerId) return { error: 'Not your turn' };

    const legalCheck = this.isLegalCard(playerId, cardId);
    if (!legalCheck.legal) return { error: legalCheck.error };

    const hand    = gs.hands[playerId];
    const cardIdx = hand.findIndex(c => c.id === cardId);
    const [card]  = hand.splice(cardIdx, 1);

    gs.table.push({ playerId, card, autoPlayed });
    gs.currentPlayerIndex = (gs.currentPlayerIndex + 1) % this.players.length;

    if (gs.table.length === this.players.length) {
      return this.resolveSubRound();
    }

    return { success: true, cardPlayed: card };
  }

  resolveSubRound() {
    const gs       = this.gameState;
    const baseSuit = gs.table[0].card.suit;
    const trumpSuit = gs.trumpSuit;

    let winnerEntry = null;

    for (const entry of gs.table) {
      const { card } = entry;
      const isTrump  = card.suit === trumpSuit;
      const isBase   = card.suit === baseSuit;

      if (!winnerEntry) { winnerEntry = entry; continue; }

      const winIsTrump = winnerEntry.card.suit === trumpSuit;

      if (isTrump && winIsTrump) {
        if (card.value > winnerEntry.card.value) winnerEntry = entry;
      } else if (isTrump && !winIsTrump) {
        winnerEntry = entry;
      } else if (isBase && !winIsTrump) {
        if (card.value > winnerEntry.card.value) winnerEntry = entry;
      }
    }

    const winnerId = winnerEntry.playerId;
    gs.tricksWon[winnerId] = (gs.tricksWon[winnerId] || 0) + 1;

    gs.subRoundLeaderIndex = gs.playOrder.indexOf(winnerId);

    const subRoundResult = {
      winnerId,
      winnerName: this.getPlayer(winnerId)?.name,
      table: [...gs.table],
      baseSuit,
    };

    if (gs.currentSubRound >= gs.currentRound) {
      return this.endRound(subRoundResult);
    }

    this.startSubRound(gs.currentSubRound);
    return { success: true, subRoundEnd: true, subRoundResult };
  }

  endRound(lastSubRoundResult) {
    const gs = this.gameState;
    let roundScores;

    if (this.config.mode === 'team') {
      roundScores = {};
      for (const team of this.teams) {
        const teamTricks = team.memberIds.reduce((sum, pid) => sum + (gs.tricksWon[pid] || 0), 0);
        const teamBid    = gs.bids[team.bidderId];
        const pts        = calculatePoints(teamBid, teamTricks);
        for (const pid of team.memberIds) {
          roundScores[pid] = pts;
        }
      }
    } else {
      const playerIds = this.players.map(p => p.id);
      roundScores = calculateRoundScores(gs.bids, gs.tricksWon, playerIds);
    }

    gs.scores.push({
      round:      gs.currentRound,
      bids:       { ...gs.bids },
      tricksWon:  { ...gs.tricksWon },
      points:     roundScores,
    });

    gs.phase = PHASES.ROUND_END;

    const cumulativeScores = this.getCumulativeScores();

    if (gs.currentRound >= this.config.numRounds) {
      gs.phase = PHASES.GAME_OVER;
      return { success: true, roundEnd: true, lastSubRoundResult, roundScores, cumulativeScores, gameOver: true };
    }

    return { success: true, roundEnd: true, lastSubRoundResult, roundScores, cumulativeScores, gameOver: false };
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
    if (gs.phase === PHASES.BIDDING) {
      const pid = gs.bidOrder[gs.currentPlayerIndex % gs.bidOrder.length];
      return this.getPlayer(pid);
    }
    if (gs.phase === PHASES.PLAYING) {
      const pid = gs.playOrder[gs.currentPlayerIndex % this.players.length];
      return this.getPlayer(pid);
    }
    return null;
  }

  getAutoPlayCard(playerId) {
    const gs      = this.gameState;
    const hand    = gs.hands[playerId];
    const baseSuit = gs.table.length > 0 ? gs.table[0].card.suit : null;
    return selectAutoPlayCard(hand, baseSuit, gs.trumpSuit);
  }

  kickPlayer(targetId) {
    if (this.gameState.phase !== PHASES.WAITING) return { error: 'Can only kick during waiting room' };
    if (targetId === this.hostId) return { error: 'Cannot kick the host' };
    const idx = this.players.findIndex(p => p.id === targetId);
    if (idx === -1) return { error: 'Player not found' };
    const [removed] = this.players.splice(idx, 1);
    return { success: true, removed };
  }

  resetForRematch() {
    if (this.gameState.phase !== PHASES.GAME_OVER) return { error: 'Game not over yet' };
    this.gameState = {
      phase: PHASES.WAITING,
      currentRound: 0,
      currentSubRound: 0,
      trumpSuit: null,
      trumpCard: null,
      bids: {}, tricksWon: {}, hands: {}, table: [], scores: [],
      currentPlayerIndex: 0, leadPlayerIndex: 0,
      bidOrder: [], playOrder: [], subRoundLeaderIndex: 0,
    };
    this.teams = [];
    this.autoPlayTimers = {};
    return { success: true };
  }

  extendGame(additionalRounds) {
    if (this.gameState.phase !== PHASES.GAME_OVER && this.gameState.phase !== PHASES.ROUND_END) {
      return { error: 'Can only extend at round end or game over' };
    }
    const n = Number(additionalRounds);
    if (!Number.isInteger(n) || n < 1 || n > 10) return { error: 'Additional rounds must be 1–10' };
    this.config.numRounds += n;
    // If was game_over, roll back to round_end so advanceToNextRound works
    if (this.gameState.phase === PHASES.GAME_OVER) {
      this.gameState.phase = PHASES.ROUND_END;
    }
    return { success: true };
  }

  getPublicState() {
    const gs = this.gameState;
    const currentPlayerId = gs.phase === PHASES.BIDDING
      ? gs.bidOrder?.[gs.currentPlayerIndex % (gs.bidOrder?.length || 1)]
      : gs.playOrder?.[gs.currentPlayerIndex % this.players.length];

    return {
      phase:            gs.phase,
      currentRound:     gs.currentRound,
      currentSubRound:  gs.currentSubRound,
      trumpSuit:        gs.trumpSuit,
      trumpCard:        gs.trumpCard,
      bids:             gs.bids,
      tricksWon:        gs.tricksWon,
      table:            gs.table,
      scores:           gs.scores,
      currentPlayerId,
      bidOrder:         gs.bidOrder,
      playOrder:        gs.playOrder,
      players: this.players.map(p => ({
        id:        p.id,
        name:      p.name,
        connected: p.connected,
        isHost:    p.id === this.hostId,
        socketId:  p.socketId,
      })),
      config:           this.config,
      cumulativeScores: this.getCumulativeScores(),
      mode:             this.config.mode,
      teams:            this.config.mode === 'team' ? this.teams : null,
    };
  }

  getStateForPlayer(playerId) {
    return {
      ...this.getPublicState(),
      myHand: this.gameState.hands[playerId] || [],
      myId:   playerId,
    };
  }

  addChatMessage(playerId, text) {
    const player = this.getPlayer(playerId);
    const msg = {
      playerName: player?.name || 'Unknown',
      playerId,
      text: text.slice(0, 500),
      ts:   Date.now(),
    };
    this.chatLog.push(msg);
    if (this.chatLog.length > 60) this.chatLog.shift();
    return msg;
  }
}

module.exports = { Room, PHASES };
