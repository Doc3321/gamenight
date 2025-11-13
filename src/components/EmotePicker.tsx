'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Smile, ThumbsUp, Heart, Flame, Hand, PartyPopper } from 'lucide-react';

export type EmoteType = '👍' | '❤️' | '🔥' | '👏' | '🎉' | '😊';

interface EmotePickerProps {
  onEmoteSelect: (emote: EmoteType) => void;
  disabled?: boolean;
}

const emotes: { type: EmoteType; icon: React.ReactNode; label: string }[] = [
  { type: '👍', icon: <ThumbsUp className="w-5 h-5" />, label: 'Thumbs Up' },
  { type: '❤️', icon: <Heart className="w-5 h-5" />, label: 'Heart' },
  { type: '🔥', icon: <Flame className="w-5 h-5" />, label: 'Fire' },
  { type: '👏', icon: <Hand className="w-5 h-5" />, label: 'Clap' },
  { type: '🎉', icon: <PartyPopper className="w-5 h-5" />, label: 'Party' },
  { type: '😊', icon: <Smile className="w-5 h-5" />, label: 'Smile' },
];

export default function EmotePicker({ onEmoteSelect, disabled = false }: EmotePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmoteClick = (emote: EmoteType) => {
    onEmoteSelect(emote);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="rounded-full h-10 w-10 border-2 hover:scale-110 transition-all"
      >
        <Smile className="h-5 w-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-full mb-2 left-0 z-50 bg-card border-2 rounded-2xl p-2 shadow-xl"
            >
              <div className="grid grid-cols-3 gap-2">
                {emotes.map((emote) => (
                  <motion.button
                    key={emote.type}
                    onClick={() => handleEmoteClick(emote.type)}
                    className="p-3 rounded-xl hover:bg-muted transition-all hover:scale-110 active:scale-95"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className="text-2xl">{emote.type}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

