'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordGame, SpinResult } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VotingPhase from './VotingPhase';

interface GameBoardProps {
  game: WordGame;
  onReset: () => void;
  isAdmin?: boolean; // For online mode
  currentPlayerId?: number; // For online mode - the game player ID of current viewer
}

export default function GameBoard({ game, onReset, isAdmin = false, currentPlayerId: viewingPlayerId }: GameBoardProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameState, setGameState] = useState(game.getState());
  const [showResult, setShowResult] = useState(false);
  const [isFirstSpin, setIsFirstSpin] = useState(true);
  const [currentVotingPlayerIndex, setCurrentVotingPlayerIndex] = useState(0);

  const handleSpin = () => {
    setIsSpinning(true);
    setShowResult(false);
    
    // Simulate spinning delay
    setTimeout(() => {
      const result = game.spin();
      if (result) {
        setGameState(game.getState());
        setIsSpinning(false);
        setShowResult(true);
      }
    }, 2000);
  };

  const getCurrentPlayer = () => {
    if (gameState.players && gameState.currentPlayerIndex < gameState.players.length) {
      return gameState.players[gameState.currentPlayerIndex];
    }
    return null;
  };

  const handleNextSpin = () => {
    setShowResult(false);
    
    // Check if all players have received their words
    const newState = game.getState();
    if (newState.currentPlayerIndex >= newState.players.length) {
      // All players have spun - start voting phase
      game.startVotingPhase();
      setGameState(game.getState());
    } else if (newState.currentSpin >= newState.totalSpins) {
      // This shouldn't happen, but just in case
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
    const newState = game.getState();
    setGameState(newState);
    
    // If this is the first spin and we have a selected word, show it immediately
    if (isFirstSpin && newState.selectedWord) {
      setShowResult(true);
      setIsFirstSpin(false);
    }

    // If voting phase started, find first player who hasn't voted
    if (newState.votingPhase && !newState.eliminatedPlayer) {
      const activePlayers = newState.players.filter(p => !p.isEliminated);
      const nextVoter = activePlayers.find(p => !p.hasVoted);
      if (nextVoter) {
        const voterIndex = newState.players.findIndex(p => p.id === nextVoter.id);
        setCurrentVotingPlayerIndex(voterIndex);
      }
    }
  }, [game, isFirstSpin]);

  const handleVoteComplete = () => {
    const newState = game.getState();
    setGameState(newState);
    
    // If there's an eliminated player, reset for next round or end game
    if (newState.eliminatedPlayer) {
      // For now, just show the result. Can add logic for multiple rounds later
      setCurrentVotingPlayerIndex(0);
    } else {
      // Check if there are more players to vote
      const activePlayers = newState.players.filter(p => !p.isEliminated);
      const nextVoter = activePlayers.find(p => !p.hasVoted);
      if (nextVoter) {
        const voterIndex = newState.players.findIndex(p => p.id === nextVoter.id);
        setCurrentVotingPlayerIndex(voterIndex);
      }
    }
  };

  // Show voting phase if all players have received words
  if (gameState.votingPhase && gameState.currentPlayerIndex >= gameState.players.length) {
    // For online mode, show voting to current viewing player
    // For local mode, show voting to next player who hasn't voted
    if (gameState.isOnline && viewingPlayerId) {
      const viewingPlayer = gameState.players.find(p => p.id === viewingPlayerId);
      if (viewingPlayer && !viewingPlayer.isEliminated) {
        return (
          <VotingPhase
            game={game}
            currentPlayerId={viewingPlayerId}
            onVoteComplete={handleVoteComplete}
            isAdmin={isAdmin}
          />
        );
      }
    } else {
      // Local mode: sequential voting
      const activePlayers = gameState.players.filter(p => !p.isEliminated);
      const nextVoter = activePlayers.find(p => !p.hasVoted);
      
      if (nextVoter) {
        // Update current voting player index
        const voterIndex = gameState.players.findIndex(p => p.id === nextVoter.id);
        if (voterIndex !== currentVotingPlayerIndex) {
          setCurrentVotingPlayerIndex(voterIndex);
        }
        
        return (
          <VotingPhase
            game={game}
            currentPlayerId={nextVoter.id}
            onVoteComplete={handleVoteComplete}
            isAdmin={isAdmin}
          />
        );
      }
    }
    
    if (gameState.eliminatedPlayer) {
      // All voted and eliminated player is set, show results
      return (
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-500 border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-red-600">השחקן הודח!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-4xl font-bold text-red-600 py-6"
              >
                {gameState.eliminatedPlayer.name}
              </motion.div>
              <div className="space-y-2">
                <p className="text-lg">קיבל {gameState.eliminatedPlayer.votes} קולות</p>
                <p className="text-muted-foreground">השחקן הודח מהמשחק</p>
              </div>
              <Button onClick={onReset} size="lg" className="mt-4">
                חזור לתפריט
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  if (gameState.gameCompleted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">המשחק הסתיים!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-lg">סיימת את כל הסיבובים</p>
            {gameState.eliminatedPlayer && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-red-600 font-semibold">
                  השחקן שהודח: {gameState.eliminatedPlayer.name}
                </p>
              </div>
            )}
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
            
            {getCurrentPlayer() && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">תור של:</p>
                <p className="text-lg font-semibold">{getCurrentPlayer()?.name}</p>
              </div>
            )}
            
            {!showResult && !isSpinning && !gameState.selectedWord && gameState.currentPlayerIndex < gameState.players.length && (
              (() => {
                // For online mode, only show spin button if it's viewing player's turn
                if (gameState.isOnline && viewingPlayerId) {
                  const currentSpinningPlayer = gameState.players[gameState.currentPlayerIndex];
                  const isMyTurn = currentSpinningPlayer && currentSpinningPlayer.id === viewingPlayerId;
                  if (!isMyTurn) {
                    return (
                      <div className="text-center text-muted-foreground">
                        <p>ממתין לתורך...</p>
                        {currentSpinningPlayer && (
                          <p className="text-sm mt-2">תור של: {currentSpinningPlayer.name}</p>
                        )}
                      </div>
                    );
                  }
                }
                return (
                  <Button onClick={handleSpin} className="w-full" size="lg">
                    סובב! 🎯
                  </Button>
                );
              })()
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
              {(() => {
                // For online mode, check if it's the viewing player's turn
                const currentSpinningPlayerIndex = gameState.currentPlayerIndex;
                const currentSpinningPlayer = gameState.players[currentSpinningPlayerIndex];
                const viewingPlayer = viewingPlayerId 
                  ? gameState.players.find(p => p.id === viewingPlayerId)
                  : gameState.players[gameState.currentPlayerIndex - 1];
                
                // Check if viewing player has received their word
                const hasMyWord = viewingPlayer?.currentWord !== undefined;
                const isMyTurn = gameState.isOnline 
                  ? currentSpinningPlayer && viewingPlayer && currentSpinningPlayer.id === viewingPlayer.id
                  : true; // Local mode always shows
                
                if (gameState.isOnline && !hasMyWord && currentSpinningPlayerIndex < gameState.players.length) {
                  // Online mode: waiting for my turn or it's someone else's turn
                  if (!isMyTurn && currentSpinningPlayer) {
                    return (
                      <motion.div 
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-muted-foreground py-8"
                      >
                        <p>ממתין לתורך...</p>
                        <p className="text-sm mt-2">
                          תור של: {currentSpinningPlayer.name}
                        </p>
                      </motion.div>
                    );
                  }
                }
                
                // Show word if: local mode OR it's my turn OR I already have my word
                if (gameState.selectedWord && (!gameState.isOnline || isMyTurn || hasMyWord)) {
                  const wordToShow = viewingPlayer?.currentWord || gameState.currentChoices[0] || gameState.selectedWord;
                  return (
                    <motion.div 
                      key="selected-word"
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.8 }}
                      transition={{ duration: 0.6, type: "spring" }}
                      className="text-center"
                    >
                      <div className="p-6 bg-primary/10 rounded-lg text-center text-2xl font-bold border-2 border-primary/20 hover:bg-primary/20 transition-colors">
                        {wordToShow}
                      </div>
                      {(gameState.currentChoices[0] || viewingPlayer?.currentWord) && (
                        <div className="mt-4 text-center">
                          <p className="text-sm text-muted-foreground">
                            המילה שלך
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                }
                
                return (
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
          {gameState.currentPlayerIndex < gameState.players.length ? (
            // More players to spin
            <Button onClick={handleNextSpin} className="w-full max-w-md" size="lg">
              סיבוב הבא
            </Button>
          ) : gameState.currentPlayerIndex >= gameState.players.length ? (
            // All players have spun - this is the last player viewing their word
            <div className="space-y-2">
              <p className="text-lg font-semibold">כל השחקנים קיבלו את המילים שלהם!</p>
              <Button onClick={handleNextSpin} className="w-full max-w-md" size="lg">
                התחל הצבעה
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
