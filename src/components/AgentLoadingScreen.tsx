'use client';

import { motion } from 'framer-motion';
import ClassifiedStamp from './ClassifiedStamp';

interface AgentLoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export default function AgentLoadingScreen({ 
  message = 'מתחבר...',
  subMessage = 'מאמת זהות סוכן'
}: AgentLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
      <ClassifiedStamp level="TOP SECRET" />
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            currentColor 10px,
            currentColor 20px
          )`,
        }} />
      </div>
      
      <div className="relative z-10 text-center space-y-8">
        {/* Animated spy icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="mx-auto"
        >
          <div className="relative">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-full blur-2xl"
            />
            <div className="relative text-8xl">🕵️</div>
          </div>
        </motion.div>
        
        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent font-mono tracking-wider">
            {message}
          </h2>
          <p className="text-sm text-muted-foreground uppercase tracking-widest">
            {subMessage}
          </p>
        </motion.div>
        
        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
        
        {/* Scanning line effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ y: '-100%' }}
          animate={{ y: '200%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}

