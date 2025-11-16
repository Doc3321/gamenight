import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid errors during build
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check if env vars are missing
  if (!supabaseUrl || !supabaseServiceKey) {
    // Check if we're in a build context (during Next.js build)
    // In build, env vars might not be available, so use placeholder
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
      // This is likely a build, use placeholder
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
    
    // At runtime (especially in Vercel), throw clear error
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    const errorMsg = `Missing Supabase environment variables: ${missing.join(', ')}. ` +
      `Please set them in Vercel Dashboard → Settings → Environment Variables.`;
    console.error('[Supabase]', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[Supabase] Admin client initialized successfully');
    return supabaseAdminInstance;
  } catch (error) {
    console.error('[Supabase] Failed to create admin client:', error);
    throw new Error(`Failed to initialize Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Server-side client with service role key (bypasses RLS)
// Lazy-loaded to avoid build-time errors
// Use a Proxy to make it work like a normal SupabaseClient
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    try {
      const client = getSupabaseAdmin();
      if (!client) {
        throw new Error('Supabase admin client not initialized. Check environment variables.');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (client as any)[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    } catch (error) {
      console.error('[Supabase] Error accessing property:', prop, error);
      throw error;
    }
  },
}) as SupabaseClient;

// Export the function for broadcast use
export { getSupabaseAdmin };

