'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WordGame, Player } from '@/lib/gameLogic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmotePicker, { EmoteType } from './EmotePicker';
import Confetti from './Confetti';
import PlayerAvatar from './PlayerAvatar';
import ClassifiedStamp from './ClassifiedStamp';
import AgentBadge from './AgentBadge';
import AgentSpinner from './AgentSpinner';
import AgentScanLine from './AgentScanLine';
import { subscribeToRoom } from '@/lib/realtime/broadcast';
import { usePlayerProfiles } from '@/lib/hooks/usePlayerProfiles';

interface VotingPhaseProps {
  game: WordGame;
  currentPlayerId: number; // The player who is currently voting
  onVoteComplete: () => void;
  isAdmin?: boolean; // Whether current player is admin (for online mode)
  roomId?: string; // For online mode - room ID for real-time sync
  currentPlayerIdString?: string; // For online mode - the string player ID
  onReset?: () => void; // Optional reset callback for going back to menu
  room?: { players: Array<{ id: string; name: string }> }; // For online mode - room data to map players to user IDs
}

export default function VotingPhase({ game, currentPlayerId, onVoteComplete, isAdmin = false, roomId, currentPlayerIdString, onReset, room }: VotingPhaseProps) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedImposterTarget, setSelectedImposterTarget] = useState<number | null>(null);
  const [selectedOtherWordTarget, setSelectedOtherWordTarget] = useState<number | null>(null);
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
  const [showResults, setShowResults] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<Player | null>(null);
  const [tiedPlayers, setTiedPlayers] = useState<Player[]>([]);
  const [showTieResults, setShowTieResults] = useState(false);
  const [showWrongElimination, setShowWrongElimination] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<Array<{ id: number; emote: EmoteType; playerName: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isVotingLock, setIsVotingLock] = useState(false); // Prevent race conditions

  const handleVote = async (voteType?: 'imposter' | 'other-word', skip: boolean = false) => {
    // Prevent multiple simultaneous votes (race condition fix)
    if (isVotingLock) {
      console.warn('[VotingPhase] Vote already in progress, ignoring duplicate call');
      return;
    }
    
    // Skip vote - no target needed
    if (skip) {
      setIsVotingLock(true);
      try {
        const success = game.skipVote(currentPlayerId, voteType);
        if (!success) {
          console.warn('[VotingPhase] Skip vote was rejected by game logic');
          return;
        }
        
        const newState = game.getState();
        setGameState(newState);
        
        // Sync skip vote to server
        if (roomId && gameState.isOnline) {
          try {
            await fetch('/api/rooms/game-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                gameStateData: {
                  currentPlayerIndex: newState.currentPlayerIndex,
                  votingPhase: newState.votingPhase,
                  votingActivated: newState.votingActivated,
                  currentVotingPlayerIndex: newState.currentVotingPlayerIndex,
                  votes: newState.players.reduce((acc, p) => {
                    if (p.votedFor !== undefined || p.votedFor === null) {
                      acc[`${p.id}_normal`] = { voterId: p.id, targetId: p.votedFor || -1, voteType: undefined };
                    }
                    if (p.votedForImposter !== undefined || p.votedForImposter === null) {
                      acc[`${p.id}_imposter`] = { voterId: p.id, targetId: p.votedForImposter || -1, voteType: 'imposter' as const };
                    }
                    if (p.votedForOtherWord !== undefined || p.votedForOtherWord === null) {
                      acc[`${p.id}_other`] = { voterId: p.id, targetId: p.votedForOtherWord || -1, voteType: 'other-word' as const };
                    }
                    return acc;
                  }, {} as Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }>),
                  playerWords: newState.players.reduce((acc, p) => {
                    if (p.currentWord) {
                      acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                    }
                    return acc;
                  }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
                }
              })
            });
          } catch (error) {
            console.error('Error syncing skip vote:', error);
          }
        }
      } finally {
        setIsVotingLock(false);
      }
      return;
    }
    
    const target = voteType 
      ? (voteType === 'imposter' ? selectedImposterTarget : selectedOtherWordTarget)
      : selectedTarget;
    
    if (!target) {
      console.log('No target selected for vote');
      return;
    }
    
    // Prevent voting if not activated (for online mode) - check both states
    if (gameState.isOnline) {
      const currentState = game.getState();
      const isActivated = currentState.votingActivated === true || gameState.votingActivated === true;
      if (!isActivated) {
        console.log('Voting not activated yet');
        return;
      }
      
      // Validate it's actually the player's turn to vote (sequential voting)
      const activePlayers = currentState.players.filter(p => !p.isEliminated);
      const currentVotingIdx = currentState.currentVotingPlayerIndex ?? 0;
      if (currentVotingIdx < activePlayers.length) {
        const currentVotingPlayer = activePlayers[currentVotingIdx];
        if (currentVotingPlayer.id !== currentPlayerId) {
          console.warn('[VotingPhase] Not player\'s turn to vote', {
            currentVotingPlayerId: currentVotingPlayer.id,
            currentPlayerId,
            currentVotingIdx
          });
          return;
        }
      }
    }
    
    // Check if player is eliminated (shouldn't happen, but double-check)
    const currentStateBeforeVote = game.getState();
    const currentPlayerBeforeVote = currentStateBeforeVote.players.find(p => p.id === currentPlayerId);
    if (!currentPlayerBeforeVote || currentPlayerBeforeVote.isEliminated) {
      console.warn('[VotingPhase] Player is eliminated, cannot vote');
      return;
    }
    
    // Prevent duplicate votes - check if player has already voted for this type
    // Note: null means skipped, undefined means not voted yet
    if (currentPlayerBeforeVote) {
      if (voteType === 'imposter' && (currentPlayerBeforeVote.votedForImposter !== undefined || currentPlayerBeforeVote.votedForImposter === null)) {
        return; // Already voted or skipped for imposter
      }
      if (voteType === 'other-word' && (currentPlayerBeforeVote.votedForOtherWord !== undefined || currentPlayerBeforeVote.votedForOtherWord === null)) {
        return; // Already voted or skipped for other word
      }
      if (!voteType && currentPlayerBeforeVote.hasVoted) {
        return; // Already voted
      }
    }
    
    setIsVotingLock(true);
    try {
      const success = game.castVote(currentPlayerId, target, voteType);
      if (!success) {
        console.warn('[VotingPhase] Vote was rejected by game logic');
        return;
      }
      
      const newState = game.getState();
      // Ensure votingActivated stays true after voting
      if (newState.isOnline && !newState.votingActivated) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (game as any).state.votingActivated = true;
        const updatedState = game.getState();
        setGameState(updatedState);
      } else {
        setGameState(newState);
      }
      
      // Sync vote to server for online games
      if (roomId && gameState.isOnline) {
        try {
          // Get current votes from all players
          const votes: Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }> = {};
          newState.players.forEach(player => {
            if (player.hasVoted || player.votedForImposter !== undefined || player.votedForOtherWord !== undefined) {
              if (newState.gameMode === 'mixed') {
                // Only sync actual votes, not skipped (null) votes
                if (player.votedForImposter !== undefined && player.votedForImposter !== null) {
                  votes[`${player.id}_imposter`] = { voterId: player.id, targetId: player.votedForImposter, voteType: 'imposter' };
                }
                if (player.votedForOtherWord !== undefined && player.votedForOtherWord !== null) {
                  votes[`${player.id}_other`] = { voterId: player.id, targetId: player.votedForOtherWord, voteType: 'other-word' };
                }
              } else if (player.votedFor !== undefined && player.votedFor !== null) {
                // Only sync actual votes, not skipped (null) votes
                votes[player.id.toString()] = { voterId: player.id, targetId: player.votedFor };
              }
            }
          });
          
          // Ensure votingActivated stays true when syncing votes
          const currentStateForVote = game.getState();
          const votingActivatedValue = currentStateForVote.votingActivated === true || newState.votingActivated === true;
          
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: newState.votingPhase,
                votingActivated: votingActivatedValue, // Ensure it stays true
                votes,
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
        } catch (error) {
          console.error('Error syncing vote:', error);
        }
      }
      
      // Check if voting is complete for this player (both votes in mixed mode)
      const currentPlayer = newState.players.find(p => p.id === currentPlayerId);
      const isBothMode = newState.gameMode === 'mixed';
      const isComplete = isBothMode 
        ? ((currentPlayer?.votedForImposter !== undefined || currentPlayer?.votedForImposter === null) && 
           (currentPlayer?.votedForOtherWord !== undefined || currentPlayer?.votedForOtherWord === null))
        : currentPlayer?.hasVoted;
      
      // For online mode: increment currentVotingPlayerIndex after player completes voting
      // Only increment once per player - check if this player is the current voting player
      if (newState.isOnline && isComplete) {
        const activePlayersList = newState.players.filter(p => !p.isEliminated);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentVotingIdx = (game as any).state.currentVotingPlayerIndex ?? 0;
        
        // Verify that the current player is actually the one whose turn it is to vote
        const currentVotingPlayer = activePlayersList[currentVotingIdx];
        if (currentVotingPlayer && currentVotingPlayer.id === currentPlayerId) {
          // Move to next player if not all have voted
          if (currentVotingIdx < activePlayersList.length - 1) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (game as any).state.currentVotingPlayerIndex = currentVotingIdx + 1;
            
            // Sync updated currentVotingPlayerIndex to server
            try {
              const updatedState = game.getState();
              // Get votingActivated value from updated state
              const votingActivatedValue = updatedState.votingActivated === true || newState.votingActivated === true;
              
              // Recalculate votes from updated state
              const votesForSync: Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }> = {};
              updatedState.players.forEach(player => {
                if (player.hasVoted || player.votedForImposter !== undefined || player.votedForOtherWord !== undefined) {
                  if (updatedState.gameMode === 'mixed') {
                    // Only sync actual votes, not skipped (null) votes
                    if (player.votedForImposter !== undefined && player.votedForImposter !== null) {
                      votesForSync[`${player.id}_imposter`] = { voterId: player.id, targetId: player.votedForImposter, voteType: 'imposter' };
                    }
                    if (player.votedForOtherWord !== undefined && player.votedForOtherWord !== null) {
                      votesForSync[`${player.id}_other`] = { voterId: player.id, targetId: player.votedForOtherWord, voteType: 'other-word' };
                    }
                  } else if (player.votedFor !== undefined && player.votedFor !== null) {
                    // Only sync actual votes, not skipped (null) votes
                    votesForSync[player.id.toString()] = { voterId: player.id, targetId: player.votedFor };
                  }
                }
              });
              
              console.log('[VotingPhase] Moving to next player, syncing to server:', {
                currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex,
                votingActivated: votingActivatedValue,
                activePlayersCount: activePlayersList.length
              });
              
              // Force immediate state update before syncing
              setGameState({
                ...updatedState,
                players: updatedState.players.map(p => ({ ...p })),
                currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex
              });
              
              await fetch('/api/rooms/game-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId,
                  gameStateData: {
                    currentPlayerIndex: updatedState.currentPlayerIndex,
                    currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex, // This should be incremented
                    votingPhase: true, // Keep voting phase true
                    votingActivated: true, // CRITICAL: Keep votingActivated true
                    votes: votesForSync,
                    playerWords: updatedState.players.reduce((acc, p) => {
                      if (p.currentWord) {
                        acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                      }
                      return acc;
                    }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
                  }
                })
              });
              
              console.log('[VotingPhase] Turn progression synced to server, next player index:', updatedState.currentVotingPlayerIndex);
              
              // Force state update after syncing to ensure UI reflects the change
              const finalState = game.getState();
              setGameState({
                ...finalState,
                players: finalState.players.map(p => ({ ...p })),
                votingActivated: true, // Explicitly ensure it stays true
                votingPhase: true
              });
            } catch (error) {
              console.error('Error syncing voting index:', error);
            }
          } else {
            // All players have voted - calculate results
            setTimeout(() => {
              if (game.allPlayersVoted() && !showResults && !showTieResults && !showWrongElimination) {
                handleCalculateResults();
              }
            }, 600);
          }
        }
      }
      
      if (isComplete && !newState.isOnline) {
        // In local mode, immediately trigger vote complete to show next player
        setTimeout(() => {
          onVoteComplete();
        }, 300);
      }
      
      if (voteType === 'imposter') {
        setSelectedImposterTarget(null);
      } else if (voteType === 'other-word') {
        setSelectedOtherWordTarget(null);
      } else {
        setSelectedTarget(null);
      }
    } finally {
      setIsVotingLock(false);
    }
  };

  const handleEmote = async (emote: EmoteType) => {
    const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
    if (currentPlayer) {
      const emoteId = Date.now();
      setActiveEmotes(prev => [...prev, { id: emoteId, emote, playerName: currentPlayer.name }]);
      
      // Send emote to server for real-time sync (online mode)
      if (roomId && currentPlayerIdString && gameState.isOnline) {
        try {
          await fetch('/api/rooms/emote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              playerId: currentPlayerIdString,
              emote
            })
          });
        } catch (error) {
          console.error('Error sending emote:', error);
        }
      }
      
      // Remove emote after animation
      setTimeout(() => {
        setActiveEmotes(prev => prev.filter(e => e.id !== emoteId));
      }, 2000);
    }
  };

  const handleCalculateResults = useCallback(async () => {
    // Prevent multiple calls - if results are already showing, don't calculate again
    if (showResults || showTieResults || showWrongElimination) {
      return;
    }
    
    // CRITICAL: Recalculate vote counts from scratch before calculating results
    const stateBeforeCalc = game.getState();
    console.log('[VotingPhase] Recalculating votes before calculateVotingResult');
    
    // Reset all vote counts
    stateBeforeCalc.players.forEach(p => {
      p.votes = 0;
    });
    
    // Recalculate votes from player voting data (ignore skipped votes - null values)
    stateBeforeCalc.players.forEach(voter => {
      if (!voter.isEliminated) {
        if (stateBeforeCalc.gameMode === 'mixed') {
          // Only count actual votes, not skipped (null) votes
          if (voter.votedForImposter !== undefined && voter.votedForImposter !== null) {
            const target = stateBeforeCalc.players.find(p => p.id === voter.votedForImposter);
            if (target && !target.isEliminated) {
              if (target.votes === undefined) target.votes = 0;
              target.votes++;
            }
          }
          if (voter.votedForOtherWord !== undefined && voter.votedForOtherWord !== null) {
            const target = stateBeforeCalc.players.find(p => p.id === voter.votedForOtherWord);
            if (target && !target.isEliminated) {
              if (target.votes === undefined) target.votes = 0;
              target.votes++;
            }
          }
        } else if (voter.votedFor !== undefined && voter.votedFor !== null) {
          // Only count actual votes, not skipped (null) votes
          const target = stateBeforeCalc.players.find(p => p.id === voter.votedFor);
          if (target && !target.isEliminated) {
            if (target.votes === undefined) target.votes = 0;
            target.votes++;
          }
        }
      }
    });
    
    console.log('[VotingPhase] Vote counts after recalculation in handleCalculateResults:', stateBeforeCalc.players.map(p => ({
      name: p.name,
      votes: p.votes,
      isEliminated: p.isEliminated,
      votedFor: p.votedFor,
      votedForImposter: p.votedForImposter,
      votedForOtherWord: p.votedForOtherWord
    })));
    
    // CRITICAL: Double-check vote counts by summing them
    const totalVotesCounted = stateBeforeCalc.players.reduce((sum, p) => sum + (p.votes || 0), 0);
    const activePlayersCount = stateBeforeCalc.players.filter(p => !p.isEliminated).length;
    const expectedVotes = stateBeforeCalc.gameMode === 'mixed' ? activePlayersCount * 2 : activePlayersCount;
    console.log('[VotingPhase] Vote count verification:', {
      totalVotesCounted,
      expectedVotes,
      activePlayersCount,
      gameMode: stateBeforeCalc.gameMode,
      match: totalVotesCounted === expectedVotes
    });
    
    // If vote counts don't match expected, log warning
    if (totalVotesCounted !== expectedVotes) {
      console.warn('[VotingPhase] WARNING: Vote counts do not match expected! This may cause incorrect results.');
    }
    
    // Now calculate results with accurate vote counts
    const result = game.calculateVotingResult();
    const newState = game.getState();
    setGameState(newState);
    
    // Check for auto-win (imposters win) - must check BEFORE other result checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((game as any).state.gameCompleted && result.eliminated) {
      // Imposters won automatically - show imposter win screen
      console.log('[VotingPhase] Auto-win detected - imposters won!');
      setShowResults(true);
      setEliminatedPlayer(result.eliminated);
      setShowWrongElimination(false);
      setShowTieResults(false);
      
      // Sync auto-win to server
      if (roomId && gameState.isOnline) {
        try {
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: newState.votingPhase,
                votingActivated: newState.votingActivated,
                eliminatedPlayer: {
                  id: result.eliminated.id,
                  name: result.eliminated.name,
                  wordType: result.eliminated.wordType,
                  votes: result.eliminated.votes || 0
                },
                wrongElimination: false,
                isTie: false,
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
        } catch (error) {
          console.error('Error syncing auto-win:', error);
        }
      }
      return; // Don't process further - auto-win screen will show
    }
    
    if (result.isTie) {
      // Show tie results - just option to revote
      setTiedPlayers(result.tiedPlayers);
      setShowTieResults(true);
      
      // Sync tie to server
      if (roomId && gameState.isOnline) {
        try {
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: newState.votingPhase,
                votingActivated: newState.votingActivated,
                isTie: true,
                tiedPlayers: result.tiedPlayers.map(p => ({ id: p.id, name: p.name, votes: p.votes || 0 })),
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
        } catch (error) {
          console.error('Error syncing tie result:', error);
        }
      }
    } else if (result.wasWrong) {
      // Wrong elimination
      setShowWrongElimination(true);
      setEliminatedPlayer(result.eliminated);
      
      // Sync wrong elimination to server
      if (roomId && gameState.isOnline && result.eliminated) {
        try {
          console.log('[VotingPhase] Syncing wrong elimination result to server:', {
            eliminatedPlayer: result.eliminated.name,
            votes: result.eliminated.votes
          });
          
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: newState.votingPhase,
                votingActivated: newState.votingActivated,
                eliminatedPlayer: {
                  id: result.eliminated.id,
                  name: result.eliminated.name,
                  wordType: result.eliminated.wordType,
                  votes: result.eliminated.votes || 0
                },
                wrongElimination: true,
                isTie: false, // CRITICAL: Clear tie flag
                tiedPlayers: undefined, // Clear tied players
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
        } catch (error) {
          console.error('Error syncing wrong elimination:', error);
        }
      }
    } else {
      // Correct elimination - show confetti if imposter/other word found
      if (result.eliminated && (result.eliminated.wordType === 'imposter' || result.eliminated.wordType === 'similar')) {
        setShowConfetti(true);
      }
      setShowResults(true);
      setEliminatedPlayer(result.eliminated);
      
      // Sync elimination to server
      if (roomId && gameState.isOnline && result.eliminated) {
        try {
          await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: newState.votingPhase,
                votingActivated: newState.votingActivated,
                eliminatedPlayer: {
                  id: result.eliminated.id,
                  name: result.eliminated.name,
                  wordType: result.eliminated.wordType,
                  votes: result.eliminated.votes || 0
                },
                wrongElimination: false,
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
        } catch (error) {
          console.error('Error syncing elimination result:', error);
        }
      }
    }
  }, [game, roomId, gameState.isOnline, showResults, showTieResults, showWrongElimination]);

  const handleRevote = async () => {
    game.revote();
    // Reset currentVotingPlayerIndex to 0 for new voting round
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.currentVotingPlayerIndex = 0;
    // Clear all result states
    const updatedState = game.getState();
    
    // Reset all players' voting state FIRST
    updatedState.players.forEach(p => {
      if (!p.isEliminated) {
        p.hasVoted = false;
        p.votedFor = undefined;
        p.votedForImposter = undefined;
        p.votedForOtherWord = undefined;
        p.votes = 0;
      }
    });
    
    // Clear eliminated player state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.eliminatedPlayer = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.wrongElimination = false;
    
    // Reset voting activation so admin needs to activate again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.votingActivated = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.votingPhase = false;
    
    setGameState(updatedState);
    setShowTieResults(false);
    setShowResults(false);
    setShowWrongElimination(false);
    setTiedPlayers([]);
    setEliminatedPlayer(null);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
    
    // Sync revote to server - clear everything
    if (roomId && gameState.isOnline) {
      try {
        const finalState = game.getState();
        await fetch('/api/rooms/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            gameStateData: {
              currentPlayerIndex: finalState.currentPlayerIndex,
              votingPhase: false, // Reset voting phase
              currentVotingPlayerIndex: 0, // Reset to first player
              votingActivated: false, // Reset activation - admin must activate again
              isTie: false,
              wrongElimination: false,
              eliminatedPlayer: undefined,
              votes: {}, // Clear all votes
              playerWords: finalState.players.reduce((acc, p) => {
                if (p.currentWord) {
                  acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                }
                return acc;
              }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
            }
          })
        });
        console.log('[VotingPhase] Revote synced to server - voting reset, admin must activate again');
        
        // Force state update after sync
        const refreshedState = game.getState();
        setGameState({
          ...refreshedState,
          players: refreshedState.players.map(p => ({ ...p }))
        });
      } catch (error) {
        console.error('Error syncing revote:', error);
      }
    }
  };

  const handleContinueAfterWrongElimination = async () => {
    if (isContinuing) {
      console.log('[VotingPhase] Continue already in progress, ignoring duplicate click');
      return;
    }
    
    setIsContinuing(true);
    
    try {
      // Check if admin is eliminated and transfer host if needed
      if (roomId && gameState.isOnline) {
        const currentState = game.getState();
        const room = await fetch(`/api/rooms/game-state?roomId=${roomId}`).then(r => r.json()).catch(() => null);
        if (room?.room) {
          const originalHostId = room.room.hostId;
          const hostPlayerInRoom = room.room.players.find((p: { id: string }) => p.id === originalHostId);
          
          if (hostPlayerInRoom) {
            // Find the host player in game state by name (since game uses numeric IDs)
            const hostPlayerInGame = currentState.players.find(p => p.name === hostPlayerInRoom.name);
            
            if (hostPlayerInGame?.isEliminated) {
              // Admin is eliminated - transfer host to first active player
              const activePlayers = currentState.players.filter(p => !p.isEliminated);
              if (activePlayers.length > 0) {
                // Find the first active player's room ID by matching name
                const firstActivePlayerName = activePlayers[0].name;
                const firstActivePlayerInRoom = room.room.players.find((p: { name: string }) => p.name === firstActivePlayerName);
                
                if (firstActivePlayerInRoom) {
                  const newHostId = firstActivePlayerInRoom.id;
                  console.log('[VotingPhase] Admin eliminated, transferring host to:', newHostId, firstActivePlayerName);
                  await fetch('/api/rooms/transfer-host', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId, newHostId })
                  }).catch(err => console.error('Error transferring host:', err));
                }
              }
            }
          }
        }
      }
      
      game.continueAfterWrongElimination();
      // Reset voting activation so admin needs to activate again for next round
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.votingActivated = false;
      // CRITICAL: Clear voting phase state to go back to word assignment screen
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.votingPhase = false;
      // Clear tie state if it exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.canRevote = false;
      
      const newState = game.getState();
      setGameState(newState);
      setShowWrongElimination(false);
      setShowResults(false);
      setShowTieResults(false);
      setEliminatedPlayer(null);
      setTiedPlayers([]);
      setSelectedTarget(null);
      setSelectedImposterTarget(null);
      setSelectedOtherWordTarget(null);
      
      // Sync continue after wrong elimination to server
      if (roomId && gameState.isOnline) {
        try {
          console.log('[VotingPhase] Syncing continue after wrong elimination to server');
          const response = await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: newState.currentPlayerIndex,
                votingPhase: false, // CRITICAL: Set to false to go back to word assignment
                votingActivated: false, // Reset activation for next round
                currentVotingPlayerIndex: 0, // Reset voting index
                wrongElimination: false,
                isTie: false, // Clear tie state
                eliminatedPlayer: null, // Clear eliminated player (but keep isEliminated on player)
                tiedPlayers: null, // Clear tied players
                votes: {}, // Clear votes
                playerWords: newState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
          
          if (response.ok) {
            // Immediately refetch from server to get updated state
            const refetchResponse = await fetch(`/api/rooms/game-state?roomId=${roomId}`);
            if (refetchResponse.ok) {
              const refetchData = await refetchResponse.json();
              const serverState = refetchData.room?.gameStateData;
              
              if (serverState) {
                // Sync from server state
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.votingPhase = serverState.votingPhase ?? false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.votingActivated = serverState.votingActivated ?? false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = serverState.eliminatedPlayer || undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = serverState.wrongElimination ?? false;
                
                // Clear component state
                setEliminatedPlayer(null);
                setShowResults(false);
                setShowWrongElimination(false);
                setShowTieResults(false);
              }
            }
          }
          
          // Force state update after sync to ensure UI updates
          const finalState = game.getState();
          setGameState({
            ...finalState,
            players: finalState.players.map(p => ({ ...p }))
          });
        } catch (error) {
          console.error('Error syncing continue after wrong elimination:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleContinueAfterWrongElimination:', error);
    } finally {
      setIsContinuing(false);
    }
  };

  const handleActivateVoting = async () => {
    game.activateVoting();
    // Reset currentVotingPlayerIndex to 0 for sequential voting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.currentVotingPlayerIndex = 0;
    
    // Clear any previous results when activating new voting round
    setShowResults(false);
    setShowWrongElimination(false);
    setShowTieResults(false);
    setEliminatedPlayer(null);
    setTiedPlayers([]);
    
    // Clear eliminated player state in game if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((game as any).state.eliminatedPlayer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.eliminatedPlayer = undefined;
    }
    
    // Reset all players' voting state when activating new voting round
    const updatedState = game.getState();
    updatedState.players.forEach(p => {
      if (!p.isEliminated) {
        p.hasVoted = false;
        p.votedFor = undefined;
        p.votedForImposter = undefined;
        p.votedForOtherWord = undefined;
        p.votes = 0;
      }
    });
    
    setGameState(updatedState);
    
      // Sync voting activation to server for online games
    if (roomId && gameState.isOnline) {
      try {
        // Ensure votingActivated is set to true in game state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (game as any).state.votingActivated = true;
        const finalState = game.getState();
        
        const gameStateDataToSend = {
          currentPlayerIndex: finalState.currentPlayerIndex,
          votingPhase: true, // Explicitly set to true
          currentVotingPlayerIndex: 0, // Reset to first player
          votingActivated: true, // Explicitly set to true
          eliminatedPlayer: undefined, // Clear eliminated player
          wrongElimination: false,
          isTie: false,
          votes: {}, // Clear previous votes
          playerWords: finalState.players.reduce((acc, p) => {
            if (p.currentWord) {
              acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
            }
            return acc;
          }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
        };
        
        console.log('[VotingPhase] Admin activating voting, sending to server:', {
          roomId,
          gameStateData: gameStateDataToSend
        });
        
        const response = await fetch('/api/rooms/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            gameStateData: gameStateDataToSend
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[VotingPhase] Server confirmed state update:', result);
        } else {
          console.error('[VotingPhase] Server rejected state update:', response.status, await response.text());
        }
        
        // Update local state after sync to ensure UI reflects the change
        setGameState(finalState);
      } catch (error) {
        console.error('[VotingPhase] Error syncing voting activation:', error);
      }
    }
  };

  // Real-time sync for online games - use broadcasts + polling
  useEffect(() => {
    if (!roomId || !gameState.isOnline) return;
    
    let shouldStopPolling = false;
    let unsubscribe: (() => void) | null = null;
    
    const syncGameState = async () => {
      if (shouldStopPolling) return;
      
      try {
        const normalizedRoomId = roomId.toUpperCase().trim();
        const response = await fetch(`/api/rooms/game-state?roomId=${encodeURIComponent(normalizedRoomId)}`);
        
        if (response.status === 404) {
          // Room not found - stop polling to prevent repeated 404s
          console.warn('[VotingPhase] Room not found (404) in game state sync, stopping polling:', normalizedRoomId);
          shouldStopPolling = true;
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          console.log('[VotingPhase] Full server response:', data);
          if (data.room?.gameStateData) {
            const serverState = data.room.gameStateData;
            console.log('[VotingPhase] Server state received:', {
              votingActivated: serverState.votingActivated,
              votingPhase: serverState.votingPhase,
              currentVotingPlayerIndex: serverState.currentVotingPlayerIndex,
              hasGameStateData: !!data.room.gameStateData
            });
            let stateChanged = false;
            
            // Sync voting activation - always sync when server has a value
            // When server says true, always sync (new voting round started)
            // When server says false, only sync if we don't have active votes (to prevent resetting mid-vote)
            if (serverState.votingActivated !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const currentActivated = (game as any).state.votingActivated;
              
              console.log('[VotingPhase] Syncing votingActivated:', {
                serverValue: serverState.votingActivated,
                currentValue: currentActivated,
                willSync: serverState.votingActivated === true || (serverState.votingActivated === false && !currentActivated)
              });
              
              // If server says true, always sync (admin activated voting)
              if (serverState.votingActivated === true) {
                // Always sync true, even if it's already true (to ensure UI updates)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.votingActivated = true;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.votingPhase = true;
                
                // Reset all players' voting state when voting is activated (new round)
                const currentState = game.getState();
                currentState.players.forEach(p => {
                  if (!p.isEliminated) {
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                    p.votes = 0;
                  }
                });
                
                stateChanged = true;
                console.log('[VotingPhase] Voting activated - forcing state update');
                // Force immediate state update when voting is activated so players can vote
                // This is critical - always update state when voting is activated
                const updatedState = game.getState();
                setGameState({ 
                  ...updatedState,
                  players: updatedState.players.map(p => ({ ...p })),
                  votingActivated: true, // Explicitly set in component state
                  votingPhase: true
                });
              } else if (serverState.votingActivated === false) {
                // Only sync false if we don't have active votes AND voting hasn't started yet
                // If voting is in progress (currentVotingPlayerIndex > 0 or players have voted), don't reset
                const currentState = game.getState();
                const hasActiveVotes = currentState.players.some(p => 
                  !p.isEliminated && (p.hasVoted || p.votedForImposter !== undefined || p.votedForOtherWord !== undefined)
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentVotingIdx = (game as any).state.currentVotingPlayerIndex ?? 0;
                const votingInProgress = currentVotingIdx > 0 || hasActiveVotes || currentState.votingPhase;
                
                // Don't reset to false if voting is in progress - this prevents the loop
                if (!hasActiveVotes && !votingInProgress && serverState.votingActivated !== currentActivated) {
                  console.log('[VotingPhase] Resetting votingActivated to false (no active votes, voting not in progress)');
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingActivated = false;
                  stateChanged = true;
                } else if (votingInProgress) {
                  console.log('[VotingPhase] Preventing votingActivated reset - voting in progress', {
                    currentVotingIdx,
                    hasActiveVotes,
                    votingPhase: currentState.votingPhase
                  });
                  // Keep it true if voting is in progress
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingActivated = true;
                  stateChanged = true;
                }
              }
            } else {
              console.log('[VotingPhase] Server state has no votingActivated value');
            }
            
            // Sync currentVotingPlayerIndex from server (CRITICAL for sequential voting)
            if (serverState.currentVotingPlayerIndex !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const currentVotingIdx = (game as any).state.currentVotingPlayerIndex ?? 0;
              if (serverState.currentVotingPlayerIndex !== currentVotingIdx) {
                console.log('[VotingPhase] currentVotingPlayerIndex changed:', {
                  old: currentVotingIdx,
                  new: serverState.currentVotingPlayerIndex
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.currentVotingPlayerIndex = serverState.currentVotingPlayerIndex;
                stateChanged = true;
                // Force immediate state update when voting index changes so next player can vote
                const updatedState = game.getState();
                setGameState({ 
                  ...updatedState,
                  players: updatedState.players.map(p => ({ ...p })),
                  currentVotingPlayerIndex: serverState.currentVotingPlayerIndex
                });
                // Force multiple re-renders to ensure UI updates
                setTimeout(() => {
                  const freshState = game.getState();
                  setGameState({ 
                    ...freshState,
                    players: freshState.players.map(p => ({ ...p })),
                    currentVotingPlayerIndex: serverState.currentVotingPlayerIndex
                  });
                }, 50);
                setTimeout(() => {
                  const freshState = game.getState();
                  setGameState({ 
                    ...freshState,
                    players: freshState.players.map(p => ({ ...p })),
                    currentVotingPlayerIndex: serverState.currentVotingPlayerIndex
                  });
                }, 200);
              }
            }
            
            // Sync votes from server
            if (serverState.votes !== undefined) {
              const currentState = game.getState();
              
              // If votes object is empty (revote), reset everything and hide tie screen
              if (Object.keys(serverState.votes).length === 0) {
                console.log('[VotingPhase] Empty votes detected - revote was triggered, resetting all voting state');
                // Hide tie screen if it's showing (revote was triggered)
                if (showTieResults) {
                  setShowTieResults(false);
                  setTiedPlayers([]);
                }
                // Reset all players' voting state
                currentState.players.forEach(p => {
                  p.votes = 0;
                  if (!p.isEliminated) {
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                  }
                });
                // Also clear any eliminated player state if it exists
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                // Reset voting activation and phase if server says so
                if (serverState.votingActivated === false) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingActivated = false;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingPhase = false;
                  // Reset currentVotingPlayerIndex
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.currentVotingPlayerIndex = 0;
                }
                stateChanged = true;
                // Force state update
                const refreshedState = game.getState();
                setGameState({
                  ...refreshedState,
                  players: refreshedState.players.map(p => ({ ...p })),
                  votingActivated: serverState.votingActivated === false ? false : refreshedState.votingActivated,
                  votingPhase: serverState.votingPhase === false ? false : refreshedState.votingPhase
                });
              } else {
                // CRITICAL: Reset ALL vote counts first to ensure accurate recalculation
                currentState.players.forEach(p => {
                  p.votes = 0;
                });
                
                // First, collect which players have votes on the server
                const playersWithServerVotes = new Set<number>();
                Object.entries(serverState.votes).forEach(([, voteData]) => {
                  type VoteData = { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' };
                  const vote = voteData as VoteData;
                  playersWithServerVotes.add(vote.voterId);
                });
                
                // Only reset voting status for players who don't have votes on the server
                // This prevents clearing votes that are in the process of being synced
                // CRITICAL: Don't reset if player already has voted locally - preserve their vote
                currentState.players.forEach(p => {
                  if (!p.isEliminated && !playersWithServerVotes.has(p.id)) {
                    // Only reset if this player doesn't have a vote on the server AND doesn't have a vote locally
                    // This prevents clearing the admin's vote after they vote
                    const hasLocalVote = p.hasVoted || p.votedFor !== undefined || 
                                       p.votedForImposter !== undefined || p.votedForOtherWord !== undefined;
                    if (!hasLocalVote) {
                      p.hasVoted = false;
                      p.votedFor = undefined;
                      p.votedForImposter = undefined;
                      p.votedForOtherWord = undefined;
                    }
                  }
                });
                
                // Apply votes from server and recalculate vote counts
                // IMPORTANT: We reset vote counts above, so now we recalculate from scratch
                Object.entries(serverState.votes).forEach(([, voteData]) => {
                  type VoteData = { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' };
                  const vote = voteData as VoteData;
                  const voter = currentState.players.find(p => p.id === vote.voterId);
                  if (voter && !voter.isEliminated) {
                    // Apply vote from server
                    if (currentState.gameMode === 'mixed' && vote.voteType) {
                      if (vote.voteType === 'imposter') {
                        voter.votedForImposter = vote.targetId;
                      } else if (vote.voteType === 'other-word') {
                        voter.votedForOtherWord = vote.targetId;
                      }
                      // Mark as voted if both votes are cast (or skipped)
                      if ((voter.votedForImposter !== undefined || voter.votedForImposter === null) && 
                          (voter.votedForOtherWord !== undefined || voter.votedForOtherWord === null)) {
                        voter.hasVoted = true;
                      }
                    } else if (!vote.voteType) {
                      voter.votedFor = vote.targetId;
                      voter.hasVoted = true;
                    }
                    
                    // Update target player's vote count (only if target is not eliminated)
                    // CRITICAL: Only increment if we haven't already counted this vote
                    // (votes were reset above, so this is safe, but double-check target exists)
                    const target = currentState.players.find(p => p.id === vote.targetId);
                    if (target && !target.isEliminated) {
                      if (target.votes === undefined) target.votes = 0;
                      target.votes++;
                    } else if (!target) {
                      console.warn('[VotingPhase] Target player not found for vote:', vote.targetId);
                    }
                    
                    stateChanged = true;
                  }
                });
                
                console.log('[VotingPhase] Vote counts after sync from server:', currentState.players.map(p => ({
                  name: p.name,
                  votes: p.votes,
                  isEliminated: p.isEliminated
                })));
              }
            }
            
            // Sync voting results from server - tie state (check FIRST before eliminated player)
            if (serverState.isTie !== undefined) {
              const shouldShowTie = serverState.isTie === true;
              if (shouldShowTie && !showTieResults) {
                // Show tie results - clear any eliminated player state first
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                setShowResults(false);
                setShowWrongElimination(false);
                setShowTieResults(true);
                if (serverState.tiedPlayers && Array.isArray(serverState.tiedPlayers)) {
                  const tiedPlayersFromServer = serverState.tiedPlayers.map((tp: { id: number; name: string; votes: number }) => {
                    const gameState = game.getState();
                    const player = gameState.players.find(p => p.id === tp.id);
                    return player || { id: tp.id, name: tp.name, votes: tp.votes };
                  });
                  setTiedPlayers(tiedPlayersFromServer);
                }
                stateChanged = true;
              } else if (!shouldShowTie && showTieResults) {
                // Hide tie results (revote was triggered) - this is the key fix
                setShowTieResults(false);
                setTiedPlayers([]);
                // Reset votes in game state
                const currentState = game.getState();
                currentState.players.forEach(p => {
                  if (!p.isEliminated) {
                    p.votes = 0;
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                  }
                });
                // Also clear any eliminated player state if it exists
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                stateChanged = true;
              }
            }
            
            // Sync eliminated player state - but only if there's no tie
            // If there's a tie, don't show eliminated player screen
            if (serverState.eliminatedPlayer !== undefined && !serverState.isTie) {
              if (!serverState.eliminatedPlayer || serverState.eliminatedPlayer === null) {
                // Clear eliminated player (continue after elimination)
                setEliminatedPlayer(null);
                setShowResults(false);
                setShowWrongElimination(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.wrongElimination = false;
                stateChanged = true;
              } else {
                // Always sync eliminated player from server, even if local state already shows results
                // This ensures all clients see the same results
                // But only if there's no tie
                const currentState = game.getState();
                const eliminated = currentState.players.find(p => p.id === serverState.eliminatedPlayer.id);
                if (eliminated) {
                  eliminated.isEliminated = true;
                  eliminated.votes = serverState.eliminatedPlayer.votes || 0;
                  setEliminatedPlayer(eliminated);
                  
                  // Always update show flags based on server state
                  if (serverState.wrongElimination) {
                    setShowWrongElimination(true);
                    setShowResults(false);
                    setShowTieResults(false);
                  } else {
                    setShowResults(true);
                    setShowWrongElimination(false);
                    setShowTieResults(false);
                    if (eliminated.wordType === 'imposter' || eliminated.wordType === 'similar') {
                      setShowConfetti(true);
                    }
                  }
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
            
            // Sync emotes
            if (data.room.gameStateData.emotes) {
              const recentEmotes = data.room.gameStateData.emotes
                .filter((e: { timestamp: number }) => Date.now() - e.timestamp < 5000)
                .map((e: { playerId: number; emote: string; timestamp: number }) => {
                  const player = gameState.players.find(p => p.id === e.playerId);
                  return {
                    id: e.playerId * 1000 + e.timestamp,
                    emote: e.emote as EmoteType,
                    playerName: player?.name || 'Unknown'
                  };
                });
              setActiveEmotes(recentEmotes);
            }
            
            if (stateChanged) {
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
      
      // Poll as fallback only (every 1 second - broadcasts are primary)
      const interval = setInterval(() => {
        if (!shouldStopPolling) {
          syncGameState();
        }
      }, 1000);
      
      // Also run immediately to catch any missed updates
      syncGameState();
      
      // Subscribe to broadcast events for instant updates (after syncGameState is defined)
      try {
        unsubscribe = subscribeToRoom(roomId, (event) => {
          if (event.type === 'game-state-updated' || event.type === 'room-updated' || event.type === 'host-transferred') {
            // Immediately refetch state when broadcast received
            syncGameState();
            // If host was transferred, trigger a window refresh to update isAdmin
            if (event.type === 'host-transferred') {
              // Force a re-render by updating a dummy state or reloading room
              window.dispatchEvent(new CustomEvent('host-transferred'));
            }
          }
        });
      } catch (error) {
        console.warn('[VotingPhase] Broadcast subscription failed, using polling only:', error);
      }
      
      return () => {
        shouldStopPolling = true;
        clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };
    }, [roomId, gameState.isOnline, gameState.players, gameState.votingActivated, gameState.votingPhase, game, showTieResults, showResults, showWrongElimination]);

  useEffect(() => {
    if (!gameState.isOnline) {
      // For local mode, check local state
      const interval = setInterval(() => {
        const newState = game.getState();
        setGameState(newState);
        
        // Check if all players have voted
        if (game.allPlayersVoted() && !showResults && !showTieResults && !showWrongElimination) {
          handleCalculateResults();
        }
      }, 500); // Check every 500ms for updates

      return () => clearInterval(interval);
    } else {
      // For online mode, check server state via polling
      let shouldStopPolling = false;
      
      const interval = setInterval(async () => {
        if (!roomId || shouldStopPolling) return;
        
        try {
          const normalizedRoomId = roomId.toUpperCase().trim();
          const response = await fetch(`/api/rooms/game-state?roomId=${encodeURIComponent(normalizedRoomId)}`);
          
          if (response.status === 404) {
            // Room not found - stop polling to prevent repeated 404s
            console.warn('[VotingPhase] Room not found (404) in vote completion check, stopping polling:', normalizedRoomId);
            shouldStopPolling = true;
            return;
          }
          
          // CRITICAL: Check for eliminated player immediately - don't wait for vote checking
          if (response.ok) {
            const data = await response.json();
            const serverState = data.room?.gameStateData;
            
            // If server has eliminated player, sync it immediately
            // CRITICAL: Sync to ALL players, including the eliminated player themselves
            // BUT: If server says eliminatedPlayer is null, that means it was cleared - respect that
            if (serverState?.eliminatedPlayer !== undefined) {
              if (serverState.eliminatedPlayer === null) {
                // Server says eliminated player was cleared - clear it locally too
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.eliminatedPlayer = undefined;
                setEliminatedPlayer(null);
                setShowResults(false);
                setShowWrongElimination(false);
                setShowTieResults(false);
                // CRITICAL: Also clear votingPhase if server cleared eliminated player
                if (serverState.votingPhase === false) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingPhase = false;
                }
                // Update game state to reflect changes
                const updatedState = game.getState();
                setGameState(updatedState);
                console.log('[VotingPhase] Server cleared eliminated player, clearing locally');
              } else if (serverState.eliminatedPlayer !== null) {
                const currentState = game.getState();
                const eliminated = currentState.players.find(p => p.id === serverState.eliminatedPlayer.id);
                if (eliminated) {
                  // Always sync eliminated state, even if already set
                  eliminated.isEliminated = true;
                  eliminated.votes = serverState.eliminatedPlayer.votes || 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.eliminatedPlayer = eliminated;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingPhase = true;
                  setEliminatedPlayer(eliminated);
                  if (serverState.wrongElimination) {
                    setShowWrongElimination(true);
                    setShowResults(false);
                    setShowTieResults(false);
                  } else {
                    setShowResults(true);
                    setShowWrongElimination(false);
                    setShowTieResults(false);
                    if (eliminated.wordType === 'imposter' || eliminated.wordType === 'similar') {
                      setShowConfetti(true);
                    }
                  }
                  const updatedState = game.getState();
                  setGameState(updatedState);
                  return; // Don't check votes if we already have results
                }
              }
            }
            
            // If server says it's a tie, sync it immediately
            if (serverState?.isTie === true) {
              setShowTieResults(true);
              setShowResults(false);
              setShowWrongElimination(false);
              if (serverState.tiedPlayers && Array.isArray(serverState.tiedPlayers)) {
                const tiedPlayersFromServer = serverState.tiedPlayers.map((tp: { id: number; name: string; votes: number }) => {
                  const currentState = game.getState();
                  const player = currentState.players.find(p => p.id === tp.id);
                  return player || { id: tp.id, name: tp.name, votes: tp.votes };
                });
                setTiedPlayers(tiedPlayersFromServer);
              }
              return; // Don't check votes if we already have tie results
            }
          }
          
          if (response.ok) {
            const data = await response.json();
            const serverState = data.room.gameStateData;
            
            // Note: eliminatedPlayer and isTie checks are already done above, so skip them here
            // Continue to vote checking logic below
            
            // Only check votes if we don't already have results
            if (serverState.votes && !serverState.eliminatedPlayer && !serverState.isTie) {
              const serverVotes = serverState.votes;
              const currentState = game.getState();
              const activePlayers = currentState.players.filter(p => !p.isEliminated);
              const isBothMode = currentState.gameMode === 'mixed';
              
              // Check if all players have voted based on server votes
              type VoteData = { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' };
              const votesArray = Object.values(serverVotes) as VoteData[];
              let allVoted = true;
              for (const player of activePlayers) {
                if (isBothMode) {
                  // Check if both votes exist in server votes
                  const hasImposterVote = votesArray.some(v => 
                    v.voterId === player.id && v.voteType === 'imposter'
                  );
                  const hasOtherVote = votesArray.some(v => 
                    v.voterId === player.id && v.voteType === 'other-word'
                  );
                  if (!hasImposterVote || !hasOtherVote) {
                    allVoted = false;
                    break;
                  }
                } else {
                  // Check if vote exists in server votes
                  const hasVote = votesArray.some(v => 
                    v.voterId === player.id && !v.voteType
                  );
                  if (!hasVote) {
                    allVoted = false;
                    break;
                  }
                }
              }
              
              // If all voted and results not shown, sync votes to local state and calculate results
              if (allVoted && !showResults && !showTieResults && !showWrongElimination) {
                // Sync votes from server to local game state
                const currentState = game.getState();
                
                // Reset vote counts only (don't reset voting data - preserve it)
                currentState.players.forEach(p => {
                  p.votes = 0;
                });
                
                // Apply votes from server to voting data
                Object.entries(serverVotes).forEach(([, voteData]) => {
                  type VoteData = { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' };
                  const vote = voteData as VoteData;
                  const voter = currentState.players.find(p => p.id === vote.voterId);
                  if (voter && !voter.isEliminated) {
                    if (isBothMode && vote.voteType) {
                      if (vote.voteType === 'imposter') {
                        voter.votedForImposter = vote.targetId;
                      } else if (vote.voteType === 'other-word') {
                        voter.votedForOtherWord = vote.targetId;
                      }
                      if ((voter.votedForImposter !== undefined || voter.votedForImposter === null) && 
                          (voter.votedForOtherWord !== undefined || voter.votedForOtherWord === null)) {
                        voter.hasVoted = true;
                      }
                    } else if (!vote.voteType) {
                      voter.votedFor = vote.targetId;
                      voter.hasVoted = true;
                    }
                  }
                });
                
                // Now recalculate vote counts from voting data - CRITICAL for accuracy
                // Reset all vote counts first to ensure clean calculation
                currentState.players.forEach(p => {
                  p.votes = 0;
                });
                
                // Count votes from server votes object directly for accuracy
                // In normal mode: each vote entry = 1 vote for target
                // In mixed mode: each vote entry = 1 vote for target (imposter and other-word are separate votes)
                const voteCounts: Record<number, number> = {};
                Object.entries(serverVotes).forEach(([, voteData]) => {
                  type VoteData = { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' };
                  const vote = voteData as VoteData;
                  // Count every vote entry - each entry represents one vote for the target
                  if (!voteCounts[vote.targetId]) {
                    voteCounts[vote.targetId] = 0;
                  }
                  voteCounts[vote.targetId]++;
                });
                
                // Apply vote counts to players
                Object.entries(voteCounts).forEach(([targetIdStr, count]) => {
                  const targetId = parseInt(targetIdStr, 10);
                  const target = currentState.players.find(p => p.id === targetId);
                  if (target && !target.isEliminated) {
                    target.votes = count;
                  }
                });
                
                console.log('[VotingPhase] Vote counts calculated from server votes:', Object.entries(voteCounts).map(([id, count]) => ({
                  targetId: id,
                  votes: count
                })));
                
                // Now calculate results since local state is synced
                console.log('[VotingPhase] All players voted, calculating results');
                console.log('[VotingPhase] Vote counts after sync and recalculation:', currentState.players.map(p => ({
                  name: p.name,
                  votes: p.votes,
                  isEliminated: p.isEliminated,
                  votedFor: p.votedFor,
                  votedForImposter: p.votedForImposter,
                  votedForOtherWord: p.votedForOtherWord
                })));
                
                // CRITICAL: Check if server already has a result before calculating
                // This prevents multiple clients from calculating different results
                try {
                  const checkResponse = await fetch(`/api/rooms/game-state?roomId=${encodeURIComponent(normalizedRoomId)}`);
                  if (checkResponse.ok) {
                    const checkData = await checkResponse.json();
                    const checkServerState = checkData.room?.gameStateData;
                    
                    // If server already has elimination result, use it
                    if (checkServerState?.eliminatedPlayer !== undefined && checkServerState.eliminatedPlayer !== null) {
                      console.log('[VotingPhase] Server already has elimination result, using it:', checkServerState.eliminatedPlayer);
                      const currentState = game.getState();
                      const eliminated = currentState.players.find(p => p.id === checkServerState.eliminatedPlayer.id);
                      if (eliminated) {
                        eliminated.isEliminated = true;
                        eliminated.votes = checkServerState.eliminatedPlayer.votes || 0;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (game as any).state.eliminatedPlayer = eliminated;
                        setEliminatedPlayer(eliminated);
                        setShowResults(true);
                        setShowTieResults(false);
                        setShowWrongElimination(checkServerState.wrongElimination || false);
                        const updatedState = game.getState();
                        setGameState(updatedState);
                      }
                      return;
                    }
                    
                    // If server says it's a tie, use that result
                    if (checkServerState?.isTie === true) {
                      console.log('[VotingPhase] Server already says its a tie, using that result');
                      setShowTieResults(true);
                      setShowResults(false);
                      setShowWrongElimination(false);
                      if (checkServerState.tiedPlayers && Array.isArray(checkServerState.tiedPlayers)) {
                        const tiedPlayersFromServer = checkServerState.tiedPlayers.map((tp: { id: number; name: string; votes: number }) => {
                          const currentState = game.getState();
                          const player = currentState.players.find(p => p.id === tp.id);
                          return player || { id: tp.id, name: tp.name, votes: tp.votes };
                        });
                        setTiedPlayers(tiedPlayersFromServer);
                      }
                      return;
                    }
                  }
                } catch (error) {
                  console.error('[VotingPhase] Error checking server state before calculation:', error);
                }
                
                // Force state update before calculating results
                const updatedState = game.getState();
                setGameState({
                  ...updatedState,
                  players: updatedState.players.map(p => ({ ...p }))
                });
                
                // Calculate results immediately - handleCalculateResults will recalculate votes
                // Use a shorter timeout to make results appear faster
                setTimeout(() => {
                  handleCalculateResults();
                }, 50);
              }
            }
          }
        } catch (error) {
          console.error('Error checking voting completion:', error);
        }
      }, 200); // Check every 200ms for vote completion (broadcasts handle instant updates)

      return () => {
        shouldStopPolling = true;
        clearInterval(interval);
      };
    }
  }, [game, showResults, handleCalculateResults, showTieResults, showWrongElimination, gameState.isOnline, roomId]);

  const handleContinueAfterElimination = async () => {
    if (isContinuing) {
      console.log('[VotingPhase] Continue already in progress, ignoring duplicate click');
      return;
    }
    
    setIsContinuing(true);
    console.log('[VotingPhase] handleContinueAfterElimination called - starting new voting round');
    
    try {
      // Check if admin is eliminated and transfer host if needed
      if (roomId && gameState.isOnline) {
        const currentState = game.getState();
        const room = await fetch(`/api/rooms/game-state?roomId=${roomId}`).then(r => r.json()).catch(() => null);
        if (room?.room) {
          const originalHostId = room.room.hostId;
          const hostPlayerInRoom = room.room.players.find((p: { id: string }) => p.id === originalHostId);
          
          if (hostPlayerInRoom) {
            // Find the host player in game state by name (since game uses numeric IDs)
            const hostPlayerInGame = currentState.players.find(p => p.name === hostPlayerInRoom.name);
            
            if (hostPlayerInGame?.isEliminated) {
              // Admin is eliminated - transfer host to first active player
              const activePlayers = currentState.players.filter(p => !p.isEliminated);
              if (activePlayers.length > 0) {
                // Find the first active player's room ID by matching name
                const firstActivePlayerName = activePlayers[0].name;
                const firstActivePlayerInRoom = room.room.players.find((p: { name: string }) => p.name === firstActivePlayerName);
                
                if (firstActivePlayerInRoom) {
                  const newHostId = firstActivePlayerInRoom.id;
                  console.log('[VotingPhase] Admin eliminated, transferring host to:', newHostId, firstActivePlayerName);
                  await fetch('/api/rooms/transfer-host', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId, newHostId })
                  }).catch(err => console.error('Error transferring host:', err));
                }
              }
            }
          }
        }
      }
      
      // Clear all result states first
      setShowResults(false);
      setShowTieResults(false);
      setShowWrongElimination(false);
      setEliminatedPlayer(null);
      setTiedPlayers([]);
      setSelectedTarget(null);
      setSelectedImposterTarget(null);
      setSelectedOtherWordTarget(null);
      
      // Use the game's continueAfterWrongElimination method to properly reset state
      game.continueAfterWrongElimination();
      
      // Reset voting activation so admin needs to activate again for next round
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.votingActivated = false;
      // CRITICAL: Keep votingPhase TRUE - we're still in voting phase, just starting a new round
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.votingPhase = true;
      // Clear tie state if it exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.canRevote = false;
      // CRITICAL: Clear eliminated player from game state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.eliminatedPlayer = undefined;
      
      // Reset all ACTIVE players' voting state for the new round
      // CRITICAL: Eliminated players stay eliminated and cannot vote
      const currentState = game.getState();
      currentState.players.forEach(p => {
        if (!p.isEliminated) {
          // Only reset voting state for active (non-eliminated) players
          p.hasVoted = false;
          p.votedFor = undefined;
          p.votedForImposter = undefined;
          p.votedForOtherWord = undefined;
          p.votes = 0; // Reset vote count for new round
        }
        // Eliminated players keep their isEliminated: true status
        // They will see spectate mode during the new voting round
      });
      
      const updatedState = game.getState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gameStateInternal = (game as any).state;
      console.log('[VotingPhase] Updated state after continue:', {
        votingPhase: updatedState.votingPhase,
        votingActivated: updatedState.votingActivated,
        eliminatedPlayer: gameStateInternal.eliminatedPlayer,
        currentVotingPlayerIndex: updatedState.currentVotingPlayerIndex
      });
      
      // Sync continue after elimination to server - start new voting round
      if (roomId && gameState.isOnline) {
        try {
          console.log('[VotingPhase] Syncing continue after elimination to server - starting new voting round');
          const response = await fetch('/api/rooms/game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              gameStateData: {
                currentPlayerIndex: updatedState.currentPlayerIndex,
                votingPhase: true, // CRITICAL: Keep voting phase TRUE - we're starting a new voting round
                votingActivated: false, // Reset activation so admin can activate again
                currentVotingPlayerIndex: 0, // Reset voting index for new round
                wrongElimination: false,
                isTie: false, // Clear tie state
                eliminatedPlayer: null, // CRITICAL: Clear eliminated player
                tiedPlayers: null, // CRITICAL: Clear tied players
                votes: {}, // Clear votes for new round
                playerWords: updatedState.players.reduce((acc, p) => {
                  if (p.currentWord) {
                    acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                  }
                  return acc;
                }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[VotingPhase] Failed to sync continue after elimination:', errorText);
            setIsContinuing(false);
            return;
          }
          
          await response.json(); // Consume response
          console.log('[VotingPhase] Successfully synced continue after elimination - new voting round ready');
          
          // Immediately refetch from server to get the updated state
          const refetchResponse = await fetch(`/api/rooms/game-state?roomId=${roomId}`);
          if (refetchResponse.ok) {
            const refetchData = await refetchResponse.json();
            const serverState = refetchData.room?.gameStateData;
            
            if (serverState) {
              // Sync from server state immediately
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.votingPhase = serverState.votingPhase ?? true;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.votingActivated = serverState.votingActivated ?? false;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.eliminatedPlayer = serverState.eliminatedPlayer || undefined;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.wrongElimination = serverState.wrongElimination ?? false;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (game as any).state.isTie = serverState.isTie ?? false;
              
              // Clear eliminated player from component state
              setEliminatedPlayer(null);
              setShowResults(false);
              setShowWrongElimination(false);
              setShowTieResults(false);
              
              // Update local game state
              const finalState = game.getState();
              setGameState({
                ...finalState,
                players: finalState.players.map(p => ({ ...p }))
              });
            }
          }
          
          setIsContinuing(false);
        } catch (error) {
          console.error('Error syncing continue after elimination:', error);
          setIsContinuing(false);
        }
      } else {
        // Force state update immediately (even if online, update local state)
        setGameState({
          ...updatedState,
          players: updatedState.players.map(p => ({ ...p }))
        });
        setIsContinuing(false);
      }
    } catch (error) {
      console.error('Error in handleContinueAfterElimination:', error);
      setIsContinuing(false);
    }
  };

  // Get current game state directly to ensure we have the latest data
  const currentGameStateForRender = game.getState();
  const currentPlayer = currentGameStateForRender.players.find(p => p.id === currentPlayerId);
  const activePlayers = currentGameStateForRender.players.filter(p => !p.isEliminated);
  const votingResults = game.getVotingResults();
  const hasVoted = currentPlayer?.hasVoted || false;
  const isBothMode = currentGameStateForRender.gameMode === 'mixed';
  const showVoteCounts = currentGameStateForRender.showVoteCounts; // false for online, true for local

  // Check if there's an eliminated player from game state (results should be shown first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasEliminatedPlayer = (game as any).state.eliminatedPlayer !== undefined && (game as any).state.eliminatedPlayer !== null;
  
  // Also check component state for eliminated player
  const hasEliminatedPlayerInState = eliminatedPlayer !== null && eliminatedPlayer !== undefined;
  
  // SPECTATOR MODE: If player is eliminated but game continues (wrong elimination or new voting round),
  // show them the voting phase in read-only mode BEFORE the general eliminated check
  // Show spectate mode if:
  // 1. Player is eliminated
  // 2. We're in voting phase (game continues)
  // 3. No results are showing (not showing elimination results)
  // 4. Either wrongElimination was shown OR voting is activated (new round started)
  const isInVotingPhase = currentGameStateForRender.votingPhase === true;
  const shouldShowSpectateMode = currentPlayer && 
    currentPlayer.isEliminated && 
    isInVotingPhase &&
    !showResults && 
    !showTieResults &&
    (showWrongElimination || currentGameStateForRender.votingActivated || !hasEliminatedPlayer);
  
  if (shouldShowSpectateMode) {
    const activePlayers = currentGameStateForRender.players.filter(p => !p.isEliminated);
    const currentVotingIndex = currentGameStateForRender.currentVotingPlayerIndex ?? 0;
    const currentVoter = activePlayers[currentVotingIndex];
    const allVoted = activePlayers.length > 0 && activePlayers.every(p => p.hasVoted);
    
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-orange-500 border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-orange-600">מצב צפייה</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">הודחת מהמשחק - המשחק ממשיך</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-orange-600 font-semibold">היית שחקן רגיל</p>
              <p className="text-orange-600 font-semibold">עדיין צריך למצוא את המתחזה/מילה דומה!</p>
            </div>
            
            {/* Show voting progress */}
            {currentGameStateForRender.votingActivated ? (
              <div className="space-y-3">
                {allVoted ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <p className="text-blue-600 font-semibold">כל השחקנים הצביעו</p>
                    <p className="text-sm text-muted-foreground mt-1">ממתין לתוצאות...</p>
                  </div>
                ) : currentVoter ? (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <p className="text-purple-600 font-semibold">מצביע כעת:</p>
                    <p className="text-2xl font-bold text-purple-600 mt-2">{currentVoter.name}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg text-center">
                    <p className="text-muted-foreground">ממתין להתחלת ההצבעה...</p>
                  </div>
                )}
                
                {/* Show voting progress */}
                <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <p className="text-sm font-semibold mb-2">התקדמות ההצבעה:</p>
                  <div className="space-y-1">
                    {activePlayers.map((player) => (
                      <div key={player.id} className="flex justify-between items-center text-sm">
                        <span>{player.name}:</span>
                        <span className={player.hasVoted ? 'text-green-600' : 'text-gray-400'}>
                          {player.hasVoted ? '✓ הצביע' : 'ממתין...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg text-center">
                <p className="text-muted-foreground">
                  {isAdmin ? 'לחץ על "הפעל הצבעה" כדי להתחיל' : 'ממתין למארח להתחיל הצבעה נוספת'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // CRITICAL: Check if current player is eliminated - show view-only screen
  // DYNAMIC: Show different messages based on game state
  if (currentPlayer && currentPlayer.isEliminated) {
    const eliminatedWordType = currentPlayer.wordType || 'normal';
    const isGameWon = eliminatedWordType === 'imposter' || eliminatedWordType === 'similar';
    const winnerType = eliminatedWordType === 'imposter' ? 'מתחזה' : 'מילה דומה';
    
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-red-500 border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-red-600">הודחת מהמשחק</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-4xl font-bold text-red-600 py-6"
            >
              {currentPlayer.name}
            </motion.div>
            <div className="space-y-2">
              <p className="text-lg text-muted-foreground">הודחת מהמשחק ולא יכול להצביע</p>
              <p className="text-muted-foreground">אתה יכול לצפות במשחק בלבד</p>
            </div>
            
            {/* Game won - show winner message with word revelation */}
            {isGameWon && showResults && !showWrongElimination && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-600 font-semibold text-lg">המשחק הסתיים!</p>
                  <p className="text-green-600 font-semibold">היית ה{winnerType} - הצליחו למצוא אותך!</p>
                  <p className="text-sm text-muted-foreground mt-2">ניצחון לשחקנים! 🎉</p>
                </div>
                
                {/* Reveal all words */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <p className="font-semibold mb-3">גילוי המילים:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="font-semibold">המילה הנכונה:</span>
                      <span className="text-green-600 font-bold">{currentGameStateForRender.gameWord || ''}</span>
                    </div>
                    {currentGameStateForRender.players.map((player) => (
                      <div key={player.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                        <span className="font-semibold">{player.name}:</span>
                        <span className={player.wordType === 'normal' ? 'text-blue-600' : player.wordType === 'imposter' ? 'text-red-600' : 'text-orange-600'}>
                          {player.currentWord || 'לא קיבל מילה'}
                          {player.wordType === 'imposter' && ' (מתחזה)'}
                          {player.wordType === 'similar' && ' (מילה דומה)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  onClick={() => {
                    console.log('[VotingPhase] Eliminated player - back to menu clicked - game won');
                    if (onReset) {
                      onReset();
                    } else {
                      onVoteComplete();
                    }
                  }} 
                  size="lg" 
                  className="w-full mt-4"
                >
                  חזור לתפריט
                </Button>
              </div>
            )}
            
            {/* Wrong elimination - game continues - SPECTATOR MODE */}
            {showWrongElimination && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-orange-600 font-semibold">היית שחקן רגיל</p>
                  <p className="text-orange-600 font-semibold">עדיין צריך למצוא את המתחזה/מילה דומה!</p>
                  <p className="text-sm text-muted-foreground mt-2">אתה במצב צפייה - המשחק ממשיך</p>
                </div>
                
                {/* Show current game state for spectators */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <p className="font-semibold mb-3">מצב המשחק:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="font-semibold">שחקנים פעילים:</span>
                      <span className="text-blue-600">
                        {currentGameStateForRender.players.filter(p => !p.isEliminated).length}
                      </span>
                    </div>
                    {currentGameStateForRender.votingActivated && (
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                        <span className="font-semibold">הצבעה פעילה:</span>
                        <span className="text-green-600">כן</span>
                      </div>
                    )}
                    {currentGameStateForRender.currentVotingPlayerIndex !== undefined && (
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                        <span className="font-semibold">מצביע כעת:</span>
                        <span className="text-purple-600">
                          {(() => {
                            const activePlayers = currentGameStateForRender.players.filter(p => !p.isEliminated);
                            const votingIndex = currentGameStateForRender.currentVotingPlayerIndex || 0;
                            const currentVoter = activePlayers[votingIndex];
                            return currentVoter ? currentVoter.name : 'ממתין...';
                          })()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="font-semibold">הצביעו:</span>
                      <span className="text-blue-600">
                        {currentGameStateForRender.players.filter(p => !p.isEliminated && p.hasVoted).length} / {currentGameStateForRender.players.filter(p => !p.isEliminated).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Game continues (shouldn't happen after elimination, but handle it) */}
            {showResults && !showWrongElimination && !isGameWon && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-blue-600 font-semibold">המשחק ממשיך...</p>
                <p className="text-sm text-muted-foreground mt-2">ממתין לשחקנים להצביע</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show results screens FIRST before any activation screens
  // This ensures all players see results when they're available
  
  // DYNAMIC: Check elimination result and show appropriate screen
  if (eliminatedPlayer) {
    const eliminatedWordType = eliminatedPlayer.wordType || 'normal';
    const isGameWon = eliminatedWordType === 'imposter' || eliminatedWordType === 'similar';
    
    // Game won - imposter/similar word found!
    if (isGameWon && showResults && !showWrongElimination) {
      // Mark game as completed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game as any).state.gameCompleted = true;
      
      const winnerType = eliminatedWordType === 'imposter' ? 'מתחזה' : 'מילה דומה';
      const gameWord = currentGameStateForRender.gameWord || '';
      
      // Sync game completion to server
      if (roomId && gameState.isOnline) {
        const updatedState = game.getState();
        fetch('/api/rooms/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            gameStateData: {
              currentPlayerIndex: updatedState.currentPlayerIndex,
              votingPhase: updatedState.votingPhase,
              votingActivated: updatedState.votingActivated,
              eliminatedPlayer: {
                id: eliminatedPlayer.id,
                name: eliminatedPlayer.name,
                wordType: eliminatedPlayer.wordType,
                votes: eliminatedPlayer.votes || 0
              },
              wrongElimination: false,
              isTie: false,
              playerWords: updatedState.players.reduce((acc, p) => {
                if (p.currentWord) {
                  acc[p.id.toString()] = { word: p.currentWord, type: p.wordType || 'normal' };
                }
                return acc;
              }, {} as Record<string, { word: string; type: 'normal' | 'similar' | 'imposter' }>)
            }
          })
        }).catch(error => {
          console.error('Error syncing game completion:', error);
        });
      }
      
      return (
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-green-500 border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-green-600">המשחק הסתיים!</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="text-4xl font-bold text-green-600 py-6"
                >
                  {eliminatedPlayer.name}
                </motion.div>
                <div className="space-y-2">
                  <p className="text-lg">קיבל {eliminatedPlayer.votes} קולות</p>
                  <p className="text-xl font-semibold text-green-600">היה: {winnerType}</p>
                  <p className="text-muted-foreground">השחקן הודח מהמשחק</p>
                  <p className="text-2xl font-bold text-green-600 mt-4">ניצחון! 🎉</p>
                  <p className="text-muted-foreground">הצלחתם למצוא את ה{winnerType}!</p>
                </div>
                
                {/* Reveal all words */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <p className="font-semibold mb-3">גילוי המילים:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="font-semibold">המילה הנכונה:</span>
                      <span className="text-green-600 font-bold">{gameWord}</span>
                    </div>
                    {currentGameStateForRender.players.map((player) => (
                      <div key={player.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                        <span className="font-semibold">{player.name}:</span>
                        <span className={player.wordType === 'normal' ? 'text-blue-600' : player.wordType === 'imposter' ? 'text-red-600' : 'text-orange-600'}>
                          {player.currentWord || 'לא קיבל מילה'}
                          {player.wordType === 'imposter' && ' (מתחזה)'}
                          {player.wordType === 'similar' && ' (מילה דומה)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button 
                    onClick={() => {
                      console.log('[VotingPhase] Back to menu clicked - game won');
                      if (onReset) {
                        onReset();
                      } else {
                        onVoteComplete();
                      }
                    }} 
                    size="lg" 
                    className="mt-4 w-full"
                  >
                    חזור לתפריט
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    }
    
    // Wrong elimination - innocent player eliminated
    if (showWrongElimination && eliminatedWordType === 'normal') {
      return (
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-orange-500 border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-orange-600">השחקן שהודח היה רגיל!</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="text-4xl font-bold text-orange-600 py-6"
                >
                  {eliminatedPlayer.name}
                </motion.div>
                <div className="space-y-2">
                  <p className="text-lg">קיבל {eliminatedPlayer.votes} קולות</p>
                  <p className="text-muted-foreground">השחקן הודח מהמשחק ולא יכול להצביע</p>
                  <p className="text-red-600 font-semibold">עדיין צריך למצוא את המתחזה/מילה דומה!</p>
                </div>
                {isAdmin && (
                  <Button 
                    onClick={handleContinueAfterWrongElimination} 
                    size="lg" 
                    className="mt-4"
                    disabled={isContinuing}
                  >
                    {isContinuing ? 'מעבד...' : 'הצבעה נוספת'}
                  </Button>
                )}
                {!isAdmin && (
                  <p className="text-muted-foreground">ממתין למארח להתחיל הצבעה נוספת</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    }
    
    // Correct elimination but game continues (shouldn't happen, but handle it)
    if (showResults && !showWrongElimination && !isGameWon) {
      return (
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
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
                  {eliminatedPlayer.name}
                </motion.div>
                <div className="space-y-2">
                  <p className="text-lg">קיבל {eliminatedPlayer.votes} קולות</p>
                  {eliminatedWordType && eliminatedWordType !== 'normal' && (
                    <p className="text-xl font-semibold text-green-600">
                      היה: {eliminatedWordType === 'imposter' ? 'מתחזה' : 'מילה דומה'}
                    </p>
                  )}
                  <p className="text-muted-foreground">השחקן הודח מהמשחק</p>
                </div>
                {isAdmin && (
                  <Button 
                    onClick={() => {
                      console.log('[VotingPhase] Continue after elimination clicked');
                      handleContinueAfterElimination();
                    }} 
                    size="lg" 
                    className="mt-4 w-full"
                    disabled={isContinuing}
                  >
                    {isContinuing ? 'מעבד...' : 'המשך'}
                  </Button>
                )}
                {!isAdmin && (
                  <p className="text-muted-foreground">ממתין למארח להמשיך</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    }
  }

  // Tie results screen - show tied players dynamically
  if (showTieResults) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-yellow-500 border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-yellow-600">שוויון בהצבעה!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-center text-muted-foreground">
                יש שוויון בקולות בין השחקנים הבאים:
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {tiedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="p-3 border-2 border-yellow-400 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-center"
                  >
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-muted-foreground">{player.votes || 0} קולות</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-4">
                המארח יכול להפעיל הצבעה מחדש.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={handleRevote} size="lg" className="w-full mt-4">
                הצבעה מחדש
              </Button>
            )}
            {!isAdmin && (
              <p className="text-center text-muted-foreground">
                ממתין למארח להחליט על הצבעה מחדש
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  
  // Admin activation screen (online mode only) - only show if not showing results AND no eliminated player
  // Make absolutely sure isAdmin is true - double check
  // Also check if current player has already voted - if they have, don't show activation button
  const isVotingActivatedForAdmin = currentGameStateForRender.votingActivated === true || gameState.votingActivated === true;
  const currentPlayerHasVoted = currentPlayer?.hasVoted || 
    (isBothMode && 
      (currentPlayer?.votedForImposter !== undefined || currentPlayer?.votedForImposter === null) && 
      (currentPlayer?.votedForOtherWord !== undefined || currentPlayer?.votedForOtherWord === null));
  const shouldShowAdminButton = gameState.isOnline && 
    !isVotingActivatedForAdmin && 
    isAdmin === true && 
    !hasEliminatedPlayer && 
    !hasEliminatedPlayerInState && 
    !showResults && 
    !showWrongElimination && 
    !showTieResults &&
    !currentPlayerHasVoted; // Don't show if player already voted
  if (shouldShowAdminButton) {
    return (
      <div className="max-w-2xl mx-auto relative">
        <ClassifiedStamp level="TOP SECRET" />
        <AgentScanLine />
        <Card className="relative overflow-hidden border-2 border-purple-500/30 dark:border-purple-400/50">
          <CardHeader className="text-center relative">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CardTitle className="text-3xl font-mono tracking-wider bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                הפעל הצבעה
              </CardTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-2">
                ACTIVATE VOTING PHASE
              </p>
            </motion.div>
          </CardHeader>
          <CardContent className="text-center space-y-6 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <AgentSpinner size="md" />
            </motion.div>
            <p className="text-muted-foreground">
              כל השחקנים קיבלו את המילים שלהם. לחץ כדי להתחיל את שלב ההצבעה.
            </p>
            <Button 
              onClick={handleActivateVoting} 
              size="lg"
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg text-white font-semibold"
            >
              הפעל הצבעה
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for admin to activate (online mode) - check both component state and game state
  // Only show if voting is NOT activated yet AND not showing results AND no eliminated player AND definitely not admin
  // Use the already-fetched currentGameStateForRender to avoid multiple getState() calls
  // Also check the game's internal state directly to ensure we have the latest value
  // CRITICAL: Check all possible sources to ensure we have the latest votingActivated state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameInternalVotingActivated = (game as any).state.votingActivated === true;
  const componentStateVotingActivated = gameState.votingActivated === true;
  const renderStateVotingActivated = currentGameStateForRender.votingActivated === true;
  const isVotingActivated = gameInternalVotingActivated || componentStateVotingActivated || renderStateVotingActivated;
  const shouldShowWaitingForActivation = gameState.isOnline && !isVotingActivated && isAdmin === false && !showResults && !showWrongElimination && !showTieResults && !hasEliminatedPlayer && !hasEliminatedPlayerInState;
  if (shouldShowWaitingForActivation) {
    return (
      <div className="max-w-2xl mx-auto relative">
        <ClassifiedStamp level="SECRET" />
        <AgentScanLine />
        <Card className="relative overflow-hidden border-2 border-purple-500/30 dark:border-purple-400/50">
          <CardHeader className="text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CardTitle className="text-3xl font-mono tracking-wider bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                ממתין להפעלת הצבעה
              </CardTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-2">
                AWAITING HOST AUTHORIZATION
              </p>
            </motion.div>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <AgentSpinner size="lg" message="ממתין למארח..." />
            <p className="text-muted-foreground">
              המארח צריך להפעיל את שלב ההצבעה
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show all active players (excluding current player)
  const playersToShow = activePlayers.filter(p => p.id !== currentPlayerId);
  
  // For online mode: Check if it's this player's turn to vote (sequential voting like word-getting)
  // Get currentVotingPlayerIndex directly from game state to ensure we have the latest value
  // Also check component state for the most up-to-date value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameInternalVotingIndex = (game as any).state.currentVotingPlayerIndex ?? 0;
  const componentStateVotingIndex = gameState.currentVotingPlayerIndex ?? gameInternalVotingIndex;
  const currentVotingIndex = componentStateVotingIndex !== undefined ? componentStateVotingIndex : (currentGameStateForRender.currentVotingPlayerIndex ?? gameInternalVotingIndex);
  const activePlayersForVoting = currentGameStateForRender.players.filter(p => !p.isEliminated);
  const isMyTurnToVote = gameState.isOnline 
    ? (currentVotingIndex < activePlayersForVoting.length && activePlayersForVoting[currentVotingIndex]?.id === currentPlayerId)
    : true; // Local mode: always show voting UI
  
  // Debug logging for turn detection
  if (gameState.isOnline) {
    console.log('[VotingPhase] Turn check:', {
      currentVotingIndex,
      currentPlayerId,
      currentVotingPlayerId: activePlayersForVoting[currentVotingIndex]?.id,
      isMyTurnToVote,
      hasVoted,
      activePlayersCount: activePlayersForVoting.length
    });
  }
  
  // Can vote if: not voted yet, voting is activated (for online mode), AND it's my turn (for online mode)
  // Use the already-fetched currentGameStateForRender to avoid multiple getState() calls
  // Also check the game's internal state directly to ensure we have the latest value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameInternalVotingActivatedForVote = (game as any).state.votingActivated === true;
  const isVotingActivatedForVote = gameInternalVotingActivatedForVote || currentGameStateForRender.votingActivated === true || gameState.votingActivated === true;
  const canVote = !hasVoted && (!gameState.isOnline || (isVotingActivatedForVote && isMyTurnToVote));
  
  // Show waiting screen if it's not my turn to vote (online mode only)
  // BUT: Don't show waiting screen if I've already voted - show "voted" status instead
  // ALSO: Don't show waiting screen if all players have voted - show results instead
  const hasVotedForDisplay = currentPlayer ? (
    currentPlayer.hasVoted || 
    (isBothMode && 
      (currentPlayer.votedForImposter !== undefined || currentPlayer.votedForImposter === null) && 
      (currentPlayer.votedForOtherWord !== undefined || currentPlayer.votedForOtherWord === null))
  ) : false;
  
  // Check if all players have voted
  const allPlayersVoted = game.allPlayersVoted();
  
  if (gameState.isOnline && !isMyTurnToVote && currentVotingIndex < activePlayersForVoting.length && !hasVotedForDisplay && !allPlayersVoted) {
    const currentVotingPlayer = activePlayersForVoting[currentVotingIndex];
    return (
      <div className="max-w-2xl mx-auto relative">
        <ClassifiedStamp level="SECRET" />
        <AgentScanLine />
        <Card className="relative overflow-hidden border-2 border-purple-500/30 dark:border-purple-400/50">
          <CardHeader className="text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CardTitle className="text-2xl font-mono tracking-wider bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                ממתין לתורך להצביע
              </CardTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-2">
                WAITING FOR YOUR TURN
              </p>
            </motion.div>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <AgentSpinner size="lg" message="ממתין לתורך..." />
            <div className="space-y-2">
              <p className="text-muted-foreground">
                תור של: <span className="font-bold">{currentVotingPlayer?.name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                ממתין לשחקנים אחרים להצביע...
              </p>
            </div>
            {/* Show vote status for all players */}
            <div className="flex justify-center gap-4 mt-4">
              {activePlayersForVoting.map((player) => (
                <div key={player.id} className="flex flex-col items-center gap-1">
                  <PlayerAvatar 
                    name={player.name} 
                    size="sm" 
                    isActive={player.id === currentVotingPlayer?.id}
                  />
                  <div className={`w-2 h-2 rounded-full ${player.hasVoted ? 'bg-green-500' : 'bg-orange-500'}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show "already voted" screen if player has voted but it's not their turn anymore
  // BUT: Don't show if all players have voted - show results instead
  if (gameState.isOnline && !isMyTurnToVote && hasVotedForDisplay && currentVotingIndex < activePlayersForVoting.length && !allPlayersVoted) {
    const currentVotingPlayer = activePlayersForVoting[currentVotingIndex];
    return (
      <div className="max-w-2xl mx-auto relative">
        <ClassifiedStamp level="SECRET" />
        <AgentScanLine />
        <Card className="relative overflow-hidden border-2 border-green-500/30 dark:border-green-400/50">
          <CardHeader className="text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CardTitle className="text-2xl font-mono tracking-wider bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                הצבעת
              </CardTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-2">
                VOTE CAST
              </p>
            </motion.div>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✓ הצבעת בהצלחה</p>
              <p className="text-muted-foreground">
                ממתין לשחקנים אחרים להצביע...
              </p>
              {currentVotingPlayer && (
                <p className="text-sm text-muted-foreground mt-2">
                  תור של: <span className="font-bold">{currentVotingPlayer.name}</span>
                </p>
              )}
            </div>
            {/* Show vote status for all players */}
            <div className="flex justify-center gap-4 mt-4">
              {activePlayersForVoting.map((player) => {
                const playerVoted = isBothMode
                  ? player.hasVoted && 
                    (player.votedForImposter !== undefined || player.votedForImposter === null) && 
                    (player.votedForOtherWord !== undefined || player.votedForOtherWord === null)
                  : player.hasVoted;
                return (
                  <div key={player.id} className="flex flex-col items-center gap-1">
                    <PlayerAvatar 
                      name={player.name} 
                      size="sm" 
                      isActive={player.id === currentVotingPlayer?.id}
                    />
                    <div className={`w-2 h-2 rounded-full ${playerVoted ? 'bg-green-500' : 'bg-orange-500'}`} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check voting progress for both mode
  const hasVotedImposter = currentPlayer?.votedForImposter !== undefined || currentPlayer?.votedForImposter === null;
  const hasVotedOtherWord = currentPlayer?.votedForOtherWord !== undefined || currentPlayer?.votedForOtherWord === null;
  const bothVotesComplete = isBothMode ? (hasVotedImposter && hasVotedOtherWord) : hasVoted;

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative">
      <ClassifiedStamp level="TOP SECRET" />
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {/* Display active emotes */}
      {activeEmotes.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 flex-wrap justify-center">
          {activeEmotes.map((emoteData) => (
            <motion.div
              key={emoteData.id}
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0, 1.2, 1, 0.8],
                y: [20, -20, -40, -60],
              }}
              transition={{ 
                duration: 2,
                times: [0, 0.2, 0.8, 1],
                ease: "easeOut"
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 text-sm"
            >
              <span>{emoteData.emote}</span>
              <span className="font-semibold">{emoteData.playerName}</span>
            </motion.div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            שלב ההצבעה
          </CardTitle>
          {isBothMode && (
            <p className="text-muted-foreground mt-2">
              יש לך 2 קולות: אחד למתחזה ואחד למילה דומה
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Current Player Info */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg text-center">
            <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
              <PlayerAvatar 
                name={currentPlayer?.name || ''} 
                size="md" 
                isActive={true}
                profilePhotoUrl={currentPlayer ? getPlayerProfilePhoto(currentPlayer.name) : null}
              />
              <div className="flex-1 min-w-0">
                <AgentBadge 
                  agentName={currentPlayer?.name || ''} 
                  agentNumber={currentPlayerId}
                  size="sm"
                />
              </div>
              <EmotePicker onEmoteSelect={handleEmote} />
            </div>
            {bothVotesComplete && (
              <p className="text-sm text-green-600 mt-2">✓ הצבעת</p>
            )}
            {isBothMode && !bothVotesComplete && (
              <div className="mt-2 space-y-1">
                {hasVotedImposter && <p className="text-xs text-green-600">✓ הצבעת למתחזה</p>}
                {hasVotedOtherWord && <p className="text-xs text-green-600">✓ הצבעת למילה דומה</p>}
                {!hasVotedImposter && <p className="text-xs text-orange-600">✗ עדיין צריך להצביע למתחזה</p>}
                {!hasVotedOtherWord && <p className="text-xs text-orange-600">✗ עדיין צריך להצביע למילה דומה</p>}
              </div>
            )}
          </div>

          {/* Voting Section - Both Mode */}
          {isBothMode && !bothVotesComplete && canVote && (
            <>
              {playersToShow.length > 0 ? (
                <div className="space-y-6">
                  {/* Imposter Vote */}
                  {!hasVotedImposter && (
                    <div className="space-y-4 p-4 border-2 border-red-200 rounded-lg">
                      <h3 className="text-lg font-semibold text-center text-red-600">
                        בחר שחקן למתחזה:
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {playersToShow.map((player) => (
                          <motion.button
                            key={player.id}
                            onClick={() => setSelectedImposterTarget(player.id)}
                            className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 ${
                              selectedImposterTarget === player.id
                                ? 'border-red-500 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 scale-105 shadow-lg'
                                : 'border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600'
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={selectedOtherWordTarget === player.id}
                          >
                            <PlayerAvatar 
                              name={player.name} 
                              size="md" 
                              isEliminated={player.isEliminated}
                              profilePhotoUrl={getPlayerProfilePhoto(player.name)}
                            />
                            <div className="font-semibold">{player.name}</div>
                            {selectedOtherWordTarget === player.id && (
                              <div className="text-xs text-muted-foreground mt-1">
                                כבר בחרת למילה דומה
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleVote('imposter')}
                          disabled={!selectedImposterTarget || selectedOtherWordTarget === selectedImposterTarget || !canVote}
                          className="flex-1"
                          size="lg"
                        >
                          הצבע למתחזה
                        </Button>
                        <Button
                          onClick={() => handleVote('imposter', true)}
                          disabled={!canVote}
                          variant="outline"
                          className="flex-1"
                          size="lg"
                        >
                          דלג
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Other Word Vote */}
                  {!hasVotedOtherWord && (
                    <div className="space-y-4 p-4 border-2 border-blue-200 rounded-lg">
                      <h3 className="text-lg font-semibold text-center text-blue-600">
                        בחר שחקן למילה דומה:
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {playersToShow.map((player) => (
                          <motion.button
                            key={player.id}
                            onClick={() => setSelectedOtherWordTarget(player.id)}
                            className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 ${
                              selectedOtherWordTarget === player.id
                                ? 'border-blue-500 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 scale-105 shadow-lg'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={selectedImposterTarget === player.id}
                          >
                            <PlayerAvatar 
                              name={player.name} 
                              size="md" 
                              isEliminated={player.isEliminated}
                              profilePhotoUrl={getPlayerProfilePhoto(player.name)}
                            />
                            <div className="font-semibold">{player.name}</div>
                            {selectedImposterTarget === player.id && (
                              <div className="text-xs text-muted-foreground mt-1">
                                כבר בחרת למתחזה
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleVote('other-word')}
                          disabled={!selectedOtherWordTarget || selectedImposterTarget === selectedOtherWordTarget || !canVote}
                          className="flex-1"
                          size="lg"
                        >
                          הצבע למילה דומה
                        </Button>
                        <Button
                          onClick={() => handleVote('other-word', true)}
                          disabled={!canVote}
                          variant="outline"
                          className="flex-1"
                          size="lg"
                        >
                          דלג
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <p>אין שחקנים אחרים להצביע עבורם</p>
                </div>
              )}
            </>
          )}

          {/* Voting Section - Normal Mode */}
          {!isBothMode && canVote && (
            <>
              {playersToShow.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center mb-4">
                    בחר שחקן להדחה:
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {playersToShow.map((player) => (
                      <motion.button
                        key={player.id}
                        onClick={() => setSelectedTarget(player.id)}
                        className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 ${
                          selectedTarget === player.id
                            ? 'border-purple-500 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 scale-105 shadow-lg'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <PlayerAvatar 
                          name={player.name} 
                          size="md" 
                          isEliminated={player.isEliminated}
                          profilePhotoUrl={getPlayerProfilePhoto(player.name)}
                        />
                        <div className="font-semibold">{player.name}</div>
                        {showVoteCounts && player.votes !== undefined && player.votes > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {player.votes} קולות
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
              
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => {
                        console.log('[VotingPhase] Vote button clicked:', {
                          selectedTarget,
                          canVote,
                          hasVoted,
                          isVotingActivatedForVote,
                          isMyTurnToVote,
                          currentVotingIndex,
                          currentPlayerId
                        });
                        handleVote();
                      }}
                      disabled={!selectedTarget || !canVote}
                      className="flex-1"
                      size="lg"
                    >
                      הצבע
                    </Button>
                    <Button
                      onClick={() => handleVote(undefined, true)}
                      disabled={!canVote}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      דלג
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <p>אין שחקנים אחרים להצביע עבורם</p>
                </div>
              )}
            </>
          )}

          {/* Real-time Vote Counts (only for local mode or if admin) */}
          {showVoteCounts && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4 text-center">ספירת קולות:</h3>
              <div className="space-y-2">
                {votingResults.map((result, index) => (
                  <motion.div
                    key={result.player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      index === 0 && result.votes > 0
                        ? 'bg-red-50 border-2 border-red-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{result.player.name}</span>
                      {result.player.isEliminated && (
                        <span className="text-xs text-red-600">(הודח)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{result.votes}</span>
                      <span className="text-sm text-muted-foreground">קולות</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting for other players */}
          {bothVotesComplete && !game.allPlayersVoted() && (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                ממתין לשחקנים אחרים להצביע...
              </p>
              <div className="mt-4">
                <div className="flex justify-center gap-2">
                  {activePlayers.map((player) => {
                    const playerVoted = isBothMode
                      ? player.hasVoted && player.votedForImposter !== undefined && player.votedForOtherWord !== undefined
                      : player.hasVoted;
                    return (
                      <div key={player.id} className="flex flex-col items-center gap-1" title={player.name}>
                        <PlayerAvatar 
                          name={player.name} 
                          size="sm"
                          profilePhotoUrl={getPlayerProfilePhoto(player.name)}
                        />
                        <div className={`w-2 h-2 rounded-full ${
                          playerVoted ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}