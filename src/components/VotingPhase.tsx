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
  const [isTieBreak, setIsTieBreak] = useState(false);
  const [tiedPlayers, setTiedPlayers] = useState<Player[]>([]);
  const [showTieResults, setShowTieResults] = useState(false);
  const [showWrongElimination, setShowWrongElimination] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<Array<{ id: number; emote: EmoteType; playerName: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleVote = (voteType?: 'imposter' | 'other-word') => {
    const target = voteType 
      ? (voteType === 'imposter' ? selectedImposterTarget : selectedOtherWordTarget)
      : selectedTarget;
    
    if (!target) return;
    
    const success = game.castVote(currentPlayerId, target, voteType);
    if (success) {
      const newState = game.getState();
      setGameState(newState);
      
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

  const handleCalculateResults = useCallback(() => {
    const result = game.calculateVotingResult();
    setGameState(game.getState());
    
    if (result.isTie) {
      // Show tie results (anonymous vote counts)
      setIsTieBreak(true);
      setTiedPlayers(result.tiedPlayers);
      setShowTieResults(true);
    } else if (result.wasWrong) {
      // Wrong elimination
      setShowWrongElimination(true);
      setEliminatedPlayer(result.eliminated);
    } else {
      // Correct elimination - show confetti if imposter/other word found
      if (result.eliminated && (result.eliminated.wordType === 'imposter' || result.eliminated.wordType === 'similar')) {
        setShowConfetti(true);
      }
      setShowResults(true);
      setEliminatedPlayer(result.eliminated);
    }
  }, [game]);

  const handleRevote = () => {
    game.revote();
    setGameState(game.getState());
    setShowTieResults(false);
    setIsTieBreak(false);
    setTiedPlayers([]);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
  };

  const handleContinueAfterWrongElimination = () => {
    game.continueAfterWrongElimination();
    setGameState(game.getState());
    setShowWrongElimination(false);
    setEliminatedPlayer(null);
    setSelectedTarget(null);
    setSelectedImposterTarget(null);
    setSelectedOtherWordTarget(null);
  };

  const handleActivateVoting = () => {
    game.activateVoting();
    setGameState(game.getState());
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
            // Sync emotes
            if (data.room.gameStateData.emotes) {
              const recentEmotes = data.room.gameStateData.emotes
                .filter((e: { timestamp: number }) => Date.now() - e.timestamp < 5000)
                .map((e: { playerId: number; emote: string }) => {
                  const player = gameState.players.find(p => p.id === e.playerId);
                  return {
                    id: e.playerId * 1000 + e.timestamp,
                    emote: e.emote as EmoteType,
                    playerName: player?.name || 'Unknown'
                  };
                });
              setActiveEmotes(recentEmotes);
            }
          }
        }
      } catch (error) {
        console.error('Error syncing game state:', error);
      }
    };
    
    const interval = setInterval(syncGameState, 1000); // Poll every second
    return () => clearInterval(interval);
  }, [roomId, gameState.isOnline, gameState.players]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newState = game.getState();
      setGameState(newState);
      
      // Check if all players have voted
      const tiedIds = isTieBreak ? tiedPlayers.map(p => p.id) : undefined;
      if (game.allPlayersVoted(tiedIds) && !showResults && !showTieResults && !showWrongElimination) {
        if (isTieBreak) {
          // Handle tie-break results
          const result = game.calculateVotingResult();
          if (!result.isTie) {
            if (result.wasWrong) {
              setShowWrongElimination(true);
              setEliminatedPlayer(result.eliminated);
            } else {
              setShowResults(true);
              setEliminatedPlayer(result.eliminated);
            }
          } else {
            // Still tied, continue tie-break
            const newTiedIds = result.tiedPlayers.map(p => p.id);
            setTiedPlayers(result.tiedPlayers);
            game.startTieBreakVote(newTiedIds);
            setGameState(game.getState());
            setSelectedTarget(null);
            setSelectedImposterTarget(null);
            setSelectedOtherWordTarget(null);
          }
        } else {
          handleCalculateResults();
        }
      }
    }, 500); // Check every 500ms for updates

    return () => clearInterval(interval);
  }, [game, showResults, isTieBreak, tiedPlayers, handleCalculateResults, showTieResults, showWrongElimination]);

  const handleContinueAfterElimination = () => {
    onVoteComplete();
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
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">הפעל הצבעה</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              כל השחקנים קיבלו את המילים שלהם. לחץ כדי להתחיל את שלב ההצבעה.
            </p>
            <Button onClick={handleActivateVoting} size="lg">
              הפעל הצבעה
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for admin to activate (online mode)
  if (gameState.isOnline && !gameState.votingActivated && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">ממתין להפעלת הצבעה</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
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

  // Tie results screen (anonymous vote counts)
  if (showTieResults && isTieBreak) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-yellow-500 border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-yellow-600">שוויון בהצבעה!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              יש שוויון בקולות. ספירת הקולות (ללא שמות):
            </p>
            <div className="space-y-2">
              {votingResults
                .filter(r => tiedPlayers.some(tp => tp.id === r.player.id))
                .map((result, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <span className="text-sm text-muted-foreground">שחקן #{index + 1}</span>
                    <span className="text-lg font-bold">{result.votes} קולות</span>
                  </div>
                ))}
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

  // If tie-break, show only tied players (excluding current player)
  const playersToShow = isTieBreak 
    ? activePlayers.filter(p => 
        tiedPlayers.some(tp => tp.id === p.id) && p.id !== currentPlayerId
      )
    : activePlayers.filter(p => p.id !== currentPlayerId);
  
  // In tie-break, only tied players can vote
  const canVote = isTieBreak 
    ? tiedPlayers.some(tp => tp.id === currentPlayerId) && !hasVoted
    : !hasVoted;

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
            {isTieBreak ? `סיבוב הצבעה ${gameState.votingRound} - שבירת שוויון` : 'שלב ההצבעה'}
          </CardTitle>
          {isTieBreak && (
            <p className="text-muted-foreground mt-2">
              יש שוויון! הצביעו רק בין השחקנים הקשורים
            </p>
          )}
          {isBothMode && !isTieBreak && (
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
            {isTieBreak && !tiedPlayers.some(tp => tp.id === currentPlayerId) && (
              <p className="text-sm text-orange-600 mt-2">
                אינך חלק מהשוויון, ממתין לתוצאות
              </p>
            )}
          </div>

          {/* Voting Section - Both Mode */}
          {isBothMode && !isTieBreak && !bothVotesComplete && playersToShow.length > 0 && (
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
          )}

          {/* Voting Section - Normal Mode */}
          {!isBothMode && canVote && playersToShow.length > 0 && (
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