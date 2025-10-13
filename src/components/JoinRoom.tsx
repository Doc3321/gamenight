'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface JoinRoomProps {
  onJoinRoom: (roomId: string, playerName: string) => void;
  onCreateRoom: (playerName: string) => void;
}

export default function JoinRoom({ onJoinRoom, onCreateRoom }: JoinRoomProps) {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleJoinRoom = async () => {
    if (!roomId.trim() || !playerName.trim()) {
      toast.error('נא למלא את כל השדות');
      return;
    }

    setIsJoining(true);
    try {
      await onJoinRoom(roomId.trim().toUpperCase(), playerName.trim());
    } catch (error) {
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
    } catch (error) {
      toast.error('שגיאה ביצירת חדר');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center">הצטרף לחדר</CardTitle>
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
            onClick={handleJoinRoom}
            disabled={isJoining || !roomId.trim() || !playerName.trim()}
            className="w-full"
            size="lg"
          >
            {isJoining ? 'מצטרף...' : 'הצטרף לחדר'}
          </Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <span className="text-muted-foreground">או</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center">צור חדר חדש</CardTitle>
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
            className="w-full"
            size="lg"
            variant="outline"
          >
            {isCreating ? 'יוצר...' : 'צור חדר חדש'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
