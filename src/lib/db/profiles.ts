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
    // Update existing profile - only update fields that are provided
    const updateData: { nickname?: string; profile_photo_url?: string | null } = {};
    
    if (updates.nickname !== undefined) {
      updateData.nickname = updates.nickname || null;
    }
    
    if (updates.profilePhotoUrl !== undefined) {
      updateData.profile_photo_url = updates.profilePhotoUrl || null;
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update profile: No data returned');
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
        nickname: updates.nickname || null,
        profile_photo_url: updates.profilePhotoUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create profile: No data returned');
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

