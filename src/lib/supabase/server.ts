import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid errors during build
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build, create a client with placeholder values
    // It will fail at runtime if env vars are missing, but allows build to complete
    supabaseAdminInstance = createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    ) as SupabaseClient;
    return supabaseAdminInstance;
  }

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

// Server-side client with service role key (bypasses RLS)
// Lazy-loaded to avoid build-time errors
export const supabaseAdmin = {
  get from() {
    return getSupabaseAdmin().from;
  },
} as SupabaseClient;

// Export the function for broadcast use
export { getSupabaseAdmin };

