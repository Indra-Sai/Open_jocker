// components/TrumpReveal.jsx
import { getSuitColorUI, getSuitLabel } from '../utils/cardHelpers';

export default function TrumpReveal({ suit, trumpCard, round }) {
  const col = getSuitColorUI(suit);
  return (
    <div className="fixed inset-0 bg-navy-950/90 backdrop-blur-md z-50 flex items-center justify-center pointer-events-none">
      <div className="text-center animate-trump-reveal">
        <p className="text-white/35 text-xs uppercase tracking-widest font-body mb-5">Round {round} — Trump Suit</p>

        {/* Show actual trump card if available */}
        {trumpCard ? (
          <div className="flex flex-col items-center gap-3">
            {/* Card visual */}
            <div className={`w-24 sm:w-32 rounded-2xl bg-cream-100 border-4 border-white/30
              shadow-2xl flex flex-col items-center justify-center py-4 gap-1`}
              style={{ aspectRatio: '2/3' }}>
              <span className={`text-3xl sm:text-5xl font-bold leading-none ${getSuitColorUI(suit) === 'text-white' ? 'text-gray-900' : 'text-red-600'}`}>
                {trumpCard.rank}
              </span>
              <span className={`text-4xl sm:text-6xl leading-none ${getSuitColorUI(suit) === 'text-white' ? 'text-gray-900' : 'text-red-600'}`}>
                {suit}
              </span>
            </div>
            <p className={`text-xl sm:text-2xl font-display font-bold mt-1 ${col}`}>{getSuitLabel(suit)}</p>
          </div>
        ) : (
          <div>
            <div className={`text-[5rem] sm:text-[8rem] leading-none font-bold ${col}`}
              style={{ textShadow: '0 0 60px currentColor' }}>
              {suit}
            </div>
            <p className={`text-2xl sm:text-3xl font-display font-bold mt-2 ${col}`}>{getSuitLabel(suit)}</p>
          </div>
        )}

        <p className="text-white/25 text-sm font-body mt-3">is trump this round</p>
      </div>
    </div>
  );
}
