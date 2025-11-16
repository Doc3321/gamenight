import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { GameRoom } from '../roomManager';

export function useRoomSubscription(roomId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    const normalizedRoomId = roomId.toUpperCase().trim();
    setLoading(true);

    // Initial fetch
    const fetchRoom = async () => {
      try {
        const response = await fetch(`/api/rooms?roomId=${normalizedRoomId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room) {
            setRoom(data.room);
          }
        }
      } catch (error) {
        console.error('Error fetching room:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${normalizedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${normalizedRoomId}`,
        },
        () => {
          // Refetch room when it changes
          fetchRoom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${normalizedRoomId}`,
        },
        () => {
          // Refetch room when players change
          fetchRoom();
        }
      )
      .subscribe();

    // Subscribe to game state changes
    const gameStateChannel = supabase
      .channel(`game-state:${normalizedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_states',
          filter: `room_id=eq.${normalizedRoomId}`,
        },
        () => {
          // Refetch room to get updated game state
          fetchRoom();
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
      gameStateChannel.unsubscribe();
    };
  }, [roomId]);

  return { room, loading };
}

