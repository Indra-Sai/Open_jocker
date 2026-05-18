// server/index.js — Express + Socket.io entry point

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Room, PHASES } = require('./game/room');
const { registerVoiceHandlers } = require('./voice/signalling');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 60000,   // generous — prevents mobile network hiccups from dropping players
});

const PORT = process.env.PORT || 3001;

// ── Logger ─────────────────────────────────────────────────────
function log(level, roomCode, msg, data = {}) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}]${roomCode ? ` [${roomCode}]` : '        '}`;
  const dataStr = Object.keys(data).length ? '  ' + JSON.stringify(data) : '';
  console.log(`${prefix} ${msg}${dataStr}`);
}

// Serve static React build
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.use(express.json());

app.get('/health', (req, res) => {
  const summary = [...rooms.entries()].map(([code, r]) => ({
    code, players: r.players.length, phase: r.gameState.phase,
    round: r.gameState.currentRound,
  }));
  res.json({ status: 'ok', rooms: rooms.size, summary });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// In-memory room store
const rooms = new Map();
const socketToPlayer = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

// ── Broadcast helpers ───────────────────────────────────────────
function broadcastGameState(room, eventName = 'game_state_update') {
  let sent = 0;
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit(eventName, room.getStateForPlayer(player.id));
      sent++;
    }
  }
  log('debug', room.roomCode, `broadcastGameState(${eventName}) → ${sent} players`, {
    phase: room.gameState.phase,
    round: room.gameState.currentRound,
    subRound: room.gameState.currentSubRound,
  });
}

function broadcastRoomEvent(room, event) {
  io.to(room.roomCode).emit('room_event', event);
  log('debug', room.roomCode, `roomEvent:${event.type}`);
}

// ── Auto-play ───────────────────────────────────────────────────
const AUTO_PLAY_DELAY = 8000;

function scheduleAutoPlay(room) {
  const gs = room.gameState;
  if (gs.phase !== PHASES.PLAYING && gs.phase !== PHASES.BIDDING) return;

  // In team mode bidOrder has fewer entries than players; use playOrder during playing.
  const currentPlayerId = gs.phase === PHASES.BIDDING
    ? gs.bidOrder?.[gs.currentPlayerIndex % (gs.bidOrder?.length || 1)]
    : gs.playOrder?.[gs.currentPlayerIndex % room.players.length];
  if (!currentPlayerId) return;

  const player = room.getPlayer(currentPlayerId);
  if (!player || player.connected) return;

  if (room.autoPlayTimers[currentPlayerId]) clearTimeout(room.autoPlayTimers[currentPlayerId]);

  log('info', room.roomCode, `Auto-play queued for ${player.name} in ${AUTO_PLAY_DELAY}ms`, { phase: gs.phase });

  room.autoPlayTimers[currentPlayerId] = setTimeout(() => {
    const currentRoom = rooms.get(room.roomCode);
    if (!currentRoom) return;

    const gs2 = currentRoom.gameState;
    const orderLen = gs2.phase === PHASES.BIDDING
      ? (gs2.bidOrder?.length || 1)
      : currentRoom.players.length;
    const idx = gs2.currentPlayerIndex % orderLen;
    const orderArr = gs2.phase === PHASES.BIDDING ? gs2.bidOrder : gs2.playOrder;
    const stillCurrent = orderArr?.[idx] === currentPlayerId;
    const stillDisconnected = !currentRoom.getPlayer(currentPlayerId)?.connected;

    if (!stillCurrent || !stillDisconnected) {
      log('debug', room.roomCode, `Auto-play cancelled for ${player.name}`);
      return;
    }

    if (gs2.phase === PHASES.BIDDING) {
      const result = currentRoom.submitBid(currentPlayerId, 0);
      log('info', room.roomCode, `Auto-bid 0 for ${player.name}`, { ok: !!result.success });
      broadcastRoomEvent(currentRoom, { type: 'auto_bid', playerName: player.name, bid: 0 });
      if (result.success) { broadcastGameState(currentRoom); scheduleAutoPlay(currentRoom); }
    } else if (gs2.phase === PHASES.PLAYING) {
      const autoCard = currentRoom.getAutoPlayCard(currentPlayerId);
      if (!autoCard) { log('warn', room.roomCode, `No auto-play card for ${player.name}`); return; }

      const result = currentRoom.playCard(currentPlayerId, autoCard.id, true);
      log('info', room.roomCode, `Auto-played ${autoCard.rank}${autoCard.suit} for ${player.name}`, {
        roundEnd: !!result.roundEnd, subRoundEnd: !!result.subRoundEnd,
      });
      broadcastRoomEvent(currentRoom, { type: 'auto_play', playerName: player.name, card: autoCard });

      if (result.error) return;
      if (result.subRoundEnd || result.roundEnd) showAndFinalizeTrick(currentRoom, result);
      else { broadcastGameState(currentRoom); scheduleAutoPlay(currentRoom); }
    }
  }, AUTO_PLAY_DELAY);
}

// ── Trick display delay ────────────────────────────────────────
// How long (ms) the completed trick stays on screen before the table clears.
const TRICK_DISPLAY_MS = 1600;

// Step 2 (called after the display delay): clear table and advance to next phase.
function finalizeTrick(roomCode, result) {
  const r = rooms.get(roomCode);
  if (!r) return;
  r.gameState.table = [];

  if (result.roundEnd) {
    broadcastGameState(r);
    log('info', roomCode, `Round ${r.gameState.currentRound} complete`, {
      gameOver: result.gameOver, scores: result.roundScores,
    });
    broadcastRoomEvent(r, {
      type: 'round_end',
      round: r.gameState.scores[r.gameState.scores.length - 1],
      cumulativeScores: result.cumulativeScores,
      gameOver: result.gameOver,
    });
    if (!result.gameOver) {
      setTimeout(() => {
        const r2 = rooms.get(roomCode);
        if (!r2 || r2.gameState.phase !== PHASES.ROUND_END) {
          log('debug', roomCode, 'Auto-advance skipped — phase already changed');
          return;
        }
        log('info', roomCode, `Auto-advancing to round ${r2.gameState.currentRound + 1}`);
        r2.advanceToNextRound();
        broadcastGameState(r2);
        scheduleAutoPlay(r2);
      }, 5000);
    }
  } else {
    broadcastGameState(r);
    scheduleAutoPlay(r);
  }
}

// Step 1: restore trick cards on table, broadcast so players can see them, then delay.
function showAndFinalizeTrick(room, result) {
  const roomCode = room.roomCode;
  // resolveSubRound() already cleared gs.table; put the cards back temporarily.
  const subRoundResult = result.subRoundResult || result.lastSubRoundResult;
  room.gameState.table = subRoundResult?.table || [];
  broadcastGameState(room); // all clients see the completed trick
  if (subRoundResult) {
    log('info', roomCode, `Trick won by ${subRoundResult.winnerName}`, {
      subRound: room.gameState.currentSubRound,
    });
    broadcastRoomEvent(room, { type: 'sub_round_end', ...subRoundResult });
  }
  setTimeout(() => finalizeTrick(roomCode, result), TRICK_DISPLAY_MS);
}

// ── Socket events ──────────────────────────────────────────────
io.on('connection', (socket) => {
  log('info', null, `Socket connected ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ playerName, config }) => {
    if (!playerName?.trim()) return socket.emit('room_error', { message: 'Name required' });
    const playerId = uuidv4();
    const roomCode = generateRoomCode();
    const room = new Room(roomCode, playerId, playerName.trim(), config);
    room.setSocketId(playerId, socket.id);
    rooms.set(roomCode, room);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, playerId });
    broadcastGameState(room);
    log('info', roomCode, `Created by ${playerName}`, { config });
  });

  // Join Room
  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = roomCode?.toUpperCase();
    const room = rooms.get(code);
    if (!room) { log('warn', code, `Join failed — not found`); return socket.emit('room_error', { message: 'Room not found' }); }

    const playerId = uuidv4();
    const result = room.addPlayer(playerId, playerName?.trim());
    if (result.error) { log('warn', code, `Join failed: ${result.error}`); return socket.emit('room_error', { message: result.error }); }

    room.setSocketId(playerId, socket.id);
    socketToPlayer.set(socket.id, { roomCode: code, playerId });
    socket.join(code);
    socket.emit('room_joined', { roomCode: code, playerId });
    broadcastGameState(room);
    broadcastRoomEvent(room, { type: 'player_joined', playerName });
    log('info', code, `${playerName} joined (${room.players.length}/${room.config.numPlayers})`);
  });

  // Reconnect
  socket.on('reconnect_room', ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('room_error', { message: 'Room not found' });
    const player = room.getPlayer(playerId);
    if (!player) return socket.emit('room_error', { message: 'Player not found' });

    player.socketId = socket.id;
    player.connected = true;
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    if (room.autoPlayTimers[playerId]) {
      clearTimeout(room.autoPlayTimers[playerId]);
      delete room.autoPlayTimers[playerId];
    }

    socket.emit('reconnected', { playerId });
    socket.emit('game_state_snapshot', room.getStateForPlayer(playerId));
    broadcastRoomEvent(room, { type: 'player_reconnected', playerName: player.name });
    broadcastGameState(room);
    log('info', roomCode, `${player.name} reconnected`);
  });

  // Start Game
  socket.on('start_game', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    if (room.hostId !== info.playerId) return socket.emit('room_error', { message: 'Only host can start' });

    const result = room.startGame();
    if (result.error) { log('warn', info.roomCode, `Start failed: ${result.error}`); return socket.emit('room_error', { message: result.error }); }

    log('info', info.roomCode, `Game started`, { rounds: room.config.numRounds, players: room.players.map(p => p.name) });
    broadcastGameState(room, 'game_started');
    scheduleAutoPlay(room);
  });

  // Submit Bid
  socket.on('submit_bid', ({ bid }) => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;

    const playerName = room.getPlayer(info.playerId)?.name;
    const result = room.submitBid(info.playerId, Number(bid));
    if (result.error) { log('warn', info.roomCode, `Bid rejected for ${playerName}: ${result.error}`); return socket.emit('game_error', { message: result.error }); }

    log('info', info.roomCode, `${playerName} bid ${bid}`, { round: room.gameState.currentRound, phase: room.gameState.phase });
    broadcastRoomEvent(room, { type: 'bid_submitted', playerName, bid });
    broadcastGameState(room);
    scheduleAutoPlay(room);
  });

  // Play Card
  socket.on('play_card', ({ cardId }) => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;

    const playerName = room.getPlayer(info.playerId)?.name;
    const legalCheck = room.isLegalCard(info.playerId, cardId);
    if (!legalCheck.legal) { log('warn', info.roomCode, `Illegal card by ${playerName}: ${legalCheck.error}`); return socket.emit('game_error', { message: legalCheck.error }); }

    const result = room.playCard(info.playerId, cardId);
    if (result.error) { log('warn', info.roomCode, `playCard error: ${result.error}`); return socket.emit('game_error', { message: result.error }); }

    log('info', info.roomCode, `${playerName} played ${cardId}`, {
      sub: room.gameState.currentSubRound,
      table: room.gameState.table.length,
      roundEnd: !!result.roundEnd,
    });

    if (result.subRoundEnd || result.roundEnd) showAndFinalizeTrick(room, result);
    else { broadcastGameState(room); scheduleAutoPlay(room); }
  });

  // Chat
  socket.on('chat_message', ({ text }) => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const msg = room.addChatMessage(info.playerId, text);
    io.to(info.roomCode).emit('chat_broadcast', msg);
  });

  // Request Scoreboard
  socket.on('request_scoreboard', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    socket.emit('scoreboard_data', {
      scores: room.gameState.scores,
      cumulativeScores: room.getCumulativeScores(),
      players: room.players,
    });
  });

  // FIX #2 & #3: Skip Round Summary — advances game AND broadcasts to ALL clients
  socket.on('skip_round_summary', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || room.hostId !== info.playerId) return;
    if (room.gameState.phase !== PHASES.ROUND_END) {
      log('debug', info.roomCode, `skip_round_summary ignored — phase is ${room.gameState.phase}`);
      return;
    }
    log('info', info.roomCode, `Host skipped round summary → advancing to round ${room.gameState.currentRound + 1}`);
    room.advanceToNextRound();
    // All clients receive phase=bidding → their stores auto-dismiss the round summary modal
    broadcastGameState(room);
    scheduleAutoPlay(room);
  });

  // End Game (host only — force game over immediately)
  socket.on('end_game', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || room.hostId !== info.playerId) return;
    if (room.gameState.phase === PHASES.GAME_OVER) return;

    log('info', info.roomCode, `Host ended game early at round ${room.gameState.currentRound}`);
    room.gameState.phase = PHASES.GAME_OVER;
    broadcastGameState(room);
  });

  // Voice (WebRTC signalling)
  registerVoiceHandlers(io, socket, rooms, socketToPlayer);

  // Disconnect
  socket.on('disconnect', (reason) => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (room) {
      room.setConnected(info.playerId, false);
      const player = room.getPlayer(info.playerId);
      log('info', info.roomCode, `${player?.name} disconnected`, { reason });
      broadcastRoomEvent(room, { type: 'player_disconnected', playerName: player?.name });
      broadcastGameState(room);

      if (room.players.every(p => !p.connected)) {
        setTimeout(() => {
          const r = rooms.get(info.roomCode);
          if (r && r.players.every(p => !p.connected)) {
            rooms.delete(info.roomCode);
            log('info', info.roomCode, `Room cleaned up (all gone)`);
          }
        }, 30 * 60 * 1000);
      }
      scheduleAutoPlay(room);
    }
    socketToPlayer.delete(socket.id);
  });
});

server.listen(PORT, () => {
  log('info', null, `🃏 Open Jocker server running on port ${PORT}`);
  log('info', null, `Health: http://localhost:${PORT}/health`);
});
