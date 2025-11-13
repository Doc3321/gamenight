# Vercel Deployment Checklist

## Current Configuration
- ✅ Removed `--turbopack` from build command (experimental, can cause issues)
- ✅ Removed manual `outputDirectory` config (Vercel auto-detects Next.js)
- ✅ Using standard `next build` command

## Vercel Dashboard Settings to Verify

1. **Framework Preset**: 
   - Go to Project Settings > General > Framework Preset
   - Should be set to **"Next.js"** (Vercel should auto-detect this)

2. **Build Command**: 
   - Should be: `npm run build` (which runs `next build`)
   - Verify in Project Settings > General > Build & Development Settings

3. **Output Directory**: 
   - Should be **empty/auto** (Vercel handles this automatically for Next.js)
   - Do NOT set this manually

4. **Root Directory**: 
   - Should be **empty** (unless your Next.js app is in a subdirectory)
   - If your `package.json` is in the root, leave this empty

5. **Install Command**: 
   - Should be: `npm install` (default)

## If 404 Persists

1. Check Build Logs in Vercel dashboard - ensure build completes successfully
2. Check Runtime Logs for any runtime errors
3. Verify the deployment URL is correct
4. Check the build logs to ensure all routes are generated correctly

## Next.js App Router Notes

- Vercel automatically detects Next.js App Router (using `src/app` directory)
- No `vercel.json` needed for standard Next.js deployments
- The `layout.tsx` and `page.tsx` files should be automatically recognized

