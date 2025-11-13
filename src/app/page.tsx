'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { WordGame, GameMode as GameModeType } from '@/lib/gameLogic';
import { wordTopics } from '@/data/wordTopics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GameBoard from '@/components/GameBoard';
import JoinRoom from '@/components/JoinRoom';
import RoomLobby from '@/components/RoomLobby';
import GameSetup from '@/components/GameSetup';
import Link from 'next/link';
import { Player as GamePlayer } from '@/lib/gameLogic';

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

  const startNewGame = (gameMode: GameModeType = 'similar-word', players: GamePlayer[] = []) => {
    const topic = wordTopics.find(t => t.id === selectedTopic);
    if (topic) {
      const newGame = new WordGame(topic, gameMode, players);
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
        // Start local game with the same topic and mode
        const topicData = wordTopics.find(t => t.id === topic);
        if (topicData) {
          setSelectedTopic(topic);
          startNewGame(gameMode);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
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
                <CardTitle className="text-2xl font-bold text-center">משחק המילים</CardTitle>
                <p className="text-muted-foreground">בחר מצב משחק</p>
              </motion.div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => setAppMode('local')}
                  variant={appMode === 'local' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  מקומי
                </Button>
                <Button
                  onClick={() => setAppMode('online')}
                  variant={(appMode as AppMode) === 'online' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  אונליין
                </Button>
              </div>
              
              <div className="pt-4 border-t">
                <Link href="/campaigner">
                  <Button variant="outline" className="w-full">
                    Campaigner Dashboard
                  </Button>
                </Link>
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
                    className="w-full"
                  >
                    הגדר משחק
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">משחק המילים</h1>
          <p className="text-muted-foreground">נושא: {game?.getState().topic.name}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <GameBoard game={game!} onReset={resetGame} />
        </motion.div>
      </div>
    </div>
  );
}
