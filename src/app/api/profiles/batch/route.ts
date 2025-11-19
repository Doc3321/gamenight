import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { getProfile } from '@/lib/db/profiles';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(); // Ensure user is authenticated
    
    const { userIds } = await request.json();
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ profiles: {} });
    }

    // Fetch profiles for all user IDs
    const profilePromises = userIds.map(async (userId: string) => {
      const profile = await getProfile(userId);
      return { userId, profile };
    });

    const results = await Promise.all(profilePromises);
    
    // Convert to object: { userId: profile }
    const profiles: Record<string, { nickname: string | null; profilePhotoUrl: string | null } | null> = {};
    results.forEach(({ userId, profile }) => {
      profiles[userId] = profile ? {
        nickname: profile.nickname,
        profilePhotoUrl: profile.profilePhotoUrl
      } : null;
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

