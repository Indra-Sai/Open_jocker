// components/Scoreboard.jsx
export default function Scoreboard({ players, scores, cumulativeScores, numRounds, onClose }) {
  const sorted = [...players].sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-navy-800 border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[82vh] overflow-hidden shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-display text-2xl font-bold text-cream-100">Scoreboard</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-navy-700 text-white/40 hover:text-white/80 transition-colors">✕</button>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(82vh-72px)]">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="sticky left-0 bg-navy-800 text-left px-5 py-3 text-[10px] uppercase tracking-widest text-white/30 font-body">Player</th>
                {scores.map((s, i) => (
                  <th key={i} className="px-3 py-3 text-center text-[10px] uppercase tracking-widest text-white/30 min-w-[60px] font-body">
                    R{s.round}
                  </th>
                ))}
                {Array.from({ length: numRounds - scores.length }, (_, i) => (
                  <th key={`f${i}`} className="px-3 py-3 text-center text-[10px] text-white/15 min-w-[60px]">
                    R{scores.length + i + 1}
                  </th>
                ))}
                <th className="px-5 py-3 text-center text-[10px] uppercase tracking-widest text-coral-400 font-body min-w-[72px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((player, rank) => (
                <tr key={player.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="sticky left-0 bg-navy-800 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 font-mono text-xs w-4">{rank + 1}</span>
                      <span className={player.isHost ? 'text-coral-300 font-medium' : 'text-white/70'}>
                        {player.name}{player.isHost && ' 👑'}
                      </span>
                    </div>
                  </td>
                  {scores.map((s, i) => {
                    const pts = s.points[player.id] ?? 0;
                    const bid = s.bids[player.id];
                    const won = s.tricksWon[player.id] || 0;
                    return (
                      <td key={i} className="px-3 py-2 text-center">
                        <div className={`font-mono font-bold text-sm ${pts > 0 ? 'text-teal-400' : pts < 0 ? 'text-red-400' : 'text-white/30'}`}>
                          {pts > 0 ? '+' : ''}{pts}
                        </div>
                        <div className="text-white/25 text-[10px] mt-0.5">{bid}→{won}</div>
                      </td>
                    );
                  })}
                  {Array.from({ length: numRounds - scores.length }, (_, i) => (
                    <td key={`f${i}`} className="px-3 py-2 text-center text-white/10 text-xs">—</td>
                  ))}
                  <td className="px-5 py-3 text-center">
                    <span className="font-mono font-bold text-coral-400 text-base">
                      {cumulativeScores[player.id] || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
