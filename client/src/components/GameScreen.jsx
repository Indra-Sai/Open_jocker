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
  } = gameState;

  const isMyTurn  = currentPlayerId === myId;
  const myPlayer  = players.find(p => p.id === myId);
  const isHost    = myPlayer?.isHost;
  const baseSuit  = table?.length > 0 ? table[0].card.suit : null;
  const needsBid  = phase === 'bidding' && isMyTurn && bids[myId] === undefined;
  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name || '…';

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
          numRounds={config.numRounds} onClose={() => setShowScoreboard(false)} />
      )}

      {showRoundSummary && lastRoundData && (
        <RoundSummary data={lastRoundData} players={players} isHost={isHost} onSkip={skipRoundSummary} />
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

      {/* ── Main 3-column layout ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left sidebar: players + chat */}
        <aside className="hidden md:flex flex-col w-52 border-r border-white/[0.06] flex-shrink-0 bg-navy-900/40 overflow-hidden">
          <div className="flex-shrink-0 p-3 overflow-y-auto" style={{ maxHeight: '55%' }}>
            <PlayerList players={players} bids={bids} tricksWon={tricksWon}
              currentPlayerId={currentPlayerId} myId={myId} phase={phase} />
          </div>
          <div className="flex-1 min-h-0 p-3 pt-0">
            <ChatPanel socket={socket} />
          </div>
        </aside>

        {/* Centre column */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/*
            ── TABLE ZONE (upper, flex-1) ──────────────────
            During BIDDING → BidPanel sits here (inline, never overlaid).
            During PLAYING → GameTable with cards on table.
            This zone NEVER goes below the hand divider.
          */}
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
                />
              </div>
            )}
          </div>

          {/* Divider — hard boundary, hand never moves above this */}
          <div className="h-px bg-white/[0.06] flex-shrink-0" />

          {/*
            ── HAND ZONE (lower, fixed) ─────────────────────
            ALWAYS visible. NEVER covered.
            Cards are scrollable horizontally if hand is large.
          */}
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
        </main>

        {/* Right sidebar: bid & trick tracker */}
        <aside className="hidden lg:flex flex-col w-40 border-l border-white/[0.06] p-3 gap-1.5 overflow-y-auto flex-shrink-0 bg-navy-900/40">
          <p className="text-[10px] uppercase tracking-widest text-white/25 font-body mb-1">Bids</p>
          {players.map(p => (
            <div key={`bid-${p.id}`} className="flex items-center justify-between bg-navy-800/60 rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-body text-white/55 truncate flex-1 mr-1">{p.name}</span>
              <span className="font-mono text-xs text-coral-400 font-bold flex-shrink-0">
                {bids[p.id] !== undefined ? bids[p.id] : '—'}
              </span>
            </div>
          ))}
          {phase === 'playing' && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-body mt-3 mb-1">Won</p>
              {players.map(p => (
                <div key={`won-${p.id}`} className="flex items-center justify-between bg-navy-800/60 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-body text-white/55 truncate flex-1 mr-1">{p.name}</span>
                  <span className="font-mono text-xs text-teal-400 font-bold flex-shrink-0">
                    {tricksWon[p.id] || 0}
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
