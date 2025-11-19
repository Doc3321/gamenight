import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isUserHost } from '@/lib/supabase/auth';
import { startGame, getRoom } from '@/lib/db/rooms';
import { broadcastEvent } from '@/lib/realtime/broadcast';

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

    // Validate minimum players based on game mode
    const getMinPlayers = (mode: string): number => {
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

    const minPlayers = getMinPlayers(gameMode);
    if (room.players.length < minPlayers) {
      const errorMsg = gameMode === 'imposter'
        ? 'נדרשים לפחות 3 שחקנים למשחק מתחזה (1 מתחזה + 2 רגילים)'
        : gameMode === 'mixed'
        ? 'נדרשים לפחות 5 שחקנים למשחק מעורב (1 מילה דומה + 1 מתחזה + 3 רגילים)'
        : 'נדרשים לפחות 2 שחקנים';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const startedRoom = await startGame(roomId, topic, gameMode);
    
    if (!startedRoom) {
      return NextResponse.json({ error: 'Failed to start game' }, { status: 400 });
    }

    // Broadcast game started
    await broadcastEvent(roomId, { type: 'game-started', roomId });
    await broadcastEvent(roomId, { type: 'room-updated', roomId });

    return NextResponse.json({ room: startedRoom });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
}
