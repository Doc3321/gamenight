'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Play, LogOut } from 'lucide-react';
import { toast } from 'sonner';

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
}

export default function RoomLobby({ room, currentPlayerId, onStartGame, onLeaveRoom }: RoomLobbyProps) {
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('similar-word');
  const [isStarting, setIsStarting] = useState(false);
  
  const isHost = room.players.find(p => p.id === currentPlayerId)?.isHost || false;
  const canStart = isHost && room.players.length >= 2 && selectedTopic;

  const copyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    toast.success('מספר החדר הועתק!');
  };

  const handleStartGame = async () => {
    if (!canStart) return;
    
    setIsStarting(true);
    try {
      await onStartGame(selectedTopic, selectedGameMode);
    } catch (error) {
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
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
              {room.id}
            </Badge>
            <Button size="sm" variant="outline" onClick={copyRoomId}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span className="font-medium">
              שחקנים ({room.players.length})
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
            {room.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{player.name}</span>
                  {player.isHost && (
                    <Badge variant="default" className="text-xs">
                      מארח
                    </Badge>
                  )}
                </div>
                {player.isReady && (
                  <Badge variant="outline" className="text-green-600">
                    מוכן
                  </Badge>
                )}
              </div>
            ))}
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
            
            {room.players.length < 2 && (
              <p className="text-sm text-muted-foreground text-center">
                צריך לפחות 2 שחקנים כדי להתחיל
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
