# Supabase + Clerk Setup Instructions

## 1. Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Getting Clerk Keys:
1. Go to https://clerk.com
2. Create a new application
3. Copy keys from Dashboard → API Keys

### Getting Supabase Keys:
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## 2. Run Database Migration

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run it in the SQL Editor

This will create:
- `rooms` table
- `room_players` table
- `game_states` table
- All indexes and RLS policies

## 3. Enable Real-time in Supabase

1. Go to Database → Replication
2. Enable replication for:
   - `rooms` table
   - `room_players` table
   - `game_states` table

## 4. Install Dependencies

Already done, but if needed:
```bash
npm install @supabase/supabase-js @clerk/nextjs
```

## 5. Test the Setup

1. Start your dev server: `npm run dev`
2. You should be redirected to Clerk login
3. After login, try creating a room

## What Changed

### Database Integration
- All room operations now use Supabase instead of in-memory storage
- Rooms persist across server restarts
- Real-time subscriptions replace polling

### Authentication
- Clerk handles all user authentication
- User IDs are Clerk user IDs
- All API routes require authentication

### Real-time Updates
- Components use `useRoomSubscription` hook
- Automatic updates when room/game state changes
- No more polling needed

## Troubleshooting

### "Missing Supabase environment variables"
- Check your `.env.local` file exists
- Verify all variables are set correctly
- Restart your dev server after adding env vars

### "Unauthorized" errors
- Make sure you're logged in via Clerk
- Check Clerk keys are correct

### Real-time not working
- Verify replication is enabled in Supabase
- Check browser console for subscription errors
- Ensure Supabase project is active

### Migration errors
- Make sure you're running the SQL in the Supabase SQL Editor
- Check for existing tables (drop them first if needed)
- Verify you have the correct permissions

