// components/GameOver.jsx
export default function GameOver({ players, cumulativeScores, teams, mode, onNewGame }) {

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
        <div className="space-y-3 mb-10">
          {rows.map((row, rank) => {
            const pct = Math.round((row.score / maxScore) * 100);
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

        <button
          onClick={onNewGame}
          className="px-10 py-4 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-2xl
            transition-all text-lg shadow-lg shadow-coral-500/25 hover:scale-[1.03] active:scale-[0.98]
            animate-slide-up"
          style={{
            animationDelay: `${380 + rows.length * 80 + 60}ms`,
            opacity: 0,
            animationFillMode: 'forwards',
          }}>
          Play Again
        </button>
      </div>
    </div>
  );
}
