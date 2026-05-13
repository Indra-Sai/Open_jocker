// components/ChatPanel.jsx
import { useState, useRef, useEffect } from 'react';
import useGameStore from '../store/gameStore';

export default function ChatPanel({ socket, compact = false }) {
  const messages = useGameStore(s => s.chatMessages);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function send() {
    if (!input.trim() || !socket) return;
    socket.emit('chat_message', { text: input.trim() });
    setInput('');
  }

  return (
    <div className={`flex flex-col bg-navy-900/60 rounded-xl border border-white/[0.06] overflow-hidden ${compact ? 'h-48' : 'h-full'}`}>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-white/[0.05] flex-shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/25 font-body">Chat</span>
      </div>

      {/* Messages — scrollable, shrinks to make room for input */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <p className="text-white/15 text-xs italic text-center pt-3 font-body">No messages yet</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="text-xs font-body leading-relaxed break-words">
            <span className="text-coral-400/80 font-semibold">{msg.playerName}: </span>
            <span className="text-white/60">{msg.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input row — always at bottom, never hidden */}
      <div className="flex-shrink-0 flex items-center gap-1.5 p-2 border-t border-white/[0.05]">
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message…" maxLength={200}
          className="flex-1 min-w-0 bg-navy-700/60 border border-white/[0.08] focus:border-coral-500/40 rounded-lg px-2 py-1.5 text-xs text-white/75 placeholder-white/20 outline-none transition-colors"
        />
        <button onClick={send}
          className="flex-shrink-0 w-7 h-7 bg-coral-500/20 hover:bg-coral-500/40 border border-coral-500/30 rounded-lg text-coral-400 text-xs transition-colors flex items-center justify-center">
          ↑
        </button>
      </div>
    </div>
  );
}
