'use client';

import { motion } from 'framer-motion';
import { EmoteType } from './EmotePicker';

interface EmoteDisplayProps {
  emote: EmoteType;
  playerName: string;
  onComplete: () => void;
}

export default function EmoteDisplay({ emote, playerName, onComplete }: EmoteDisplayProps) {
  return (
    <motion.div
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
      onAnimationComplete={onComplete}
      className="absolute pointer-events-none z-50"
    >
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <span className="text-2xl">{emote}</span>
        <span className="text-sm font-semibold">{playerName}</span>
      </div>
    </motion.div>
  );
}

