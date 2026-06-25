// components/GameOver.jsx
import { useState } from 'react';

export default function GameOver({ players, cumulativeScores, teams, mode, isHost, socket, onNewGame }) {
  const [extendOpen, setExtendOpen] = useState(false);
  const [extraRounds, setExtraRounds] = useState(3);

  // Build rows — team mode: one row per team; single: one per player
  let rows;
  if (mode === 'team' && teams?.length) {
    rows = teams.map(team => ({
      id: team.id,
      label: team.name,
      sublabel: team.memberIds
        .map(pid => players.find(p => p.id === pid)?.name)
        .filter(Boolean)
        .join(' & '),
      score: cumulativeScores[team.memberIds[0]] || 0,
    }));
  } else {
    rows = [...players].map(p => ({
      id: p.id,
      label: p.name,
      sublabel: null,
      score: cumulativeScores[p.id] || 0,
    }));
  }

  rows.sort((a, b) => b.score - a.score);
  const winner   = rows[0];
  const maxScore = winner?.score || 1;

  const medals = ['🥇', '🥈', '🥉'];

  function handleRematch() {
    socket.emit('rematch');
  }

  function handleExtend() {
    socket.emit('extend_game', { rounds: extraRounds });
    setExtendOpen(false);
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6 relative overflow-hidden">

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-[600px] h-[600px] rounded-full bg-coral-500/5 blur-3xl" />
      </div>

      <div className="max-w-lg w-full text-center animate-fade-in relative z-10">

        {/* Trophy */}
        <div className="text-8xl mb-2 animate-bounce-in">🏆</div>

        {/* Winner name */}
        <h1 className="font-display text-4xl sm:text-5xl font-black text-cream-100 mb-1 animate-slide-up"
          style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
          {winner?.label}
        </h1>

        {winner?.sublabel && (
          <p className="text-white/35 font-body text-sm mb-1 animate-slide-up"
            style={{ animationDelay: '180ms', opacity: 0, animationFillMode: 'forwards' }}>
            {winner.sublabel}
          </p>
        )}

        <p className="text-coral-400 font-body text-lg mb-2 animate-slide-up"
          style={{ animationDelay: '230ms', opacity: 0, animationFillMode: 'forwards' }}>
          Wins the game!
        </p>
        <p className="text-white/25 font-mono text-sm mb-8 animate-slide-up"
          style={{ animationDelay: '280ms', opacity: 0, animationFillMode: 'forwards' }}>
          {winner?.score} points
        </p>

        {/* Leaderboard */}
        <div className="space-y-3 mb-8">
          {rows.map((row, rank) => {
            const pct = maxScore > 0 ? Math.round((row.score / maxScore) * 100) : 0;
            return (
              <div key={row.id}
                className={`rounded-2xl px-5 py-4 border animate-slide-up
                  ${rank === 0
                    ? 'bg-coral-500/20 border-coral-500/50 shadow-lg shadow-coral-500/10'
                    : 'bg-navy-800 border-white/[0.06]'}`}
                style={{
                  animationDelay: `${380 + rank * 80}ms`,
                  opacity: 0,
                  animationFillMode: 'forwards',
                }}>

                <div className="flex items-center gap-4 mb-2">
                  <span className="text-2xl w-8 text-center flex-shrink-0">
                    {medals[rank] ?? `${rank + 1}.`}
                  </span>
                  <div className="flex-1 text-left">
                    <span className="font-body text-white/80 text-base block">{row.label}</span>
                    {row.sublabel && (
                      <span className="font-body text-white/35 text-xs block">{row.sublabel}</span>
                    )}
                  </div>
                  <span className={`font-mono font-black text-xl flex-shrink-0 ${rank === 0 ? 'text-coral-400' : 'text-white/50'}`}>
                    {row.score}
                  </span>
                </div>

                {/* Score bar */}
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${rank === 0 ? 'bg-coral-500' : 'bg-white/20'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up"
          style={{
            animationDelay: `${380 + rows.length * 80 + 60}ms`,
            opacity: 0,
            animationFillMode: 'forwards',
          }}>
          {isHost ? (
            <>
              {/* Rematch — same players, back to waiting room */}
              <button onClick={handleRematch}
                className="px-8 py-3.5 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body
                  rounded-2xl transition-all text-base shadow-lg shadow-coral-500/25 hover:scale-[1.03] active:scale-[0.98]">
                🔄 Rematch
              </button>
              {/* Extend — add more rounds and keep playing */}
              <button onClick={() => setExtendOpen(v => !v)}
                className="px-8 py-3.5 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/30
                  text-teal-300 font-bold font-body rounded-2xl transition-all text-base hover:scale-[1.02]">
                ➕ Add Rounds
              </button>
              {/* New game — leave room entirely */}
              <button onClick={onNewGame}
                className="px-8 py-3.5 bg-navy-800 hover:bg-navy-700 border border-white/10
                  text-white/50 font-body rounded-2xl transition-all text-base">
                New Game
              </button>
            </>
          ) : (
            <button onClick={onNewGame}
              className="px-10 py-4 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body
                rounded-2xl transition-all text-lg shadow-lg shadow-coral-500/25 hover:scale-[1.03] active:scale-[0.98]">
              Play Again
            </button>
          )}
        </div>

        {/* Extend game panel */}
        {extendOpen && isHost && (
          <div className="mt-5 bg-navy-800 border border-teal-500/20 rounded-2xl p-5 animate-slide-up">
            <p className="text-sm text-white/60 font-body mb-3">How many rounds to add?</p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={() => setExtraRounds(r => Math.max(1, r - 1))}
                className="w-9 h-9 rounded-xl bg-navy-700 border border-white/10 text-white/60
                  hover:text-white hover:bg-navy-600 font-bold text-lg transition-colors">−</button>
              <span className="font-mono text-3xl font-bold text-coral-400 w-10 text-center">{extraRounds}</span>
              <button onClick={() => setExtraRounds(r => Math.min(10, r + 1))}
                className="w-9 h-9 rounded-xl bg-navy-700 border border-white/10 text-white/60
                  hover:text-white hover:bg-navy-600 font-bold text-lg transition-colors">+</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExtendOpen(false)}
                className="flex-1 py-2.5 bg-navy-700 border border-white/10 text-white/40
                  font-body rounded-xl text-sm transition-colors hover:bg-navy-600">Cancel</button>
              <button onClick={handleExtend}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold
                  font-body rounded-xl text-sm transition-colors">
                Add {extraRounds} Round{extraRounds > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
