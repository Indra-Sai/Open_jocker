// hooks/useSocket.js

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useGameStore from '../store/gameStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export function useSocket() {
  const socketRef = useRef(null);
  const store = useGameStore();

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    store.setSocket(socket);

    socket.on('connect', () => {
      store.setConnected(true);
      // Attempt reconnection if we have saved credentials
      const saved = sessionStorage.getItem('openjocker_session');
      if (saved) {
        const { roomCode, playerId } = JSON.parse(saved);
        socket.emit('reconnect_room', { roomCode, playerId });
      }
    });

    socket.on('disconnect', () => store.setConnected(false));

    socket.on('room_created', ({ roomCode, playerId }) => {
      store.setRoomCode(roomCode);
      store.setPlayerId(playerId);
      sessionStorage.setItem('openjocker_session', JSON.stringify({ roomCode, playerId }));
    });

    socket.on('room_joined', ({ roomCode, playerId }) => {
      store.setRoomCode(roomCode);
      store.setPlayerId(playerId);
      sessionStorage.setItem('openjocker_session', JSON.stringify({ roomCode, playerId }));
    });

    socket.on('reconnected', ({ playerId }) => {
      // Restore identity into the store so the App renders the correct screen.
      // After a page refresh Zustand is empty; game_state_snapshot fills gameState
      // but roomCode/playerId must be set here so the routing condition fires.
      const saved = sessionStorage.getItem('openjocker_session');
      if (saved) {
        const { roomCode } = JSON.parse(saved);
        store.setRoomCode(roomCode);
        store.setPlayerId(playerId);
      }
    });

    socket.on('game_state_update', (state) => store.setGameState(state));
    socket.on('game_started', (state) => store.setGameState(state));
    socket.on('game_state_snapshot', (state) => store.setGameState(state));

    socket.on('room_error', ({ message }) => {
      store.setError(message);
      // If a reconnect attempt failed (no gameState loaded yet), clear the stale
      // session so the user lands on the home screen, not a broken reconnect loop.
      if (message === 'Room not found' || message === 'Player not found') {
        const currentState = useGameStore.getState();
        if (!currentState.gameState) {
          sessionStorage.removeItem('openjocker_session');
        }
      }
    });
    socket.on('game_error', ({ message }) => store.setError(message));

    socket.on('chat_broadcast', (msg) => store.addChatMessage(msg));

    socket.on('room_event', (event) => {
      if (event.type === 'sub_round_end') {
        store.setSubRoundResult(event);
      }
      if (event.type === 'round_end') {
        store.setRoundSummary(event);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
