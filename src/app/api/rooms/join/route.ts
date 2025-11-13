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
    
    // First check if room exists
    const existingRoom = roomManager.getRoom(normalizedRoomId);
    if (!existingRoom) {
      return NextResponse.json({ error: 'החדר לא נמצא. בדוק את מספר החדר.' }, { status: 404 });
    }
    
    // Check if game already started
    if (existingRoom.gameState !== 'waiting') {
      return NextResponse.json({ error: 'המשחק כבר התחיל. לא ניתן להצטרף.' }, { status: 400 });
    }
    
    // Check if player is already in this room
    if (existingRoom.players.some(p => p.id === playerId)) {
      return NextResponse.json({ room: existingRoom });
    }
    
    // Check if room is full
    if (existingRoom.players.length >= 8) {
      return NextResponse.json({ error: 'החדר מלא. מקסימום 8 שחקנים.' }, { status: 400 });
    }
    
    // Check for duplicate name
    const normalizedName = playerName.trim().toLowerCase();
    if (existingRoom.players.some(p => p.name.trim().toLowerCase() === normalizedName)) {
      return NextResponse.json({ error: 'שם זה כבר תפוס בחדר. בחר שם אחר.' }, { status: 400 });
    }
    
    // Try to join the room
    const room = roomManager.joinRoom(normalizedRoomId, playerId, playerName.trim());
    
    if (!room) {
      return NextResponse.json({ error: 'לא ניתן להצטרף לחדר' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
