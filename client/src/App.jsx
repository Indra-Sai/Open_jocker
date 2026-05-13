// App.jsx

import { useEffect } from 'react';
import useGameStore from './store/gameStore';
import { useSocket } from './hooks/useSocket';
import HomeScreen from './components/HomeScreen';
import WaitingRoom from './components/WaitingRoom';
import GameScreen from './components/GameScreen';
import GameOver from './components/GameOver';

export default function App() {
  useSocket(); // establishes socket connection
  
  const socket = useGameStore(s => s.socket);
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const roomCode = useGameStore(s => s.roomCode);
  const reset = useGameStore(s => s.reset);

  // Determine current screen
  const phase = gameState?.phase;

  function handleNewGame() {
    sessionStorage.removeItem('openjocker_session');
    reset();
  }

  // No room yet — show home
  if (!roomCode || !gameState) {
    return <HomeScreen socket={socket} />;
  }

  // Enrich gameState with roomCode and myId
  const enriched = { ...gameState, roomCode, myId: playerId };

  if (phase === 'waiting') {
    return <WaitingRoom socket={socket} gameState={enriched} playerId={playerId} />;
  }

  if (phase === 'game_over') {
    return (
      <GameOver
        players={gameState.players}
        cumulativeScores={gameState.cumulativeScores}
        onNewGame={handleNewGame}
      />
    );
  }

  // bidding | playing | round_end
  return <GameScreen socket={socket} gameState={enriched} playerId={playerId} />;
}
