import { wordTopics } from '@/data/wordTopics';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  currentWord?: string;
  isImposter?: boolean;
}

export type GameMode = 'similar-word' | 'imposter' | 'mixed';

export interface GameRoom {
  id: string;
  hostId: string;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'finished';
  currentTopic?: string;
  gameWord?: string;
  gameMode?: GameMode;
  currentSpin: number;
  totalSpins: number;
  spinOrder: (boolean | 'similar' | 'imposter')[];
  createdAt: Date;
  playerOrder?: string[]; // Randomized player order (player IDs)
  // Real-time game state
  gameStateData?: {
    currentPlayerIndex: number;
    currentSpin?: number; // Add currentSpin to game state data
    votingPhase: boolean;
    votingActivated: boolean;
    eliminatedPlayer?: { id: number; name: string; wordType?: 'normal' | 'similar' | 'imposter'; votes?: number };
    isTie?: boolean;
    tiedPlayers?: Array<{ id: number; name: string; votes: number }>;
    wrongElimination?: boolean;
    playerWords?: Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>;
    votes?: Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }>;
    emotes?: Array<{ playerId: number; emote: string; timestamp: number }>;
  };
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
  private roomCleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  createRoom(hostId: string, hostName: string): GameRoom {
    const roomId = this.generateRoomId();
    const room: GameRoom = {
      id: roomId,
      hostId,
      players: [{
        id: hostId,
        name: hostName,
        isHost: true,
        isReady: false
      }],
      gameState: 'waiting',
      currentSpin: 0,
      totalSpins: 3,
      spinOrder: [],
      createdAt: new Date()
    };
    
    this.rooms.set(roomId, room);
    this.playerRooms.set(hostId, roomId);
    
    // Cancel any cleanup timer for this room
    const timer = this.roomCleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.roomCleanupTimers.delete(roomId);
    }
    
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string, maxPlayers: number = 8): GameRoom | null {
    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    const room = this.rooms.get(normalizedRoomId);
    
    // Check if room exists
    if (!room) {
      return null;
    }
    
    // Check if room is in waiting state
    if (room.gameState !== 'waiting') {
      return null;
    }

    // Check if player already in room
    if (room.players.some(p => p.id === playerId)) {
      return room;
    }

    // Check room capacity
    if (room.players.length >= maxPlayers) {
      return null;
    }

    // Check for duplicate names (case-insensitive)
    const normalizedName = playerName.trim().toLowerCase();
    if (room.players.some(p => p.name.trim().toLowerCase() === normalizedName)) {
      return null;
    }

    room.players.push({
      id: playerId,
      name: playerName.trim(),
      isHost: false,
      isReady: false
    });

    this.playerRooms.set(playerId, normalizedRoomId);
    return room;
  }

  leaveRoom(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    // If host left, assign new host
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }

    // If no players left, schedule room cleanup (delete after 5 minutes)
    if (room.players.length === 0) {
      const timer = setTimeout(() => {
        this.rooms.delete(roomId);
        this.roomCleanupTimers.delete(roomId);
      }, 5 * 60 * 1000); // 5 minutes
      
      // Clear existing timer if any
      const existingTimer = this.roomCleanupTimers.get(roomId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      this.roomCleanupTimers.set(roomId, timer);
    } else {
      // Cancel cleanup if room has players again
      const timer = this.roomCleanupTimers.get(roomId);
      if (timer) {
        clearTimeout(timer);
        this.roomCleanupTimers.delete(roomId);
      }
    }

    this.playerRooms.delete(playerId);
    return room;
  }

  getRoom(roomId: string): GameRoom | null {
    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    return this.rooms.get(normalizedRoomId) || null;
  }

  getPlayerRoom(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) || null : null;
  }

  getOpenRooms(): GameRoom[] {
    // Return all rooms that are waiting for players
    return Array.from(this.rooms.values()).filter(room => room.gameState === 'waiting');
  }

  startGame(roomId: string, topic: string, gameMode: GameMode): GameRoom | null {
    // Normalize room ID to uppercase for consistent lookup
    const normalizedRoomId = roomId.toUpperCase().trim();
    const room = this.rooms.get(normalizedRoomId);
    if (!room || room.players.length < 2) return null;
    
    // Check if all players are ready
    if (!room.players.every(p => p.isReady)) {
      return null;
    }

    // Randomize player order
    const shuffledPlayers = this.shuffleArray([...room.players]);
    room.players = shuffledPlayers;
    room.playerOrder = shuffledPlayers.map(p => p.id); // Store the randomized order

    // Select random word from topic
    const words = this.getWordsForTopic(topic);
    const gameWord = words[Math.floor(Math.random() * words.length)];

    // Create spin order based on game mode and actual number of players
    const numPlayers = room.players.length;
    let spinOrder: (boolean | 'similar' | 'imposter')[];
    switch (gameMode) {
      case 'similar-word':
        // 1 similar word, rest normal
        spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'similar' : false);
        break;
      case 'imposter':
        // 1 imposter, rest normal
        spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'imposter' : false);
        break;
      case 'mixed':
        // 1 similar word, 1 imposter, rest normal
        spinOrder = Array(numPlayers).fill(false).map((_, i) => {
          if (i === 0) return 'similar';
          if (i === 1) return 'imposter';
          return false;
        });
        break;
      default:
        spinOrder = Array(numPlayers).fill(false).map((_, i) => i === 0 ? 'similar' : false);
    }
    
    const shuffledOrder = this.shuffleArray([...spinOrder]);

    room.gameState = 'playing';
    room.currentTopic = topic;
    room.gameWord = gameWord;
    room.gameMode = gameMode;
    room.currentSpin = 0;
    room.totalSpins = numPlayers;
    room.spinOrder = shuffledOrder;

    return room;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private getWordsForTopic(topic: string): string[] {
    const topicData = wordTopics.find((t) => t.id === topic);
    return topicData?.words || [];
  }
}

// Singleton instance
let roomManagerInstance: RoomManager | null = null;

export const roomManager = (() => {
  if (!roomManagerInstance) {
    roomManagerInstance = new RoomManager();
  }
  return roomManagerInstance;
})();
