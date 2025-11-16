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

    // Upload to Supabase Storage
    const { getSupabaseAdmin } = await import('@/lib/supabase/server');
    const adminClient = getSupabaseAdmin();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await adminClient.storage
      .from('profile-photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('profile-photos')
      .getPublicUrl(fileName);

    const profilePhotoUrl = urlData.publicUrl;

    // Update profile with photo URL
    const profile = await createOrUpdateProfile(userId, {
      profilePhotoUrl,
    });

    return NextResponse.json({ profile, photoUrl: profilePhotoUrl });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}

