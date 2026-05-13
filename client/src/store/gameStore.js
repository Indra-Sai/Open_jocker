// store/gameStore.js — Zustand store for all game state

import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // Connection
  socket: null,
  connected: false,

  // Identity
  playerId: null,
  roomCode: null,

  // Game state (mirrors server)
  gameState: null,

  // Chat
  chatMessages: [],
  chatOpen: false,

  // UI
  error: null,
  showScoreboard: false,
  showTrumpReveal: false,
  trumpRevealSuit: null,
  lastSubRoundResult: null,
  showSubRoundResult: false,
  showRoundSummary: false,
  lastRoundData: null,
  lastTrickWinner: null,   // playerId of last trick winner, for toast in GameTable

  // Voice
  isMuted: true,
  speakingPeers: {},

  // Actions
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setPlayerId: (playerId) => set({ playerId }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setError: (error) => set({ error }),

  setGameState: (gameState) => {
    const prev = get().gameState;

    if (gameState && prev) {
      const roundChanged = prev.currentRound !== gameState.currentRound;
      const newGame = prev.phase === 'waiting' && gameState.phase === 'bidding';

      // Show trump reveal whenever a new round starts
      if ((roundChanged || newGame) && gameState.trumpSuit) {
        // Clear any existing trump reveal timer
        set({ showTrumpReveal: true, trumpRevealSuit: gameState.trumpSuit });
        setTimeout(() => set({ showTrumpReveal: false }), 3000);
      }

      // Bug fix #2/#3: auto-dismiss round summary when server transitions to next round
      // This ensures ALL clients dismiss it, not just the one who clicked Skip
      const leavingRoundEnd = prev.phase === 'round_end' && gameState.phase !== 'round_end';
      if (leavingRoundEnd && get().showRoundSummary) {
        set({ showRoundSummary: false, lastRoundData: null });
      }
    }

    set({ gameState });
  },

  addChatMessage: (msg) => set(state => ({
    chatMessages: [...state.chatMessages.slice(-59), msg],
  })),

  setChatOpen: (open) => set({ chatOpen: open }),
  setShowScoreboard: (v) => set({ showScoreboard: v }),

  setSubRoundResult: (result) => {
    set({ lastSubRoundResult: result, showSubRoundResult: true, lastTrickWinner: result.winnerId || null });
    setTimeout(() => set({ showSubRoundResult: false, lastTrickWinner: null }), 2500);
  },

  setRoundSummary: (data) => set({ showRoundSummary: true, lastRoundData: data }),
  dismissRoundSummary: () => set({ showRoundSummary: false, lastRoundData: null }),

  setMuted: (muted) => set({ isMuted: muted }),
  setSpeakingPeer: (socketId, speaking) => set(state => ({
    speakingPeers: { ...state.speakingPeers, [socketId]: speaking },
  })),

  reset: () => set({
    playerId: null, roomCode: null, gameState: null,
    chatMessages: [], error: null, showScoreboard: false,
    showTrumpReveal: false, showSubRoundResult: false,
    showRoundSummary: false, lastRoundData: null,
  }),
}));

export default useGameStore;
