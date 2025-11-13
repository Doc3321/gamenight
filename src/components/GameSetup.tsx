'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GameMode } from '@/lib/gameLogic';

interface Player {
  id: number;
  name: string;
}

interface GameSetupProps {
  selectedTopic: string;
  onStartGame: (gameMode: GameMode, players: Player[]) => void;
  onBack: () => void;
}

export default function GameSetup({ selectedTopic, onStartGame, onBack }: GameSetupProps) {
  const [gameMode, setGameMode] = useState<GameMode>('similar-word');
  const [numPlayers, setNumPlayers] = useState<number>(3);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' }
  ]);

  const handleNumPlayersChange = (value: string) => {
    const num = parseInt(value);
    setNumPlayers(num);
    // Update players array
    const newPlayers: Player[] = [];
    for (let i = 1; i <= num; i++) {
      newPlayers.push({
        id: i,
        name: players.find(p => p.id === i)?.name || ''
      });
    }
    setPlayers(newPlayers);
  };

  const handlePlayerNameChange = (id: number, name: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const handleStart = () => {
    // Validate all players have names
    if (players.some(p => !p.name.trim())) {
      alert('אנא הזן שם לכל השחקנים');
      return;
    }
    onStartGame(gameMode, players);
  };

  const gameModeOptions = [
    { value: 'similar-word' as GameMode, label: 'מילה דומה', description: '1 מילה דומה, השאר מילה רגילה' },
    { value: 'imposter' as GameMode, label: 'מתחזה', description: '1 מתחזה, השאר מילה רגילה' },
    { value: 'mixed' as GameMode, label: 'מעורב', description: '1 מילה דומה + 1 מתחזה, השאר מילה רגילה' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">הגדרת משחק</CardTitle>
            <p className="text-muted-foreground">הגדר את המשחק לפני התחלה</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Game Mode Selection */}
            <div>
              <Label className="text-base font-semibold mb-3 block">בחר סוג משחק:</Label>
              <div className="grid grid-cols-1 gap-3">
                {gameModeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setGameMode(option.value)}
                    className={`p-4 border-2 rounded-lg text-right transition-all ${
                      gameMode === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Players */}
            <div>
              <Label htmlFor="numPlayers" className="text-base font-semibold mb-2 block">
                מספר שחקנים:
              </Label>
              <Select value={numPlayers.toString()} onValueChange={handleNumPlayersChange}>
                <SelectTrigger id="numPlayers">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} שחקנים
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player Names */}
            <div>
              <Label className="text-base font-semibold mb-3 block">שמות השחקנים:</Label>
              <div className="space-y-3">
                {players.map((player) => (
                  <div key={player.id}>
                    <Label htmlFor={`player-${player.id}`}>
                      שחקן {player.id}:
                    </Label>
                    <Input
                      id={`player-${player.id}`}
                      value={player.name}
                      onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                      placeholder={`הזן שם לשחקן ${player.id}`}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={onBack} variant="outline" className="flex-1">
                חזור
              </Button>
              <Button onClick={handleStart} className="flex-1" size="lg">
                התחל משחק
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
