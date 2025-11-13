import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, isReady } = await request.json();
    
    if (!roomId || !playerId || typeof isReady !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    player.isReady = isReady;
    
    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Failed to update ready status' }, { status: 500 });
  }
}
