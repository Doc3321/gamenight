'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ClassifiedStamp from './ClassifiedStamp';
import AgentScanLine from './AgentScanLine';

interface SecurityPhoneProps {
  onAction?: (action: string) => void;
}

export default function SecurityPhone({ onAction }: SecurityPhoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'actions' | 'status'>('home');

  const phoneActions = [
    { id: 'scan', label: 'סריקת שטח', icon: '🔍', description: 'סרוק את השטח לפעילות חשודה' },
    { id: 'report', label: 'דיווח', icon: '📋', description: 'דווח על פעילות חשודה' },
    { id: 'status', label: 'סטטוס סוכן', icon: '🕵️', description: 'בדוק סטטוס סוכן' },
    { id: 'mission', label: 'מידע משימה', icon: '📱', description: 'מידע על המשימה הנוכחית' },
    { id: 'emergency', label: 'חירום', icon: '🚨', description: 'קריאת חירום' },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative"
        aria-label="טלפון אבטחה"
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
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
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
              <Card className="relative w-full max-w-sm mx-auto border-2 border-purple-500/30 dark:border-purple-400/50 overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 dark:from-gray-950 dark:via-purple-950/30 dark:to-gray-950">
                <ClassifiedStamp level="TOP SECRET" />
                <AgentScanLine />
                
                <CardHeader className="text-center pb-2 border-b border-purple-500/30">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl">🐧</span>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent font-mono">
                      PENGUIN CLUB
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    SECURITY PHONE
                  </p>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {currentScreen === 'home' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground mb-2">בחר פעולה:</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {phoneActions.map((action) => (
                          <motion.button
                            key={action.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              if (action.id === 'status') {
                                setCurrentScreen('status');
                              } else {
                                onAction?.(action.id);
                                setIsOpen(false);
                              }
                            }}
                            className="p-3 border-2 border-purple-500/30 dark:border-purple-400/50 rounded-lg bg-gradient-to-br from-purple-600/10 via-pink-600/10 to-orange-500/10 dark:from-purple-400/20 dark:via-pink-400/20 dark:to-orange-400/20 hover:border-purple-500/50 dark:hover:border-purple-400/70 transition-all flex flex-col items-center gap-1"
                          >
                            <span className="text-2xl">{action.icon}</span>
                            <span className="text-xs font-semibold text-center">{action.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {currentScreen === 'status' && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-3"
                    >
                      <div className="text-center">
                        <p className="text-sm font-semibold mb-2">סטטוס סוכן</p>
                        <div className="p-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-500/20 rounded-lg border border-purple-500/30">
                          <div className="text-4xl mb-2">🕵️</div>
                          <p className="text-xs text-muted-foreground">מצב: פעיל</p>
                          <p className="text-xs text-muted-foreground mt-1">רמת אבטחה: גבוהה</p>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setCurrentScreen('home')}
                      >
                        חזרה
                      </Button>
                    </motion.div>
                  )}

                  <div className="pt-2 border-t border-purple-500/30">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setIsOpen(false)}
                    >
                      סגור
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

