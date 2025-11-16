import { supabaseAdmin } from '../supabase/server';

export interface UserProfile {
  id: string;
  userId: string;
  nickname: string | null;
  profilePhotoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    nickname: data.nickname,
    profilePhotoUrl: data.profile_photo_url,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function createOrUpdateProfile(
  userId: string,
  updates: {
    nickname?: string;
    profilePhotoUrl?: string;
  }
): Promise<UserProfile> {
  // Check if profile exists
  const existing = await getProfile(userId);

  if (existing) {
    // Update existing profile
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        nickname: updates.nickname ?? existing.nickname,
        profile_photo_url: updates.profilePhotoUrl ?? existing.profilePhotoUrl,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to update profile');
    }

    return {
      id: data.id,
      userId: data.user_id,
      nickname: data.nickname,
      profilePhotoUrl: data.profile_photo_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } else {
    // Create new profile
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: userId,
        nickname: updates.nickname,
        profile_photo_url: updates.profilePhotoUrl,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create profile');
    }

    return {
      id: data.id,
      userId: data.user_id,
      nickname: data.nickname,
      profilePhotoUrl: data.profile_photo_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

