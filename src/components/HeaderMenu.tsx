'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import ClassifiedStamp from './ClassifiedStamp';
import AgentScanLine from './AgentScanLine';

export function HeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  const isHomePage = pathname === '/';
  const isProfilePage = pathname === '/profile';

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-50"
        aria-label="תפריט"
      >
        <div className="relative">
          <span className="text-2xl">📱</span>
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Phone Frame */}
              <div className="relative w-full max-w-sm mx-auto">
                {/* Phone Body */}
                <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-[2.5rem] p-2 shadow-2xl border-4 border-gray-700">
                  {/* Phone Screen Bezel */}
                  <div className="bg-black rounded-[2rem] p-1">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10"></div>
                    
                    {/* Screen Content */}
                    <div className="relative bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 rounded-[1.75rem] overflow-hidden min-h-[600px]">
                      <ClassifiedStamp level="TOP SECRET" />
                      <AgentScanLine />
                      
                      {/* Status Bar */}
                      <div className="flex justify-between items-center px-6 pt-8 pb-2 text-white text-xs">
                        <span>9:41</span>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-2 border border-white rounded-sm">
                            <div className="w-full h-full bg-white rounded-sm"></div>
                          </div>
                          <span>📶</span>
                          <span>📶</span>
                        </div>
                      </div>

                      {/* Header */}
                      <div className="px-6 py-4 border-b border-purple-500/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent font-mono">
                              הסוכן
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">משחק המילים</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsOpen(false)}
                          >
                            <span className="text-white">✕</span>
                          </Button>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="px-4 py-4 space-y-2">
                        {!isHomePage && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              router.push('/');
                              setIsOpen(false);
                            }}
                            className="w-full p-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20 border-2 border-purple-500/30 rounded-xl flex items-center gap-3 hover:border-purple-500/50 transition-all"
                          >
                            <span className="text-2xl">🏠</span>
                            <span className="flex-1 text-right font-semibold">דף הבית</span>
                          </motion.button>
                        )}

                        {user && !isProfilePage && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              router.push('/profile');
                              setIsOpen(false);
                            }}
                            className="w-full p-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20 border-2 border-purple-500/30 rounded-xl flex items-center gap-3 hover:border-purple-500/50 transition-all"
                          >
                            <span className="text-2xl">👤</span>
                            <span className="flex-1 text-right font-semibold">פרופיל</span>
                          </motion.button>
                        )}

                        <div className="p-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20 border-2 border-purple-500/30 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">ערכת נושא</span>
                            <ThemeToggle />
                          </div>
                        </div>

                        {user && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              signOut();
                              setIsOpen(false);
                            }}
                            className="w-full p-4 bg-gradient-to-r from-red-600/20 to-orange-600/20 border-2 border-red-500/30 rounded-xl flex items-center gap-3 hover:border-red-500/50 transition-all"
                          >
                            <span className="text-2xl">🚪</span>
                            <span className="flex-1 text-right font-semibold text-red-400">התנתק</span>
                          </motion.button>
                        )}
                      </div>

                      {/* Home Indicator */}
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

