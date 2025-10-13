import { WordTopic } from '@/data/wordTopics';

export type GameMode = 'similar-word' | 'imposter' | 'mixed';

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

  constructor(topic: WordTopic, gameMode: GameMode = 'similar-word') {
    // Select 1 random word for the entire game
    const gameWord = topic.words[Math.floor(Math.random() * topic.words.length)];
    
    // Create spin order based on game mode
    let spinOrder: (boolean | 'similar' | 'imposter')[];
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
    console.log('Spin order:', shuffledOrder); // Debug log
    
    this.state = {
      currentSpin: 0,
      totalSpins: 3,
      currentChoices: [],
      selectedWord: '',
      isImposter: false,
      gameCompleted: false,
      topic,
      gameWord,
      gameMode,
      spinOrder: shuffledOrder
    };
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public spin(): SpinResult | null {
    if (this.state.gameCompleted) {
      return null;
    }

    // Get the current spin order
    const spinType = this.state.spinOrder[this.state.currentSpin];
    const selectedWord = this.state.gameWord;
    console.log(`Spin ${this.state.currentSpin + 1}: spinType = ${spinType}`); // Debug log

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

    this.state.currentChoices = finalChoices;
    this.state.selectedWord = selectedWord;
    this.state.isImposter = isImposter;
    this.state.currentSpin++;

    // Only mark as completed after showing the result
    if (this.state.currentSpin > this.state.totalSpins) {
      this.state.gameCompleted = true;
    }

    return {
      choices: finalChoices,
      selectedWord,
      isImposter,
      spinType: actualSpinType
    };
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
    
    // Create new spin order based on current game mode
    let spinOrder: (boolean | 'similar' | 'imposter')[];
    switch (this.state.gameMode) {
      case 'similar-word':
        spinOrder = [false, false, 'similar'];
        break;
      case 'imposter':
        spinOrder = [false, false, 'imposter'];
        break;
      case 'mixed':
        spinOrder = [false, 'similar', 'imposter'];
        break;
      default:
        spinOrder = [false, false, 'similar'];
    }
    
    const shuffledOrder = this.shuffleArray([...spinOrder]);
    
    this.state.currentSpin = 0;
    this.state.currentChoices = [];
    this.state.selectedWord = '';
    this.state.isImposter = false;
    this.state.gameCompleted = false;
    this.state.gameWord = gameWord;
    this.state.spinOrder = shuffledOrder;
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
