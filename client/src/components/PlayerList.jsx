// components/PlayerList.jsx
export default function PlayerList({ players, bids, tricksWon, currentPlayerId, myId, phase, teams, mode }) {

  function renderPlayerRow(p, overrideBid, overrideTricks) {
    const isActive = p.id === currentPlayerId;
    const isMe     = p.id === myId;
    const bid      = overrideBid !== undefined ? overrideBid : bids?.[p.id];
    const won      = overrideTricks !== undefined ? overrideTricks : (tricksWon?.[p.id] || 0);

    return (
      <div key={p.id}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all border
          ${isActive
            ? 'bg-coral-500/15 border-coral-500/35 animate-pulse-glow'
            : 'bg-navy-800/60 border-white/[0.05]'}`}>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0
          ${isMe ? 'bg-coral-500 text-white' : 'bg-navy-600 text-white/60'}
          ${!p.connected ? 'opacity-30' : ''}`}>
          {p.name[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-xs font-body truncate leading-tight ${isMe ? 'text-coral-300' : 'text-white/70'}`}>
              {p.name}{isMe && <span className="text-white/25 ml-1 text-[10px]">(you)</span>}
            </span>
            {p.isHost && <span className="text-[10px] text-white/30">👑</span>}
          </div>
          {(phase === 'bidding' || phase === 'playing') && (
            <p className="text-[10px] font-mono text-white/30 leading-tight mt-0.5">
              {bid !== undefined ? `bid ${bid}` : '…'}
              {phase === 'playing' && bid !== undefined && ` · won ${won}`}
            </p>
          )}
        </div>

        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.connected ? 'bg-teal-400' : 'bg-red-500 animate-pulse'}`} />
      </div>
    );
  }

  // Team mode: group players under team headers
  if (mode === 'team' && teams?.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-widest text-white/25 font-body">Players</p>
        {teams.map(team => {
          const teamTricks = team.memberIds.reduce((sum, pid) => sum + (tricksWon?.[pid] || 0), 0);
          const teamBid    = bids?.[team.bidderId];
          return (
            <div key={team.id}>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[10px] uppercase tracking-widest text-teal-400/60 font-body">{team.name}</span>
                {(phase === 'bidding' || phase === 'playing') && (
                  <span className="text-[10px] font-mono text-white/30">
                    {teamBid !== undefined ? `bid ${teamBid}` : ''}
                    {phase === 'playing' && teamBid !== undefined && ` · won ${teamTricks}`}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {team.memberIds.map(pid => {
                  const p = players.find(pl => pl.id === pid);
                  if (!p) return null;
                  return renderPlayerRow(p, teamBid, teamTricks);
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Single mode
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-widest text-white/25 font-body mb-1">Players</p>
      {players.map(p => renderPlayerRow(p))}
    </div>
  );
}
