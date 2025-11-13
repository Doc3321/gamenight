import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/roomManager';

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, emote } = await request.json();
    
    if (!roomId || !playerId || !emote) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Initialize gameStateData if it doesn't exist
    if (!room.gameStateData) {
      room.gameStateData = {
        currentPlayerIndex: 0,
        votingPhase: false,
        votingActivated: false,
        emotes: []
      };
    }

    // Initialize emotes array if it doesn't exist
    if (!room.gameStateData.emotes) {
      room.gameStateData.emotes = [];
    }

    // Add emote
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      const playerIndex = room.players.findIndex(p => p.id === playerId);
      room.gameStateData.emotes.push({
        playerId: playerIndex + 1,
        emote,
        timestamp: Date.now()
      });
      
      // Keep only last 20 emotes
      if (room.gameStateData.emotes.length > 20) {
        room.gameStateData.emotes = room.gameStateData.emotes.slice(-20);
      }
    }
    
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error sending emote:', error);
    return NextResponse.json({ error: 'Failed to send emote' }, { status: 500 });
  }
}

