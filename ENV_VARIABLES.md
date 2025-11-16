# Environment Variables

Add these to your `.env.local` file:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhY3QtZm93bC0yMi5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_XWcviaonRCIGjh3TBg43K2qLyzIm2QQDvRC0JZmYDs

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: For development
NODE_ENV=development
```

## How to get these values:

### Clerk:
1. Go to https://clerk.com
2. Create a new application
3. Copy the publishable key and secret key from the dashboard

### Supabase:
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings > API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

