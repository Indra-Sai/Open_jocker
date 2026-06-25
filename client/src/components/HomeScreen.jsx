// components/HomeScreen.jsx
import { useState, useEffect } from 'react';
import useGameStore from '../store/gameStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export default function HomeScreen({ socket }) {
  const [view, setView]             = useState('home');
  const [name, setName]             = useState(() => localStorage.getItem('openjocker_name') || '');
  const [numPlayers, setNumPlayers] = useState(4);
  const [numRounds, setNumRounds]   = useState(8);
  const [mode, setMode]             = useState('single');
  const [numDecks, setNumDecks]     = useState(1);
  const [roomCode, setRoomCode]     = useState('');
  const [serverReady, setServerReady] = useState(!SERVER_URL); // true if same-origin
  const error    = useGameStore(s => s.error);
  const setError = useGameStore(s => s.setError);

  // Ping the server to wake it up (Railway free tier has cold starts)
  useEffect(() => {
    if (!SERVER_URL) return;
    fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(15000) })
      .then(() => setServerReady(true))
      .catch(() => setServerReady(true)); // still allow play even if ping fails
  }, []);

  // Maximum rounds possible with the chosen deck count
  const maxRounds = Math.floor((numDecks * 52) / numPlayers);

  function saveName(v) {
    setName(v);
    if (v.trim()) localStorage.setItem('openjocker_name', v.trim());
  }

  function createGame() {
    if (!name.trim()) return setError('Please enter your name');
    setError(null);
    socket.emit('create_room', {
      playerName: name.trim(),
      config: { numPlayers, numRounds, numDecks, mode: numPlayers % 2 === 0 ? mode : 'single' },
    });
  }

  function joinGame() {
    if (!name.trim())     return setError('Please enter your name');
    if (!roomCode.trim()) return setError('Please enter a room code');
    setError(null);
    socket.emit('join_room', { roomCode: roomCode.trim().toUpperCase(), playerName: name.trim() });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-navy-950">
      {/* Logo */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="text-7xl mb-4">🃏</div>
        <h1 className="font-display text-5xl sm:text-6xl font-black text-cream-100 tracking-tight">
          Open Jocker
        </h1>
        <p className="text-white/30 font-body mt-3 text-sm tracking-[0.2em] uppercase">
          Real-time Multiplayer Card Game
        </p>
      </div>

      {/* Server wake indicator */}
      {!serverReady && (
        <div className="mb-4 px-4 py-2.5 bg-navy-800/80 border border-white/10 rounded-xl
          text-white/50 text-xs font-body flex items-center gap-2 max-w-sm w-full">
          <span className="w-2 h-2 rounded-full bg-coral-400 animate-pulse flex-shrink-0" />
          Waking up server… this may take a few seconds
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-900/40 border border-red-500/30 rounded-xl text-red-300 text-sm font-body flex items-center gap-3 max-w-sm w-full animate-slide-up">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-300 text-lg">✕</button>
        </div>
      )}

      {/* Home */}
      {view === 'home' && (
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
          <button onClick={() => setView('create')}
            className="px-10 py-4 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-2xl transition-all text-lg shadow-lg shadow-coral-500/20 hover:scale-[1.03] active:scale-[0.98]">
            Create Game
          </button>
          <button onClick={() => setView('join')}
            className="px-10 py-4 bg-navy-800 hover:bg-navy-700 border border-white/10 text-cream-100 font-bold font-body rounded-2xl transition-all text-lg hover:scale-[1.03] active:scale-[0.98]">
            Join Game
          </button>
        </div>
      )}

      {/* Create */}
      {view === 'create' && (
        <div className="bg-navy-800 border border-white/[0.07] rounded-2xl p-7 max-w-sm w-full shadow-2xl animate-slide-up">
          <h2 className="font-display text-2xl text-cream-100 mb-6 text-center font-bold">Create Game</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">Your Name</label>
              <input type="text" value={name} onChange={e => saveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGame()}
                placeholder="Enter your name" maxLength={20}
                className="w-full bg-navy-700 border border-white/10 focus:border-coral-500/50 rounded-xl px-4 py-2.5 text-cream-100 placeholder-white/20 outline-none font-body transition-colors" />
            </div>

            <div>
              <label className="flex justify-between text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">
                <span>Players</span><span className="text-coral-400 font-bold">{numPlayers}</span>
              </label>
              <input type="range" min={2} max={8} value={numPlayers}
                onChange={e => { setNumPlayers(Number(e.target.value)); setMode('single'); }}
                className="w-full accent-coral-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1"><span>2</span><span>8</span></div>
            </div>

            {/* Deck selector */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">Deck Size</label>
              <div className="flex gap-2">
                {[
                  { val: 1, label: '1 Deck',  sub: '52 cards' },
                  { val: 2, label: '2 Decks', sub: '104 cards' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => {
                    setNumDecks(opt.val);
                    // Clamp rounds to new maximum
                    const newMax = Math.floor((opt.val * 52) / numPlayers);
                    if (numRounds > newMax) setNumRounds(newMax);
                  }}
                    className={`flex-1 py-2 rounded-xl border font-body text-sm transition-colors flex flex-col items-center gap-0.5
                      ${numDecks === opt.val
                        ? 'bg-coral-500 border-coral-500 text-white font-bold'
                        : 'bg-navy-700 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'}`}>
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-normal ${numDecks === opt.val ? 'text-white/70' : 'text-white/25'}`}>
                      {opt.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex justify-between text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">
                <span>Rounds</span><span className="text-coral-400 font-bold">{numRounds}</span>
              </label>
              <input type="range" min={1} max={maxRounds} value={numRounds}
                onChange={e => setNumRounds(Number(e.target.value))} className="w-full accent-coral-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-white/20 font-mono mt-1"><span>1</span><span>{maxRounds}</span></div>
            </div>

            {/* Team mode toggle — only when player count is even */}
            {numPlayers % 2 === 0 && (
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">Game Mode</label>
                <div className="flex gap-2">
                  {[
                    { value: 'single', label: 'Solo' },
                    { value: 'team',   label: `Teams (${numPlayers / 2}×2)` },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setMode(opt.value)}
                      className={`flex-1 py-2 rounded-xl border font-body text-sm transition-colors
                        ${mode === opt.value
                          ? 'bg-coral-500 border-coral-500 text-white font-bold'
                          : 'bg-navy-700 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {mode === 'team' && (
                  <p className="text-[10px] text-white/30 font-body mt-1.5 text-center">
                    Teams assigned by joining order · 1st &amp; {numPlayers / 2 + 1}th, 2nd &amp; {numPlayers / 2 + 2}th, …
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setView('home'); setError(null); }}
                className="flex-1 py-2.5 bg-navy-700 hover:bg-navy-600 border border-white/10 text-white/50 font-body rounded-xl transition-colors">Back</button>
              <button onClick={createGame}
                className="flex-1 py-2.5 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-xl transition-all shadow-md shadow-coral-500/20">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Join */}
      {view === 'join' && (
        <div className="bg-navy-800 border border-white/[0.07] rounded-2xl p-7 max-w-sm w-full shadow-2xl animate-slide-up">
          <h2 className="font-display text-2xl text-cream-100 mb-6 text-center font-bold">Join Game</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">Your Name</label>
              <input type="text" value={name} onChange={e => saveName(e.target.value)}
                placeholder="Enter your name" maxLength={20}
                className="w-full bg-navy-700 border border-white/10 focus:border-coral-500/50 rounded-xl px-4 py-2.5 text-cream-100 placeholder-white/20 outline-none font-body transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 font-body mb-2">Room Code</label>
              <input type="text" value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                placeholder="ABC123" maxLength={6}
                className="w-full bg-navy-700 border border-white/10 focus:border-coral-500/50 rounded-xl px-4 py-3 text-coral-400 font-mono text-2xl text-center tracking-[0.4em] uppercase outline-none transition-colors" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setView('home'); setError(null); }}
                className="flex-1 py-2.5 bg-navy-700 hover:bg-navy-600 border border-white/10 text-white/50 font-body rounded-xl transition-colors">Back</button>
              <button onClick={joinGame}
                className="flex-1 py-2.5 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-xl transition-all shadow-md shadow-coral-500/20">Join</button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-white/15 text-xs font-body">No account needed · Share a code · Play instantly</p>
    </div>
  );
}
