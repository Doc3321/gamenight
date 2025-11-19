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
import { subscribeToRoom } from '@/lib/realtime/broadcast';
import { usePlayerProfiles } from '@/lib/hooks/usePlayerProfiles';

interface GameBoardProps {
  game: WordGame;
  onReset: () => void;
  isAdmin?: boolean; // For online mode
  currentPlayerId?: number; // For online mode - the game player ID of current viewer
  roomId?: string; // For online mode - room ID for real-time sync
  currentPlayerIdString?: string; // For online mode - the string player ID
  room?: { players: Array<{ id: string; name: string }> }; // For online mode - room data to map players to user IDs
}

export default function GameBoard({ game, onReset, isAdmin = false, currentPlayerId: viewingPlayerId, roomId, currentPlayerIdString, room }: GameBoardProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameState, setGameState] = useState(game.getState());
  
  // Map game players to user IDs for profile fetching (online mode only)
  const playerNameToUserId = room ? new Map<string, string>() : null;
  if (room && playerNameToUserId) {
    room.players.forEach(rp => {
      playerNameToUserId.set(rp.name, rp.id);
    });
  }
  const userIds = room && playerNameToUserId 
    ? gameState.players.map(p => playerNameToUserId.get(p.name) || '').filter(Boolean)
    : [];
  const playerProfiles = usePlayerProfiles(userIds);
  
  // Helper to get profile photo for a game player
  const getPlayerProfilePhoto = (playerName: string): string | null => {
    if (!room || !playerNameToUserId) return null;
    const userId = playerNameToUserId.get(playerName);
    return userId ? (playerProfiles[userId]?.profilePhotoUrl || null) : null;
  };
  const [showResult, setShowResult] = useState(false);
  const [isFirstSpin, setIsFirstSpin] = useState(true);
  const [currentVotingPlayerIndex, setCurrentVotingPlayerIndex] = useState(0);
  const [spinProgress, setSpinProgress] = useState(0);
  const [isSpinningLock, setIsSpinningLock] = useState(false); // Prevent race conditions

  const handleSpin = async () => {
    // Prevent multiple simultaneous spins (race condition fix)
    if (isSpinningLock || isSpinning) {
      console.warn('[GameBoard] Spin already in progress, ignoring duplicate call');
      return;
    }
    
    // Validate it's actually the player's turn (online mode)
    const currentState = game.getState();
    if (currentState.isOnline && viewingPlayerId !== undefined) {
      const expectedIndex = viewingPlayerId - 1;
      if (currentState.currentPlayerIndex !== expectedIndex) {
        console.warn('[GameBoard] Not player\'s turn, ignoring spin', {
          currentIndex: currentState.currentPlayerIndex,
          expectedIndex,
          viewingPlayerId
        });
        return;
      }
    }
    
    setIsSpinningLock(true);
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
      try {
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
              const response = await fetch('/api/rooms/game-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId,
                  gameStateData: {
                    currentPlayerIndex: freshState.currentPlayerIndex,
                    currentSpin: freshState.currentSpin,
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
              
              if (!response.ok) {
                console.error('[GameBoard] Server rejected spin sync:', response.status);
                // Rollback local state if server rejects
                const serverState = await fetch(`/api/rooms/game-state?roomId=${roomId}`).then(r => r.json());
                if (serverState.room?.gameStateData) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.currentPlayerIndex = serverState.room.gameStateData.currentPlayerIndex;
                  setGameState(game.getState());
                }
              }
            } catch (error) {
              console.error('Error syncing game state:', error);
            }
          }
        }
      } finally {
        setIsSpinningLock(false);
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
      // All players have spun - start voting phase (only if not already started)
      if (!newState.votingPhase) {
        game.startVotingPhase();
      }
      const updatedState = game.getState();
      setGameState(updatedState);
      
      // Sync to server (use newState, not stale gameState)
      if (newState.isOnline && roomId) {
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
      
      // Sync to server (use newState, not stale gameState)
      if (newState.isOnline && roomId) {
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

  // Real-time sync for online games - broadcasts primary, polling fallback
  useEffect(() => {
    if (!gameState.isOnline || !roomId) return;
    
    let unsubscribe: (() => void) | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    
    const syncGameState = async () => {
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
                  // Only update if word is missing (don't overwrite existing words during active gameplay)
                  // Server is source of truth, but we preserve words that are already assigned to avoid mid-spin overwrites
                  if (!player.currentWord) {
                    // Word is missing, update from server
                    player.currentWord = wordDataTyped.word;
                    player.wordType = wordDataTyped.type;
                    stateChanged = true;
                    console.log('[GameBoard] Updated missing player word:', { playerId, word: wordDataTyped.word });
                  } else if (player.currentWord !== wordDataTyped.word) {
                    // Word exists but differs from server - only update if player has already received their word
                    // (i.e., their index is less than currentPlayerIndex, meaning they've already spun)
                    const playerIndex = currentState.players.findIndex(p => p.id === playerId);
                    if (playerIndex < currentState.currentPlayerIndex) {
                      // Player has already spun, server word takes precedence
                      player.currentWord = wordDataTyped.word;
                      player.wordType = wordDataTyped.type;
                      stateChanged = true;
                      console.log('[GameBoard] Synced player word from server (overwrite):', { playerId, old: player.currentWord, new: wordDataTyped.word });
                    }
                  }
                } else if (!player) {
                  console.warn('[GameBoard] Player not found for word sync:', playerId);
                }
              });
            } else {
              console.log('[GameBoard] No playerWords in server state');
            }
            
            // Force state update if player words changed to ensure UI reflects the change
            if (stateChanged) {
              const updatedState = game.getState();
              setGameState({ 
                ...updatedState,
                players: updatedState.players.map(p => ({ ...p }))
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
            
            // Sync eliminated player state - CRITICAL for showing correct screen
            if (serverState.eliminatedPlayer !== undefined) {
              if (serverState.eliminatedPlayer === null || serverState.eliminatedPlayer === undefined) {
                // Clear eliminated player
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                stateChanged = true;
              } else {
                // Set eliminated player - ALWAYS sync, even if already set
                // IMPORTANT: Sync to ALL players, including the eliminated player themselves
                const eliminated = currentState.players.find(p => p.id === serverState.eliminatedPlayer.id);
                if (eliminated) {
                  // Always update eliminated state, even if already eliminated
                  eliminated.isEliminated = true;
                  eliminated.votes = serverState.eliminatedPlayer.votes || 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.eliminatedPlayer = eliminated;
                  // CRITICAL: Ensure votingPhase is true when there's an eliminated player
                  // This prevents GameBoard from showing the spin wheel screen
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingPhase = true;
                  if (serverState.wrongElimination !== undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (game as any).state.wrongElimination = serverState.wrongElimination;
                  }
                  stateChanged = true;
                  console.log('[GameBoard] Synced eliminated player from server:', eliminated.name, 'votes:', eliminated.votes, 'viewingPlayerId:', viewingPlayerId);
                }
              }
            }
            
            // Also sync isTie to ensure we don't show elimination if it's actually a tie
            if (serverState.isTie !== undefined) {
              // If server says it's a tie, clear eliminated player
              if (serverState.isTie === true) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                stateChanged = true;
                console.log('[GameBoard] Server says its a tie, clearing eliminated player');
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
        console.error('Error syncing game state:', error);
      }
    };
    
    // Subscribe to broadcasts for instant updates (PRIMARY mechanism)
    try {
      unsubscribe = subscribeToRoom(roomId, (event) => {
        if (event.type === 'game-state-updated' || event.type === 'vote-cast' || event.type === 'room-updated') {
          // Immediately sync when broadcast received - INSTANT updates!
          syncGameState();
        }
      });
    } catch (error) {
      console.warn('[GameBoard] Broadcast subscription failed, using polling only:', error);
    }
    
    // Poll as fallback only (every 1 second - much less frequent since broadcasts are primary)
    pollInterval = setInterval(syncGameState, 1000);
    
    // Run immediately to get initial state
    syncGameState();
    
    return () => {
      if (unsubscribe) unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [gameState.isOnline, roomId, game, viewingPlayerId]);

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
  
  // Debug logging to help identify the issue
  if (gameState.isOnline) {
    console.log('[GameBoard] Voting phase check:', {
      currentPlayerIndex: currentGameStateForVoting.currentPlayerIndex,
      playersLength: currentGameStateForVoting.players.length,
      allPlayersHaveSpun,
      allPlayersHaveWordsAssigned,
      stillSpinning: currentGameStateForVoting.currentPlayerIndex < currentGameStateForVoting.players.length,
      playerWords: currentGameStateForVoting.players.map(p => ({ id: p.id, name: p.name, hasWord: !!p.currentWord, word: p.currentWord }))
    });
  }
  
  // CRITICAL: Only show voting phase if ALL players have spun AND all have words assigned
  // This ensures the last player has gotten their word before voting starts
  // CRITICAL: Check for eliminated player FIRST - if there's an eliminated player, show results screen
  // This prevents showing "Start Voting" screen when results are already available
  // IMPORTANT: Show results to ALL players, including the eliminated player
  if (currentGameStateForVoting.eliminatedPlayer && gameState.isOnline && viewingPlayerId !== undefined) {
    const viewingPlayer = currentGameStateForVoting.players.find(p => p.id === viewingPlayerId);
    // Show results to all players, including the eliminated player
    if (viewingPlayer) {
      return (
        <VotingPhase
          game={game}
          currentPlayerId={viewingPlayerId}
          onVoteComplete={handleVoteComplete}
          isAdmin={isAdmin}
          roomId={roomId}
          currentPlayerIdString={currentPlayerIdString}
          onReset={onReset}
        />
      );
    }
  }
  
  // Also check that we're not still in the spinning phase (currentPlayerIndex < players.length means someone still needs to spin)
  const stillSpinning = currentGameStateForVoting.currentPlayerIndex < currentGameStateForVoting.players.length;
  if (!stillSpinning && allPlayersHaveSpun && allPlayersHaveWordsAssigned) {
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
              onReset={onReset}
              room={room}
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
              onReset={onReset}
              room={room}
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
              onReset={onReset}
              room={room}
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
            onReset={onReset}
            room={room}
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
    
    // In online mode, let VotingPhase handle the elimination screen
    // In local mode, show elimination screen here
    if (gameState.eliminatedPlayer && !gameState.isOnline) {
      // All voted and eliminated player is set, show results (local mode only)
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
    
    // In online mode, if there's an eliminated player, show VotingPhase which will handle the elimination screen
    // IMPORTANT: Show results to ALL players, including the eliminated player
    if (gameState.eliminatedPlayer && gameState.isOnline && viewingPlayerId !== undefined) {
      const viewingPlayer = currentGameStateForVoting.players.find(p => p.id === viewingPlayerId);
      // Show results to all players, including the eliminated player
      if (viewingPlayer) {
        return (
          <VotingPhase
            game={game}
            currentPlayerId={viewingPlayerId}
            onVoteComplete={handleVoteComplete}
            isAdmin={isAdmin}
            roomId={roomId}
            currentPlayerIdString={currentPlayerIdString}
            onReset={onReset}
          />
        );
      }
    }
  }

  // Only show game completed screen if game is actually completed AND not in voting phase
  if (gameState.gameCompleted && !gameState.votingPhase) {
    const eliminatedPlayer = gameState.eliminatedPlayer;
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">המשחק הסתיים!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-lg">סיימת את כל הסיבובים</p>
            {eliminatedPlayer && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-red-600 font-semibold">
                  השחקן שהודח: {eliminatedPlayer.name}
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
                <PlayerAvatar 
                  name={getCurrentPlayer()!.name} 
                  size="md" 
                  isActive={true}
                  profilePhotoUrl={getPlayerProfilePhoto(getCurrentPlayer()!.name)}
                />
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
                // Allow spinning if currentPlayerIndex is less than players.length
                // This includes the last player (when index is players.length - 1)
                const canSpin = currentPlayerIndex < currentGameState.players.length;
                
                console.log('[GameBoard] Spin button check:', {
                  currentPlayerIndex,
                  playersLength: currentGameState.players.length,
                  canSpin,
                  viewingPlayerId,
                  isLastPlayer: currentPlayerIndex === currentGameState.players.length - 1
                });
                
                if (canSpin) {
                  const currentSpinningPlayer = currentGameState.players[currentPlayerIndex];
                  
                  if (!currentSpinningPlayer) {
                    console.log('[GameBoard] No current spinning player at index:', currentPlayerIndex);
                    return null;
                  }
                  
                  // Find viewing player - viewingPlayerId is calculated as findIndex(...) + 1
                  // So it should match the player ID (which is also index + 1)
                  let viewingPlayer = null;
                  
                  // Method 1: Try by ID first (viewingPlayerId should match player.id)
                  if (viewingPlayerId !== undefined && viewingPlayerId !== null && viewingPlayerId > 0) {
                    viewingPlayer = currentGameState.players.find(p => p.id === viewingPlayerId);
                  }
                  
                  // Method 2: If not found by ID, try by index (viewingPlayerId = index + 1)
                  if (!viewingPlayer && viewingPlayerId !== undefined && viewingPlayerId > 0) {
                    const possibleIndex = viewingPlayerId - 1;
                    if (possibleIndex >= 0 && possibleIndex < currentGameState.players.length) {
                      viewingPlayer = currentGameState.players[possibleIndex];
                    }
                  }
                  
                  // Method 3: If still not found, try to find by currentPlayerIdString (room player ID)
                  // This matches the room player ID with the game player
                  if (!viewingPlayer && currentPlayerIdString && roomId) {
                    // We need to find the player by matching with room data
                    // Since we don't have direct access to room here, we'll try to infer
                    // by checking if any player's name matches what we expect
                    // This is a fallback that might not always work, but it's better than nothing
                  }
                  
                  const hasMyWord = viewingPlayer?.currentWord !== undefined;
                  
                  // Check if it's my turn - use multiple independent strategies
                  // viewingPlayerId is calculated as findIndex(...) + 1, which matches player.id
                  let isMyTurn = false;
                  
                  // PRIMARY: Direct index comparison using viewingPlayerId (MOST RELIABLE - works for all players)
                  // This should be the primary check since viewingPlayerId = index + 1
                  if (viewingPlayerId !== undefined && viewingPlayerId !== null && viewingPlayerId > 0) {
                    const expectedIndex = viewingPlayerId - 1;
                    // Check if expectedIndex matches currentPlayerIndex and is valid
                    // For last player: expectedIndex = players.length - 1, which should equal currentPlayerIndex
                    if (expectedIndex === currentPlayerIndex && 
                        expectedIndex >= 0 && 
                        expectedIndex < currentGameState.players.length) {
                      isMyTurn = true;
                    }
                  }
                  
                  // Strategy A: If viewingPlayer found, check by index directly (fallback)
                  if (!isMyTurn && viewingPlayer) {
                    const viewingPlayerIndex = currentGameState.players.findIndex(p => p.id === viewingPlayer.id);
                    if (viewingPlayerIndex === currentPlayerIndex && viewingPlayerIndex >= 0) {
                      isMyTurn = true;
                    }
                  }
                  
                  // Strategy 1: Direct ID match (fallback)
                  if (!isMyTurn && viewingPlayerId !== undefined && viewingPlayerId !== null && currentSpinningPlayer.id === viewingPlayerId) {
                    isMyTurn = true;
                  }
                  
                  // Strategy 2: Name match with currentSpinningPlayer (fallback)
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
                // CRITICAL: Also check if viewingPlayer exists and their index matches currentPlayerIndex
                // This ensures the last player can always get their word
                let viewingPlayerIndex = -1;
                if (viewingPlayer) {
                  viewingPlayerIndex = currentGameState.players.findIndex(p => p.id === viewingPlayer.id);
                } else if (viewingPlayerId !== undefined && viewingPlayerId !== null && viewingPlayerId > 0) {
                  // If viewingPlayer not found, try to calculate index from viewingPlayerId
                  viewingPlayerIndex = viewingPlayerId - 1;
                }
                
                // For last player, allow index match even if viewingPlayerIndex equals players.length - 1
                const isMyTurnByIndex = viewingPlayerIndex === currentPlayerIndex && 
                                       viewingPlayerIndex >= 0 && 
                                       viewingPlayerIndex < currentGameState.players.length;
                
                // Additional check: if viewingPlayerId matches currentSpinningPlayer.id, it's definitely their turn
                const isMyTurnById = viewingPlayerId !== undefined && viewingPlayerId !== null && 
                                     currentSpinningPlayer && currentSpinningPlayer.id === viewingPlayerId;
                
                // Last resort: if it's the last player's turn and viewingPlayerId matches the last player's ID
                const isLastPlayerTurn = viewingPlayerId !== undefined && viewingPlayerId !== null &&
                                        currentPlayerIndex === currentGameState.players.length - 1 &&
                                        viewingPlayerId === currentGameState.players.length &&
                                        !hasMyWord;
                
                // Also check: if currentPlayerIndex is the last player's index, and viewingPlayer is the last player
                const isLastPlayerByIndex = currentPlayerIndex === currentGameState.players.length - 1 &&
                                           viewingPlayerIndex === currentGameState.players.length - 1 &&
                                           !hasMyWord;
                
                // CRITICAL: If it's the last player's turn (currentPlayerIndex === players.length - 1)
                // and the viewing player is the last player, allow them to spin
                const isLastPlayerTurnSimple = currentPlayerIndex === currentGameState.players.length - 1 &&
                                              viewingPlayer &&
                                              viewingPlayerIndex === currentGameState.players.length - 1 &&
                                              !hasMyWord;
                
                // Fallback: If currentPlayerIndex is last player's index and viewingPlayerId suggests it's the last player
                const isLastPlayerFallback = currentPlayerIndex === currentGameState.players.length - 1 &&
                                            (viewingPlayerId === currentGameState.players.length || 
                                             (viewingPlayerId !== undefined && viewingPlayerId > 0 && viewingPlayerId - 1 === currentGameState.players.length - 1)) &&
                                            !hasMyWord;
                
                console.log('[GameBoard] Turn check results:', {
                  isMyTurn,
                  isMyTurnByIndex,
                  isMyTurnById,
                  isLastPlayerTurn,
                  isLastPlayerByIndex,
                  hasMyWord,
                  showResult,
                  currentPlayerIndex,
                  viewingPlayerIndex,
                  viewingPlayerId,
                  currentSpinningPlayerId: currentSpinningPlayer?.id
                });
                
                if ((isMyTurn || isMyTurnByIndex || isMyTurnById || isLastPlayerTurn || isLastPlayerByIndex || isLastPlayerTurnSimple || isLastPlayerFallback) && !hasMyWord && !showResult) {
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
