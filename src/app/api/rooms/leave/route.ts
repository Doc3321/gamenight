import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { leaveRoom } from '@/lib/db/rooms';
import { broadcastEvent } from '@/lib/realtime/broadcast';

export async function POST() {
  try {
    const userId = await requireAuth();

    const room = await leaveRoom(userId);
    
    if (room) {
      // Broadcast update
      await broadcastEvent(room.id, { type: 'player-left', roomId: room.id, playerId: userId });
      await broadcastEvent(room.id, { type: 'room-updated', roomId: room.id });
      return NextResponse.json({ room });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}

