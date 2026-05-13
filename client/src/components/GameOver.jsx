// components/GameOver.jsx
export default function GameOver({ players, cumulativeScores, onNewGame }) {
  const sorted = [...players].sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0));
  const winner = sorted[0];

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center animate-fade-in">
        <div className="text-8xl mb-4 animate-bounce-in">🏆</div>
        <h1 className="font-display text-4xl sm:text-5xl font-black text-cream-100 mb-1">{winner?.name}</h1>
        <p className="text-coral-400 font-body text-lg mb-8">Wins the game!</p>

        {/* Final leaderboard */}
        <div className="space-y-3 mb-10">
          {sorted.map((player, rank) => (
            <div key={player.id}
              className={`flex items-center gap-4 rounded-2xl px-6 py-4 transition-all
                ${rank === 0
                  ? 'bg-coral-500/20 border-2 border-coral-500/50 shadow-lg shadow-coral-500/10'
                  : 'bg-navy-800 border border-white/[0.06]'}`}>
              <span className="text-3xl w-8 text-center flex-shrink-0">
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
              </span>
              <span className="flex-1 text-left font-body text-white/80 text-lg">{player.name}</span>
              <span className={`font-mono font-black text-2xl ${rank === 0 ? 'text-coral-400' : 'text-white/50'}`}>
                {cumulativeScores[player.id] || 0}
              </span>
            </div>
          ))}
        </div>

        <button onClick={onNewGame}
          className="px-10 py-4 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-2xl transition-all text-lg shadow-lg shadow-coral-500/25 hover:scale-[1.03] active:scale-[0.98]">
          Play Again
        </button>
      </div>
    </div>
  );
}
