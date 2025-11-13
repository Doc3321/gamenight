import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
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
  } catch (error) {
    console.error('Error getting game state:', error);
    return NextResponse.json({ error: 'Failed to get game state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { roomId, gameStateData } = await request.json();
    
    if (!roomId || !gameStateData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    const room = roomManager.getRoom(normalizedRoomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    room.gameStateData = gameStateData;
    
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ error: 'Failed to update game state' }, { status: 500 });
  }
}

