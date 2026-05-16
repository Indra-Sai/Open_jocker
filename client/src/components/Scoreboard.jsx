// components/Scoreboard.jsx
export default function Scoreboard({ players, scores, cumulativeScores, numRounds, teams, mode, onClose }) {

  // Build display rows
  let rows;
  if (mode === 'team' && teams?.length) {
    rows = teams.map(team => ({
      key:       team.id,
      label:     team.name,
      sublabel:  team.memberIds.map(pid => players.find(p => p.id === pid)?.name).filter(Boolean).join(' & '),
      isHost:    false,
      cumulative: cumulativeScores[team.memberIds[0]] || 0,
      getRoundPoints: (s) => s.points[team.memberIds[0]] ?? 0,
      getRoundBid:    (s) => s.bids[team.bidderId ?? team.memberIds[0]],
      getRoundWon:    (s) => team.memberIds.reduce((sum, pid) => sum + (s.tricksWon[pid] || 0), 0),
      bidderId:   team.bidderId ?? team.memberIds[0],
    }));
  } else {
    rows = players.map(p => ({
      key:       p.id,
      label:     p.name,
      sublabel:  null,
      isHost:    p.isHost,
      cumulative: cumulativeScores[p.id] || 0,
      getRoundPoints: (s) => s.points[p.id] ?? 0,
      getRoundBid:    (s) => s.bids[p.id],
      getRoundWon:    (s) => s.tricksWon[p.id] || 0,
    }));
  }

  rows.sort((a, b) => b.cumulative - a.cumulative);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-navy-800 border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[82vh] overflow-hidden shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-cream-100">Scoreboard</h2>
            {mode === 'team' && (
              <span className="text-xs font-body text-teal-400/70 border border-teal-500/20 rounded-full px-2 py-0.5">Teams</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-navy-700 text-white/40 hover:text-white/80 transition-colors">✕</button>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(82vh-72px)]">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="sticky left-0 bg-navy-800 text-left px-5 py-3 text-[10px] uppercase tracking-widest text-white/30 font-body">
                  {mode === 'team' ? 'Team' : 'Player'}
                </th>
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
              {rows.map((row, rank) => (
                <tr key={row.key} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="sticky left-0 bg-navy-800 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 font-mono text-xs w-4">{rank + 1}</span>
                      <div>
                        <span className={row.isHost ? 'text-coral-300 font-medium block' : 'text-white/70 block'}>
                          {row.label}{row.isHost && ' 👑'}
                        </span>
                        {row.sublabel && (
                          <span className="text-white/30 text-[10px] block">{row.sublabel}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {scores.map((s, i) => {
                    const pts = row.getRoundPoints(s);
                    const bid = row.getRoundBid(s);
                    const won = row.getRoundWon(s);
                    return (
                      <td key={i} className="px-3 py-2 text-center">
                        <div className={`font-mono font-bold text-sm ${pts > 0 ? 'text-teal-400' : pts < 0 ? 'text-red-400' : 'text-white/30'}`}>
                          {pts > 0 ? '+' : ''}{pts}
                        </div>
                        <div className="text-white/25 text-[10px] mt-0.5">
                          {bid !== undefined ? `${bid}→${won}` : '—'}
                        </div>
                      </td>
                    );
                  })}
                  {Array.from({ length: numRounds - scores.length }, (_, i) => (
                    <td key={`f${i}`} className="px-3 py-2 text-center text-white/10 text-xs">—</td>
                  ))}
                  <td className="px-5 py-3 text-center">
                    <span className="font-mono font-bold text-coral-400 text-base">{row.cumulative}</span>
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
