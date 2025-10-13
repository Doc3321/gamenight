import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, playerName } = await request.json();
    
    if (!roomId || !playerId || !playerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const room = roomManager.joinRoom(roomId, playerId, playerName);
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found or game already started' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
