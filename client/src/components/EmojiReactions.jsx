// EmojiReactions.jsx — floating emoji bubbles + picker bar
import { useState } from 'react';
import useGameStore from '../store/gameStore';

const EMOJIS = ['🔥','😂','💀','👏','😤','🎉','🫡','💯','🤡','😱','🤌','👀'];

export default function EmojiReactions({ socket, compact = false }) {
  const reactions = useGameStore(s => s.reactions);
  const [open, setOpen] = useState(false);

  function sendReaction(emoji) {
    socket.emit('send_reaction', { emoji });
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Floating reaction bubbles */}
      <div className="fixed bottom-28 right-4 flex flex-col-reverse gap-1.5 pointer-events-none z-50"
        style={{ maxHeight: 200, overflow: 'hidden' }}>
        {reactions.map(r => (
          <div key={r.id}
            className="flex items-center gap-1.5 bg-navy-800/90 border border-white/10 rounded-full
              px-3 py-1 text-sm animate-slide-up backdrop-blur-sm shadow-lg"
            style={{ animationDuration: '300ms' }}>
            <span className="text-base">{r.emoji}</span>
            <span className="text-white/60 font-body text-xs truncate max-w-[6rem]">{r.playerName}</span>
          </div>
        ))}
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`${compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-1.5 text-xs'}
          bg-navy-700 hover:bg-navy-600 border border-white/[0.08] rounded-lg
          text-white/60 hover:text-white/90 font-body transition-colors`}
        title="Send reaction">
        😄
      </button>

      {/* Emoji picker */}
      {open && (
        <div className="absolute right-0 bottom-full mb-2 bg-navy-800 border border-white/10
          rounded-2xl p-2 shadow-2xl z-50 animate-slide-up" style={{ width: 176 }}>
          <div className="grid grid-cols-4 gap-1">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => sendReaction(e)}
                className="text-xl w-10 h-10 rounded-xl hover:bg-white/10 transition-colors
                  flex items-center justify-center active:scale-90">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
