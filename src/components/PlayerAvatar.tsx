'use client';

import { motion } from 'framer-motion';

interface PlayerAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  isEliminated?: boolean;
  className?: string;
  profilePhotoUrl?: string | null;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-lg',
};

const colors = [
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
];

export default function PlayerAvatar({ 
  name, 
  size = 'md', 
  isActive = false,
  isEliminated = false,
  className = '',
  profilePhotoUrl
}: PlayerAvatarProps) {
  // Generate consistent color based on name
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-bold shadow-lg relative overflow-hidden ${className}`}
      animate={isActive ? { scale: [1, 1.1, 1], boxShadow: ['0 4px 6px rgba(0,0,0,0.1)', '0 0 20px rgba(168,85,247,0.5)', '0 4px 6px rgba(0,0,0,0.1)'] } : {}}
      transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 1 }}
    >
      {profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profilePhotoUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
      {isEliminated && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <span className="text-xs">✕</span>
        </div>
      )}
      {isActive && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white z-10"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

