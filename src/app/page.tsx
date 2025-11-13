'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { WordGame, GameMode as GameModeType } from '@/lib/gameLogic';
import { wordTopics } from '@/data/wordTopics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GameBoard from '@/components/GameBoard';
import JoinRoom from '@/components/JoinRoom';
import RoomLobby from '@/components/RoomLobby';
import GameSetup from '@/components/GameSetup';
import { Player as GamePlayer } from '@/lib/gameLogic';
import { ThemeToggle } from '@/components/ThemeToggle';

type AppMode = 'local' | 'online';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}


interface GameRoom {
  id: string;
  hostId: string;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'finished';
  currentTopic?: string;
  gameWord?: string;
  gameMode?: GameModeType;
  currentSpin: number;
  totalSpins: number;
  spinOrder: (boolean | 'similar' | 'imposter')[];
}

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>('local');
  const [game, setGame] = useState<WordGame | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [gameStarted, setGameStarted] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  
  // Online game state
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');

  const startNewGame = (gameMode: GameModeType = 'similar-word', players: GamePlayer[] = [], isOnline: boolean = false) => {
    const topic = wordTopics.find(t => t.id === selectedTopic);
    if (topic) {
      const newGame = new WordGame(topic, gameMode, players, isOnline);
      setGame(newGame);
      setGameStarted(true);
      setShowSetup(false);
    }
  };

  const handleStartWithSetup = (gameMode: GameModeType, players: GamePlayer[]) => {
    startNewGame(gameMode, players);
  };

  const resetGame = () => {
    setGame(null);
    setSelectedTopic('');
    setGameStarted(false);
    setShowSetup(false);
    setRoom(null);
    setCurrentPlayerId('');
  };

  const createRoom = async (hostName: string) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostId: `player_${Date.now()}`,
          hostName 
        })
      });
      
      const data = await response.json();
      if (data.room) {
        setRoom(data.room);
        setCurrentPlayerId(data.room.hostId);
        setGameStarted(true);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = async (roomId: string, playerName: string) => {
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId,
          playerId: `player_${Date.now()}`,
          playerName 
        })
      });
      
      const data = await response.json();
      if (data.room) {
        setRoom(data.room);
        setCurrentPlayerId(data.room.players.find((p: Player) => p.name === playerName)?.id || '');
        setGameStarted(true);
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const startOnlineGame = async (topic: string, gameMode: GameModeType) => {
    if (!room) return;
    
    try {
      const response = await fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, topic, gameMode })
      });
      
      const data = await response.json();
      if (data.room) {
        setRoom(data.room);
        // Start local game with the same topic and mode, but mark as online
        const topicData = wordTopics.find(t => t.id === topic);
        if (topicData) {
          setSelectedTopic(topic);
          // Convert room players to game players
          const gamePlayers: GamePlayer[] = data.room.players.map((p: { id: string; name: string; isHost: boolean; isReady: boolean }, index: number) => ({
            id: index + 1,
            name: p.name
          }));
          startNewGame(gameMode, gamePlayers, true); // isOnline = true
        }
      }
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const leaveRoom = () => {
    setRoom(null);
    setCurrentPlayerId('');
    setGameStarted(false);
  };

  // Online mode - show join/create room
  if (appMode === 'online' && !room) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 p-4 relative">
        <div className="absolute top-4 left-4 z-10">
          <ThemeToggle />
        </div>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <JoinRoom onJoinRoom={joinRoom} onCreateRoom={createRoom} />
          </motion.div>
        </div>
      </div>
    );
  }

  // Online mode - show room lobby
  if (appMode === 'online' && room && !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 p-4 relative">
        <div className="absolute top-4 left-4 z-10">
          <ThemeToggle />
        </div>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <RoomLobby
              room={room}
              currentPlayerId={currentPlayerId}
              onStartGame={startOnlineGame}
              onLeaveRoom={leaveRoom}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // Show setup screen if topic is selected but game hasn't started
  if (!gameStarted && appMode === 'local' && showSetup && selectedTopic) {
    return (
      <GameSetup
        selectedTopic={selectedTopic}
        onStartGame={handleStartWithSetup}
        onBack={() => setShowSetup(false)}
      />
    );
  }

  // Local mode - show topic selection
  if (!gameStarted && appMode === 'local') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 left-4">
          <ThemeToggle />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-center space-y-2">
                  <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                    WordQuest
                  </div>
                  <p className="text-lg text-muted-foreground">משחק המילים</p>
                  <p className="text-sm text-muted-foreground">בחר מצב משחק</p>
                </div>
              </motion.div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={() => setAppMode('local')}
                  variant={appMode === 'local' ? 'default' : 'outline'}
                  className={`flex-1 transition-all ${
                    appMode === 'local' 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg' 
                      : 'border-2 hover:border-purple-400'
                  }`}
                  size="lg"
                >
                  🎮 מקומי
                </Button>
                <Button
                  onClick={() => setAppMode('online')}
                  variant={appMode === 'online' ? 'default' : 'outline'}
                  className={`flex-1 transition-all ${
                    appMode === 'online' 
                      ? 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 shadow-lg' 
                      : 'border-2 hover:border-pink-400'
                  }`}
                  size="lg"
                >
                  🌐 אונליין
                </Button>
              </div>
              
              {appMode === 'local' && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium">בחר נושא:</label>
                  <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר נושא..." />
                    </SelectTrigger>
                    <SelectContent>
                      {wordTopics.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
              
              {appMode === 'local' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button 
                    onClick={() => setShowSetup(true)} 
                    disabled={!selectedTopic}
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold"
                    size="lg"
                  >
                    🎯 התחל משחק
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 relative">
      <div className="absolute top-4 left-4 z-10">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              WordQuest
            </h1>
            <p className="text-lg text-muted-foreground">נושא: {game?.getState().topic.name}</p>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <GameBoard 
            game={game!} 
            onReset={resetGame} 
            isAdmin={appMode === 'online' && room?.hostId === currentPlayerId}
            currentPlayerId={appMode === 'online' && room 
              ? game!.getState().players.findIndex(p => {
                  const roomPlayer = room.players.find(rp => rp.id === currentPlayerId);
                  return roomPlayer && p.name === roomPlayer.name;
                }) + 1
              : undefined}
          />
        </motion.div>
      </div>
    </div>
  );
}
