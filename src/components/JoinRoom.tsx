'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
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
    const targetRoomId = roomIdToJoin || roomId.trim();
    if (!targetRoomId || !playerName.trim()) {
      toast.error('נא למלא את כל השדות');
      return;
    }

    setIsJoining(true);
    try {
      await onJoinRoom(targetRoomId.toUpperCase(), playerName.trim());
    } catch {
      toast.error('שגיאה בהצטרפות לחדר');
    } finally {
      setIsJoining(false);
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
      {/* Open Rooms List */}
      {openRooms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-center">חדרים פתוחים להצטרפות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {openRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setRoomId(room.id);
                    if (playerName.trim()) {
                      handleJoinRoom(room.id);
                    }
                  }}
                >
                  <div>
                    <p className="font-semibold">חדר {room.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {room.players.length} שחקנים
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    הצטרף
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
            הצטרף לחדר
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
          
          <div className="space-y-2">
            <Label htmlFor="roomId">מספר החדר</Label>
            <Input
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="הזן מספר חדר"
              maxLength={6}
            />
          </div>
          
          <Button
            onClick={() => handleJoinRoom()}
            disabled={isJoining || !roomId.trim() || !playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg text-white font-semibold"
            size="lg"
          >
            {isJoining ? 'מצטרף...' : '🎮 הצטרף לחדר'}
          </Button>
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
            {isCreating ? 'יוצר...' : '✨ צור חדר חדש'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
