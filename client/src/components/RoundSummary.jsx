// components/RoundSummary.jsx
export default function RoundSummary({ data, players, isHost, onSkip }) {
  if (!data?.round) return null;
  const { round, cumulativeScores, gameOver } = data;

  const sorted = [...players].sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 border border-white/[0.08] rounded-2xl max-w-md w-full shadow-2xl animate-bounce-in p-6">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏁</div>
          <h2 className="font-display text-2xl font-bold text-cream-100">Round {round.round} Done</h2>
          <p className="text-white/30 text-xs font-body mt-1 uppercase tracking-widest">Results</p>
        </div>

        {/* Player rows */}
        <div className="space-y-2 mb-6">
          {sorted.map((player, rank) => {
            const pts   = round.points?.[player.id] ?? 0;
            const bid   = round.bids?.[player.id];
            const won   = round.tricksWon?.[player.id] || 0;
            const total = cumulativeScores[player.id] || 0;
            const metBid = won === bid;
            const overBid = won > bid;

            return (
              <div key={player.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3
                  ${rank === 0 ? 'bg-coral-500/15 border border-coral-500/30' : 'bg-navy-700/50 border border-transparent'}`}>
                <span className="text-lg w-6 text-center">{['🥇','🥈','🥉'][rank] || `${rank+1}.`}</span>
                <span className="flex-1 font-body text-white/80 text-sm">{player.name}</span>
                <div className="text-right">
                  <div className="text-[10px] font-body text-white/35">
                    Bid {bid} / Won {won}
                    {metBid && <span className="text-teal-400 ml-1">✓</span>}
                    {overBid && <span className="text-yellow-400 ml-1">↑</span>}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    <span className={`font-mono font-bold text-sm ${pts > 0 ? 'text-teal-400' : pts < 0 ? 'text-red-400' : 'text-white/30'}`}>
                      {pts > 0 ? '+' : ''}{pts}
                    </span>
                    <span className="font-mono font-bold text-coral-400">{total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-white/25 text-xs font-body mb-3">
          {gameOver ? 'Game over!' : 'Next round starts in 5 seconds…'}
        </p>
        {isHost && !gameOver && (
          <button onClick={onSkip}
            className="w-full py-2.5 bg-navy-700 hover:bg-navy-600 border border-white/10 hover:border-white/20 rounded-xl text-white/60 hover:text-white/90 font-body text-sm transition-all">
            Skip to Next Round →
          </button>
        )}
      </div>
    </div>
  );
}
