'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import ClassifiedStamp from './ClassifiedStamp';
import AgentSpinner from './AgentSpinner';

interface JoinRoomProps {
  onJoinRoom: (roomId: string, playerName: string) => void;
  onCreateRoom: (playerName: string) => void;
}

interface OpenRoom {
  id: string;
  hostId: string;
  players: Array<{ id: string; name: string; isHost: boolean; isReady: boolean }>;
  gameState: string;
  createdAt: Date;
}

export default function JoinRoom({ onJoinRoom, onCreateRoom }: JoinRoomProps) {
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);

  useEffect(() => {
    // Fetch open rooms periodically
    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/rooms?list=true');
        const data = await response.json();
        if (data.rooms) {
          setOpenRooms(data.rooms);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const handleJoinRoom = async (roomIdToJoin?: string) => {
    const targetRoomId = roomIdToJoin || '';
    if (!targetRoomId || !playerName.trim()) {
      toast.error('נא למלא את כל השדות');
      return;
    }

    try {
      await onJoinRoom(targetRoomId.toUpperCase().trim(), playerName.trim());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'שגיאה בהצטרפות לחדר';
      toast.error(errorMessage);
    }
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast.error('נא להזין את שמך');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateRoom(playerName.trim());
    } catch {
      toast.error('שגיאה ביצירת חדר');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Open Rooms List - Primary way to join */}
      <Card className="border-2 border-purple-200 dark:border-purple-800 relative overflow-hidden">
        <ClassifiedStamp level="CONFIDENTIAL" />
        <CardHeader>
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold font-mono">
            🕵️ חדרים פתוחים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">השם שלך</Label>
            <Input
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="הזן את שמך"
              maxLength={20}
            />
          </div>

          {openRooms.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {openRooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between items-center p-4 border-2 border-purple-300 dark:border-purple-700 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 cursor-pointer transition-all"
                  onClick={() => {
                    if (playerName.trim()) {
                      handleJoinRoom(room.id);
                    } else {
                      toast.error('נא להזין את שמך תחילה');
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold font-mono text-lg">
                      {room.id}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">חדר {room.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.players.length} {room.players.length === 1 ? 'שחקן' : 'שחקנים'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    disabled={!playerName.trim()}
                  >
                    הצטרף
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>אין חדרים פתוחים כרגע</p>
              <p className="text-sm mt-2">צור חדר חדש למטה</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <span className="text-muted-foreground">או</span>
      </div>

      <Card className="border-2 border-pink-200 dark:border-pink-800">
        <CardHeader>
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent font-bold">
            צור חדר חדש
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hostName">השם שלך (מארח)</Label>
            <Input
              id="hostName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="הזן את שמך"
              maxLength={20}
            />
          </div>
          
          <Button
            onClick={handleCreateRoom}
            disabled={isCreating || !playerName.trim()}
            className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold"
            size="lg"
          >
            {isCreating ? (
              <div className="flex items-center gap-2 justify-center">
                <AgentSpinner size="sm" />
                <span>יוצר...</span>
              </div>
            ) : (
              '✨ צור חדר חדש'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
