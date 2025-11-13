'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WordGame, Player } from '@/lib/gameLogic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface VotingPhaseProps {
  game: WordGame;
  currentPlayerId: number; // The player who is currently voting
  onVoteComplete: () => void;
}

export default function VotingPhase({ game, currentPlayerId, onVoteComplete }: VotingPhaseProps) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [gameState, setGameState] = useState(game.getState());
  const [showResults, setShowResults] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<Player | null>(null);
  const [isTieBreak, setIsTieBreak] = useState(false);
  const [tiedPlayers, setTiedPlayers] = useState<Player[]>([]);

  const handleVote = () => {
    if (!selectedTarget) return;
    
    const success = game.castVote(currentPlayerId, selectedTarget);
    if (success) {
      setGameState(game.getState());
    }
  };

  const handleCalculateResults = useCallback(() => {
    const result = game.calculateVotingResult();
    setGameState(game.getState());
    
    if (result.isTie) {
      // Start tie-break vote
      setIsTieBreak(true);
      setTiedPlayers(result.tiedPlayers);
      const tiedIds = result.tiedPlayers.map(p => p.id);
      game.startTieBreakVote(tiedIds);
      setGameState(game.getState());
      setSelectedTarget(null);
    } else {
      // Show eliminated player
      setShowResults(true);
      setEliminatedPlayer(result.eliminated);
    }
  }, [game]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newState = game.getState();
      setGameState(newState);
      
      // Check if all players have voted
      const tiedIds = isTieBreak ? tiedPlayers.map(p => p.id) : undefined;
      if (game.allPlayersVoted(tiedIds) && !showResults) {
        if (isTieBreak) {
          // Handle tie-break results
          const result = game.calculateVotingResult();
          if (!result.isTie) {
            setShowResults(true);
            setEliminatedPlayer(result.eliminated);
          } else {
            // Still tied, continue tie-break
            const newTiedIds = result.tiedPlayers.map(p => p.id);
            setTiedPlayers(result.tiedPlayers);
            game.startTieBreakVote(newTiedIds);
            setGameState(game.getState());
            setSelectedTarget(null);
          }
        } else {
          handleCalculateResults();
        }
      }
    }, 500); // Check every 500ms for updates

    return () => clearInterval(interval);
  }, [game, showResults, isTieBreak, tiedPlayers, handleCalculateResults]);

  const handleContinueAfterElimination = () => {
    onVoteComplete();
  };

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  const votingResults = game.getVotingResults();
  const hasVoted = currentPlayer?.hasVoted || false;

  // If showing results (eliminated player)
  if (showResults && eliminatedPlayer) {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        </CardHeader>
        <CardContent>
          {/* Current Player Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">השחקן שלך:</p>
            <p className="text-xl font-bold">{currentPlayer?.name}</p>
            {hasVoted && (
              <p className="text-sm text-green-600 mt-2">✓ הצבעת</p>
            )}
            {isTieBreak && !tiedPlayers.some(tp => tp.id === currentPlayerId) && (
              <p className="text-sm text-orange-600 mt-2">
                אינך חלק מהשוויון, ממתין לתוצאות
              </p>
            )}
          </div>

          {/* Voting Section */}
          {canVote && playersToShow.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center mb-4">
                בחר שחקן להדחה:
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {playersToShow.map((player) => (
                  <motion.button
                    key={player.id}
                    onClick={() => setSelectedTarget(player.id)}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedTarget === player.id
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="font-semibold">{player.name}</div>
                    {player.votes !== undefined && player.votes > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {player.votes} קולות
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
              
              <Button
                onClick={handleVote}
                disabled={!selectedTarget}
                className="w-full mt-4"
                size="lg"
              >
                הצבע
              </Button>
            </div>
          )}

          {/* Real-time Vote Counts */}
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

          {/* Waiting for other players */}
          {hasVoted && !game.allPlayersVoted() && (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                ממתין לשחקנים אחרים להצביע...
              </p>
              <div className="mt-4">
                <div className="flex justify-center gap-2">
                  {activePlayers.map((player) => (
                    <div
                      key={player.id}
                      className={`w-3 h-3 rounded-full ${
                        player.hasVoted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={player.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
