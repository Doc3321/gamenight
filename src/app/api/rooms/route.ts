import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { createRoom, getRoom, getOpenRooms } from '@/lib/db/rooms';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { hostName } = await request.json();
    
    if (!hostName) {
      return NextResponse.json({ error: 'Missing hostName' }, { status: 400 });
    }

    const room = await createRoom(userId, hostName);
    
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const list = searchParams.get('list');
    
    // If list=true, return all open rooms
    if (list === 'true') {
      const openRooms = await getOpenRooms();
      return NextResponse.json({ rooms: openRooms });
    }
    
    // Otherwise, get specific room
    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error getting room:', error);
    return NextResponse.json({ error: 'Failed to get room' }, { status: 500 });
  }
}
