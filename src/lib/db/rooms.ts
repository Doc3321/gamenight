import { supabaseAdmin } from '../supabase/server';
import { GameRoom, GameMode } from '../roomManager';

// Database row types
interface DbRoom {
  id: string;
  host_id: string;
  game_state: 'waiting' | 'playing' | 'finished';
  current_topic?: string | null;
  game_word?: string | null;
  game_mode?: string | null;
  current_spin: number;
  total_spins: number;
  spin_order?: unknown;
  player_order?: unknown;
  created_at: string;
  updated_at: string;
}

interface DbPlayer {
  id: string;
  room_id: string;
  user_id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  player_index?: number | null;
  created_at: string;
}

interface DbGameState {
  current_player_index?: number | null;
  current_spin?: number | null;
  voting_phase?: boolean | null;
  current_voting_player_index?: number | null;
  voting_activated?: boolean | null;
  eliminated_player?: unknown;
  is_tie?: boolean | null;
  tied_players?: unknown;
  wrong_elimination?: boolean | null;
  player_words?: unknown;
  votes?: unknown;
  emotes?: unknown;
}

// Convert database room to GameRoom format
function dbRoomToGameRoom(dbRoom: DbRoom, players: DbPlayer[]): GameRoom {
  return {
    id: dbRoom.id,
    hostId: dbRoom.host_id,
    players: players.map(p => ({
      id: p.user_id,
      name: p.player_name,
      isHost: p.is_host,
      isReady: p.is_ready,
    })),
    gameState: dbRoom.game_state,
    currentTopic: dbRoom.current_topic || undefined,
    gameWord: dbRoom.game_word || undefined,
    gameMode: dbRoom.game_mode as GameMode | undefined,
    currentSpin: dbRoom.current_spin || 0,
    totalSpins: dbRoom.total_spins || 3,
    spinOrder: (dbRoom.spin_order as (boolean | 'similar' | 'imposter')[]) || [],
    playerOrder: (dbRoom.player_order as string[] | undefined) || undefined,
    createdAt: new Date(dbRoom.created_at),
  };
}

