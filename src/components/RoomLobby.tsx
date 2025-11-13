'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Play, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';
import PlayerAvatar from './PlayerAvatar';
import AgentBadge from './AgentBadge';
import ClassifiedStamp from './ClassifiedStamp';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

type GameMode = 'similar-word' | 'imposter' | 'mixed';

interface GameRoom {
  id: string;
  hostId: string;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'finished';
  currentTopic?: string;
  gameMode?: GameMode;
}

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
  
  // Poll for room updates
  useEffect(() => {
    if (localRoom.gameState !== 'waiting') return; // Stop polling if game started
    
    const fetchRoomUpdates = async () => {
      try {
        const response = await fetch(`/api/rooms?roomId=${localRoom.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room) {
            setLocalRoom(data.room);
            onRoomUpdate?.(data.room);
          }
        }
      } catch (error) {
        console.error('Error fetching room updates:', error);
      }
    };
    
    const interval = setInterval(fetchRoomUpdates, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [localRoom.id, localRoom.gameState, onRoomUpdate]);
  
  const isHost = localRoom.players.find(p => p.id === currentPlayerId)?.isHost || false;
  const currentPlayer = localRoom.players.find(p => p.id === currentPlayerId);
  const allPlayersReady = localRoom.players.every(p => p.isReady);
  const canStart = isHost && localRoom.players.length >= 2 && selectedTopic && allPlayersReady;

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
      
      if (!response.ok) {
        throw new Error('Failed to update ready status');
      }
      
      const data = await response.json();
      if (data.room) {
        setLocalRoom(data.room);
        onRoomUpdate?.(data.room);
      }
    } catch {
      toast.error('שגיאה בעדכון סטטוס מוכן');
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
          
          {!isHost && (
            <div className="mt-4">
              <Button
                onClick={handleToggleReady}
                disabled={isTogglingReady}
                variant={currentPlayer?.isReady ? 'outline' : 'default'}
                className="w-full"
              >
                {currentPlayer?.isReady ? 'לא מוכן' : 'מוכן'}
              </Button>
            </div>
          )}
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
            
            {localRoom.players.length < 2 && (
              <p className="text-sm text-muted-foreground text-center">
                צריך לפחות 2 שחקנים כדי להתחיל
              </p>
            )}
            
            {!allPlayersReady && localRoom.players.length >= 2 && (
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
