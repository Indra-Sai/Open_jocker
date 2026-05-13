// components/PlayerHand.jsx
import { useState } from 'react';
import PlayingCard from './PlayingCard';
import { isLegalToPlay, sortHand } from '../utils/cardHelpers';

export default function PlayerHand({ hand, trumpSuit, baseSuit, isMyTurn, onPlayCard, phase }) {
  const [hovered, setHovered] = useState(null);
  const sorted = sortHand(hand, trumpSuit);
  const canPlay = isMyTurn && phase === 'playing';

  let label = `Your hand (${hand.length} card${hand.length !== 1 ? 's' : ''})`;
  if (phase === 'bidding') label = 'Your hand — place your bid below';
  if (canPlay)             label = 'Select a card to play';

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] uppercase tracking-widest font-body text-white/25 flex-shrink-0">{label}</p>

      {/* Horizontal scroll — cards never wrap/stack vertically */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="flex items-end gap-1.5 px-2" style={{ width: 'max-content', minWidth: '100%', justifyContent: 'center' }}>
          {sorted.map((card, i) => {
            const legal  = canPlay ? isLegalToPlay(card, hand, baseSuit) : true;
            const dimmed = canPlay && !legal;
            const lifted = hovered === card.id && !dimmed;

            return (
              <div
                key={card.id}
                style={{
                  transform: lifted ? 'translateY(-14px)' : 'translateY(0)',
                  zIndex: lifted ? 20 : i,
                  position: 'relative',
                  transition: 'transform 0.12s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={() => setHovered(card.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  dimmed={dimmed}
                  highlighted={canPlay && legal}
                  onClick={() => canPlay && legal && onPlayCard(card.id)}
                />
              </div>
            );
          })}

          {hand.length === 0 && (
            <p className="text-white/20 italic text-sm py-8 px-4">No cards remaining</p>
          )}
        </div>
      </div>
    </div>
  );
}
