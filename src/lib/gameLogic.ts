import { WordTopic } from '@/data/wordTopics';

export type GameMode = 'similar-word' | 'imposter' | 'mixed';

export interface Player {
  id: number;
  name: string;
  currentWord?: string;
  wordType?: 'normal' | 'similar' | 'imposter';
  votes?: number; // Number of votes received
  hasVoted?: boolean; // Whether this player has voted
  votedFor?: number; // ID of player this player voted for (for normal voting)
  votedForImposter?: number; // ID of player voted for as imposter (for both mode)
  votedForOtherWord?: number; // ID of player voted for as other word (for both mode)
  isEliminated?: boolean; // Whether player is eliminated
}

export interface GameState {
  currentSpin: number;
  totalSpins: number;
  currentChoices: string[];
  selectedWord: string;
  isImposter: boolean;
  gameCompleted: boolean;
  topic: WordTopic;
  gameWord: string; // 1 word selected for the entire game
  gameMode: GameMode;
  spinOrder: (boolean | 'similar' | 'imposter')[]; // which spins are imposter/similar vs normal
  players: Player[];
  currentPlayerIndex: number;
  votingPhase: boolean; // Whether we're in voting phase
  votingRound: number; // Current voting round (for tie-breaking)
  eliminatedPlayer?: Player; // The eliminated player
  isOnline: boolean; // Whether this is an online game
  votingActivated: boolean; // Whether voting has been activated (for online mode)
  showVoteCounts: boolean; // Whether to show vote counts (false for online, true for local)
  wrongElimination: boolean; // Whether the eliminated player was wrong (not imposter/other word)
  canRevote: boolean; // Whether admin can trigger revote (for ties)
}

export interface SpinResult {
  choices: string[];
  selectedWord: string;
  isImposter: boolean;
  spinType: 'normal' | 'similar' | 'imposter';
}

export class WordGame {
  private state: GameState;
  private usedWords: Set<string> = new Set();

  constructor(topic: WordTopic, gameMode: GameMode = 'similar-word', players: Player[] = [], isOnline: boolean = false) {
    // Select 1 random word for the entire game
    const gameWord = topic.words[Math.floor(Math.random() * topic.words.length)];
    
    // Create spin order based on game mode and number of players
    const numPlayers = players.length || 3;
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
    console.log('Spin order:', shuffledOrder); // Debug log
    
    this.state = {
      currentSpin: 0,
      totalSpins: numPlayers,
      currentChoices: [],
      selectedWord: '',
      isImposter: false,
      gameCompleted: false,
      topic,
      gameWord,
      gameMode,
      spinOrder: shuffledOrder,
      players: players.map(p => ({ 
        ...p, 
        currentWord: undefined, 
        wordType: undefined,
        votes: 0,
        hasVoted: false,
        votedFor: undefined,
        isEliminated: false
      })),
      currentPlayerIndex: 0,
      votingPhase: false,
      votingRound: 1,
      eliminatedPlayer: undefined,
      isOnline,
      votingActivated: false,
      showVoteCounts: !isOnline, // Show votes in local mode, hide in online
      wrongElimination: false,
      canRevote: false
    };
  }

  public getState(): GameState {
    return { ...this.state };
  }

  // Method to sync game word and spin order from server (for online games)
  public syncFromServer(gameWord: string, spinOrder: (boolean | 'similar' | 'imposter')[]): void {
    this.state.gameWord = gameWord;
    this.state.spinOrder = spinOrder;
  }

  public spin(): SpinResult | null {
    if (this.state.gameCompleted || this.state.currentPlayerIndex >= this.state.players.length) {
      return null;
    }

    // Get the current spin order for this player
    const spinType = this.state.spinOrder[this.state.currentPlayerIndex];
    const selectedWord = this.state.gameWord;
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    console.log(`Spin ${this.state.currentPlayerIndex + 1} (${currentPlayer.name}): spinType = ${spinType}`); // Debug log

    let finalChoices: string[];
    let isImposter = false;
    let actualSpinType: 'normal' | 'similar' | 'imposter' = 'normal';

    if (spinType === 'imposter') {
      // Show "מתחזה" for imposter
      finalChoices = ['מתחזה'];
      isImposter = true;
      actualSpinType = 'imposter';
    } else if (spinType === 'similar') {
      // Show a similar word
      const similarWord = this.findSimilarWord(selectedWord);
      finalChoices = [similarWord];
      isImposter = true; // Similar word is also considered "imposter" for game logic
      actualSpinType = 'similar';
    } else {
      // Normal spin - show the game word
      finalChoices = [selectedWord];
      isImposter = false;
      actualSpinType = 'normal';
    }

    // Update player's word
    this.state.players[this.state.currentPlayerIndex].currentWord = finalChoices[0];
    this.state.players[this.state.currentPlayerIndex].wordType = actualSpinType;

    this.state.currentChoices = finalChoices;
    this.state.selectedWord = selectedWord;
    this.state.isImposter = isImposter;
    this.state.currentSpin++;
    this.state.currentPlayerIndex++;

    // Don't start voting phase immediately - let the last player see their word first
    // Voting phase will be started manually after the last player views their word

    return {
      choices: finalChoices,
      selectedWord,
      isImposter,
      spinType: actualSpinType
    };
  }

