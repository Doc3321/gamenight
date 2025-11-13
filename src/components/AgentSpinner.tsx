'use client';

import { motion } from 'framer-motion';

interface AgentSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function AgentSpinner({ 
  size = 'md',
  message 
}: AgentSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer rotating ring */}
        <motion.div
          className={`${sizeClasses[size]} border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Inner pulsing circle */}
        <motion.div
          className={`absolute inset-0 ${sizeClasses[size]} bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20 rounded-full`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Center spy icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ 
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
            className="text-lg"
          >
            🕵️
          </motion.div>
        </div>
      </div>
      
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground font-mono uppercase tracking-wider"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}

