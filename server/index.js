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
  pingInterval: 10000,
  pingTimeout: 5000,
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

  const currentPlayerId = gs.bidOrder?.[gs.currentPlayerIndex % room.players.length];
  if (!currentPlayerId) return;

  const player = room.getPlayer(currentPlayerId);
  if (!player || player.connected) return;

  if (room.autoPlayTimers[currentPlayerId]) clearTimeout(room.autoPlayTimers[currentPlayerId]);

  log('info', room.roomCode, `Auto-play queued for ${player.name} in ${AUTO_PLAY_DELAY}ms`, { phase: gs.phase });

  room.autoPlayTimers[currentPlayerId] = setTimeout(() => {
    const currentRoom = rooms.get(room.roomCode);
    if (!currentRoom) return;

    const gs2 = currentRoom.gameState;
    const idx = gs2.currentPlayerIndex % currentRoom.players.length;
    const stillCurrent = gs2.bidOrder?.[idx] === currentPlayerId;
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
      broadcastGameState(currentRoom);
      if (result.subRoundEnd || result.roundEnd) handleRoundOrSubRoundEnd(currentRoom, result);
      else scheduleAutoPlay(currentRoom);
    }
  }, AUTO_PLAY_DELAY);
}

// ── Round / sub-round end ──────────────────────────────────────
function handleRoundOrSubRoundEnd(room, result) {
  if (result.subRoundResult) {
    log('info', room.roomCode, `Trick won by ${result.subRoundResult.winnerName}`, {
      subRound: room.gameState.currentSubRound,
    });
    broadcastRoomEvent(room, { type: 'sub_round_end', ...result.subRoundResult });
  }

  if (result.roundEnd) {
    log('info', room.roomCode, `Round ${room.gameState.currentRound} complete`, {
      gameOver: result.gameOver,
      scores: result.roundScores,
    });

    broadcastRoomEvent(room, {
      type: 'round_end',
      round: room.gameState.scores[room.gameState.scores.length - 1],
      cumulativeScores: result.cumulativeScores,
      gameOver: result.gameOver,
    });

    if (!result.gameOver) {
      // FIX #2 & #3: auto-advance after 5s, broadcast new state to ALL clients.
      // The phase change (round_end → bidding) triggers the client store to
      // auto-dismiss round summary modals for every player.
      setTimeout(() => {
        const r = rooms.get(room.roomCode);
        if (!r) return;
        if (r.gameState.phase !== PHASES.ROUND_END) {
          log('debug', room.roomCode, 'Auto-advance skipped — phase already changed');
          return;
        }
        log('info', room.roomCode, `Auto-advancing to round ${r.gameState.currentRound + 1}`);
        r.advanceToNextRound();
        broadcastGameState(r); // phase=bidding broadcast → clients dismiss modal
        scheduleAutoPlay(r);
      }, 5000);
    }
  } else {
    scheduleAutoPlay(room);
  }
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

    broadcastGameState(room);
    if (result.subRoundEnd || result.roundEnd) handleRoundOrSubRoundEnd(room, result);
    else scheduleAutoPlay(room);
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
  registerVoiceHandlers(io, socket, rooms);

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
