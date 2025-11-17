import { supabase } from '../supabase/client';
import { getSupabaseAdmin } from '../supabase/server';

/**
 * Broadcast-based real-time system (works on free tier!)
 * Uses Supabase broadcast channels - no replication needed!
 */

export type BroadcastEvent = 
  | { type: 'room-updated'; roomId: string }
  | { type: 'player-joined'; roomId: string; playerId: string }
  | { type: 'player-left'; roomId: string; playerId: string }
  | { type: 'player-ready'; roomId: string; playerId: string; isReady: boolean }
  | { type: 'game-started'; roomId: string }
  | { type: 'game-state-updated'; roomId: string }
  | { type: 'vote-cast'; roomId: string; voterId: string }
  | { type: 'emote-sent'; roomId: string; playerId: string; emote: string }
  | { type: 'host-transferred'; roomId: string; newHostId: string };

/**
 * Client-side: Subscribe to room events
 */
export function subscribeToRoom(
  roomId: string,
  onEvent: (event: BroadcastEvent) => void
): () => void {
  const normalizedRoomId = roomId.toUpperCase().trim();
  const channel = supabase.channel(`room-broadcast:${normalizedRoomId}`);

  channel
    .on('broadcast', { event: '*' }, (payload) => {
      onEvent(payload.payload as BroadcastEvent);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Broadcast] Subscribed to room:', normalizedRoomId);
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[Broadcast] Channel error, will use polling fallback');
      }
    });

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Server-side: Broadcast event to all clients in a room
 * Uses admin client to send broadcasts
 */
export async function broadcastEvent(roomId: string, event: BroadcastEvent): Promise<void> {
  const normalizedRoomId = roomId.toUpperCase().trim();
  
  try {
    const adminClient = getSupabaseAdmin();
    const channel = adminClient.channel(`room-broadcast:${normalizedRoomId}`);
    
    // Subscribe first (required for sending)
    await channel.subscribe();
    
    // Send broadcast
    await channel.send({
      type: 'broadcast',
      event: event.type,
      payload: event,
    });
    
    // Unsubscribe after sending
    await channel.unsubscribe();
  } catch (error) {
    // If broadcast fails, it's okay - polling will catch up
    console.warn('[Broadcast] Failed to send event (will use polling):', error);
  }
}

