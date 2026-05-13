// components/BidPanel.jsx
// Renders INLINE in the centre "table" area during the bidding phase.
// The player's hand below is NEVER covered — this is NOT a fixed overlay.

import { useState } from 'react';
import { getSuitColorUI, getSuitLabel } from '../utils/cardHelpers';

export default function BidPanel({ currentRound, onSubmitBid, trumpSuit, myHand, players, bids, myId }) {
  const [bid, setBid] = useState(0);
  const max = currentRound;
  const trumpCount = (myHand || []).filter(c => c.suit === trumpSuit).length;

  // Who has already bid vs still waiting
  const bidsDone   = players.filter(p => bids[p.id] !== undefined);
  const bidsWaiting = players.filter(p => bids[p.id] === undefined && p.id !== myId);
  const iAmWaiting  = bids[myId] === undefined;

  return (
    <div className="flex flex-col items-center justify-center gap-5 w-full h-full px-4 py-6">

      {/* Title */}
      <div className="text-center">
        <p className="text-white/30 text-[10px] uppercase tracking-widest font-body mb-1">
          Round {currentRound} · Bidding Phase
        </p>
        <h2 className="font-display text-2xl font-bold text-cream-100">How many tricks will you win?</h2>
        {trumpSuit && (
          <p className={`mt-1 text-sm font-body font-semibold ${getSuitColorUI(trumpSuit)}`}>
            {trumpSuit} {getSuitLabel(trumpSuit)} is trump · {trumpCount} trump card{trumpCount !== 1 ? 's' : ''} in your hand
          </p>
        )}
      </div>

      {/* ── Compact stepper: −  [ N ]  + ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setBid(Math.max(0, bid - 1))}
          className="w-12 h-12 rounded-2xl bg-navy-700 hover:bg-navy-600 border border-white/10 hover:border-white/25 text-white text-2xl font-bold transition-all active:scale-95 flex items-center justify-center"
        >−</button>

        <div className="w-20 h-20 rounded-2xl bg-coral-500 flex items-center justify-center shadow-xl shadow-coral-500/30">
          <span className="font-display text-5xl font-black text-white leading-none">{bid}</span>
        </div>

        <button
          onClick={() => setBid(Math.min(max, bid + 1))}
          className="w-12 h-12 rounded-2xl bg-navy-700 hover:bg-navy-600 border border-white/10 hover:border-white/25 text-white text-2xl font-bold transition-all active:scale-95 flex items-center justify-center"
        >+</button>
      </div>

      {/* Range hint */}
      <p className="text-white/25 text-xs font-body">0 – {max} tricks available this round</p>

      {/* Confirm button */}
      <button
        onClick={() => onSubmitBid(bid)}
        className="px-10 py-3 bg-coral-500 hover:bg-coral-400 active:scale-95 text-white font-bold font-body rounded-2xl transition-all text-base shadow-lg shadow-coral-500/20 hover:shadow-coral-500/35"
      >
        Confirm — Bid {bid} trick{bid !== 1 ? 's' : ''}
      </button>

      {/* Who has already bid */}
      {bidsDone.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {bidsDone.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/25 rounded-full px-3 py-1 text-xs font-body text-teal-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
              {p.name} bid {bids[p.id]}
            </span>
          ))}
          {bidsWaiting.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1 text-xs font-body text-white/30">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse flex-shrink-0" />
              {p.name}…
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
