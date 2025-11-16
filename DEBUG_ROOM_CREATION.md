# Debugging Room Creation Errors

## How to Debug

### 1. Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Try creating a room
4. Look for error messages starting with `[API]` or `[DB]`

### 2. Check Network Tab
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try creating a room
4. Click on the `/api/rooms` request (POST)
5. Check:
   - **Status Code** (should be 200, not 500)
   - **Response** tab - see the actual error message

### 3. Check Server Logs
If deployed on Vercel:
1. Go to Vercel Dashboard
2. Click on your project
3. Go to **Logs** tab
4. Look for error messages when creating a room

## Common Errors and Solutions

### Error: "relation 'rooms' does not exist"
**Problem**: Database tables haven't been created
**Solution**: 
1. Go to Supabase Dashboard → SQL Editor
2. Run the migration: `supabase/migrations/001_initial_schema.sql`
3. Make sure all tables are created

### Error: "permission denied for table rooms"
**Problem**: RLS policies blocking access
**Solution**: 
1. Check RLS policies in Supabase
2. Make sure policies allow service role access
3. Or check if service role key is set correctly

### Error: "Unauthorized"
**Problem**: Clerk authentication failing
**Solution**:
1. Check `CLERK_SECRET_KEY` is set in environment variables
2. Check user is logged in
3. Check Clerk middleware is working

### Error: "Failed to create room: No room data returned"
**Problem**: Insert succeeded but select failed
**Solution**:
1. Check if room was actually created in Supabase
2. Check database connection
3. Check if there are any triggers blocking the insert

### Error: "Failed to add host to room"
**Problem**: Player insert failed
**Solution**:
1. Check `room_players` table exists
2. Check foreign key constraint (room_id must exist in rooms table)
3. Check UNIQUE constraint (user_id, room_id)

## Quick Test

Run this in Supabase SQL Editor to check if tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('rooms', 'room_players', 'game_states');
```

Should return 3 rows. If not, run the migration.

## Check Environment Variables

Make sure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

