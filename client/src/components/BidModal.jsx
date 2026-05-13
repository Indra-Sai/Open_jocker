// components/BidModal.jsx — bottom-sheet panel, hand stays visible above
import { useState } from 'react';
import { getSuitColor } from '../utils/cardHelpers';

export default function BidModal({ currentRound, onSubmitBid, trumpSuit, myHand }) {
  const [bid, setBid] = useState(0);
  const max = currentRound;
  const trumpCount = myHand ? myHand.filter(c => c.suit === trumpSuit).length : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      {/* Gradient scrim so hand above is still readable */}
      <div className="absolute inset-x-0 bottom-full h-12 bg-gradient-to-t from-navy-950/70 to-transparent pointer-events-none" />

      <div className="bg-navy-800 border-t-2 border-coral-500/50 shadow-2xl px-4 pt-4 pb-6 safe-bottom">

        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-cream-100 leading-tight">Place Your Bid</h2>
            <p className="text-white/35 text-xs font-body mt-0.5">
              Round {currentRound} · up to {max} trick{max !== 1 ? 's' : ''}
              {trumpSuit && (
                <span className={`ml-2 font-bold ${getSuitColor(trumpSuit)}`}>
                  {trumpSuit} trump · {trumpCount} in hand
                </span>
              )}
            </p>
          </div>
          {/* Big bid badge */}
          <div className="w-14 h-14 rounded-2xl bg-coral-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="font-display text-3xl font-black text-white">{bid}</span>
          </div>
        </div>

        {/* Quick-pick row */}
        <div className="flex gap-2 flex-wrap mb-4">
          {Array.from({ length: max + 1 }, (_, i) => i).map(n => (
            <button key={n} onClick={() => setBid(n)}
              className={`h-9 min-w-[2.25rem] px-3 rounded-xl text-sm font-bold font-body transition-all
                ${bid === n
                  ? 'bg-coral-500 text-white shadow-md scale-105'
                  : 'bg-navy-700 text-white/45 hover:bg-navy-600 hover:text-white/80 border border-white/[0.08]'}`}>
              {n}
            </button>
          ))}
        </div>

        {/* Stepper + confirm */}
        <div className="flex items-center gap-2">
          <button onClick={() => setBid(Math.max(0, bid - 1))}
            className="w-11 h-11 rounded-xl bg-navy-700 border border-white/10 text-white/60 text-xl font-bold hover:bg-navy-600 transition-colors flex-shrink-0">
            −
          </button>
          <button onClick={() => setBid(Math.min(max, bid + 1))}
            className="w-11 h-11 rounded-xl bg-navy-700 border border-white/10 text-white/60 text-xl font-bold hover:bg-navy-600 transition-colors flex-shrink-0">
            +
          </button>
          <button onClick={() => onSubmitBid(bid)}
            className="flex-1 h-11 bg-coral-500 hover:bg-coral-400 text-white font-bold font-body rounded-xl transition-all text-base shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.98]">
            Bid {bid} trick{bid !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
