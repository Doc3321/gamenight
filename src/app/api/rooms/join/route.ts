import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { joinRoom, leaveRoom, getRoom } from '@/lib/db/rooms';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { roomId, playerName } = await request.json();
    
    if (!roomId || !playerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if player is already in a different room
    const currentRoom = await getRoom(roomId);
    if (currentRoom) {
      const playerInOtherRoom = currentRoom.players.find(p => p.id === userId);
      if (playerInOtherRoom && currentRoom.id !== roomId.toUpperCase().trim()) {
        // Leave current room first
        await leaveRoom(userId);
      }
    }
    
    // Try to join the room
    const room = await joinRoom(roomId, userId, playerName);
    
    if (!room) {
      // Check why it failed
      const existingRoom = await getRoom(roomId);
      if (!existingRoom) {
        return NextResponse.json({ error: 'החדר לא נמצא. בדוק את מספר החדר.' }, { status: 404 });
      }
      if (existingRoom.gameState !== 'waiting') {
        return NextResponse.json({ error: 'המשחק כבר התחיל. לא ניתן להצטרף.' }, { status: 400 });
      }
      if (existingRoom.players.length >= 8) {
        return NextResponse.json({ error: 'החדר מלא. מקסימום 8 שחקנים.' }, { status: 400 });
      }
      const normalizedName = playerName.trim().toLowerCase();
      if (existingRoom.players.some(p => p.name.trim().toLowerCase() === normalizedName)) {
        return NextResponse.json({ error: 'שם זה כבר תפוס בחדר. בחר שם אחר.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'לא ניתן להצטרף לחדר' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
