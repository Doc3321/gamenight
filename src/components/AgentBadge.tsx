'use client';

import { motion } from 'framer-motion';
import { User, Shield } from 'lucide-react';

interface AgentBadgeProps {
  agentName: string;
  agentNumber?: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function AgentBadge({ 
  agentName, 
  agentNumber, 
  isHost = false,
  size = 'md',
  className = '' 
}: AgentBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const number = agentNumber || Math.abs(agentName.charCodeAt(0)) % 1000;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-orange-500/10 dark:from-purple-400/20 dark:via-pink-400/20 dark:to-orange-400/20 border-2 border-purple-500/30 dark:border-purple-400/50 rounded-lg font-mono ${className}`}
    >
      {isHost && <Shield className={iconSizes[size]} />}
      <span className="font-semibold">AGENT-{number.toString().padStart(3, '0')}</span>
      <span className="text-muted-foreground">|</span>
      <span>{agentName}</span>
    </motion.div>
  );
}

