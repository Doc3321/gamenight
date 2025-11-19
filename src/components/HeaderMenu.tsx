'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import SecurityPhone from '@/components/SecurityPhone';

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
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 top-12 z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-purple-200 dark:border-purple-800 p-4 space-y-3"
            >
              <div className="pb-3 border-b border-purple-200 dark:border-purple-800">
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent font-mono tracking-wider">
                  הסוכן
                </div>
                <p className="text-xs text-muted-foreground mt-1">משחק המילים</p>
              </div>

              {!isHomePage && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    router.push('/');
                    setIsOpen(false);
                  }}
                >
                  <span className="ml-2">🏠</span>
                  דף הבית
                </Button>
              )}

              {user && !isProfilePage && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    router.push('/profile');
                    setIsOpen(false);
                  }}
                >
                  <span className="ml-2">👤</span>
                  פרופיל
                </Button>
              )}

              <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">ערכת נושא</span>
                  <ThemeToggle />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">טלפון אבטחה</span>
                  <SecurityPhone 
                    onAction={(action) => {
                      console.log('Security phone action:', action);
                      setIsOpen(false);
                    }} 
                  />
                </div>
              </div>

              {user && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    signOut();
                    setIsOpen(false);
                  }}
                >
                  <span className="ml-2">🚪</span>
                  התנתק
                </Button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

