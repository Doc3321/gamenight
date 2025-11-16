import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './server';

/**
 * Get the current authenticated user ID from Clerk
 * This is used throughout the app to identify users
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Verify that a user is authenticated
 * Throws an error if not authenticated
 */
export async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

/**
 * Check if a user is in a specific room
 * This is used for authorization checks
 */
export async function isUserInRoom(userId: string, roomId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('room_players')
    .select('id')
    .eq('room_id', roomId.toUpperCase().trim())
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Check if a user is the host of a room
 */
export async function isUserHost(userId: string, roomId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('host_id')
    .eq('id', roomId.toUpperCase().trim())
    .single();

  return !error && data?.host_id === userId;
}

