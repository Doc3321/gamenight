'use client';

import { motion } from 'framer-motion';

export default function AgentScanLine() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      initial={{ y: '-100%' }}
      animate={{ y: '200%' }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "linear",
        repeatDelay: 1
      }}
    >
      <div className="h-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent blur-sm" />
      <div className="h-0.5 bg-gradient-to-r from-transparent via-pink-500/50 to-transparent mt-0.5" />
    </motion.div>
  );
}

