'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Play, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import PlayerAvatar from './PlayerAvatar';
import AgentBadge from './AgentBadge';
import ClassifiedStamp from './ClassifiedStamp';
import AgentSpinner from './AgentSpinner';
import { GameRoom, GameMode } from '@/lib/roomManager';

interface RoomLobbyProps {
  room: GameRoom;
  currentPlayerId: string;
  onStartGame: (topic: string, gameMode: GameMode) => void;
  onLeaveRoom: () => void;
  onRoomUpdate?: (room: GameRoom) => void;
}

export default function RoomLobby({ room, currentPlayerId, onStartGame, onLeaveRoom, onRoomUpdate }: RoomLobbyProps) {
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('similar-word');
  const [isStarting, setIsStarting] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [localRoom, setLocalRoom] = useState(room);
  
  // Update local room when prop changes
  useEffect(() => {
    setLocalRoom(room);
  }, [room]);
  
  // Poll for room updates (continue polling even when game starts to detect game state changes)
  useEffect(() => {
    let isMounted = true;
    let shouldStopPolling = false;
    
    const fetchRoomUpdates = async () => {
      if (!isMounted || shouldStopPolling) return;
      
      try {
        const response = await fetch(`/api/rooms?roomId=${localRoom.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room) {
            if (!isMounted || shouldStopPolling) return;
            setLocalRoom(data.room);
            onRoomUpdate?.(data.room);
            
            // Check if current player was removed
            const playerStillExists = data.room.players.find((p: { id: string }) => p.id === currentPlayerId);
            if (!playerStillExists) {
              if (isMounted) {
                shouldStopPolling = true;
                toast.error('הוסרת מהחדר');
                onLeaveRoom();
              }
              return;
            }
          } else {
            // Room doesn't exist anymore - stop polling and leave
            shouldStopPolling = true;
            if (isMounted) {
              onLeaveRoom();
            }
            return;
          }
        } else if (response.status === 404) {
          // Room not found - stop polling immediately to prevent repeated 404s
          shouldStopPolling = true;
          if (isMounted) {
            onLeaveRoom();
          }
          return;
        }
      } catch (error) {
        // Only log network errors, don't show toasts for them
        // Don't stop polling on network errors - might be temporary
        if (isMounted) {
          console.error('Error fetching room updates:', error);
        }
      }
    };
    
    // Poll every 2 seconds while in lobby, or every 5 seconds if game started (to detect state changes)
    const pollInterval = localRoom.gameState === 'waiting' ? 2000 : 5000;
    const interval = setInterval(() => {
      if (!shouldStopPolling) {
        fetchRoomUpdates();
      }
    }, pollInterval);
    
    return () => {
      isMounted = false;
      shouldStopPolling = true;
      clearInterval(interval);
    };
  }, [localRoom.id, localRoom.gameState, onRoomUpdate, currentPlayerId, onLeaveRoom]);
  
  const isHost = localRoom.players.find(p => p.id === currentPlayerId)?.isHost || false;
  const currentPlayer = localRoom.players.find(p => p.id === currentPlayerId);
  const allPlayersReady = localRoom.players.every(p => p.isReady);
  
  // Minimum players validation based on game mode
  const getMinPlayers = (mode: GameMode): number => {
    switch (mode) {
      case 'imposter':
        return 3; // 1 imposter + at least 2 innocents
      case 'mixed':
        return 5; // 1 similar + 1 imposter + at least 3 innocents
      case 'similar-word':
        return 2; // 1 similar + at least 1 normal
      default:
        return 2;
    }
  };
  
  const minPlayers = getMinPlayers(selectedGameMode);
  const hasEnoughPlayers = localRoom.players.length >= minPlayers;
  const canStart = isHost && hasEnoughPlayers && selectedTopic && allPlayersReady;

  const copyRoomId = () => {
    navigator.clipboard.writeText(localRoom.id);
    toast.success('מספר החדר הועתק!');
  };

  const handleToggleReady = async () => {
    if (!currentPlayer) return;
    
    setIsTogglingReady(true);
    try {
      const response = await fetch('/api/rooms/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: localRoom.id,
          playerId: currentPlayerId,
          isReady: !currentPlayer.isReady
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.room) {
          setLocalRoom(data.room);
          onRoomUpdate?.(data.room);
        }
      } else if (response.status === 404) {
        // Room not found - silently leave
        onLeaveRoom();
      } else {
        toast.error('שגיאה בעדכון סטטוס מוכן');
      }
    } catch (error) {
      // Don't show toast for network errors - might be temporary
      console.error('Error toggling ready:', error);
    } finally {
      setIsTogglingReady(false);
    }
  };

  const handleStartGame = async () => {
    if (!canStart) return;
    
    setIsStarting(true);
    try {
      await onStartGame(selectedTopic, selectedGameMode);
    } catch {
      toast.error('שגיאה בהתחלת המשחק');
    } finally {
      setIsStarting(false);
    }
  };

  const topics = [
    { id: 'drinks', name: 'משקאות' },
    { id: 'objects', name: 'חפצים' },
    { id: 'places', name: 'מקומות' },
    { id: 'food', name: 'אוכל' },
    { id: 'celebrities', name: 'מפורסמים' },
    { id: 'animals', name: 'חיות' }
  ];

  const gameModes = [
    { 
      id: 'similar-word' as GameMode, 
      name: 'מילה דומה', 
      description: 'כולם אותה מילה, אחד מקבל מילה דומה' 
    },
    { 
      id: 'imposter' as GameMode, 
      name: 'מתחזה', 
      description: 'כולם אותה מילה, אחד מקבל "מתחזה"' 
    },
    { 
      id: 'mixed' as GameMode, 
      name: 'מעורב', 
      description: 'מילה רגילה, מילה דומה, ומתחזה' 
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 relative">
      <ClassifiedStamp level="SECRET" />
      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">חדר משחק</CardTitle>
            <Button variant="outline" onClick={onLeaveRoom}>
              <LogOut className="w-4 h-4 mr-2" />
              עזוב חדר
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">מספר החדר:</span>
            <Badge variant="secondary" className="text-lg font-mono">
              {localRoom.id}
            </Badge>
            <Button size="sm" variant="outline" onClick={copyRoomId}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span className="font-medium">
              שחקנים ({localRoom.players.length})
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>רשימת שחקנים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {localRoom.players.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600 transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <PlayerAvatar name={player.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <AgentBadge 
                      agentName={player.name} 
                      agentNumber={index + 1}
                      isHost={player.isHost}
                      size="sm"
                    />
                  </div>
                </div>
                {player.isReady ? (
                  <Badge variant="outline" className="text-green-600 border-green-500 bg-green-50 dark:bg-green-900/20">
                    ✓ מוכן
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">
                    ⏳ לא מוכן
                  </Badge>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4">
            <Button
              onClick={handleToggleReady}
              disabled={isTogglingReady}
              variant={currentPlayer?.isReady ? 'outline' : 'default'}
              className={`w-full ${
                !currentPlayer?.isReady 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg' 
                  : ''
              }`}
            >
              {isTogglingReady ? (
                <div className="flex items-center gap-2 justify-center">
                  <AgentSpinner size="sm" />
                  <span>מעדכן...</span>
                </div>
              ) : (
                currentPlayer?.isReady ? 'לא מוכן' : 'מוכן'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isHost && (
        <Card>
          <CardHeader>
            <CardTitle>התחל משחק</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                בחר נושא:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {topics.map((topic) => (
                  <Button
                    key={topic.id}
                    variant={selectedTopic === topic.id ? 'default' : 'outline'}
                    onClick={() => setSelectedTopic(topic.id)}
                    className="justify-start"
                  >
                    {topic.name}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                בחר מצב משחק:
              </label>
              <div className="space-y-2">
                {gameModes.map((mode) => (
                  <div
                    key={mode.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGameMode === mode.id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedGameMode(mode.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{mode.name}</div>
                        <div className="text-sm text-muted-foreground">{mode.description}</div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedGameMode === mode.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Button
              onClick={handleStartGame}
              disabled={!canStart || isStarting}
              className="w-full"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              {isStarting ? 'מתחיל...' : 'התחל משחק'}
            </Button>
            
            {!hasEnoughPlayers && (
              <p className="text-sm text-orange-600 mt-2 text-center">
                {selectedGameMode === 'imposter' 
                  ? 'נדרשים לפחות 3 שחקנים למשחק מתחזה (1 מתחזה + 2 רגילים)'
                  : selectedGameMode === 'mixed'
                  ? 'נדרשים לפחות 5 שחקנים למשחק מעורב (1 מילה דומה + 1 מתחזה + 3 רגילים)'
                  : 'נדרשים לפחות 2 שחקנים'}
              </p>
            )}
            
            {localRoom.players.length >= 8 && (
              <p className="text-sm text-yellow-600 text-center">
                החדר מלא (8/8 שחקנים)
              </p>
            )}
            
            {!allPlayersReady && localRoom.players.length >= 2 && localRoom.players.length < 8 && (
              <p className="text-sm text-orange-600 text-center">
                ממתין שכל השחקנים יהיו מוכנים
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
