# Supabase Storage Setup for Profile Photos

## 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure:
   - **Name**: `profile-photos`
   - **Public bucket**: ✅ **YES** (so photos can be accessed via URL)
   - **File size limit**: 5 MB (recommended)
   - **Allowed MIME types**: `image/*` (or specific: `image/jpeg,image/png,image/webp`)
5. Click **"Create bucket"**

## 2. Set Storage Policies (RLS)

After creating the bucket, set up policies:

1. Go to **Storage** → **Policies** → Select `profile-photos` bucket
2. Click **"New Policy"**
3. Create these policies:

### Policy 1: Allow authenticated users to upload
- **Policy name**: "Users can upload their own photos"
- **Allowed operation**: INSERT
- **Policy definition**:
```sql
(bucket_id = 'profile-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

### Policy 2: Allow public read access
- **Policy name**: "Public read access"
- **Allowed operation**: SELECT
- **Policy definition**:
```sql
bucket_id = 'profile-photos'::text
```

### Policy 3: Allow users to update their own photos
- **Policy name**: "Users can update their own photos"
- **Allowed operation**: UPDATE
- **Policy definition**:
```sql
(bucket_id = 'profile-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

### Policy 4: Allow users to delete their own photos
- **Policy name**: "Users can delete their own photos"
- **Allowed operation**: DELETE
- **Policy definition**:
```sql
(bucket_id = 'profile-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

## Alternative: Simple Policy (If above doesn't work)

If the folder-based policies don't work, use this simpler approach:

### Allow all authenticated operations:
```sql
bucket_id = 'profile-photos'::text
```

**Note**: Since we're using the service role key in the API route, RLS policies are bypassed anyway. The policies above are for direct client access if needed in the future.

## 3. Test Upload

After setup, test by:
1. Going to `/profile` page
2. Uploading a photo
3. Checking if it appears in Storage → `profile-photos` bucket

## Troubleshooting

### "Bucket not found" error
- Make sure bucket name is exactly `profile-photos` (case-sensitive)
- Check bucket exists in Storage dashboard

### "Permission denied" error
- Check RLS policies are set correctly
- Verify bucket is public
- Check service role key is set in environment variables

### Photo not displaying
- Check bucket is set to **Public**
- Verify the URL is correct in the database
- Check CORS settings if accessing from different domain

