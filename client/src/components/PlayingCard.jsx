// components/PlayingCard.jsx
import { getSuitColor } from '../utils/cardHelpers';

// Use inline styles for pixel-perfect card sizing
const SIZE = {
  sm: { width: 44,  height: 62,  rankPx: 11, suitPx: 13, centerPx: 16 },
  md: { width: 56,  height: 80,  rankPx: 13, suitPx: 15, centerPx: 22 },
  lg: { width: 72,  height: 100, rankPx: 15, suitPx: 18, centerPx: 28 },
  xl: { width: 88,  height: 124, rankPx: 18, suitPx: 22, centerPx: 36 },
};

export default function PlayingCard({ card, onClick, dimmed = false, isOnTable = false, autoPlayed = false, size = 'md', highlighted = false }) {
  const s   = SIZE[size] || SIZE.md;
  const col = getSuitColor(card.suit);

  return (
    <div
      onClick={!dimmed && !isOnTable ? onClick : undefined}
      className={`
        playing-card flex flex-col select-none relative flex-shrink-0
        ${dimmed     ? 'dimmed' : ''}
        ${isOnTable  ? 'is-on-table cursor-default' : ''}
        ${highlighted ? 'ring-2 ring-coral-400 ring-offset-1 ring-offset-navy-900' : ''}
        ${autoPlayed  ? 'ring-2 ring-yellow-400' : ''}
      `}
      style={{ width: s.width, height: s.height, padding: 4 }}
      title={autoPlayed ? 'Auto-played' : undefined}
    >
      {/* Top-left corner */}
      <div className={`flex flex-col items-start leading-none ${col}`} style={{ gap: 0 }}>
        <span style={{ fontSize: s.rankPx, fontWeight: 900, lineHeight: 1, fontFamily: 'Playfair Display, serif' }}>{card.rank}</span>
        <span style={{ fontSize: s.suitPx, lineHeight: 1 }}>{card.suit}</span>
      </div>

      {/* Centre large suit */}
      <div className={`flex-1 flex items-center justify-center ${col}`}>
        <span style={{ fontSize: s.centerPx, lineHeight: 1 }}>{card.suit}</span>
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div className={`flex flex-col items-end leading-none rotate-180 ${col}`} style={{ gap: 0 }}>
        <span style={{ fontSize: s.rankPx, fontWeight: 900, lineHeight: 1, fontFamily: 'Playfair Display, serif' }}>{card.rank}</span>
        <span style={{ fontSize: s.suitPx, lineHeight: 1 }}>{card.suit}</span>
      </div>

      {autoPlayed && (
        <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none shadow">
          AUTO
        </span>
      )}
    </div>
  );
}
