// App.jsx

import useGameStore from './store/gameStore';
import { useSocket } from './hooks/useSocket';
import HomeScreen from './components/HomeScreen';
import WaitingRoom from './components/WaitingRoom';
import GameScreen from './components/GameScreen';
import GameOver from './components/GameOver';

export default function App() {
  useSocket();

  const socket      = useGameStore(s => s.socket);
  const gameState   = useGameStore(s => s.gameState);
  const playerId    = useGameStore(s => s.playerId);
  const roomCode    = useGameStore(s => s.roomCode);
  const connected   = useGameStore(s => s.connected);
  const reset       = useGameStore(s => s.reset);

  const phase = gameState?.phase;

  function handleNewGame() {
    sessionStorage.removeItem('openjocker_session');
    reset();
  }

  const enriched = gameState ? { ...gameState, roomCode, myId: playerId } : null;

  let screen;
  if (!roomCode || !gameState) {
    screen = <HomeScreen socket={socket} />;
  } else if (phase === 'waiting') {
    screen = <WaitingRoom socket={socket} gameState={enriched} playerId={playerId} />;
  } else if (phase === 'game_over') {
    screen = (
      <GameOver
        players={gameState.players}
        cumulativeScores={gameState.cumulativeScores}
        teams={gameState.teams}
        mode={gameState.mode}
        onNewGame={handleNewGame}
      />
    );
  } else {
    screen = <GameScreen socket={socket} gameState={enriched} playerId={playerId} />;
  }

  return (
    <>
      {connected === false && (
        <div className="fixed top-0 inset-x-0 z-[100] px-4 py-2.5 bg-red-950/95
          border-b border-red-500/30 backdrop-blur-sm flex items-center justify-center
          gap-2 text-sm font-body text-red-200 animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
          Connection lost — reconnecting…
        </div>
      )}
      {screen}
    </>
  );
}
