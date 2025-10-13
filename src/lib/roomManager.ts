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
  spinOrder: boolean[];
  createdAt: Date;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId

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
    
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== 'waiting') {
      return null;
    }

    // Check if player already in room
    if (room.players.some(p => p.id === playerId)) {
      return room;
    }

    room.players.push({
      id: playerId,
      name: playerName,
      isHost: false,
      isReady: false
    });

    this.playerRooms.set(playerId, roomId);
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

    // If no players left, delete room
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }

    this.playerRooms.delete(playerId);
    return room;
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null;
  }

  getPlayerRoom(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) || null : null;
  }

  startGame(roomId: string, topic: string, gameMode: GameMode): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length < 2) return null;

    // Select random word from topic
    const words = this.getWordsForTopic(topic);
    const gameWord = words[Math.floor(Math.random() * words.length)];

    // Create spin order based on game mode
    let spinOrder: boolean[];
    switch (gameMode) {
      case 'similar-word':
        // 2 normal, 1 similar word
        spinOrder = [false, false, 'similar'];
        break;
      case 'imposter':
        // 2 normal, 1 imposter
        spinOrder = [false, false, 'imposter'];
        break;
      case 'mixed':
        // 1 normal, 1 similar word, 1 imposter
        spinOrder = [false, 'similar', 'imposter'];
        break;
      default:
        spinOrder = [false, false, 'similar'];
    }
    
    const shuffledOrder = this.shuffleArray([...spinOrder]);

    room.gameState = 'playing';
    room.currentTopic = topic;
    room.gameWord = gameWord;
    room.gameMode = gameMode;
    room.currentSpin = 0;
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
export const roomManager = new RoomManager();
