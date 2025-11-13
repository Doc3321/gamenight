import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, playerName } = await request.json();
    
    if (!roomId || !playerId || !playerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedRoomId = roomId.toUpperCase().trim();
    
    // Check if player is already in a different room
    const existingPlayerRoom = roomManager.getPlayerRoom(playerId);
    if (existingPlayerRoom && existingPlayerRoom.id !== normalizedRoomId) {
      // Player is trying to join a different room, leave current room first
      roomManager.leaveRoom(playerId);
    }
    
    const room = roomManager.joinRoom(normalizedRoomId, playerId, playerName.trim());
    
    if (!room) {
      const existingRoom = roomManager.getRoom(normalizedRoomId);
      if (!existingRoom) {
        return NextResponse.json({ error: 'החדר לא נמצא. בדוק את מספר החדר.' }, { status: 404 });
      }
      if (existingRoom.gameState !== 'waiting') {
        return NextResponse.json({ error: 'המשחק כבר התחיל. לא ניתן להצטרף.' }, { status: 400 });
      }
      // Check if player is already in this room
      if (existingRoom.players.some(p => p.id === playerId)) {
        return NextResponse.json({ room: existingRoom });
      }
      return NextResponse.json({ error: 'לא ניתן להצטרף לחדר' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