  public startVotingPhase(): void {
    this.state.votingPhase = true;
    // Reset voting state for all active (non-eliminated) players
    this.state.players.forEach(p => {
      if (!p.isEliminated) {
        p.votes = 0;
        p.hasVoted = false;
        p.votedFor = undefined;
        p.votedForImposter = undefined;
        p.votedForOtherWord = undefined;
      }
    });
  }

  public activateVoting(): void {
    // For online mode, admin must activate voting
    if (this.state.isOnline) {
      this.state.votingActivated = true;
      this.startVotingPhase();
    }
  }

  public castVote(voterId: number, targetId: number, voteType?: 'imposter' | 'other-word'): boolean {
    const voter = this.state.players.find(p => p.id === voterId);
    const target = this.state.players.find(p => p.id === targetId);

    // Validation
    if (!voter || !target) return false;
    if (voter.isEliminated || target.isEliminated) return false;
    if (voterId === targetId) return false; // Can't vote for yourself
    
    // For both mode, check if already voted for this person in this type
    if (this.state.gameMode === 'mixed' && voteType) {
      if (voteType === 'imposter' && voter.votedForImposter === targetId) return false;
      if (voteType === 'other-word' && voter.votedForOtherWord === targetId) return false;
    } else {
      // Normal voting - can't vote if already voted
      if (voter.hasVoted) return false;
    }

    // Cast vote
    if (this.state.gameMode === 'mixed' && voteType) {
      // Both mode: separate votes for imposter and other word
      if (voteType === 'imposter') {
        voter.votedForImposter = targetId;
      } else if (voteType === 'other-word') {
        voter.votedForOtherWord = targetId;
      }
      // Mark as voted only if both votes are cast
      if (voter.votedForImposter !== undefined && voter.votedForOtherWord !== undefined) {
        voter.hasVoted = true;
      }
    } else {
      // Normal voting
      voter.hasVoted = true;
      voter.votedFor = targetId;
    }
    
    if (target.votes === undefined) target.votes = 0;
    target.votes!++;

    return true;
  }

  public getVotingResults(): { player: Player; votes: number }[] {
    const activePlayers = this.state.players.filter(p => !p.isEliminated);
    return activePlayers.map(p => ({
      player: p,
      votes: p.votes || 0
    })).sort((a, b) => b.votes - a.votes);
  }

  public allPlayersVoted(tiedPlayerIds?: number[]): boolean {
    if (tiedPlayerIds && tiedPlayerIds.length > 0) {
      // In tie-break, only check if tied players have voted
      const tiedPlayers = this.state.players.filter(p => 
        tiedPlayerIds.includes(p.id) && !p.isEliminated
      );
      if (this.state.gameMode === 'mixed') {
        // Both mode: need both votes
        return tiedPlayers.length > 0 && tiedPlayers.every(p => 
          p.hasVoted && p.votedForImposter !== undefined && p.votedForOtherWord !== undefined
        );
      }
      return tiedPlayers.length > 0 && tiedPlayers.every(p => p.hasVoted);
    }
    
    // Normal voting - all active players must vote
    const activePlayers = this.state.players.filter(p => !p.isEliminated);
    if (this.state.gameMode === 'mixed') {
      // Both mode: need both votes
      return activePlayers.length > 0 && activePlayers.every(p => 
        p.hasVoted && p.votedForImposter !== undefined && p.votedForOtherWord !== undefined
      );
    }
    return activePlayers.length > 0 && activePlayers.every(p => p.hasVoted);
  }

  public calculateVotingResult(): { eliminated: Player | null; isTie: boolean; tiedPlayers: Player[]; wasWrong: boolean } {
    const results = this.getVotingResults();
    
    if (results.length === 0) {
      return { eliminated: null, isTie: false, tiedPlayers: [], wasWrong: false };
    }

    const maxVotes = results[0].votes;
    const tiedPlayers = results.filter(r => r.votes === maxVotes).map(r => r.player);

    if (tiedPlayers.length > 1) {
      // There's a tie
      this.state.canRevote = true;
      return {
        eliminated: null,
        isTie: true,
        tiedPlayers,
        wasWrong: false
      };
    }

    // Single winner (most votes = eliminated)
    const eliminated = tiedPlayers[0];
    eliminated.isEliminated = true;
    this.state.eliminatedPlayer = eliminated;
    
    // Check if wrong elimination (not imposter/other word)
    const wasWrong = eliminated.wordType === 'normal';
    this.state.wrongElimination = wasWrong;
    
    return {
      eliminated,
      isTie: false,
      tiedPlayers: [],
      wasWrong
    };
  }

