import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { roomId, topic, gameMode } = await request.json();
    
    if (!roomId || !topic || !gameMode) {
      return NextResponse.json({ error: 'Missing roomId, topic, or gameMode' }, { status: 400 });
    }

    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    const room = roomManager.startGame(normalizedRoomId, topic, gameMode);
    
    if (!room) {
      return NextResponse.json({ error: 'Failed to start game' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
}
