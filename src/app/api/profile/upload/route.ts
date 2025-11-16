import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth';
import { createOrUpdateProfile } from '@/lib/db/profiles';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 2MB for base64 storage)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Image too large. Maximum size is 2MB.' }, { status: 400 });
    }

    // Convert file to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    console.log('[Upload] Image converted to base64, size:', base64.length, 'chars');

    // Store base64 data URL directly in database
    const profile = await createOrUpdateProfile(userId, {
      profilePhotoUrl: dataUrl,
    });

    return NextResponse.json({ profile, photoUrl: dataUrl });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload photo' 
    }, { status: 500 });
  }
}

