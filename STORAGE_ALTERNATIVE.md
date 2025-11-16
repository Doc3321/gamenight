# Storage Alternative: Base64 in Database

## Why This Approach

Instead of using Supabase Storage (which requires buckets), we're storing images as **base64 data URLs** directly in the database.

## Pros
- ✅ **No bucket setup needed** - Works immediately
- ✅ **Simple** - No storage configuration
- ✅ **Works on free tier** - No storage limits to worry about
- ✅ **No CORS issues** - Images load directly from database

## Cons
- ⚠️ **File size limit** - Max 2MB (base64 increases size by ~33%)
- ⚠️ **Database size** - Images stored in database (not ideal for large files)
- ⚠️ **Performance** - Slightly slower than CDN storage

## How It Works

1. User selects image
2. Image converted to base64
3. Stored as `data:image/jpeg;base64,...` in `profile_photo_url` column
4. Displayed directly in `<img src={dataUrl} />`

## File Size Limits

- **Max file size**: 2MB (before base64 encoding)
- **After encoding**: ~2.6MB in database
- **Good for**: Profile photos, small images

## If You Need Larger Files Later

You can always switch back to Supabase Storage:
1. Create the bucket
2. Update the upload route to use storage
3. Migrate existing base64 images to storage

## Current Implementation

The `profile_photo_url` column stores the full data URL:
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...
```

This works directly in `<img>` tags - no special handling needed!

