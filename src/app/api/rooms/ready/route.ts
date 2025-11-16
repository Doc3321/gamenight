import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { updatePlayerReady, getRoom } from '@/lib/db/rooms';
import { broadcastEvent } from '@/lib/realtime/broadcast';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { roomId, isReady } = await request.json();
    
    if (!roomId || typeof isReady !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const player = room.players.find(p => p.id === userId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const updatedRoom = await updatePlayerReady(roomId, userId, isReady);
    
    if (!updatedRoom) {
      return NextResponse.json({ error: 'Failed to update ready status' }, { status: 500 });
    }

    // Broadcast update
    await broadcastEvent(roomId, { type: 'player-ready', roomId, playerId: userId, isReady });
    await broadcastEvent(roomId, { type: 'room-updated', roomId });

    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    console.error('Error updating ready status:', error);
    return NextResponse.json({ error: 'Failed to update ready status' }, { status: 500 });
  }
}
