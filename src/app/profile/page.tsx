'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import AgentSpinner from '@/components/AgentSpinner';
import { HeaderMenu } from '@/components/HeaderMenu';

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [nickname, setNickname] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.profile) {
        setNickname(data.profile.nickname || '');
        setProfilePhotoUrl(data.profile.profilePhotoUrl || null);
      } else {
        // Use Clerk name as default
        setNickname(user?.firstName || user?.username || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('שגיאה בטעינת הפרופיל');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('נא לבחור קובץ תמונה');
      return;
    }

    // Validate file size (max 2MB for base64 storage)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('גודל הקובץ גדול מדי. מקסימום 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.photoUrl) {
        setProfilePhotoUrl(data.photoUrl);
        // Auto-save the photo immediately after upload
        try {
          const saveResponse = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nickname: nickname.trim() || user?.firstName || user?.username || '',
              profilePhotoUrl: data.photoUrl,
            }),
          });

          if (saveResponse.ok) {
            toast.success('תמונת הפרופיל עודכנה ונשמרה בהצלחה');
          } else {
            toast.success('תמונת הפרופיל עודכנה (נא לשמור את הפרופיל)');
          }
        } catch (saveError) {
          console.error('Error auto-saving photo:', saveError);
          toast.success('תמונת הפרופיל עודכנה (נא לשמור את הפרופיל)');
        }
      } else {
        throw new Error(data.error || 'Failed to upload');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('שגיאה בהעלאת התמונה');
    } finally {
      setIsUploading(false);
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast.error('נא להזין כינוי');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          profilePhotoUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('הפרופיל עודכן בהצלחה');
        router.push('/');
      } else {
        const errorMsg = data.error || 'Failed to save';
        console.error('Profile save error:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'שגיאה בשמירת הפרופיל';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 flex items-center justify-center">
        <AgentSpinner />
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 p-4 relative">
      <div className="absolute top-4 left-4 z-10">
        <HeaderMenu />
      </div>
      <div className="max-w-2xl mx-auto pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="text-2xl text-center">עריכת פרופיל</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Photo */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center overflow-hidden border-4 border-purple-300 dark:border-purple-700">
                    {profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profilePhotoUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl text-white font-bold">
                        {nickname.charAt(0).toUpperCase() || user.firstName?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute bottom-0 right-0 rounded-full"
                    onClick={handlePhotoSelect}
                    disabled={isUploading}
                  >
                    {isUploading ? 'מעלה...' : '📷'}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoSelect}
                    disabled={isUploading}
                  >
                    {isUploading ? 'מעלה...' : 'בחר מהגלריה'}
                  </Button>
                </div>
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="nickname">כינוי במשחקים</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="הזן כינוי"
                  maxLength={20}
                />
                <p className="text-sm text-muted-foreground">
                  הכינוי שלך יופיע אוטומטית כשתצטרף לחדרים
                </p>
              </div>

              {/* User Info (read-only) */}
              <div className="space-y-2 pt-4 border-t">
                <Label>אימייל</Label>
                <Input value={user.emailAddresses[0]?.emailAddress || ''} disabled />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !nickname.trim()}
                    className="flex-1"
                  >
                    {isSaving ? 'שומר...' : 'שמור'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/')}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    signOut();
                    router.push('/');
                  }}
                  className="w-full"
                >
                  התנתק
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