  public startTieBreakVote(tiedPlayerIds: number[]): void {
    // Reset votes for all active players (only tied players will vote, but we reset all)
    this.state.players.forEach(p => {
      if (!p.isEliminated) {
        p.votes = 0;
        // Only reset voting status for tied players (they can vote again)
        if (tiedPlayerIds.includes(p.id)) {
          p.hasVoted = false;
          p.votedFor = undefined;
          p.votedForImposter = undefined;
          p.votedForOtherWord = undefined;
        }
      }
    });
    this.state.votingRound++;
    this.state.canRevote = false;
  }

  public revote(): void {
    // Admin can trigger revote for ties
    const activePlayers = this.state.players.filter(p => !p.isEliminated);
    activePlayers.forEach(p => {
      p.votes = 0;
      p.hasVoted = false;
      p.votedFor = undefined;
      p.votedForImposter = undefined;
      p.votedForOtherWord = undefined;
    });
    this.state.votingRound++;
    this.state.canRevote = false;
  }

  public continueAfterWrongElimination(): void {
    // After wrong elimination, allow another vote
    const activePlayers = this.state.players.filter(p => !p.isEliminated);
    activePlayers.forEach(p => {
      p.votes = 0;
      p.hasVoted = false;
      p.votedFor = undefined;
      p.votedForImposter = undefined;
      p.votedForOtherWord = undefined;
    });
    this.state.wrongElimination = false;
    this.state.eliminatedPlayer = undefined;
    this.state.votingRound++;
  }

  public clearCurrentWord(): void {
    this.state.currentChoices = [];
    this.state.selectedWord = '';
    this.state.isImposter = false;
  }

  public completeGame(): void {
    this.state.gameCompleted = true;
  }

  public reset(): void {
    // Select a new random word for the entire game
    const gameWord = this.state.topic.words[Math.floor(Math.random() * this.state.topic.words.length)];
    
    // Create new spin order based on current game mode and number of players
    const numPlayers = this.state.players.length;
    let spinOrder: (boolean | 'similar' | 'imposter')[];
    
    switch (this.state.gameMode) {
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
    
    const shuffledOrder = this.shuffleArray([...spinOrder]);
    
    this.state.currentSpin = 0;
    this.state.currentChoices = [];
    this.state.selectedWord = '';
    this.state.isImposter = false;
    this.state.gameCompleted = false;
    this.state.gameWord = gameWord;
    this.state.spinOrder = shuffledOrder;
    this.state.currentPlayerIndex = 0;
    // Reset player words
    this.state.players.forEach(p => {
      p.currentWord = undefined;
      p.wordType = undefined;
      p.votes = 0;
      p.hasVoted = false;
      p.votedFor = undefined;
      p.votedForImposter = undefined;
      p.votedForOtherWord = undefined;
      p.isEliminated = false;
    });
    this.state.votingPhase = false;
    this.state.votingRound = 1;
    this.state.eliminatedPlayer = undefined;
    this.state.votingActivated = false;
    this.state.wrongElimination = false;
    this.state.canRevote = false;
    this.usedWords.clear();
  }

  private findSimilarWord(selectedWord: string): string {
    // Find words that are similar to the selected word
    const similarWords = this.state.topic.words.filter(word => 
      word !== selectedWord && 
      this.areWordsSimilar(selectedWord, word)
    );
    
    if (similarWords.length > 0) {
      return similarWords[Math.floor(Math.random() * similarWords.length)];
    }
    
    // If no similar words found, return a random word
    const otherWords = this.state.topic.words.filter(word => word !== selectedWord);
    return otherWords[Math.floor(Math.random() * otherWords.length)];
  }

  private areWordsSimilar(word1: string, word2: string): boolean {
    // Check if words share common letters or patterns
    const commonLetters = this.getCommonLetters(word1, word2);
    const minLength = Math.min(word1.length, word2.length);
    
    // Words are similar if they share at least 60% of their letters
    return commonLetters / minLength >= 0.6;
  }

  private getCommonLetters(word1: string, word2: string): number {
    const letters1 = word1.split('');
    const letters2 = word2.split('');
    let common = 0;
    
    for (const letter of letters1) {
      if (letters2.includes(letter)) {
        common++;
        // Remove the letter from letters2 to avoid counting it twice
        const index = letters2.indexOf(letter);
        letters2.splice(index, 1);
      }
    }
    
    return common;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
