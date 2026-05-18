// components/GameScreen.jsx
import { useState } from 'react';
import useGameStore from '../store/gameStore';
import PlayerHand from './PlayerHand';
import GameTable from './GameTable';
import BidPanel from './BidPanel';
import PlayerList from './PlayerList';
import Scoreboard from './Scoreboard';
import TrumpReveal from './TrumpReveal';
import RoundSummary from './RoundSummary';
import ChatPanel from './ChatPanel';
import VoiceBar from './VoiceBar';

export default function GameScreen({ socket, gameState, playerId }) {
  const [chatOpen, setChatOpen]             = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const showScoreboard    = useGameStore(s => s.showScoreboard);
  const setShowScoreboard = useGameStore(s => s.setShowScoreboard);
  const showTrumpReveal   = useGameStore(s => s.showTrumpReveal);
  const trumpRevealSuit   = useGameStore(s => s.trumpRevealSuit);
  const showRoundSummary  = useGameStore(s => s.showRoundSummary);
  const lastRoundData     = useGameStore(s => s.lastRoundData);
  const lastTrickWinner   = useGameStore(s => s.lastTrickWinner);
  const error             = useGameStore(s => s.error);
  const setError          = useGameStore(s => s.setError);

  const {
    phase, currentRound, currentSubRound, trumpSuit,
    bids, tricksWon, table, myHand, players, currentPlayerId,
    scores, cumulativeScores, config, myId, roomCode,
    mode, teams,
  } = gameState;

  const isMyTurn  = currentPlayerId === myId;
  const myPlayer  = players.find(p => p.id === myId);
  const isHost    = myPlayer?.isHost;
  const baseSuit  = table?.length > 0 ? table[0].card.suit : null;
  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name || '…';

  // Team helpers
  const getTeamForPlayer = (pid) => teams?.find(t => t.memberIds.includes(pid));
  const getDisplayBid = (p) => {
    if (mode !== 'team') return bids[p.id];
    const team = getTeamForPlayer(p.id);
    return bids[team?.bidderId];
  };
  const getDisplayTricks = (p) => {
    if (mode !== 'team') return tricksWon[p.id] || 0;
    const team = getTeamForPlayer(p.id);
    if (!team) return tricksWon[p.id] || 0;
    return (tricksWon[team.memberIds[0]] || 0) + (tricksWon[team.memberIds[1]] || 0);
  };

  function playCard(cardId)   { socket.emit('play_card',        { cardId }); }
  function submitBid(bid)     { socket.emit('submit_bid',       { bid });    }
  function skipRoundSummary() { socket.emit('skip_round_summary');           }
  function endGame()          { socket.emit('end_game'); setShowEndConfirm(false); }

  return (
    <div className="h-screen flex flex-col bg-navy-950 overflow-hidden">

      {/* ── Full-screen overlays ────────────────────────── */}
      {showTrumpReveal && <TrumpReveal suit={trumpRevealSuit} round={currentRound} />}

      {showScoreboard && (
        <Scoreboard players={players} scores={scores} cumulativeScores={cumulativeScores}
          numRounds={config.numRounds} teams={teams} mode={mode}
          onClose={() => setShowScoreboard(false)} />
      )}

      {showRoundSummary && lastRoundData && (
        <RoundSummary data={lastRoundData} players={players} isHost={isHost}
          teams={teams} mode={mode} onSkip={skipRoundSummary} />
      )}

      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center animate-bounce-in">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="font-display text-lg text-cream-100 font-bold mb-2">End Game Early?</h3>
            <p className="text-white/40 text-sm font-body mb-5">Final scores will be shown to all players.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 bg-navy-700 hover:bg-navy-600 border border-white/10 text-white/60 font-body rounded-xl transition-colors text-sm">
                Cancel
              </button>
              <button onClick={endGame}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold font-body rounded-xl transition-colors text-sm">
                End Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 py-2 bg-navy-900 border-b border-white/[0.06] flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-bold text-cream-100 text-sm tracking-wide whitespace-nowrap">🃏 Open Jocker</span>
          {mode === 'team' && (
            <span className="text-[10px] font-body text-teal-400/70 border border-teal-500/20 rounded px-1.5 py-0.5 whitespace-nowrap">Teams</span>
          )}
          <button onClick={() => navigator.clipboard.writeText(roomCode)} title="Copy room code"
            className="font-mono text-xs text-white/30 border border-white/[0.08] rounded px-1.5 py-0.5 hover:text-coral-400 hover:border-coral-500/30 transition-colors whitespace-nowrap">
            {roomCode}
          </button>
          <span className="text-xs text-white/20 font-mono hidden sm:block whitespace-nowrap">
            R{currentRound}/{config.numRounds} · T{currentSubRound}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <VoiceBar socket={socket} players={players} myId={myId} />
          <button onClick={() => setShowScoreboard(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-navy-700 hover:bg-navy-600 border border-white/[0.08] rounded-lg text-white/60 hover:text-white/90 text-xs font-body transition-colors">
            📊<span className="hidden sm:inline ml-1">Scores</span>
          </button>
          {isHost && (
            <button onClick={() => setShowEndConfirm(true)}
              className="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/70 border border-red-500/30 rounded-lg text-red-400 text-xs font-body transition-colors whitespace-nowrap">
              End
            </button>
          )}
          <button onClick={() => setChatOpen(v => !v)}
            className="px-2.5 py-1.5 bg-navy-700 hover:bg-navy-600 border border-white/[0.08] rounded-lg text-white/60 text-xs font-body transition-colors md:hidden">
            💬
          </button>
        </div>
      </header>

      {/* ── Error toast ─────────────────────────────────── */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-xs font-body flex items-center justify-between animate-slide-up flex-shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-400/50 hover:text-red-300">✕</button>
        </div>
      )}

      {/* ── Phase banner ────────────────────────────────── */}
      <div className={`text-center py-1.5 text-xs font-body uppercase tracking-widest border-b border-white/[0.05] flex-shrink-0
        ${isMyTurn && phase !== 'round_end' ? 'bg-coral-500/15 text-coral-400' : 'text-white/30'}`}>
        {phase === 'bidding' && (isMyTurn
          ? '🎯 Check your hand below, then place your bid'
          : `Waiting for ${currentPlayerName} to bid`)}
        {phase === 'playing' && (isMyTurn ? '🃏 Your turn — tap a card to play it' : `${currentPlayerName}'s turn`)}
        {phase === 'round_end' && `Round ${currentRound} complete — next round starting…`}
      </div>

      {/* ── Mobile opponents strip (below md) ─────────── */}
      <div className="flex md:hidden flex-shrink-0 px-2 py-1.5 gap-1.5 overflow-x-auto bg-navy-900/60 border-b border-white/[0.05]">
        {players.filter(p => p.id !== myId).map(p => {
          const displayBid    = getDisplayBid(p);
          const displayTricks = getDisplayTricks(p);
          const isActive      = p.id === currentPlayerId;
          return (
            <div key={p.id}
              className={`flex flex-col items-center flex-shrink-0 rounded-lg px-2.5 py-1 border min-w-[56px]
                ${isActive ? 'bg-coral-500/15 border-coral-500/30' : 'bg-navy-800/60 border-white/[0.05]'}`}>
              <span className={`text-[11px] font-body truncate max-w-[5rem] leading-tight
                ${isActive ? 'text-coral-300' : 'text-white/60'}`}>{p.name}</span>
              <span className="font-mono text-[10px] text-white/35 leading-tight">
                B:{displayBid !== undefined ? displayBid : '—'}
                {phase === 'playing' && ` W:${displayTricks}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── md-only bid/trick strip (tablets 768–1023px) ── */}
      <div className="hidden md:flex lg:hidden flex-shrink-0 px-3 py-1.5 gap-2 overflow-x-auto bg-navy-900/60 border-b border-white/[0.05]">
        {players.map(p => {
          const displayBid    = getDisplayBid(p);
          const displayTricks = getDisplayTricks(p);
          const hasBid = displayBid !== undefined;
          return (
            <div key={p.id}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 flex-shrink-0 border
                ${p.id === currentPlayerId
                  ? 'bg-coral-500/15 border-coral-500/30'
                  : 'bg-navy-800/60 border-white/[0.05]'}`}>
              <span className={`text-[11px] font-body truncate max-w-[5rem]
                ${p.id === myId ? 'text-coral-300' : 'text-white/55'}`}>{p.name}</span>
              <span className="font-mono text-[11px] text-coral-400 font-bold flex-shrink-0">
                {hasBid ? displayBid : '—'}
              </span>
              {phase === 'playing' && hasBid && (
                <>
                  <span className="text-white/20 text-[10px]">/</span>
                  <span className="font-mono text-[11px] text-teal-400 font-bold flex-shrink-0">
                    {displayTricks}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Main 3-column layout ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left sidebar: players + chat */}
        <aside className="hidden md:flex flex-col w-52 border-r border-white/[0.06] flex-shrink-0 bg-navy-900/40 overflow-hidden">
          <div className="flex-shrink-0 p-3 overflow-y-auto" style={{ maxHeight: '55%' }}>
            <PlayerList players={players} bids={bids} tricksWon={tricksWon}
              currentPlayerId={currentPlayerId} myId={myId} phase={phase}
              teams={teams} mode={mode} />
          </div>
          <div className="flex-1 min-h-0 p-3 pt-0">
            <ChatPanel socket={socket} />
          </div>
        </aside>

        {/* Centre column */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">

          <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden">
            {phase === 'bidding' ? (
              <div className="w-full max-w-lg h-full">
                <BidPanel
                  currentRound={currentRound}
                  onSubmitBid={submitBid}
                  trumpSuit={trumpSuit}
                  myHand={myHand || []}
                  players={players}
                  bids={bids}
                  myId={myId}
                  isMyTurn={isMyTurn}
                  alreadyBid={bids[myId] !== undefined}
                  mode={mode}
                  teams={teams}
                />
              </div>
            ) : (
              <div className="w-full max-w-xl">
                <GameTable
                  table={table || []}
                  players={players}
                  trumpSuit={trumpSuit}
                  currentRound={currentRound}
                  currentSubRound={currentSubRound}
                  currentPlayerId={currentPlayerId}
                  lastTrickWinner={lastTrickWinner}
                  teams={teams}
                  mode={mode}
                />
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.06] flex-shrink-0" />

          {/* My bid / tricks indicator above the hand */}
          <div className="flex-shrink-0 flex items-center justify-center gap-4 px-3 py-1 bg-navy-900/50 border-b border-white/[0.04]">
            <span className="text-xs font-body text-white/35">
              Bid <span className="font-mono font-bold text-coral-400">
                {bids[myId] !== undefined ? bids[myId] : '—'}
              </span>
            </span>
            {phase === 'playing' && (
              <span className="text-xs font-body text-white/35">
                Won <span className="font-mono font-bold text-teal-400">
                  {mode === 'team'
                    ? (() => { const t = getTeamForPlayer(myId); return t ? (tricksWon[t.memberIds[0]] || 0) + (tricksWon[t.memberIds[1]] || 0) : tricksWon[myId] || 0; })()
                    : tricksWon[myId] || 0}
                </span>
              </span>
            )}
          </div>

          <div className="flex-shrink-0 bg-navy-900/70 py-3 px-2 overflow-x-auto"
            style={{ minHeight: 120 }}>
            <PlayerHand
              hand={myHand || []}
              trumpSuit={trumpSuit}
              baseSuit={baseSuit}
              isMyTurn={isMyTurn && phase === 'playing'}
              onPlayCard={playCard}
              phase={phase}
            />
          </div>

          {/* Bottom score strip — mobile only (desktop has right sidebar) */}
          <div className="flex lg:hidden flex-shrink-0 overflow-x-auto gap-3 px-3 py-1.5 bg-navy-950/80 border-t border-white/[0.05]">
            {[...players]
              .sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0))
              .map(p => {
                const score = cumulativeScores[p.id] || 0;
                return (
                  <div key={p.id} className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[11px] font-body truncate max-w-[4rem] ${p.id === myId ? 'text-coral-300' : 'text-white/45'}`}>
                      {p.name}
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${score > 0 ? 'text-teal-400' : score < 0 ? 'text-red-400' : 'text-white/30'}`}>
                      {score > 0 ? `+${score}` : score}
                    </span>
                  </div>
                );
              })}
          </div>
        </main>

        {/* Right sidebar: bid & trick tracker */}
        <aside className="hidden lg:flex flex-col w-44 border-l border-white/[0.06] p-3 gap-1.5 overflow-y-auto flex-shrink-0 bg-navy-900/40">
          <p className="text-[10px] uppercase tracking-widest text-white/25 font-body mb-1">Bids</p>
          {players.map(p => {
            const displayBid = getDisplayBid(p);
            return (
              <div key={`bid-${p.id}`} className="flex items-center justify-between bg-navy-800/60 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-body text-white/55 truncate flex-1 mr-1">{p.name}</span>
                <span className="font-mono text-xs text-coral-400 font-bold flex-shrink-0">
                  {displayBid !== undefined ? displayBid : '—'}
                </span>
              </div>
            );
          })}
          {phase === 'playing' && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-body mt-3 mb-1">Won</p>
              {players.map(p => (
                <div key={`won-${p.id}`} className="flex items-center justify-between bg-navy-800/60 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-body text-white/55 truncate flex-1 mr-1">{p.name}</span>
                  <span className="font-mono text-xs text-teal-400 font-bold flex-shrink-0">
                    {getDisplayTricks(p)}
                  </span>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>

      {/* Mobile chat drawer */}
      {chatOpen && (
        <div className="fixed inset-x-0 bottom-0 h-60 bg-navy-800 border-t border-coral-500/20 z-40 md:hidden p-2 animate-slide-up">
          <ChatPanel socket={socket} compact />
        </div>
      )}
    </div>
  );
}
