import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isUserHost } from '@/lib/supabase/auth';
import { startGame, getRoom } from '@/lib/db/rooms';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { roomId, topic, gameMode } = await request.json();
    
    if (!roomId || !topic || !gameMode) {
      return NextResponse.json({ error: 'Missing roomId, topic, or gameMode' }, { status: 400 });
    }

    // Verify user is the host
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isHost = await isUserHost(userId, roomId);
    if (!isHost) {
      return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
    }

    const startedRoom = await startGame(roomId, topic, gameMode);
    
    if (!startedRoom) {
      return NextResponse.json({ error: 'Failed to start game' }, { status: 400 });
    }

    return NextResponse.json({ room: startedRoom });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
}
