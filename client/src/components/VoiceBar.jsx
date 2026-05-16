// components/VoiceBar.jsx
// WebRTC P2P voice chat with Socket.io signalling.
//
// Bugs fixed vs original:
//  1. voice_ready no longer sends roomCode — server looks it up from socketToPlayer
//  2. Audio elements stored in a ref so they aren't garbage-collected
//  3. ICE candidates queued until setRemoteDescription completes
//  4. Socket listeners use named functions + specific .off() to avoid removing other listeners
//  5. voiceEnabled/isMuted state accessed via refs inside callbacks to avoid stale closures

import { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

export default function VoiceBar({ socket, players, myId }) {
  const isMuted         = useGameStore(s => s.isMuted);
  const setMuted        = useGameStore(s => s.setMuted);
  const speakingPeers   = useGameStore(s => s.speakingPeers);
  const setSpeakingPeer = useGameStore(s => s.setSpeakingPeer);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceError,   setVoiceError]   = useState(null);

  // Refs — readable inside callbacks without stale-closure issues
  const streamRef       = useRef(null);
  const voiceOnRef      = useRef(false); // mirrors voiceEnabled
  const isMutedRef      = useRef(isMuted);
  const peersRef        = useRef({});    // socketId -> { pc, pendingCandidates, hasRemote }
  const audioElemsRef   = useRef({});    // socketId -> HTMLAudioElement (kept to prevent GC)
  const analyserTimers  = useRef({});    // id -> intervalId

  // Keep refs in sync with state
  useEffect(() => { voiceOnRef.current  = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { isMutedRef.current  = isMuted;      }, [isMuted]);

  // ── Cleanup helpers ──────────────────────────────────────────
  function cleanupPeer(socketId) {
    const peer = peersRef.current[socketId];
    if (peer) { peer.pc.close(); delete peersRef.current[socketId]; }

    const audio = audioElemsRef.current[socketId];
    if (audio) { audio.srcObject = null; delete audioElemsRef.current[socketId]; }

    if (analyserTimers.current[socketId]) {
      clearInterval(analyserTimers.current[socketId]);
      delete analyserTimers.current[socketId];
    }
    setSpeakingPeer(socketId, false);
  }

  // ── Speaking detection via AudioContext analyser ─────────────
  function detectSpeaking(stream, id) {
    if (analyserTimers.current[id]) clearInterval(analyserTimers.current[id]);
    try {
      const ctx      = new AudioContext();
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyserTimers.current[id] = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setSpeakingPeer(id, avg > 15);
      }, 100);
    } catch { /* AudioContext unavailable */ }
  }

  // ── Create or replace a peer connection ─────────────────────
  function initPeerConnection(targetSocketId, isInitiator) {
    if (peersRef.current[targetSocketId]) cleanupPeer(targetSocketId);

    const pc   = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, pendingCandidates: [], hasRemote: false };
    peersRef.current[targetSocketId] = peer;

    // Add local tracks so the remote can hear us
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    }

    // Send ICE candidates to the remote peer via server relay
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc_signal', {
          targetSocketId,
          signal: candidate.toJSON(),
        });
      }
    };

    // If the connection drops, clean up
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeer(targetSocketId);
      }
    };

    // Incoming audio from remote peer
    pc.ontrack = (e) => {
      const remote = e.streams?.[0];
      if (!remote) return;

      detectSpeaking(remote, targetSocketId);

      // Store element in ref — if it were a plain local variable, the GC would
      // drop it and audio would stop immediately in most browsers.
      if (!audioElemsRef.current[targetSocketId]) {
        audioElemsRef.current[targetSocketId] = document.createElement('audio');
        audioElemsRef.current[targetSocketId].autoplay   = true;
        audioElemsRef.current[targetSocketId].playsInline = true;
      }
      const audio = audioElemsRef.current[targetSocketId];
      audio.srcObject = remote;
      audio.play().catch(() => {
        // Autoplay blocked (common on mobile) — audio starts on next user interaction
      });
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc_signal', {
            targetSocketId,
            signal: pc.localDescription.toJSON(),
          });
        })
        .catch(err => console.warn('[Voice] offer error:', err));
    }
  }

  // ── Apply a received signal (offer / answer / candidate) ─────
  async function applySignal(fromSocketId, signal) {
    if (!peersRef.current[fromSocketId]) {
      initPeerConnection(fromSocketId, false);
    }
    const peer = peersRef.current[fromSocketId];
    if (!peer) return;
    const { pc } = peer;

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        peer.hasRemote = true;
        // Flush candidates that arrived before the offer
        for (const c of peer.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peer.pendingCandidates = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', {
          targetSocketId: fromSocketId,
          signal: pc.localDescription.toJSON(),
        });

      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        peer.hasRemote = true;
        for (const c of peer.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peer.pendingCandidates = [];

      } else if (signal.candidate !== undefined) {
        // ICE candidate — queue if remote description not set yet
        if (peer.hasRemote) {
          await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(() => {});
        } else {
          peer.pendingCandidates.push(signal);
        }
      }
    } catch (err) {
      console.warn('[Voice] signal handling error:', err);
    }
  }

  // ── Register socket listeners (once per socket mount) ────────
  useEffect(() => {
    if (!socket) return;

    function onPeerVoiceReady({ socketId }) {
      // Use ref — this handler is never recreated, so it must read current state via ref
      if (!voiceOnRef.current || !streamRef.current) return;
      initPeerConnection(socketId, true);
    }

    function onWebrtcSignal({ fromSocketId, signal }) {
      if (!voiceOnRef.current) return;
      applySignal(fromSocketId, signal);
    }

    socket.on('peer_voice_ready', onPeerVoiceReady);
    socket.on('webrtc_signal',    onWebrtcSignal);

    return () => {
      socket.off('peer_voice_ready', onPeerVoiceReady);
      socket.off('webrtc_signal',    onWebrtcSignal);
    };
  }, [socket]); // only depends on socket — refs handle the rest

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      if (!voiceOnRef.current) return;
      streamRef.current?.getTracks().forEach(t => t.stop());
      Object.keys(peersRef.current).forEach(cleanupPeer);
      Object.values(analyserTimers.current).forEach(clearInterval);
    };
  }, []);

  // ── Public actions ───────────────────────────────────────────
  async function enableVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      stream.getAudioTracks().forEach(t => { t.enabled = !isMutedRef.current; });

      setVoiceEnabled(true);
      voiceOnRef.current = true;
      setVoiceError(null);

      detectSpeaking(stream, myId);
      // Server looks up roomCode from socketToPlayer — don't send it from client
      socket.emit('voice_ready');
    } catch (err) {
      setVoiceError('Mic access denied');
      console.warn('[Voice] getUserMedia error:', err);
    }
  }

  function toggleMute() {
    const newMuted = !isMuted;
    setMuted(newMuted);
    isMutedRef.current = newMuted;
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
  }

  function disableVoice() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    Object.keys(peersRef.current).forEach(cleanupPeer);
    Object.values(analyserTimers.current).forEach(clearInterval);
    analyserTimers.current = {};
    setVoiceEnabled(false);
    voiceOnRef.current = false;
  }

  const isSpeaking = speakingPeers[myId];

  return (
    <div className="flex items-center gap-2">

      {/* Per-player speaking indicators */}
      <div className="hidden sm:flex items-center gap-1">
        {players.filter(p => p.id !== myId).map(p => {
          const speaking = speakingPeers[p.socketId] || speakingPeers[p.id];
          return speaking ? (
            <div key={p.id}
              className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-body">{p.name}</span>
            </div>
          ) : null;
        })}
      </div>

      {/* My speaking dot */}
      {voiceEnabled && isSpeaking && !isMuted && (
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="You're speaking" />
      )}

      {/* Enable / mute / disable */}
      {!voiceEnabled ? (
        <button onClick={enableVoice} title="Enable voice chat"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-700 hover:bg-navy-600 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs font-body transition-colors">
          🎙️ Voice
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body transition-all border
              ${isMuted
                ? 'bg-red-900/40 border-red-500/40 text-red-400 hover:bg-red-900/60'
                : 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'}`}>
            {isMuted ? '🔇 Muted' : '🎙️ Live'}
          </button>
          <button onClick={disableVoice} title="Disable voice"
            className="px-2 py-1.5 bg-navy-700 hover:bg-red-900/40 border border-white/10 hover:border-red-500/30 rounded-lg text-white/30 hover:text-red-400 text-xs transition-colors">
            ✕
          </button>
        </div>
      )}

      {voiceError && (
        <span className="text-red-400 text-xs font-body">{voiceError}</span>
      )}
    </div>
  );
}
