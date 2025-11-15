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

interface VotingPhaseProps {
  game: WordGame;
  currentPlayerId: number; // The player who is currently voting
  onVoteComplete: () => void;
  isAdmin?: boolean; // Whether current player is admin (for online mode)
  roomId?: string; // For online mode - room ID for real-time sync
  currentPlayerIdString?: string; // For online mode - the string player ID
}

export default function VotingPhase({ game, currentPlayerId, onVoteComplete, isAdmin = false, roomId, currentPlayerIdString }: VotingPhaseProps) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedImposterTarget, setSelectedImposterTarget] = useState<number | null>(null);
  const [selectedOtherWordTarget, setSelectedOtherWordTarget] = useState<number | null>(null);
  const [gameState, setGameState] = useState(game.getState());
  const [showResults, setShowResults] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<Player | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tiedPlayers, setTiedPlayers] = useState<Player[]>([]);
  const [showTieResults, setShowTieResults] = useState(false);
  const [showWrongElimination, setShowWrongElimination] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<Array<{ id: number; emote: EmoteType; playerName: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleVote = async (voteType?: 'imposter' | 'other-word') => {
    const target = voteType 
      ? (voteType === 'imposter' ? selectedImposterTarget : selectedOtherWordTarget)
      : selectedTarget;
    
    if (!target) return;
    
    // Prevent voting if not activated (for online mode) - check both states
    if (gameState.isOnline) {
      const currentState = game.getState();
      const isActivated = currentState.votingActivated === true || gameState.votingActivated === true;
      if (!isActivated) return;
    }
    
    const success = game.castVote(currentPlayerId, target, voteType);
    if (success) {
      const newState = game.getState();
      setGameState(newState);
      
      // Sync vote to server for online games
      if (roomId && gameState.isOnline) {
        try {
          // Get current votes from all players
          const votes: Record<string, { voterId: number; targetId: number; voteType?: 'imposter' | 'other-word' }> = {};
          newState.players.forEach(player => {
            if (player.hasVoted || player.votedForImposter !== undefined || player.votedForOtherWord !== undefined) {
              if (newState.gameMode === 'mixed') {
                if (player.votedForImposter !== undefined) {
                  votes[`${player.id}_imposter`] = { voterId: player.id, targetId: player.votedForImposter, voteType: 'imposter' };
                }
                if (player.votedForOtherWord !== undefined) {
                  votes[`${player.id}_other`] = { voterId: player.id, targetId: player.votedForOtherWord, voteType: 'other-word' };
                }
              } else if (player.votedFor !== undefined) {
                votes[player.id.toString()] = { voterId: player.id, targetId: player.votedFor };
              }
            }
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
        ? (currentPlayer?.votedForImposter !== undefined && currentPlayer?.votedForOtherWord !== undefined)
        : currentPlayer?.hasVoted;
      
      if (isComplete && !newState.isOnline) {
        // In local mode, immediately trigger vote complete to show next player
        setTimeout(() => {
          onVoteComplete();
        }, 300);
      }
      
      // Check if all players have voted (for online mode, check after sync)
      if (newState.isOnline && isComplete) {
        // Wait a bit for server sync, then check if all voted
        setTimeout(() => {
          if (game.allPlayersVoted() && !showResults && !showTieResults && !showWrongElimination) {
            handleCalculateResults();
          }
        }, 600);
      }
      
      if (voteType === 'imposter') {
        setSelectedImposterTarget(null);
      } else if (voteType === 'other-word') {
        setSelectedOtherWordTarget(null);
      } else {
        setSelectedTarget(null);
      }
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
    
    const result = game.calculateVotingResult();
    const newState = game.getState();
    setGameState(newState);
    
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
  }, [game, roomId, gameState.isOnline]);

  const handleRevote = async () => {
    game.revote();
    const newState = game.getState();
    // Reset voting activation so admin needs to activate again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.votingActivated = false;
    const updatedState = game.getState();
    setGameState(updatedState);
    setShowTieResults(false);
    setTiedPlayers([]);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
    
    // Sync revote to server
    if (roomId && gameState.isOnline) {
      try {
        await fetch('/api/rooms/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            gameStateData: {
              currentPlayerIndex: updatedState.currentPlayerIndex,
              votingPhase: updatedState.votingPhase,
              votingActivated: false, // Reset activation
              isTie: false,
              wrongElimination: false,
              eliminatedPlayer: undefined,
              votes: {},
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
        console.error('Error syncing revote:', error);
      }
    }
  };

  const handleContinueAfterWrongElimination = async () => {
    game.continueAfterWrongElimination();
    const newState = game.getState();
    setGameState(newState);
    setShowWrongElimination(false);
    setEliminatedPlayer(null);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
    
    // Sync continue after wrong elimination to server
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
              wrongElimination: false,
              eliminatedPlayer: undefined,
              votes: {},
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
        console.error('Error syncing continue after wrong elimination:', error);
      }
    }
  };

  const handleActivateVoting = async () => {
    game.activateVoting();
    const newState = game.getState();
    setGameState(newState);
    
    // Sync voting activation to server for online games
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
        console.error('Error syncing voting activation:', error);
      }
    }
  };

  // Real-time sync for online games
  useEffect(() => {
    if (!roomId || !gameState.isOnline) return;
    
    const syncGameState = async () => {
      try {
        const response = await fetch(`/api/rooms/game-state?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.room?.gameStateData) {
            const serverState = data.room.gameStateData;
            let stateChanged = false;
            
            // Sync voting activation - always sync when server has a value
            if (serverState.votingActivated !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const currentActivated = (game as any).state.votingActivated;
              if (serverState.votingActivated !== currentActivated) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (game as any).state.votingActivated = serverState.votingActivated;
                if (serverState.votingActivated && !gameState.votingPhase) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (game as any).state.votingPhase = true;
                }
                stateChanged = true;
              }
            }
            
            // Sync votes from server
            if (serverState.votes !== undefined) {
              const currentState = game.getState();
              
              // If votes object is empty (revote), reset everything and hide tie screen
              if (Object.keys(serverState.votes).length === 0) {
                // Hide tie screen if it's showing (revote was triggered)
                if (showTieResults) {
                  setShowTieResults(false);
                  setTiedPlayers([]);
                }
                currentState.players.forEach(p => {
                  p.votes = 0;
                  if (!p.isEliminated) {
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                  }
                });
                stateChanged = true;
              } else {
                // Reset vote counts and voting status first
                currentState.players.forEach(p => {
                  p.votes = 0;
                  if (!p.isEliminated) {
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                  }
                });
                
                // Apply votes from server and recalculate vote counts
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
                      // Mark as voted if both votes are cast
                      if (voter.votedForImposter !== undefined && voter.votedForOtherWord !== undefined) {
                        voter.hasVoted = true;
                      }
                    } else if (!vote.voteType) {
                      voter.votedFor = vote.targetId;
                      voter.hasVoted = true;
                    }
                    
                    // Update target player's vote count (only if target is not eliminated)
                    const target = currentState.players.find(p => p.id === vote.targetId);
                    if (target && !target.isEliminated) {
                      if (target.votes === undefined) target.votes = 0;
                      target.votes++;
                    }
                    
                    stateChanged = true;
                  }
                });
              }
            }
            
            // Sync voting results from server - tie state
            if (serverState.isTie !== undefined) {
              const shouldShowTie = serverState.isTie === true;
              if (shouldShowTie && !showTieResults) {
                // Show tie results
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
            
            // Sync eliminated player state
            if (serverState.eliminatedPlayer !== undefined) {
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
              } else if (!showResults && !showWrongElimination && !showTieResults) {
                // Set eliminated player
                const currentState = game.getState();
                const eliminated = currentState.players.find(p => p.id === serverState.eliminatedPlayer.id);
                if (eliminated) {
                  eliminated.isEliminated = true;
                  eliminated.votes = serverState.eliminatedPlayer.votes || 0;
                  setEliminatedPlayer(eliminated);
                  
                  if (serverState.wrongElimination) {
                    setShowWrongElimination(true);
                  } else {
                    setShowResults(true);
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
    
    const interval = setInterval(syncGameState, 500); // Poll every 500ms for faster updates
    return () => clearInterval(interval);
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
      const interval = setInterval(async () => {
        if (!roomId) return;
        
        try {
          const response = await fetch(`/api/rooms/game-state?roomId=${roomId}`);
          if (response.ok) {
            const data = await response.json();
            const serverState = data.room.gameStateData;
            
            // If server already has results (eliminatedPlayer), don't check votes - results are already calculated
            if (serverState.eliminatedPlayer !== undefined && serverState.eliminatedPlayer !== null) {
              // Results already exist on server, skip vote checking
              return;
            }
            
            if (serverState.votes) {
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
                currentState.players.forEach(p => {
                  p.votes = 0;
                  if (!p.isEliminated) {
                    p.hasVoted = false;
                    p.votedFor = undefined;
                    p.votedForImposter = undefined;
                    p.votedForOtherWord = undefined;
                  }
                });
                
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
                      if (voter.votedForImposter !== undefined && voter.votedForOtherWord !== undefined) {
                        voter.hasVoted = true;
                      }
                    } else if (!vote.voteType) {
                      voter.votedFor = vote.targetId;
                      voter.hasVoted = true;
                    }
                    
                    const target = currentState.players.find(p => p.id === vote.targetId);
                    if (target && !target.isEliminated) {
                      if (target.votes === undefined) target.votes = 0;
                      target.votes++;
                    }
                  }
                });
                
                // Now calculate results since local state is synced
                handleCalculateResults();
              }
            }
          }
        } catch (error) {
          console.error('Error checking voting completion:', error);
        }
      }, 500); // Check every 500ms for updates

      return () => clearInterval(interval);
    }
  }, [game, showResults, handleCalculateResults, showTieResults, showWrongElimination, gameState.isOnline, roomId]);

  const handleContinueAfterElimination = async () => {
    // Use the game's continueAfterWrongElimination method to properly reset state
    game.continueAfterWrongElimination();
    const newState = game.getState();
    // Reset voting activation so admin needs to activate again for next round
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).state.votingActivated = false;
    const updatedState = game.getState();
    setGameState(updatedState);
    setShowResults(false);
    setEliminatedPlayer(null);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
    
    // Sync continue after elimination to server
    if (roomId && gameState.isOnline) {
      try {
        await fetch('/api/rooms/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            gameStateData: {
              currentPlayerIndex: updatedState.currentPlayerIndex,
              votingPhase: updatedState.votingPhase,
              votingActivated: false, // Reset activation for next round
              wrongElimination: false,
              eliminatedPlayer: undefined,
              votes: {},
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
        console.error('Error syncing continue after elimination:', error);
      }
    }
    
    // Don't call onVoteComplete - just let the component re-render with cleared state
    // The voting phase will continue automatically
  };

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  const votingResults = game.getVotingResults();
  const hasVoted = currentPlayer?.hasVoted || false;
  const isBothMode = gameState.gameMode === 'mixed';
  const showVoteCounts = gameState.showVoteCounts; // false for online, true for local

  // Admin activation screen (online mode only)
  if (gameState.isOnline && !gameState.votingActivated && isAdmin) {
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
  const currentGameState = game.getState();
  const isVotingActivated = currentGameState.votingActivated === true || gameState.votingActivated === true;
  if (gameState.isOnline && !isVotingActivated && !isAdmin) {
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

  // Wrong elimination screen
  if (showWrongElimination && eliminatedPlayer) {
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
                <Button onClick={handleContinueAfterWrongElimination} size="lg" className="mt-4">
                  הצבעה נוספת
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

  // Tie results screen - simplified, just revote option
  if (showTieResults) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-yellow-500 border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-yellow-600">שוויון בהצבעה!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              יש שוויון בקולות. המארח יכול להפעיל הצבעה מחדש.
            </p>
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

  // Correct elimination screen
  if (showResults && eliminatedPlayer) {
    const eliminationType = eliminatedPlayer.wordType;
    const typeText = eliminationType === 'imposter' 
      ? 'מתחזה' 
      : eliminationType === 'similar' 
        ? 'מילה דומה' 
        : 'רגיל';
    const isCorrectElimination = eliminationType === 'imposter' || eliminationType === 'similar';
    
    return (
      <div className="max-w-2xl mx-auto relative">
        {isCorrectElimination && <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className={`border-2 ${eliminationType === 'normal' ? 'border-orange-500' : 'border-red-500'}`}>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-red-600">השחקן הודח!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <PlayerAvatar name={eliminatedPlayer.name} size="lg" isEliminated={true} />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-4xl font-bold text-red-600 py-6"
              >
                {eliminatedPlayer.name}
              </motion.div>
              {isCorrectElimination && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className="text-6xl mb-4"
                >
                  🎉
                </motion.div>
              )}
              <div className="space-y-2">
                <p className="text-lg">קיבל {eliminatedPlayer.votes} קולות</p>
                {isBothMode && (
                  <p className="text-lg font-semibold">
                    היה: {typeText}
                  </p>
                )}
                {!isBothMode && eliminationType !== 'normal' && (
                  <p className="text-lg font-semibold">
                    היה: {typeText}
                  </p>
                )}
                <p className="text-muted-foreground">השחקן הודח מהמשחק</p>
              </div>
              <Button onClick={handleContinueAfterElimination} size="lg" className="mt-4">
                המשך
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show all active players (excluding current player)
  const playersToShow = activePlayers.filter(p => p.id !== currentPlayerId);
  
  // Can vote if not voted yet and voting is activated (for online mode) - check both states
  const currentGameStateForVote = game.getState();
  const isVotingActivatedForVote = currentGameStateForVote.votingActivated === true || gameState.votingActivated === true;
  const canVote = !hasVoted && (!gameState.isOnline || isVotingActivatedForVote);

  // Check voting progress for both mode
  const hasVotedImposter = currentPlayer?.votedForImposter !== undefined;
  const hasVotedOtherWord = currentPlayer?.votedForOtherWord !== undefined;
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
              <PlayerAvatar name={currentPlayer?.name || ''} size="md" isActive={true} />
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
                            <PlayerAvatar name={player.name} size="md" isEliminated={player.isEliminated} />
                            <div className="font-semibold">{player.name}</div>
                            {selectedOtherWordTarget === player.id && (
                              <div className="text-xs text-muted-foreground mt-1">
                                כבר בחרת למילה דומה
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      <Button
                        onClick={() => handleVote('imposter')}
                        disabled={!selectedImposterTarget || selectedOtherWordTarget === selectedImposterTarget}
                        className="w-full"
                        size="lg"
                      >
                        הצבע למתחזה
                      </Button>
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
                            <PlayerAvatar name={player.name} size="md" isEliminated={player.isEliminated} />
                            <div className="font-semibold">{player.name}</div>
                            {selectedImposterTarget === player.id && (
                              <div className="text-xs text-muted-foreground mt-1">
                                כבר בחרת למתחזה
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      <Button
                        onClick={() => handleVote('other-word')}
                        disabled={!selectedOtherWordTarget || selectedImposterTarget === selectedOtherWordTarget}
                        className="w-full"
                        size="lg"
                      >
                        הצבע למילה דומה
                      </Button>
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
                        <PlayerAvatar name={player.name} size="md" isEliminated={player.isEliminated} />
                        <div className="font-semibold">{player.name}</div>
                        {showVoteCounts && player.votes !== undefined && player.votes > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {player.votes} קולות
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
              
                  <Button
                    onClick={() => handleVote()}
                    disabled={!selectedTarget}
                    className="w-full mt-4"
                    size="lg"
                  >
                    הצבע
                  </Button>
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
                        <PlayerAvatar name={player.name} size="sm" />
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