// components/VoiceBar.jsx — mute/unmute + per-player speaking indicator

import { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';

export default function VoiceBar({ socket, players, myId }) {
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const speakingPeers = useGameStore(s => s.speakingPeers);
  const setSpeakingPeer = useGameStore(s => s.setSpeakingPeer);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const streamRef = useRef(null);
  const peersRef = useRef({});       // socketId -> RTCPeerConnection
  const analyserTimers = useRef({}); // socketId -> intervalId

  async function enableVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setVoiceEnabled(true);
      setVoiceError(null);

      // Mute all tracks according to current isMuted state
      stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });

      // Tell server we're ready — other peers will initiate connections
      socket.emit('voice_ready', { roomCode: null }); // roomCode injected server-side
      detectSpeaking(stream, myId);
    } catch (err) {
      setVoiceError('Mic access denied');
      console.warn('Voice init error:', err);
    }
  }

  function toggleMute() {
    const newMuted = !isMuted;
    setMuted(newMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    }
  }

  function disableVoice() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    Object.values(analyserTimers.current).forEach(clearInterval);
    analyserTimers.current = {};
    setVoiceEnabled(false);
  }

  // Detect speaking via AudioContext analyser
  function detectSpeaking(stream, id) {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const timer = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setSpeakingPeer(id, avg > 15);
      }, 100);
      analyserTimers.current[id] = timer;
    } catch { /* AudioContext not available */ }
  }

  // WebRTC signalling
  useEffect(() => {
    if (!socket) return;

    socket.on('peer_voice_ready', ({ socketId }) => {
      if (!voiceEnabled || !streamRef.current) return;
      initPeerConnection(socketId, true);
    });

    socket.on('webrtc_signal', ({ fromSocketId, signal }) => {
      if (!voiceEnabled) return;
      if (!peersRef.current[fromSocketId]) {
        initPeerConnection(fromSocketId, false);
      }
      const pc = peersRef.current[fromSocketId];
      if (!pc) return;

      if (signal.type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal))
          .then(() => pc.createAnswer())
          .then(ans => pc.setLocalDescription(ans))
          .then(() => socket.emit('webrtc_signal', { targetSocketId: fromSocketId, signal: pc.localDescription }));
      } else if (signal.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    return () => {
      socket.off('peer_voice_ready');
      socket.off('webrtc_signal');
    };
  }, [socket, voiceEnabled]);

  function initPeerConnection(targetSocketId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peersRef.current[targetSocketId] = pc;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('webrtc_signal', { targetSocketId, signal: candidate });
    };

    pc.ontrack = (e) => {
      const remote = e.streams[0];
      detectSpeaking(remote, targetSocketId);
      // play audio
      const audio = new Audio();
      audio.srcObject = remote;
      audio.autoplay = true;
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('webrtc_signal', { targetSocketId, signal: pc.localDescription }));
    }
  }

  const isSpeaking = speakingPeers[myId];

  return (
    <div className="flex items-center gap-2">
      {/* Speaking indicators for all players */}
      <div className="hidden sm:flex items-center gap-1">
        {players.filter(p => p.id !== myId).map(p => {
          const speaking = speakingPeers[p.socketId] || speakingPeers[p.id];
          return speaking ? (
            <div key={p.id} className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-body">{p.name}</span>
            </div>
          ) : null;
        })}
      </div>

      {/* My speaking indicator */}
      {voiceEnabled && isSpeaking && !isMuted && (
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="You're speaking" />
      )}

      {/* Voice enable / mute / disable button */}
      {!voiceEnabled ? (
        <button
          onClick={enableVoice}
          title="Enable voice chat"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-700 hover:bg-navy-600 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs font-body transition-colors"
        >
          🎙️ Voice
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body transition-all border
              ${isMuted
                ? 'bg-red-900/40 border-red-500/40 text-red-400 hover:bg-red-900/60'
                : 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'}
            `}
          >
            {isMuted ? '🔇 Muted' : '🎙️ Live'}
          </button>
          <button
            onClick={disableVoice}
            title="Disable voice"
            className="px-2 py-1.5 bg-navy-700 hover:bg-red-900/40 border border-white/10 hover:border-red-500/30 rounded-lg text-white/30 hover:text-red-400 text-xs transition-colors"
          >✕</button>
        </div>
      )}

      {voiceError && (
        <span className="text-red-400 text-xs font-body">{voiceError}</span>
      )}
    </div>
  );
}
