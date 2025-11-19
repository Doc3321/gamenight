'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
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
import { GameRoom, Player } from '@/lib/roomManager';
import AgentLoadingScreen from '@/components/AgentLoadingScreen';
import { HeaderMenu } from '@/components/HeaderMenu';
import { subscribeToRoom } from '@/lib/realtime/broadcast';

type AppMode = 'local' | 'online';

export default function Home() {
  const { user, isLoaded } = useUser();
  const [appMode, setAppMode] = useState<AppMode>('local');
  const [game, setGame] = useState<WordGame | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [gameStarted, setGameStarted] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  
  // Online game state
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState(true);
  const [userProfile, setUserProfile] = useState<{ nickname: string | null } | null>(null);
  
  // Load user profile
  useEffect(() => {
    if (isLoaded && user) {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setUserProfile(data.profile);
          } else {
            // If no profile exists, use Clerk name as default
            setUserProfile({
              nickname: user.firstName || user.username || null
            });
          }
        })
        .catch(console.error);
    }
  }, [isLoaded, user]);
  
  useEffect(() => {
    setIsReconnecting(false);
  }, []);

  // Poll for room updates during game (to catch host transfers, etc.)
  useEffect(() => {
    if (appMode !== 'online' || !room || !game) return;
    
    let unsubscribe: (() => void) | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    
    const refreshRoom = async () => {
      try {
        const response = await fetch(`/api/rooms?roomId=${room.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room) {
            setRoom(data.room);
          }
        }
      } catch (error) {
        console.error('Error refreshing room:', error);
      }
    };
    
    // Subscribe to broadcast events
    try {
      unsubscribe = subscribeToRoom(room.id, (event) => {
        if (event.type === 'host-transferred' || event.type === 'room-updated') {
          refreshRoom();
        }
      });
    } catch (error) {
      console.warn('[Page] Broadcast subscription failed, using polling:', error);
    }
    
    // Poll every 2 seconds as fallback
    pollInterval = setInterval(refreshRoom, 2000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, room?.id, game]);
  
  // Detect when game starts for non-admin players
  useEffect(() => {
    if (appMode === 'online' && room && !game && room.gameState === 'playing' && room.currentTopic && room.gameMode && room.gameWord && room.spinOrder) {
      console.log('Game started detected for non-admin player', { 
        gameState: room.gameState, 
        topic: room.currentTopic, 
        mode: room.gameMode,
        players: room.players.length,
        gameWord: room.gameWord,
        spinOrder: room.spinOrder
      });
      // Game was started by admin, initialize for this player with server data
      const topicData = wordTopics.find(t => t.id === room.currentTopic);
      if (topicData) {
        setSelectedTopic(room.currentTopic);
        // Use the randomized player order from server
        const gamePlayers: GamePlayer[] = room.players.map((p, index: number) => ({
          id: index + 1,
          name: p.name
        }));
        // Create game with server's game word and spin order
        const newGame = new WordGame(topicData, room.gameMode, gamePlayers, true);
        // Sync game word and spin order from server to keep all clients in sync
        if (room.gameWord && room.spinOrder) {
          newGame.syncFromServer(room.gameWord, room.spinOrder);
        }
        setGame(newGame);
        setGameStarted(true);
        setShowSetup(false);
        console.log('Game initialized for non-admin player with server data');
      }
    }
  }, [appMode, room, game]);

  const startNewGame = (gameMode: GameModeType = 'similar-word', players: GamePlayer[] = [], isOnline: boolean = false, topicId?: string) => {
    const topic = topicId 
      ? wordTopics.find(t => t.id === topicId)
      : wordTopics.find(t => t.id === selectedTopic);
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

  const createRoom = async (hostName?: string) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use provided name first, then nickname from profile, then Clerk name
      const displayName = hostName?.trim() || userProfile?.nickname?.trim() || user.firstName?.trim() || user.username?.trim() || 'Player';
      
      if (!displayName || !displayName.trim()) {
        throw new Error('נא להזין שם או כינוי');
      }
      
      console.log('[Client] Creating room with displayName:', displayName);
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostName: displayName.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.error || 'Failed to create room';
        console.error('[Client] Room creation failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (data.room) {
        console.log('[Client] Room created successfully:', data.room.id);
        setRoom(data.room);
        setCurrentPlayerId(data.room.hostId);
        setGameStarted(false);
        localStorage.setItem('roomId', data.room.id);
      } else {
        console.error('[Client] Room not returned from server');
        throw new Error('Room not returned from server');
      }
    } catch (error) {
      console.error('[Client] Error creating room:', error);
      throw error;
    }
  };

  const joinRoom = async (roomId: string, playerName?: string) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use nickname from profile if available, otherwise use provided name or Clerk name
      const displayName = playerName || userProfile?.nickname || user.firstName || user.username || 'Player';
      
      // Normalize room ID
      const normalizedRoomId = roomId.toUpperCase().trim();
      
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId: normalizedRoomId,
          playerName: displayName.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.error || 'Failed to join room';
        throw new Error(errorMsg);
      }
      
      if (data.room) {
        setRoom(data.room);
        // Find player by user ID
        const player = data.room.players.find((p: Player) => p.id === user.id);
        if (player) {
          setCurrentPlayerId(player.id);
        } else {
          // Fallback: find by name
          setCurrentPlayerId(data.room.players.find((p: Player) => p.name === displayName.trim())?.id || '');
        }
        setGameStarted(false);
        localStorage.setItem('roomId', data.room.id);
      } else {
        throw new Error('Room not found');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
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
        if (topicData && data.room.gameWord && data.room.spinOrder) {
          setSelectedTopic(topic);
          // Convert room players to game players (using randomized order from server)
          const gamePlayers: GamePlayer[] = data.room.players.map((p: { id: string; name: string; isHost: boolean; isReady: boolean }, index: number) => ({
            id: index + 1,
            name: p.name
          }));
          const newGame = new WordGame(topicData, gameMode, gamePlayers, true);
          // Sync game word and spin order from server
          newGame.syncFromServer(data.room.gameWord, data.room.spinOrder);
          setGame(newGame);
          setGameStarted(true);
          setShowSetup(false);
          localStorage.setItem('roomId', data.room.id);
        }
      }
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const leaveRoom = () => {
    const isAdmin = room?.hostId === currentPlayerId;
    const isInGame = game !== null;
    
    // Warn admin if leaving during game
    if (isAdmin && isInGame) {
      if (!confirm('אתה המארח במשחק פעיל. האם אתה בטוח שברצונך לעזוב? המשחק יסתיים עבור כל השחקנים.')) {
        return;
      }
    }
    
    // Leave room on server
    if (currentPlayerId) {
      fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayerId })
      }).catch(console.error);
    }
    
    setRoom(null);
    setCurrentPlayerId('');
    setGameStarted(false);
    setGame(null);
    localStorage.removeItem('roomId');
    // Don't clear playerId from localStorage - keep it for reconnection
  };

  // Handle browser navigation/close - delete room if admin leaves
  useEffect(() => {
    if (appMode !== 'online' || !room || !currentPlayerId) return;
    
    const isAdmin = room.hostId === currentPlayerId;
    const isInGame = game !== null;
    
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (isAdmin) {
        if (isInGame) {
          e.preventDefault();
          e.returnValue = 'אתה המארח במשחק פעיל. האם אתה בטוח שברצונך לעזוב?';
        }
        // Delete room when admin leaves (even if not in game)
        // Use fetch with keepalive for reliable delivery even on page close
        fetch('/api/rooms/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: currentPlayerId }),
          keepalive: true
        }).catch(() => {});
      }
    };
    
    const handleVisibilityChange = () => {
      // When page becomes hidden (tab switch, minimize, close), delete room if admin
      if (document.hidden && isAdmin) {
        fetch('/api/rooms/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: currentPlayerId }),
          keepalive: true
        }).catch(() => {});
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appMode, room, currentPlayerId, game]);

  // Show loading while reconnecting
  if (isReconnecting && appMode === 'online') {
    return <AgentLoadingScreen message="מתחבר..." subMessage="מאמת זהות סוכן" />;
  }

  // Online mode - show join/create room
  if (appMode === 'online' && !room) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 p-4 relative">
        <div className="absolute top-4 left-4 z-10">
          <HeaderMenu />
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
          <HeaderMenu />
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
              onRoomUpdate={(updatedRoom) => {
                setRoom(updatedRoom);
                // Update currentPlayerId if player still exists
                const playerStillExists = updatedRoom.players.find(p => p.id === currentPlayerId);
                if (!playerStillExists) {
                  // Player was removed, leave room
                  leaveRoom();
                }
              }}
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
          <HeaderMenu />
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
                <div className="text-center space-y-2 relative">
                  <div className="absolute -top-2 -right-2 text-2xl opacity-20">🕵️</div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent mb-2 font-mono tracking-wider">
                    סוכן
                  </div>
                  <p className="text-lg text-muted-foreground font-semibold">משחק המילים</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">CLASSIFIED OPERATION</p>
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
                  variant={(appMode as AppMode) === 'online' ? 'default' : 'outline'}
                  className={`flex-1 transition-all ${
                    (appMode as AppMode) === 'online' 
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
        <HeaderMenu />
      </div>
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent mb-2">
              סוכן
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
            isAdmin={appMode === 'online' && room ? (() => {
              // Check if current player is the host (by user ID)
              if (room.hostId === currentPlayerId) {
                return true;
              }
              // Check if host is eliminated and current player is first active player
              // Find host player in room by user ID, then find in game by name
              const hostPlayerInRoom = room.players.find(p => p.id === room.hostId);
              if (hostPlayerInRoom) {
                const gameState = game!.getState();
                const hostPlayerInGame = gameState.players.find(p => p.name === hostPlayerInRoom.name);
                
                if (hostPlayerInGame?.isEliminated) {
                  const activePlayers = gameState.players.filter(p => !p.isEliminated);
                  if (activePlayers.length > 0) {
                    const firstActivePlayer = activePlayers[0];
                    const currentPlayerInRoom = room.players.find(rp => rp.id === currentPlayerId);
                    if (currentPlayerInRoom) {
                      const currentPlayerInGame = gameState.players.find(p => p.name === currentPlayerInRoom.name);
                      return !!(currentPlayerInGame && currentPlayerInGame.id === firstActivePlayer.id);
                    }
                  }
                }
              }
              return false;
            })() : false}
            currentPlayerId={appMode === 'online' && room 
              ? game!.getState().players.findIndex(p => {
                  const roomPlayer = room.players.find(rp => rp.id === currentPlayerId);
                  return roomPlayer && p.name === roomPlayer.name;
                }) + 1
              : undefined}
            roomId={appMode === 'online' ? room?.id : undefined}
            currentPlayerIdString={appMode === 'online' ? currentPlayerId : undefined}
            room={appMode === 'online' && room ? { players: room.players } : undefined}
          />
        </motion.div>
      </div>
    </div>
  );
}
