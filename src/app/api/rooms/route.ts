import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { hostId, hostName } = await request.json();
    
    if (!hostId || !hostName) {
      return NextResponse.json({ error: 'Missing hostId or hostName' }, { status: 400 });
    }

    const room = roomManager.createRoom(hostId, hostName);
    
    return NextResponse.json({ room });
  } catch {
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
      const openRooms = roomManager.getOpenRooms();
      return NextResponse.json({ rooms: openRooms });
    }
    
    // Otherwise, get specific room
    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    const room = roomManager.getRoom(normalizedRoomId);
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Failed to get room' }, { status: 500 });
  }
}
