import { useState, useEffect } from 'react';

interface PlayerProfile {
  nickname: string | null;
  profilePhotoUrl: string | null;
}

export function usePlayerProfiles(userIds: string[]): Record<string, PlayerProfile | null> {
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile | null>>({});

  useEffect(() => {
    if (userIds.length === 0) {
      setProfiles({});
      return;
    }

    const fetchProfiles = async () => {
      try {
        const response = await fetch('/api/profiles/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });

        if (response.ok) {
          const data = await response.json();
          setProfiles(data.profiles || {});
        } else {
          console.error('Failed to fetch profiles');
          setProfiles({});
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
        setProfiles({});
      }
    };

    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(',')]); // Re-fetch if userIds change

  return profiles;
}

