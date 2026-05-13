// voice/signalling.js — WebRTC signalling relay via Socket.io

function registerVoiceHandlers(io, socket, rooms) {
  socket.on('webrtc_signal', ({ targetSocketId, signal }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_signal', {
        fromSocketId: socket.id,
        signal,
      });
    }
  });

  socket.on('voice_ready', ({ roomCode }) => {
    // Notify others in room that this peer is ready for voice connections
    socket.to(roomCode).emit('peer_voice_ready', {
      socketId: socket.id,
    });
  });
}

module.exports = { registerVoiceHandlers };
