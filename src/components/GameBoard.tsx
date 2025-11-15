'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordGame } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VotingPhase from './VotingPhase';
import PlayerAvatar from './PlayerAvatar';
import ClassifiedStamp from './ClassifiedStamp';
import AgentSpinner from './AgentSpinner';
import AgentScanLine from './AgentScanLine';

interface GameBoardProps {
  game: WordGame;
  onReset: () => void;
  isAdmin?: boolean; // For online mode
  currentPlayerId?: number; // For online mode - the game player ID of current viewer
  roomId?: string; // For online mode - room ID for real-time sync
  currentPlayerIdString?: string; // For online mode - the string player ID
}

export default function GameBoard({ game, onReset, isAdmin = false, currentPlayerId: viewingPlayerId, roomId, currentPlayerIdString }: GameBoardProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameState, setGameState] = useState(game.getState());
  const [showResult, setShowResult] = useState(false);
  const [isFirstSpin, setIsFirstSpin] = useState(true);
  const [currentVotingPlayerIndex, setCurrentVotingPlayerIndex] = useState(0);
  const [spinProgress, setSpinProgress] = useState(0);

  const handleSpin = async () => {
    setIsSpinning(true);
    setShowResult(false);
    setSpinProgress(0);
    
    // Animate progress
    const progressInterval = setInterval(() => {
      setSpinProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
    
    // Simulate spinning delay
    setTimeout(async () => {
      const result = game.spin();
      if (result) {
        const newState = game.getState();
        setGameState(newState);
        setIsSpinning(false);
        setShowResult(true);
        setSpinProgress(100);
        clearInterval(progressInterval);
        
        // Sync game state to server for online games
        // Use fresh state from game object, not component state
        const freshState = game.getState();
        if (freshState.isOnline && roomId) {
          try {
            await fetch('/api/rooms/game-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                gameStateData: {
                  currentPlayerIndex: freshState.currentPlayerIndex,
                  currentSpin: freshState.currentSpin, // Also sync currentSpin
                  votingPhase: freshState.votingPhase,
                  votingActivated: freshState.votingActivated,
                  playerWords: freshState.players.reduce((acc, p) => {
                    if (p.currentWord) {
                      acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                    }
                    return acc;
                  }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
                }
              })
            });
          } catch (error) {
            console.error('Error syncing game state:', error);
          }
        }
      }
    }, 2000);
  };

  const getCurrentPlayer = () => {
    if (gameState.players && gameState.currentPlayerIndex < gameState.players.length) {
      return gameState.players[gameState.currentPlayerIndex];
    }
    return null;
  };

  const handleNextSpin = async () => {
    setShowResult(false);
    
    // Check if all players have received their words
    const newState = game.getState();
    if (newState.currentPlayerIndex >= newState.players.length) {
      // All players have spun - start voting phase
      game.startVotingPhase();
      const updatedState = game.getState();
      setGameState(updatedState);
      
      // Sync to server
      if (gameState.isOnline && roomId) {
        try {
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
                gameStateData: {
                  currentPlayerIndex: updatedState.currentPlayerIndex,
                  currentSpin: updatedState.currentSpin,
                  votingPhase: updatedState.votingPhase,
                  currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex,
                  votingActivated: updatedState.votingActivated,
                  playerWords: updatedState.players.reduce((acc, p) => {
                    if (p.currentWord) {
                      acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                    }
                    return acc;
                  }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
                }
            })
          });
        } catch (error) {
          console.error('Error syncing game state:', error);
        }
      }
    } else if (newState.currentSpin >= newState.totalSpins) {
      // This shouldn't happen, but just in case
      game.completeGame();
      setGameState(game.getState());
    } else {
      // Clear the current word for next spin (but keep player's word)
      game.clearCurrentWord();
      const updatedState = game.getState();
      setGameState(updatedState);
      
      // Sync to server
      if (gameState.isOnline && roomId) {
        try {
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
                gameStateData: {
                  currentPlayerIndex: updatedState.currentPlayerIndex,
                  currentSpin: updatedState.currentSpin,
                  votingPhase: updatedState.votingPhase,
                  currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex,
                  votingActivated: updatedState.votingActivated,
                  playerWords: updatedState.players.reduce((acc, p) => {
                    if (p.currentWord) {
                      acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                    }
                    return acc;
                  }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
                }
            })
          });
        } catch (error) {
          console.error('Error syncing game state:', error);
        }
      }
    }
  };

  const handleReset = () => {
    game.reset();
    setShowResult(false);
    setGameState(game.getState());
  };

  // Poll for game state updates in online mode
  useEffect(() => {
    if (!gameState.isOnline || !roomId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/game-state?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room?.gameStateData) {
            const serverState = data.room.gameStateData;
            const currentState = game.getState();
            let stateChanged = false;
            
            // Update currentPlayerIndex from server - CRITICAL for turn progression
            if (serverState.currentPlayerIndex !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const currentIdx = (game as any).state.currentPlayerIndex;
              if (serverState.currentPlayerIndex !== currentIdx) {
                // Directly update the game's internal state
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.currentPlayerIndex = serverState.currentPlayerIndex;
                stateChanged = true;
                // Force immediate update to ensure UI reflects the change right away
                const updatedState = game.getState();
                setGameState({ 
                  ...updatedState,
                  players: updatedState.players.map(p => ({ ...p }))
                });
              }
            }
            
            // Update currentSpin from server (if provided, otherwise use currentPlayerIndex)
            const serverCurrentSpin = serverState.currentSpin !== undefined 
              ? serverState.currentSpin 
              : serverState.currentPlayerIndex;
            if (serverCurrentSpin !== undefined && serverCurrentSpin !== currentState.currentSpin) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.currentSpin = serverCurrentSpin;
              stateChanged = true;
            }
            
            // Sync player words from server - CRITICAL for showing words to players
            if (serverState.playerWords) {
              type PlayerWordData = { word: string; type: 'normal' | 'similar' | 'imposter' };
              Object.entries(serverState.playerWords).forEach(([playerIdStr, wordData]) => {
                const playerId = parseInt(playerIdStr);
                const wordDataTyped = wordData as PlayerWordData;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const player = (game as any).state.players.find((p: { id: number }) => p.id === playerId);
                if (player && wordDataTyped.word && wordDataTyped.type) {
                  // Always update if word is different or missing
                  if (player.currentWord !== wordDataTyped.word || !player.currentWord) {
                    player.currentWord = wordDataTyped.word;
                    player.wordType = wordDataTyped.type;
                    stateChanged = true;
                  }
                }
              });
            }
            
            // Update voting phase
            if (serverState.votingPhase !== undefined && serverState.votingPhase !== currentState.votingPhase) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.votingPhase = serverState.votingPhase;
              stateChanged = true;
            }
            
            // Update currentVotingPlayerIndex from server (for sequential voting)
            if (serverState.currentVotingPlayerIndex !== undefined && serverState.currentVotingPlayerIndex !== (currentState.currentVotingPlayerIndex ?? 0)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.currentVotingPlayerIndex = serverState.currentVotingPlayerIndex;
              stateChanged = true;
            }
            
            if (serverState.votingActivated !== undefined && serverState.votingActivated !== currentState.votingActivated) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.votingActivated = serverState.votingActivated;
              stateChanged = true;
            }
            
            // Sync eliminated player state
            if (serverState.eliminatedPlayer !== undefined) {
              if (serverState.eliminatedPlayer === null || serverState.eliminatedPlayer === undefined) {
                // Clear eliminated player
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                stateChanged = true;
              } else {
                // Set eliminated player
                const eliminated = currentState.players.find(p => p.id === serverState.eliminatedPlayer.id);
                if (eliminated && !eliminated.isEliminated) {
                  eliminated.isEliminated = true;
                  eliminated.votes = serverState.eliminatedPlayer.votes || 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.eliminatedPlayer = eliminated;
                  if (serverState.wrongElimination !== undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (game as any).state.wrongElimination = serverState.wrongElimination;
                  }
                  stateChanged = true;
                }
              }
            }
            
            // Always update component state if anything changed
            if (stateChanged) {
              // Force a fresh state update with deep copy of players array
              const updatedState = game.getState();
              setGameState({ 
                ...updatedState,
                players: updatedState.players.map(p => ({ ...p }))
              });
            }
          }
        }
      } catch (error) {
        console.error('Error polling game state:', error);
      }
    }, 300); // Poll every 300ms for faster updates
    
    return () => clearInterval(pollInterval);
  }, [gameState.isOnline, roomId, game]);

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
    // Force state refresh to show next player
    const newState = game.getState();
    setGameState(newState);
    
    // In local mode, the component will automatically show the next player
    // because it checks for players who haven't voted in the render logic
    if (!newState.isOnline) {
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        const updatedState = game.getState();
        setGameState(updatedState);
      }, 50);
    }
  };

  // Show voting phase if all players have received words - check game state directly
  const currentGameStateForVoting = game.getState();
  // Check if all players have spun (currentPlayerIndex >= players.length means all have spun)
  const allPlayersHaveSpun = currentGameStateForVoting.currentPlayerIndex >= currentGameStateForVoting.players.length;
  // Verify all players actually have words assigned (critical check)
  const allPlayersHaveWordsAssigned = currentGameStateForVoting.players.every(p => p.currentWord !== undefined);
  
  // CRITICAL: Only show voting phase if ALL players have spun AND all have words assigned
  // This ensures the last player has gotten their word before voting starts
  if (allPlayersHaveSpun && allPlayersHaveWordsAssigned) {
    // For online mode, use sequential voting like word-getting process
    // Only show voting UI to the current voting player
    if (gameState.isOnline && viewingPlayerId) {
      const currentGameStateForVotingCheck = game.getState();
      const activePlayers = currentGameStateForVotingCheck.players.filter(p => !p.isEliminated);
      const currentVotingIndex = currentGameStateForVotingCheck.currentVotingPlayerIndex ?? 0;
      
      // Check if there's a current voting player
      if (currentVotingIndex < activePlayers.length) {
        const currentVotingPlayer = activePlayers[currentVotingIndex];
        const viewingPlayer = currentGameStateForVotingCheck.players.find(p => p.id === viewingPlayerId);
        
        // Only show voting UI to the current voting player
        if (viewingPlayer && !viewingPlayer.isEliminated && currentVotingPlayer && viewingPlayer.id === currentVotingPlayer.id) {
          return (
            <VotingPhase
              game={game}
              currentPlayerId={viewingPlayerId}
              onVoteComplete={handleVoteComplete}
              isAdmin={isAdmin}
              roomId={roomId}
              currentPlayerIdString={currentPlayerIdString}
            />
          );
        } else if (viewingPlayer && !viewingPlayer.isEliminated) {
          // Show waiting screen for other players
          return (
            <VotingPhase
              game={game}
              currentPlayerId={viewingPlayerId}
              onVoteComplete={handleVoteComplete}
              isAdmin={isAdmin}
              roomId={roomId}
              currentPlayerIdString={currentPlayerIdString}
            />
          );
        }
      } else {
        // All players have voted, show results to everyone
        const viewingPlayer = currentGameStateForVotingCheck.players.find(p => p.id === viewingPlayerId);
        if (viewingPlayer && !viewingPlayer.isEliminated) {
          return (
            <VotingPhase
              game={game}
              currentPlayerId={viewingPlayerId}
              onVoteComplete={handleVoteComplete}
              isAdmin={isAdmin}
              roomId={roomId}
              currentPlayerIdString={currentPlayerIdString}
            />
          );
        }
      }
    } else {
      // Local mode: sequential voting - show next player who hasn't voted
      const activePlayers = gameState.players.filter(p => !p.isEliminated);
      
      // Check for mixed mode - need both votes
      const isBothMode = gameState.gameMode === 'mixed';
      const nextVoter = activePlayers.find(p => {
        if (isBothMode) {
          return !p.hasVoted || (p.votedForImposter === undefined || p.votedForOtherWord === undefined);
        }
        return !p.hasVoted;
      });
      
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
            roomId={roomId}
            currentPlayerIdString={currentPlayerIdString}
          />
        );
      } else {
        // All players have voted, calculate results
        if (!gameState.eliminatedPlayer) {
          game.calculateVotingResult();
          const updatedState = game.getState();
          setGameState(updatedState);
        }
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
    <div className="max-w-4xl mx-auto relative">
      <ClassifiedStamp level="SECRET" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Status */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>סטטוס המשחק</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              {/* Use game state directly to ensure accurate round display */}
              {(() => {
                const currentGameState = game.getState();
                return (
                  <>
                    <p className="text-2xl font-bold">{currentGameState.currentSpin} / {currentGameState.totalSpins}</p>
                    <p className="text-muted-foreground">סיבובים</p>
                  </>
                );
              })()}
            </div>
            
            {getCurrentPlayer() && (
              <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg flex items-center justify-center gap-3">
                <PlayerAvatar name={getCurrentPlayer()!.name} size="md" isActive={true} />
                <div>
                  <p className="text-sm text-muted-foreground">תור של:</p>
                  <p className="text-lg font-semibold">{getCurrentPlayer()?.name}</p>
                </div>
              </div>
            )}
            
            {(() => {
              // Show status message or spin button
              if (isSpinning) {
                return null; // Spinning animation is shown separately
              }
              
              if (gameState.isOnline) {
                // Check both component state and game state for currentPlayerIndex
                const currentGameState = game.getState();
                const currentPlayerIndex = currentGameState.currentPlayerIndex;
                const canSpin = currentPlayerIndex < currentGameState.players.length;
                
                if (canSpin) {
                  const currentSpinningPlayer = currentGameState.players[currentPlayerIndex];
                  
                  if (!currentSpinningPlayer) {
                    return null;
                  }
                  
                  // Find viewing player - viewingPlayerId is calculated as findIndex(...) + 1
                  // So it should match the player ID (which is also index + 1)
                  let viewingPlayer = null;
                  
                  // Method 1: Try by ID first (viewingPlayerId should match player.id)
                  if (viewingPlayerId !== undefined && viewingPlayerId !== null) {
                    viewingPlayer = currentGameState.players.find(p => p.id === viewingPlayerId);
                  }
                  
                  // Method 2: If not found by ID, try by index (viewingPlayerId = index + 1)
                  if (!viewingPlayer && viewingPlayerId !== undefined && viewingPlayerId > 0) {
                    const possibleIndex = viewingPlayerId - 1;
                    if (possibleIndex >= 0 && possibleIndex < currentGameState.players.length) {
                      viewingPlayer = currentGameState.players[possibleIndex];
                    }
                  }
                  
                  const hasMyWord = viewingPlayer?.currentWord !== undefined;
                  
                  // Check if it's my turn
                  // viewingPlayerId is calculated as findIndex(...) + 1, which matches player.id
                  // So we can check: currentSpinningPlayer.id === viewingPlayerId
                  // OR: currentPlayerIndex === viewingPlayerId - 1
                  let isMyTurn = false;
                  
                  if (viewingPlayerId !== undefined && viewingPlayerId !== null) {
                    // Primary check: ID match (most reliable)
                    if (currentSpinningPlayer.id === viewingPlayerId) {
                      isMyTurn = true;
                    }
                    // Fallback: Index match (if IDs don't match for some reason)
                    else if (currentPlayerIndex === viewingPlayerId - 1) {
                      isMyTurn = true;
                    }
                    // Additional fallback: Name match (if we found viewingPlayer)
                    else if (viewingPlayer && currentSpinningPlayer.name === viewingPlayer.name) {
                      isMyTurn = true;
                    }
                  }
                  
                  // CRITICAL: If viewingPlayer exists but wasn't matched, and it's their index turn, allow it
                  // This handles edge cases where ID matching fails but it's clearly their turn
                  if (!isMyTurn && viewingPlayer && currentPlayerIndex < currentGameState.players.length) {
                    const viewingPlayerIndex = currentGameState.players.findIndex(p => p.id === viewingPlayer.id);
                    if (viewingPlayerIndex === currentPlayerIndex) {
                      isMyTurn = true;
                    }
                  }
                  
                  // Additional fallback: If we still can't determine and viewingPlayer exists,
                  // check if the currentSpinningPlayer's name matches viewingPlayer's name
                  if (!isMyTurn && viewingPlayer && currentSpinningPlayer && currentSpinningPlayer.name === viewingPlayer.name) {
                    isMyTurn = true;
                  }
                
                // If player already has their word, show status message
                if (hasMyWord && !isMyTurn) {
                  return (
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">קיבלת את המילה שלך</p>
                      {currentSpinningPlayer && (
                        <p className="text-sm mt-2">תור של: {currentSpinningPlayer.name}</p>
                      )}
                    </div>
                  );
                }
                
                // If it's not my turn and I don't have my word yet
                if (!isMyTurn && !hasMyWord) {
                  return (
                    <div className="text-center text-muted-foreground">
                      <p>ממתין לתורך...</p>
                      {currentSpinningPlayer && (
                        <p className="text-sm mt-2">תור של: {currentSpinningPlayer.name}</p>
                      )}
                    </div>
                  );
                }
                
                // If it's my turn and I don't have my word yet, show spin button
                if (isMyTurn && !hasMyWord && !showResult) {
                  return (
                    <Button 
                      onClick={handleSpin} 
                      className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold" 
                      size="lg"
                    >
                      🎯 סובב!
                    </Button>
                  );
                }
                }
              } else if (!gameState.isOnline && !showResult && !gameState.selectedWord && gameState.currentPlayerIndex < gameState.players.length) {
                // Local mode: show spin button
                return (
                  <Button 
                    onClick={handleSpin} 
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold" 
                    size="lg"
                  >
                    🎯 סובב!
                  </Button>
                );
              }
              
              return null;
            })()}
            
            {isSpinning && (
              <div className="text-center space-y-4">
                <AgentSpinner size="md" message="מאמת מילה..." />
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${spinProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {spinProgress}%
                </p>
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
                
                // If player already has their word, show it regardless of whose turn it is
                if (hasMyWord && viewingPlayer?.currentWord) {
                  return (
                    <motion.div 
                      key="my-word"
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.8 }}
                      transition={{ duration: 0.6, type: "spring" }}
                      className="text-center"
                    >
                      <div className="p-8 bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-orange-900/20 rounded-xl text-center text-3xl font-bold border-2 border-purple-300 dark:border-purple-700 hover:shadow-lg transition-all">
                        {viewingPlayer.currentWord}
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          המילה שלך
                        </p>
                      </div>
                    </motion.div>
                  );
                }
                
                if (gameState.isOnline && currentSpinningPlayerIndex < gameState.players.length) {
                  // Online mode: show whose turn it is
                  if (!isMyTurn && currentSpinningPlayer) {
                    return (
                      <motion.div 
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-8"
                      >
                        <div className="space-y-4">
                          <AgentSpinner size="md" message="ממתין לתורך..." />
                          <div>
                            <p className="text-lg font-semibold text-muted-foreground">ממתין לתורך...</p>
                            <p className="text-sm mt-2 text-muted-foreground">
                              תור של: <span className="font-bold">{currentSpinningPlayer.name}</span>
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }
                }
                
                // Show word if: local mode OR it's my turn
                if (gameState.selectedWord && (!gameState.isOnline || isMyTurn)) {
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
                      <div className="p-8 bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-orange-900/20 rounded-xl text-center text-3xl font-bold border-2 border-purple-300 dark:border-purple-700 hover:shadow-lg transition-all">
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
                
                // Default placeholder
                return (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-muted-foreground py-8"
                  >
                    {isSpinning ? (
                      <div className="relative">
                        <AgentSpinner size="lg" message="מאמת מילה..." />
                        <AgentScanLine />
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <p className="text-lg mb-2">לחץ על &quot;סובב&quot; כדי לקבל את המילה שלך</p>
                        <p className="text-xs font-mono uppercase tracking-wider opacity-70">CLASSIFIED INFORMATION</p>
                      </div>
                    )}
                  </motion.div>
                );
              })()}
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
            <Button 
              onClick={handleNextSpin} 
              className="w-full max-w-md bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg text-white font-semibold" 
              size="lg"
            >
              סיבוב הבא
            </Button>
          ) : gameState.currentPlayerIndex >= gameState.players.length ? (
            // All players have spun - this is the last player viewing their word
            <div className="space-y-2">
              <p className="text-lg font-semibold">כל השחקנים קיבלו את המילים שלהם!</p>
              <Button 
                onClick={handleNextSpin} 
                className="w-full max-w-md bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold" 
                size="lg"
              >
                🗳️ התחל הצבעה
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
