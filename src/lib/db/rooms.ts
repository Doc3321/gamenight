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
  
  const { data: room, error: roomError } = await supabaseAdmin
    .from('rooms')
    .insert({
      id: roomId,
      host_id: hostId,
      game_state: 'waiting',
    })
    .select()
    .single();

  if (roomError || !room) {
    throw new Error('Failed to create room');
  }

  // Add host as player
  const { error: playerError } = await supabaseAdmin
    .from('room_players')
    .insert({
      room_id: roomId,
      user_id: hostId,
      player_name: hostName,
      is_host: true,
      is_ready: false,
    });

  if (playerError) {
    // Cleanup room if player insert fails
    await supabaseAdmin.from('rooms').delete().eq('id', roomId);
    throw new Error('Failed to add host to room');
  }

  const createdRoom = await getRoom(roomId);
  if (!createdRoom) {
    throw new Error('Failed to retrieve created room');
  }
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
      const { data: players } = await supabaseAdmin
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });

      return dbRoomToGameRoom(room, players || []);
    })
  );

  return roomsWithPlayers;
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

  // Check if already in room
  const existingPlayer = room.players.find(p => p.id === userId);
  if (existingPlayer) {
    return room;
  }

  // Check if room is full
  if (room.players.length >= 8) {
    return null;
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
  // Find which room the user is in
  const { data: playerData } = await supabaseAdmin
    .from('room_players')
    .select('room_id')
    .eq('user_id', userId)
    .single();

  if (!playerData) {
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

  // Remove player
  await supabaseAdmin
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  // If host left and there are other players, assign new host
  if (player.isHost && room.players.length > 1) {
    const remainingPlayers = room.players.filter(p => p.id !== userId);
    if (remainingPlayers.length > 0) {
      await supabaseAdmin
        .from('rooms')
        .update({ host_id: remainingPlayers[0].id })
        .eq('id', roomId);

      await supabaseAdmin
        .from('room_players')
        .update({ is_host: true })
        .eq('room_id', roomId)
        .eq('user_id', remainingPlayers[0].id);
    }
  }

  // If no players left, delete room after 5 minutes (handled by cleanup job)
  const updatedRoom = await getRoom(roomId);
  if (updatedRoom && updatedRoom.players.length === 0) {
    // Schedule cleanup - in production, use a cron job
    setTimeout(async () => {
      const checkRoom = await getRoom(roomId);
      if (checkRoom && checkRoom.players.length === 0) {
        await supabaseAdmin.from('rooms').delete().eq('id', roomId);
      }
    }, 5 * 60 * 1000);
  }

  return updatedRoom;
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

  if (!room || room.gameState !== 'waiting' || room.players.length < 2) {
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

  await supabaseAdmin
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

