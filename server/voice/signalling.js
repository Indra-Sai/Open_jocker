// voice/signalling.js — WebRTC signalling relay via Socket.io

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
    // Look up the room from the server-side map — never trust client-sent roomCode
    const info = socketToPlayer.get(socket.id);
    if (!info?.roomCode) return;
    socket.to(info.roomCode).emit('peer_voice_ready', { socketId: socket.id });
  });
}

module.exports = { registerVoiceHandlers };
