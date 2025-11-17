import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isUserInRoom } from '@/lib/supabase/auth';
import { getRoom } from '@/lib/db/rooms';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcastEvent } from '@/lib/realtime/broadcast';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { roomId, newHostId } = await request.json();
    
    if (!roomId || !newHostId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user is in the room
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const userInRoom = await isUserInRoom(userId, roomId);
    if (!userInRoom) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 });
    }

    // Update host in rooms table
    const { error: roomUpdateError } = await supabaseAdmin
      .from('rooms')
      .update({ host_id: newHostId })
      .eq('id', roomId.toUpperCase().trim());

    if (roomUpdateError) {
      console.error('[TransferHost] Error updating room host:', roomUpdateError);
      return NextResponse.json({ error: 'Failed to update host' }, { status: 500 });
    }

    // Update is_host flag in room_players table
    // First, set all players in room to not host
    await supabaseAdmin
      .from('room_players')
      .update({ is_host: false })
      .eq('room_id', roomId.toUpperCase().trim());

    // Then set the new host
    const { error: playerUpdateError } = await supabaseAdmin
      .from('room_players')
      .update({ is_host: true })
      .eq('room_id', roomId.toUpperCase().trim())
      .eq('user_id', newHostId);

    if (playerUpdateError) {
      console.error('[TransferHost] Error updating player host status:', playerUpdateError);
      return NextResponse.json({ error: 'Failed to update player host status' }, { status: 500 });
    }

    // Broadcast host transfer event and room update
    await broadcastEvent(roomId, { type: 'host-transferred', roomId, newHostId });
    await broadcastEvent(roomId, { type: 'room-updated', roomId });
    
    const updatedRoom = await getRoom(roomId);
    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    console.error('Error transferring host:', error);
    return NextResponse.json({ error: 'Failed to transfer host' }, { status: 500 });
  }
}

