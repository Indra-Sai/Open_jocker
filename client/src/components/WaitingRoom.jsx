// components/WaitingRoom.jsx
import { useState } from 'react';

export default function WaitingRoom({ socket, gameState, playerId }) {
  const { players, config, roomCode } = gameState;
  const [copied, setCopied] = useState(false);
  const isHost    = players.find(p => p.id === playerId)?.isHost;
  const allJoined = players.length === config.numPlayers;
  const isTeam    = config.mode === 'team';
  const half      = config.numPlayers / 2;

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-navy-950">
      <div className="max-w-md w-full animate-fade-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="font-display text-3xl font-black text-cream-100 mb-1">Waiting Room</h1>
          <p className="text-white/30 font-body text-sm">Share this code with your friends</p>

          {/* Room code + copy */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div className="bg-navy-800 border border-white/10 rounded-2xl px-6 py-3">
              <span className="font-mono text-3xl font-bold text-coral-400 tracking-[0.35em]">{roomCode}</span>
            </div>
            <button onClick={copyCode}
              className={`px-4 py-3 rounded-xl text-sm font-body font-medium border transition-all
                ${copied
                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
                  : 'bg-navy-800 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'}`}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Config chips */}
        <div className="flex gap-3 justify-center mb-6 flex-wrap">
          {[
            { label: 'Rounds',  val: config.numRounds },
            { label: 'Players', val: `${players.length} / ${config.numPlayers}` },
            { label: 'Decks',   val: Math.ceil((config.numPlayers * config.numRounds) / 52) },
          ].map(chip => (
            <div key={chip.label} className="flex flex-col items-center bg-navy-800/60 border border-white/[0.06] rounded-xl px-4 py-2">
              <span className="text-coral-400 font-mono font-bold text-lg leading-none">{chip.val}</span>
              <span className="text-white/25 text-[10px] font-body uppercase tracking-widest mt-0.5">{chip.label}</span>
            </div>
          ))}
          {isTeam && (
            <div className="flex flex-col items-center bg-teal-500/10 border border-teal-500/20 rounded-xl px-4 py-2">
              <span className="text-teal-400 font-mono font-bold text-lg leading-none">{half}×2</span>
              <span className="text-teal-400/50 text-[10px] font-body uppercase tracking-widest mt-0.5">Teams</span>
            </div>
          )}
        </div>

        {/* Player slots */}
        <div className="bg-navy-800 border border-white/[0.06] rounded-2xl p-4 mb-5">
          <p className="text-[11px] uppercase tracking-widest text-white/25 font-body mb-3">Players</p>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-navy-700/50 rounded-xl px-3 py-2.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-display flex-shrink-0
                  ${p.id === playerId ? 'bg-coral-500 text-white' : 'bg-navy-600 text-white/70'}`}>
                  {p.name[0].toUpperCase()}
                </div>
                <span className="font-body text-white/80 flex-1">
                  {p.name}
                  {p.id === playerId && <span className="text-coral-400/60 text-xs ml-1.5">(you)</span>}
                </span>
                {p.isHost && <span className="text-xs text-white/40 font-body bg-navy-600 rounded-full px-2 py-0.5">Host 👑</span>}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: config.numPlayers - players.length }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border border-dashed border-white/[0.08] rounded-xl px-3 py-2.5">
                <div className="w-9 h-9 rounded-full bg-navy-700/40 border border-dashed border-white/10 flex-shrink-0" />
                <span className="text-white/20 font-body text-sm italic">Waiting for player…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team preview — shown when all players joined and mode is team */}
        {isTeam && allJoined && (
          <div className="bg-navy-800 border border-teal-500/15 rounded-2xl p-4 mb-5">
            <p className="text-[11px] uppercase tracking-widest text-teal-400/60 font-body mb-3">Teams</p>
            <div className="space-y-2">
              {Array.from({ length: half }, (_, i) => {
                const m1 = players[i];
                const m2 = players[i + half];
                return (
                  <div key={i} className="flex items-center gap-3 bg-teal-500/5 border border-teal-500/15 rounded-xl px-3 py-2">
                    <span className="text-xs text-teal-400/50 font-body font-mono w-14 flex-shrink-0">Team {i + 1}</span>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <span className={`text-sm font-body ${m1?.id === playerId ? 'text-coral-300 font-medium' : 'text-white/70'}`}>{m1?.name}</span>
                      <span className="text-white/20 text-xs">&amp;</span>
                      <span className={`text-sm font-body ${m2?.id === playerId ? 'text-coral-300 font-medium' : 'text-white/70'}`}>{m2?.name}</span>
                    </div>
                    {(m1?.id === playerId || m2?.id === playerId) && (
                      <span className="text-[10px] text-teal-400/50 font-body flex-shrink-0">your team</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team mode hint when not all joined yet */}
        {isTeam && !allJoined && (
          <div className="mb-5 px-4 py-2.5 bg-teal-500/5 border border-teal-500/15 rounded-xl text-xs font-body text-teal-400/60 text-center">
            Teams assigned by joining order · 1st &amp; {half + 1}th join → Team 1, 2nd &amp; {half + 2}th → Team 2…
          </div>
        )}

        {/* Start / waiting */}
        {isHost ? (
          <button onClick={() => socket.emit('start_game')} disabled={!allJoined}
            className={`w-full py-4 rounded-2xl font-bold font-body text-lg transition-all
              ${allJoined
                ? 'bg-coral-500 hover:bg-coral-400 text-white shadow-lg shadow-coral-500/25 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-navy-800 text-white/20 cursor-not-allowed border border-white/[0.06]'}`}>
            {allJoined ? 'Start Game 🎮' : `Waiting for ${config.numPlayers - players.length} more…`}
          </button>
        ) : (
          <div className="text-center py-4 text-white/30 font-body text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-coral-500 animate-pulse mr-2" />
            Waiting for host to start…
          </div>
        )}
      </div>
    </div>
  );
}
