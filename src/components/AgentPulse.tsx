'use client';

import { motion } from 'framer-motion';

interface AgentPulseProps {
  children: React.ReactNode;
  className?: string;
}

export default function AgentPulse({ children, className = '' }: AgentPulseProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

