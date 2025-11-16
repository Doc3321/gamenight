import { useEffect, useState, useRef } from 'react';
import { subscribeToRoom, type BroadcastEvent } from '../realtime/broadcast';
import { GameRoom } from '../roomManager';

export function useRoomSubscription(roomId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const useBroadcast = useRef(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    const normalizedRoomId = roomId.toUpperCase().trim();
    setLoading(true);

    // Fetch room data
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

    // Try broadcast-based real-time (works on free tier!)
    let unsubscribe: (() => void) | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    if (useBroadcast.current) {
      try {
        unsubscribe = subscribeToRoom(normalizedRoomId, (event) => {
          // Refetch room when any event occurs
          fetchRoom();
        });

        // Fallback to polling if broadcast doesn't work after 3 seconds
        const fallbackTimeout = setTimeout(() => {
          if (unsubscribe) {
            console.warn('[useRoomSubscription] Broadcast timeout, using polling');
            unsubscribe();
            unsubscribe = null;
            useBroadcast.current = false;
            
            // Start polling
            pollInterval = setInterval(fetchRoom, 2000);
          }
        }, 3000);

        return () => {
          clearTimeout(fallbackTimeout);
          if (unsubscribe) unsubscribe();
          if (pollInterval) clearInterval(pollInterval);
        };
      } catch (error) {
        console.warn('[useRoomSubscription] Broadcast error, using polling:', error);
        useBroadcast.current = false;
      }
    }

    // Fallback to polling
    if (!useBroadcast.current || !unsubscribe) {
      pollInterval = setInterval(fetchRoom, 2000);
      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [roomId]);

  return { room, loading };
}

