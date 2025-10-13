'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordGame, SpinResult } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GameBoardProps {
  game: WordGame;
  onReset: () => void;
}

export default function GameBoard({ game, onReset }: GameBoardProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameState, setGameState] = useState(game.getState());
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [isFirstSpin, setIsFirstSpin] = useState(true);

  const handleSpin = () => {
    setIsSpinning(true);
    setShowResult(false);
    
    // Simulate spinning delay
    setTimeout(() => {
      const result = game.spin();
      if (result) {
        setLastResult(result);
        setGameState(game.getState());
        setIsSpinning(false);
        setShowResult(true);
      }
    }, 2000);
  };

  const getSpinTypeText = (spinType: string) => {
    switch (spinType) {
      case 'normal':
        return '✅ המילה הנכונה';
      case 'similar':
        return '🎭 מילה דומה';
      case 'imposter':
        return '🎭 מתחזה';
      default:
        return '';
    }
  };

  const handleNextSpin = () => {
    setShowResult(false);
    
    // If this was the last spin, complete the game
    if (gameState.currentSpin >= gameState.totalSpins) {
      game.completeGame();
      setGameState(game.getState());
    } else {
      // Clear the current word for next spin
      game.clearCurrentWord();
      setGameState(game.getState());
    }
  };

  const handleReset = () => {
    game.reset();
    setShowResult(false);
    setLastResult(null);
    setGameState(game.getState());
  };

  useEffect(() => {
    setGameState(game.getState());
    // If this is the first spin and we have a selected word, show it immediately
    if (isFirstSpin && game.getState().selectedWord) {
      setShowResult(true);
      setLastResult({
        choices: game.getState().currentChoices,
        selectedWord: game.getState().selectedWord,
        isImposter: game.getState().isImposter,
        spinType: game.getState().isImposter ? 'imposter' : 'normal'
      });
      setIsFirstSpin(false);
    }
  }, [game, isFirstSpin]);

  if (gameState.gameCompleted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">המשחק הסתיים!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-lg">סיימת את כל 3 הסיבובים</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleReset} variant="outline">
                משחק חדש
              </Button>
              <Button onClick={onReset}>
                חזור לתפריט
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Status */}
        <Card>
          <CardHeader>
            <CardTitle>סטטוס המשחק</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{gameState.currentSpin} / {gameState.totalSpins}</p>
              <p className="text-muted-foreground">סיבובים</p>
            </div>
            
            {!showResult && !isSpinning && !gameState.selectedWord && (
              <Button onClick={handleSpin} className="w-full" size="lg">
                סובב! 🎯
              </Button>
            )}
            
            {isSpinning && (
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>סובב...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Word Display */}
        <Card>
          <CardHeader>
            <CardTitle>המילה שלך</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {gameState.selectedWord ? (
                <motion.div 
                  key="selected-word"
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  transition={{ duration: 0.6, type: "spring" }}
                  className="text-center"
                >
                  <div className="p-6 bg-primary/10 rounded-lg text-center text-2xl font-bold border-2 border-primary/20 hover:bg-primary/20 transition-colors">
                    {gameState.isImposter ? gameState.currentChoices[0] : gameState.selectedWord}
                  </div>
                  {lastResult && (
                    <div className="mt-4 text-center">
                      <p className="text-lg font-medium">
                        {getSpinTypeText(lastResult.spinType)}
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-muted-foreground py-8"
                >
                  {isSpinning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                  ) : null}
                  {isSpinning ? 'סובב...' : 'לחץ על "סובב" כדי לקבל את המילה שלך'}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Next Spin Button */}
      {gameState.selectedWord && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          {gameState.currentSpin < gameState.totalSpins ? (
            <Button onClick={handleNextSpin} className="w-full max-w-md" size="lg">
              סיבוב הבא
            </Button>
          ) : gameState.currentSpin === gameState.totalSpins ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold">זהו הסיבוב האחרון!</p>
              <Button onClick={handleNextSpin} className="w-full max-w-md" size="lg">
                סיים משחק
              </Button>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Reset Button */}
      <div className="text-center mt-6">
        <Button onClick={onReset} variant="outline">
          חזור לתפריט הראשי
        </Button>
      </div>
    </div>
  );
}
