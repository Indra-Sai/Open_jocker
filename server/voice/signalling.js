// voice/signalling.js — WebRTC signalling relay via Socket.io

// Per-room set of currently voice-active socket IDs.
// When a new user enables voice, we send them this list so they can initiate
// connections with all peers who were already in voice before them.
const roomVoiceUsers = new Map(); // roomCode -> Set<socketId>

function registerVoiceHandlers(io, socket, rooms, socketToPlayer) {
  socket.on('webrtc_signal', ({ targetSocketId, signal }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_signal', {
        fromSocketId: socket.id,
        signal,
      });
    }
  });

  socket.on('voice_ready', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info?.roomCode) return;
    const { roomCode } = info;

    if (!roomVoiceUsers.has(roomCode)) {
      roomVoiceUsers.set(roomCode, new Set());
    }
    const voiceUsers = roomVoiceUsers.get(roomCode);

    // 1. Notify all OTHER voice users about this new participant
    socket.to(roomCode).emit('peer_voice_ready', { socketId: socket.id });

    // 2. Tell THIS user about everyone who is already in voice so they can
    //    establish connections with pre-existing peers (the missing 3-way link).
    for (const existingId of voiceUsers) {
      socket.emit('peer_voice_ready', { socketId: existingId });
    }

    voiceUsers.add(socket.id);
  });

  // Client emits this when the user clicks the disable-voice button
  socket.on('voice_stop', () => {
    const info = socketToPlayer.get(socket.id);
    if (info?.roomCode) {
      roomVoiceUsers.get(info.roomCode)?.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    const info = socketToPlayer.get(socket.id);
    if (info?.roomCode) {
      roomVoiceUsers.get(info.roomCode)?.delete(socket.id);
    }
  });
}

module.exports = { registerVoiceHandlers };
