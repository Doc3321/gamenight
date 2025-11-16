import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isUserInRoom } from '@/lib/supabase/auth';
import { addEmote, getRoom } from '@/lib/db/rooms';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { roomId, emote } = await request.json();
    
    if (!roomId || !emote) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const userInRoom = await isUserInRoom(userId, roomId);
    if (!userInRoom) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 });
    }

    await addEmote(roomId, userId, emote);
    
    const updatedRoom = await getRoom(roomId);
    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    console.error('Error sending emote:', error);
    return NextResponse.json({ error: 'Failed to send emote' }, { status: 500 });
  }
}

