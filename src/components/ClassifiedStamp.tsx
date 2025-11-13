'use client';

import { motion } from 'framer-motion';

interface ClassifiedStampProps {
  level?: 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET';
  className?: string;
}

export default function ClassifiedStamp({ 
  level = 'CONFIDENTIAL',
  className = '' 
}: ClassifiedStampProps) {
  const colors = {
    'CONFIDENTIAL': 'from-blue-600 to-blue-800',
    'SECRET': 'from-orange-600 to-red-600',
    'TOP SECRET': 'from-red-600 to-purple-600',
  };

  return (
    <motion.div
      initial={{ rotate: -15, scale: 0.8 }}
      animate={{ rotate: -15, scale: 1 }}
      className={`absolute top-4 right-4 ${className}`}
    >
      <div className={`bg-gradient-to-r ${colors[level]} text-white px-4 py-2 rounded-lg border-2 border-white/50 shadow-lg transform rotate-12`}>
        <div className="text-xs font-bold tracking-wider text-center">
          {level}
        </div>
        <div className="text-[8px] text-center mt-0.5 opacity-90">
          CLASSIFIED
        </div>
      </div>
    </motion.div>
  );
}

