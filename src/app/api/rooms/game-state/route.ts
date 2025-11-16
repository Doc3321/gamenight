import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isUserInRoom } from '@/lib/supabase/auth';
import { getRoom, updateGameState } from '@/lib/db/rooms';
import { broadcastEvent } from '@/lib/realtime/broadcast';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    
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
    const userId = await requireAuth();

    const { roomId, gameStateData } = await request.json();
    
    if (!roomId || !gameStateData) {
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

    await updateGameState(roomId, gameStateData);
    
    // Broadcast game state update
    await broadcastEvent(roomId, { type: 'game-state-updated', roomId });
    
    const updatedRoom = await getRoom(roomId);
    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ error: 'Failed to update game state' }, { status: 500 });
  }
}

