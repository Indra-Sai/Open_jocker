// components/GameTable.jsx
import { useState, useEffect } from 'react';
import PlayingCard from './PlayingCard';
import { getSuitColorUI, getSuitLabel } from '../utils/cardHelpers';

export default function GameTable({ table, players, trumpSuit, currentRound, currentSubRound, currentPlayerId, lastTrickWinner }) {
  const [winnerToast, setWinnerToast] = useState(null);
  const playerMap = {};
  players.forEach(p => { playerMap[p.id] = p; });
  const baseSuit = table.length > 0 ? table[0].card.suit : null;

  useEffect(() => {
    if (lastTrickWinner) {
      setWinnerToast(lastTrickWinner);
      const t = setTimeout(() => setWinnerToast(null), 2200);
      return () => clearTimeout(t);
    }
  }, [lastTrickWinner]);

  // Trump badge: red suits get dark red bg, black suits get light slate bg so the white symbol pops
  const isRedSuit = ['♥','♦'].includes(trumpSuit);
  const trumpBg   = isRedSuit ? 'bg-red-950 border-red-500/60' : 'bg-slate-600 border-slate-400/50';

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Trump pill — always high-contrast */}
      {trumpSuit && (
        <div className={`flex items-center gap-2.5 rounded-2xl px-5 py-2.5 border-2 shadow-lg ${trumpBg}`}>
          <span className="text-white/60 text-[10px] uppercase tracking-widest font-body font-semibold">Trump</span>
          <span className={`text-3xl leading-none font-bold ${getSuitColorUI(trumpSuit)}`}
            style={{ textShadow: '0 0 16px currentColor' }}>
            {trumpSuit}
          </span>
          <span className={`text-base font-bold font-body ${getSuitColorUI(trumpSuit)}`}>
            {getSuitLabel(trumpSuit)}
          </span>
        </div>
      )}

      {/* Round / trick counter */}
      <div className="flex gap-3 text-[11px] text-white/30 font-mono uppercase tracking-wider">
        <span>Round {currentRound}</span><span>·</span><span>Trick {currentSubRound}</span>
      </div>

      {/* Trick winner toast */}
      {winnerToast && (
        <div className="animate-bounce-in bg-teal-500/20 border border-teal-500/40 rounded-xl px-5 py-2 text-teal-300 text-sm font-body font-semibold">
          🏆 {playerMap[winnerToast]?.name || winnerToast} wins the trick!
        </div>
      )}

      {/* Cards on table */}
      <div className="w-full min-h-[140px] flex items-center justify-center">
        {table.length === 0 ? (
          <div className="flex flex-col items-center gap-2 opacity-35">
            <div className="rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center"
              style={{ width: 72, height: 100 }}>
              <span className="text-white/25 text-3xl">?</span>
            </div>
            <p className="text-white/20 italic text-xs font-body">Waiting for first card…</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-5 justify-center items-end">
            {table.map(({ playerId, card, autoPlayed }) => (
              <div key={card.id} className="flex flex-col items-center gap-2 animate-bounce-in">
                <PlayingCard card={card} isOnTable size="lg" autoPlayed={autoPlayed} />
                <span className={`text-xs font-body font-medium ${playerId === currentPlayerId ? 'text-coral-400' : 'text-white/45'}`}>
                  {playerMap[playerId]?.name || 'Player'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Base suit pill */}
      {baseSuit && (
        <div className="flex items-center gap-2 bg-navy-800/80 border border-white/[0.08] rounded-xl px-4 py-1.5">
          <span className="text-white/40 text-xs font-body">Base suit</span>
          <span className={`text-lg font-bold leading-none ${getSuitColorUI(baseSuit)}`}>{baseSuit}</span>
          <span className={`text-xs font-medium font-body ${getSuitColorUI(baseSuit)}`}>{getSuitLabel(baseSuit)}</span>
        </div>
      )}
    </div>
  );
}
