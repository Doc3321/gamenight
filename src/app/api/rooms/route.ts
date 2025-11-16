import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { createRoom, getRoom, getOpenRooms } from '@/lib/db/rooms';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    console.log('[API] Creating room for user:', userId);

    const { hostName } = await request.json();
    console.log('[API] Host name:', hostName);
    
    if (!hostName) {
      return NextResponse.json({ error: 'Missing hostName' }, { status: 400 });
    }

    const room = await createRoom(userId, hostName);
    console.log('[API] Room created successfully:', room.id);
    
    return NextResponse.json({ room });
  } catch (error) {
    console.error('[API] Error creating room:', error);
    if (error instanceof Error) {
      console.error('[API] Error details:', {
        message: error.message,
        stack: error.stack,
      });
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Return the actual error message
      return NextResponse.json({ 
        error: error.message || 'Failed to create room' 
      }, { status: 500 });
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