export async function createRoom(hostId: string, hostName: string): Promise<GameRoom> {
  const roomId = generateRoomId();
  console.log('[DB] Creating room:', { roomId, hostId, hostName });
  
  // Verify supabaseAdmin is accessible
  try {
    const testQuery = supabaseAdmin.from('rooms');
    if (!testQuery) {
      throw new Error('supabaseAdmin.from is not accessible');
    }
  } catch (error) {
    console.error('[DB] supabaseAdmin access error:', error);
    throw new Error(`Supabase client not initialized: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const { data: room, error: roomError } = await supabaseAdmin
    .from('rooms')
    .insert({
      id: roomId,
      host_id: hostId,
      game_state: 'waiting',
    })
    .select()
    .single();

  if (roomError) {
    console.error('[DB] Room creation error:', {
      code: roomError.code,
      message: roomError.message,
      details: roomError.details,
      hint: roomError.hint,
    });
    throw new Error(`Failed to create room: ${roomError.message} (Code: ${roomError.code})`);
  }
  
  if (!room) {
    console.error('[DB] No room data returned after insert');
    throw new Error('Failed to create room: No room data returned');
  }
  
  console.log('[DB] Room created successfully:', room.id);

  // Add host as player
  console.log('[DB] Adding host as player:', { roomId, hostId, hostName });
  const { error: playerError } = await supabaseAdmin
    .from('room_players')
    .insert({
      room_id: roomId,
      user_id: hostId,
      player_name: hostName.trim(),
      is_host: true,
      is_ready: false,
    });

  if (playerError) {
    console.error('[DB] Player insert error:', {
      code: playerError.code,
      message: playerError.message,
      details: playerError.details,
      hint: playerError.hint,
    });
    // Cleanup room if player insert fails
    await supabaseAdmin.from('rooms').delete().eq('id', roomId);
    throw new Error(`Failed to add host to room: ${playerError.message} (Code: ${playerError.code})`);
  }
  
  console.log('[DB] Host added as player successfully');

  const createdRoom = await getRoom(roomId);
  if (!createdRoom) {
    throw new Error('Failed to retrieve created room');
  }
  
  console.log('[DB] Room creation complete:', {
    roomId: createdRoom.id,
    hostId: createdRoom.hostId,
    players: createdRoom.players.length,
    hostName: createdRoom.players.find(p => p.isHost)?.name
  });
  
  return createdRoom;
}

export async function getRoom(roomId: string): Promise<GameRoom | null> {
  const normalizedRoomId = roomId.toUpperCase().trim();

  const { data: room, error: roomError } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('id', normalizedRoomId)
    .single();

  if (roomError || !room) {
    return null;
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from('room_players')
    .select('*')
    .eq('room_id', normalizedRoomId)
    .order('created_at', { ascending: true });

  if (playersError) {
    return null;
  }

  const { data: gameState } = await supabaseAdmin
    .from('game_states')
    .select('*')
    .eq('room_id', normalizedRoomId)
    .single();

  const gameRoom = dbRoomToGameRoom(room, players || []);
  
  if (gameState) {
    const dbState = gameState as unknown as DbGameState;
    gameRoom.gameStateData = {
      currentPlayerIndex: dbState.current_player_index || 0,
      currentSpin: dbState.current_spin ?? undefined,
      votingPhase: dbState.voting_phase || false,
      currentVotingPlayerIndex: dbState.current_voting_player_index ?? undefined,
      votingActivated: dbState.voting_activated || false,
      eliminatedPlayer: dbState.eliminated_player as { id: number; name: string; wordType?: 'normal' | 'similar' | 'imposter'; votes?: number } | undefined,
      isTie: dbState.is_tie ?? undefined,
      tiedPlayers: dbState.tied_players as Array<{ id: number; name: string; votes: number }> | undefined,
      wrongElimination: dbState.wrong_elimination ?? undefined,
      playerWords: dbState.player_words as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }> | undefined,
      votes: dbState.votes as Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }> | undefined,
      emotes: dbState.emotes as Array<{ playerId: number; emote: string; timestamp: number }> | undefined,
    };
  }

  return gameRoom;
}

export async function getOpenRooms(): Promise<GameRoom[]> {
  const { data: rooms, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('game_state', 'waiting')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !rooms) {
    return [];
  }

  const roomsWithPlayers = await Promise.all(
    rooms.map(async (room) => {
      const { data: players, error: playersError } = await supabaseAdmin
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });

      if (playersError) {
        console.error('[DB] Error fetching players for room:', room.id, playersError);
        // If we can't fetch players, delete the room
        try {
          await supabaseAdmin.from('rooms').delete().eq('id', room.id);
          await supabaseAdmin.from('room_players').delete().eq('room_id', room.id);
          await supabaseAdmin.from('game_states').delete().eq('room_id', room.id);
        } catch (deleteError) {
          console.error('[DB] Error deleting room after player fetch error:', deleteError);
        }
        return null;
      }

      const gameRoom = dbRoomToGameRoom(room, players || []);
      
      // If room has no players, delete it and return null
      if (gameRoom.players.length === 0) {
        console.log('[DB] Found empty room, deleting:', room.id);
        try {
          await supabaseAdmin.from('rooms').delete().eq('id', room.id);
          await supabaseAdmin.from('room_players').delete().eq('room_id', room.id);
          await supabaseAdmin.from('game_states').delete().eq('room_id', room.id);
        } catch (deleteError) {
          console.error('[DB] Error deleting empty room:', deleteError);
        }
        return null;
      }

      // Verify room host still exists in players list
      const hostExists = gameRoom.players.some(p => p.id === room.host_id);
      if (!hostExists) {
        console.log('[DB] Room host not found in players, deleting orphaned room:', room.id, {
          hostId: room.host_id,
          playerIds: gameRoom.players.map(p => p.id)
        });
        try {
          await supabaseAdmin.from('rooms').delete().eq('id', room.id);
          await supabaseAdmin.from('room_players').delete().eq('room_id', room.id);
          await supabaseAdmin.from('game_states').delete().eq('room_id', room.id);
        } catch (deleteError) {
          console.error('[DB] Error deleting orphaned room:', deleteError);
        }
        return null;
      }

      // Check if room is older than 1 hour and has fewer players than expected
      // This helps clean up stale rooms where players left without proper cleanup
      const roomAge = Date.now() - new Date(room.created_at).getTime();
      const oneHour = 60 * 60 * 1000;
      if (roomAge > oneHour && gameRoom.players.length < 2) {
        console.log('[DB] Found stale room (old and few players), deleting:', room.id, {
          age: Math.round(roomAge / 1000 / 60),
          players: gameRoom.players.length
        });
        try {
          await supabaseAdmin.from('rooms').delete().eq('id', room.id);
          await supabaseAdmin.from('room_players').delete().eq('room_id', room.id);
          await supabaseAdmin.from('game_states').delete().eq('room_id', room.id);
        } catch (deleteError) {
          console.error('[DB] Error deleting stale room:', deleteError);
        }
        return null;
      }
      
      return gameRoom;
    })
  );

  // Filter out null values (deleted empty rooms)
  return roomsWithPlayers.filter((room): room is GameRoom => room !== null);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  playerName: string
): Promise<GameRoom | null> {
  const normalizedRoomId = roomId.toUpperCase().trim();

  // Check if room exists and is in waiting state
  const room = await getRoom(normalizedRoomId);
  if (!room || room.gameState !== 'waiting') {
    return null;
  }
  
  // If room has no players, delete it (orphaned room)
  if (room.players.length === 0) {
    console.log('[DB] Room has no players, deleting orphaned room:', normalizedRoomId);
    try {
      await supabaseAdmin.from('rooms').delete().eq('id', normalizedRoomId);
      await supabaseAdmin.from('room_players').delete().eq('room_id', normalizedRoomId);
      await supabaseAdmin.from('game_states').delete().eq('room_id', normalizedRoomId);
    } catch (deleteError) {
      console.error('[DB] Error deleting orphaned room:', deleteError);
    }
    return null;
  }

  // Check if already in room
  const existingPlayer = room.players.find(p => p.id === userId);
  if (existingPlayer) {
    return room;
  }

  // Check for duplicate name
  const normalizedName = playerName.trim().toLowerCase();
  if (room.players.some(p => p.name.trim().toLowerCase() === normalizedName)) {
    return null;
  }

  // Add player
  const { error } = await supabaseAdmin
    .from('room_players')
    .insert({
      room_id: normalizedRoomId,
      user_id: userId,
      player_name: playerName.trim(),
      is_host: false,
      is_ready: false,
    });

  if (error) {
    return null;
  }

  return getRoom(normalizedRoomId);
}

export async function leaveRoom(userId: string): Promise<GameRoom | null> {
  try {
    // Find which room the user is in
    const { data: playerData, error: playerDataError } = await supabaseAdmin
      .from('room_players')
      .select('room_id')
      .eq('user_id', userId)
      .single();

    if (playerDataError || !playerData) {
      // User not in any room - this is fine, just return null
      return null;
    }

    const roomId = playerData.room_id;
    const room = await getRoom(roomId);
    if (!room) {
      return null;
    }

    // Get player info before removing
    const player = room.players.find(p => p.id === userId);
    if (!player) {
      return null;
    }

    const isHost = player.isHost;
    const wasOnlyPlayer = room.players.length === 1;

    // If host was the only player, delete room immediately before removing player
    if (isHost && wasOnlyPlayer) {
      console.log('[DB] Host was only player, deleting room:', roomId);
      const { error: roomDeleteError } = await supabaseAdmin.from('rooms').delete().eq('id', roomId);
      if (roomDeleteError) {
        console.error('[DB] Error deleting room:', roomDeleteError);
      }
      const { error: playersDeleteError } = await supabaseAdmin.from('room_players').delete().eq('room_id', roomId);
      if (playersDeleteError) {
        console.error('[DB] Error deleting room players:', playersDeleteError);
      }
      const { error: gameStateDeleteError } = await supabaseAdmin.from('game_states').delete().eq('room_id', roomId);
      if (gameStateDeleteError) {
        console.error('[DB] Error deleting game state:', gameStateDeleteError);
      }
      return null;
    }

    // Remove player
    const { error: removeError } = await supabaseAdmin
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (removeError) {
      console.error('[DB] Error removing player:', removeError);
      throw new Error(`Failed to remove player: ${removeError.message}`);
    }

    // If host left and there are other players, assign new host
    if (isHost && room.players.length > 1) {
      const remainingPlayers = room.players.filter(p => p.id !== userId);
      if (remainingPlayers.length > 0) {
        const { error: updateHostError } = await supabaseAdmin
          .from('rooms')
          .update({ host_id: remainingPlayers[0].id })
          .eq('id', roomId);
        
        if (updateHostError) {
          console.error('[DB] Error updating host:', updateHostError);
        }

        const { error: updatePlayerHostError } = await supabaseAdmin
          .from('room_players')
          .update({ is_host: true })
          .eq('room_id', roomId)
          .eq('user_id', remainingPlayers[0].id);
        
        if (updatePlayerHostError) {
          console.error('[DB] Error updating player host status:', updatePlayerHostError);
        }
      }
    }

    // Check if room is now empty after removing player
    const updatedRoom = await getRoom(roomId);
    if (updatedRoom && updatedRoom.players.length === 0) {
      // No players left - delete room
      console.log('[DB] Deleting empty room:', roomId);
      const { error: roomDeleteError } = await supabaseAdmin.from('rooms').delete().eq('id', roomId);
      if (roomDeleteError) {
        console.error('[DB] Error deleting empty room:', roomDeleteError);
      }
      const { error: playersDeleteError } = await supabaseAdmin.from('room_players').delete().eq('room_id', roomId);
      if (playersDeleteError) {
        console.error('[DB] Error deleting empty room players:', playersDeleteError);
      }
      const { error: gameStateDeleteError } = await supabaseAdmin.from('game_states').delete().eq('room_id', roomId);
      if (gameStateDeleteError) {
        console.error('[DB] Error deleting empty room game state:', gameStateDeleteError);
      }
      return null;
    }

    return updatedRoom;
  } catch (error) {
    console.error('[DB] Error in leaveRoom:', error);
    // Don't throw - return null to gracefully handle errors
    return null;
  }
}

export async function updatePlayerReady(
  roomId: string,
  userId: string,
  isReady: boolean
): Promise<GameRoom | null> {
  const normalizedRoomId = roomId.toUpperCase().trim();

  const { error } = await supabaseAdmin
    .from('room_players')
    .update({ is_ready: isReady })
    .eq('room_id', normalizedRoomId)
    .eq('user_id', userId);

  if (error) {
    return null;
  }

  return getRoom(normalizedRoomId);
}

export async function startGame(
  roomId: string,
  topic: string,
  gameMode: GameMode
): Promise<GameRoom | null> {
  const normalizedRoomId = roomId.toUpperCase().trim();
  const room = await getRoom(normalizedRoomId);

  // Validate minimum players based on game mode
  const getMinPlayers = (mode: GameMode): number => {
    switch (mode) {
      case 'imposter':
        return 3; // 1 imposter + at least 2 innocents
      case 'mixed':
        return 5; // 1 similar + 1 imposter + at least 3 innocents
      case 'similar-word':
        return 2; // 1 similar + at least 1 normal
      default:
        return 2;
    }
  };

  const minPlayers = getMinPlayers(gameMode);
  if (!room || room.gameState !== 'waiting' || room.players.length < minPlayers) {
    return null;
  }

  // Get words for topic
  const words = getWordsForTopic(topic);
  const gameWord = words[Math.floor(Math.random() * words.length)];

  // Create spin order
  const numPlayers = room.players.length;
  let spinOrder: (boolean | 'similar' | 'imposter')[];
  
  switch (gameMode) {
    case 'similar-word':
      spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'similar' : false);
      break;
    case 'imposter':
      spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'imposter' : false);
      break;
    case 'mixed':
      spinOrder = Array(numPlayers).fill(false).map((_, i) => {
        if (i === 0) return 'similar';
        if (i === 1) return 'imposter';
        return false;
      });
      break;
    default:
      spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'similar' : false);
  }

  const shuffledOrder = shuffleArray([...spinOrder]);
  const playerOrder = shuffleArray(room.players.map(p => p.id));

  // Update room
  const { error: roomError } = await supabaseAdmin
    .from('rooms')
    .update({
      game_state: 'playing',
      current_topic: topic,
      game_word: gameWord,
      game_mode: gameMode,
      current_spin: 0,
      total_spins: numPlayers,
      spin_order: shuffledOrder,
      player_order: playerOrder,
    })
    .eq('id', normalizedRoomId);

  if (roomError) {
    return null;
  }

  // Initialize game state
  await supabaseAdmin
    .from('game_states')
    .upsert({
      room_id: normalizedRoomId,
      current_player_index: 0,
      current_spin: 0,
      voting_phase: false,
      voting_activated: false,
    }, {
      onConflict: 'room_id',
    });

  // Update player indices
  playerOrder.forEach((playerId, index) => {
    supabaseAdmin
      .from('room_players')
      .update({ player_index: index + 1 })
      .eq('room_id', normalizedRoomId)
      .eq('user_id', playerId);
  });

  return getRoom(normalizedRoomId);
}

export interface GameStateData {
  currentPlayerIndex?: number;
  currentSpin?: number;
  votingPhase?: boolean;
  currentVotingPlayerIndex?: number;
  votingActivated?: boolean;
  eliminatedPlayer?: unknown;
  isTie?: boolean;
  tiedPlayers?: unknown;
  wrongElimination?: boolean;
  playerWords?: unknown;
  votes?: unknown;
  emotes?: unknown;
}

export async function updateGameState(
  roomId: string,
  gameStateData: GameStateData
): Promise<void> {
  const normalizedRoomId = roomId.toUpperCase().trim();

  const { error } = await supabaseAdmin
    .from('game_states')
    .upsert({
      room_id: normalizedRoomId,
      current_player_index: gameStateData.currentPlayerIndex,
      current_spin: gameStateData.currentSpin,
      voting_phase: gameStateData.votingPhase,
      current_voting_player_index: gameStateData.currentVotingPlayerIndex,
      voting_activated: gameStateData.votingActivated,
      eliminated_player: gameStateData.eliminatedPlayer,
      is_tie: gameStateData.isTie,
      tied_players: gameStateData.tiedPlayers,
      wrong_elimination: gameStateData.wrongElimination,
      player_words: gameStateData.playerWords,
      votes: gameStateData.votes,
      emotes: gameStateData.emotes,
    }, {
      onConflict: 'room_id',
    });

  if (error) {
    console.error('[DB] Error updating game state:', {
      roomId: normalizedRoomId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to update game state: ${error.message} (Code: ${error.code})`);
  }
}

export async function addEmote(
  roomId: string,
  userId: string,
  emote: string
): Promise<void> {
  const normalizedRoomId = roomId.toUpperCase().trim();
  const room = await getRoom(normalizedRoomId);
  if (!room) return;

  const player = room.players.find(p => p.id === userId);
  if (!player) return;

  const playerIndex = room.players.findIndex(p => p.id === userId);
  
  const { data: gameState } = await supabaseAdmin
    .from('game_states')
    .select('emotes')
    .eq('room_id', normalizedRoomId)
    .single();

  const emotes = gameState?.emotes || [];
  emotes.push({
    playerId: playerIndex + 1,
    emote,
    timestamp: Date.now(),
  });

  // Keep only last 20 emotes
  const recentEmotes = emotes.slice(-20);

  await supabaseAdmin
    .from('game_states')
    .update({ emotes: recentEmotes })
    .eq('room_id', normalizedRoomId);
}

// Helper functions
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getWordsForTopic(topic: string): string[] {
  // Import wordTopics dynamically to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { wordTopics } = require('@/data/wordTopics') as { wordTopics: Array<{ id: string; words: string[] }> };
  const topicData = wordTopics.find((t) => t.id === topic);
  return topicData?.words || [];
}

