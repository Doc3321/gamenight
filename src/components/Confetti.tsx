'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

export default function Confetti({ trigger, onComplete }: ConfettiProps) {
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (trigger) {
      const colors = ['#a855f7', '#ec4899', '#f97316', '#8b5cf6', '#f43f5e'];
      const newConfetti = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
      }));
      setConfetti(newConfetti);

      const timer = setTimeout(() => {
        setConfetti([]);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!trigger || confetti.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confetti.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ 
            y: -10,
            x: `${piece.x}%`,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            y: window.innerHeight + 100,
            x: `${piece.x + (Math.random() - 0.5) * 20}%`,
            opacity: [1, 1, 0],
            rotate: 360,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: piece.delay,
            ease: "easeOut",
          }}
          className="absolute w-3 h-3 rounded-full"
          style={{ backgroundColor: piece.color }}
        />
      ))}
    </div>
  );
}

