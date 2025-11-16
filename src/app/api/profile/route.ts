import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { getProfile, createOrUpdateProfile } from '@/lib/db/profiles';

export async function GET() {
  try {
    const userId = await requireAuth();
    const profile = await getProfile(userId);

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error getting profile:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { nickname, profilePhotoUrl } = await request.json();

    const profile = await createOrUpdateProfile(userId, {
      nickname,
      profilePhotoUrl,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Return the actual error message for debugging
      return NextResponse.json({ 
        error: error.message || 'Failed to update profile' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

