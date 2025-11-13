'use client';

import { motion } from 'framer-motion';
import { FileText, Target, Users } from 'lucide-react';

interface MissionBriefingProps {
  missionName: string;
  objective: string;
  agents: number;
  className?: string;
}

export default function MissionBriefing({ 
  missionName, 
  objective, 
  agents,
  className = '' 
}: MissionBriefingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6 rounded-xl border-2 border-purple-500/50 shadow-2xl ${className}`}
    >
      <div className="absolute top-2 left-2 w-full h-full bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.1)_1px,_transparent_0)] bg-[length:20px_20px] opacity-20"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-purple-300">MISSION BRIEFING</h3>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Mission</span>
            </div>
            <p className="text-xl font-bold text-white">{missionName}</p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Agents</span>
            </div>
            <p className="text-lg text-white">{agents} Active Agents</p>
          </div>
          
          <div className="pt-2 border-t border-purple-500/30">
            <p className="text-sm text-gray-300 leading-relaxed">{objective}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

