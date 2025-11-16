# Fix: Storage Upload Error

## The Problem

You're getting 500 errors when uploading profile photos. This is likely because:

1. **Storage bucket doesn't exist** - The `profile-photos` bucket hasn't been created in Supabase
2. **Service role key works** - We're using the service role key which bypasses RLS, so auth is fine

## How Auth Works

**You're correct to question this!** Here's how it works:

1. **Clerk authenticates the user** → Gets `userId` (e.g., `user_2abc123...`)
2. **API route verifies auth** → `requireAuth()` checks Clerk session
3. **Service role key bypasses Supabase auth** → We use `SUPABASE_SERVICE_ROLE_KEY` which has admin access
4. **We use Clerk userId** → Store it in database/storage paths, but Supabase doesn't need to authenticate it

**Key Point**: Supabase doesn't need to know which user is making the request because:
- We verify auth in our API routes (Clerk)
- We use service role key (bypasses all RLS)
- We control access in application code

## Solution: Create Storage Bucket

### Step 1: Create the Bucket

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure:
   - **Name**: `profile-photos` (exactly this, case-sensitive)
   - **Public bucket**: ✅ **YES** (important!)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/*`
4. Click **"Create bucket"**

### Step 2: Verify It Works

After creating the bucket, the upload should work because:
- Service role key has full access
- Bucket is public (for reading)
- No RLS policies needed (service role bypasses them)

## Testing

1. Create the bucket in Supabase
2. Try uploading a photo again
3. Check browser console for `[Upload]` logs
4. Check Supabase Storage → `profile-photos` bucket to see if file appears

## If Still Not Working

Check Vercel logs for the actual error message. The code now logs detailed errors:
- `[Upload] Storage error:` - Shows the exact Supabase error
- `[Upload] File name:` - Shows what file is being uploaded
- `[Upload] Upload successful:` - Confirms upload worked

## Common Errors

### "Bucket not found"
→ Create the `profile-photos` bucket in Supabase Storage

### "Permission denied"
→ Check service role key is set in Vercel environment variables

### "File too large"
→ Check bucket file size limit (should be 5MB+)

