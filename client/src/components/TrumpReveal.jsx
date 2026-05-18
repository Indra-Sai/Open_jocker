// components/TrumpReveal.jsx
import { getSuitColorUI, getSuitLabel } from '../utils/cardHelpers';

export default function TrumpReveal({ suit, round }) {
  const col = getSuitColorUI(suit);
  return (
    <div className="fixed inset-0 bg-navy-950/90 backdrop-blur-md z-50 flex items-center justify-center pointer-events-none">
      <div className="text-center animate-trump-reveal">
        <p className="text-white/35 text-xs uppercase tracking-widest font-body mb-5">Round {round} — Trump Suit</p>
        <div className={`text-[5rem] sm:text-[8rem] leading-none font-bold ${col}`} style={{ textShadow: '0 0 60px currentColor' }}>
          {suit}
        </div>
        <p className={`text-2xl sm:text-3xl font-display font-bold mt-2 ${col}`}>{getSuitLabel(suit)}</p>
        <p className="text-white/25 text-sm font-body mt-3">is trump this round</p>
      </div>
    </div>
  );
}
