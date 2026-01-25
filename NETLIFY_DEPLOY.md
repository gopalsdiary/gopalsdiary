# Netlify Deployment Instructions

## ⚠️ CRITICAL: You MUST deploy the `dist` folder, NOT the root folder!

### Option 1: Git-based Deployment (Recommended)

1. **Push all files to your Git repository** (GitHub, GitLab, etc.)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **In Netlify Dashboard:**
   - Go to "Site settings" → "Build & deploy" → "Build settings"
   - Set **Build command**: `npm run build`
   - Set **Publish directory**: `dist`
   - Click "Save"

3. **Trigger a new deploy:**
   - Go to "Deploys" tab
   - Click "Trigger deploy" → "Clear cache and deploy site"

### Option 2: Manual Deployment (Drag & Drop)

1. **Build the project locally:**
   ```bash
   npm run build
   ```

2. **Deploy ONLY the `dist` folder:**
   - Open Netlify dashboard
   - Drag and drop the **`dist` folder** (NOT the root folder!)
   - Wait for deployment to complete

## Verification

After deployment, check:
- ✅ The site loads (no white screen)
- ✅ No console errors about `.jsx` files
- ✅ Images load correctly

## Common Issues

### White Screen / "index.jsx" error
**Cause**: You deployed the root folder instead of `dist`
**Fix**: Follow the instructions above and deploy the `dist` folder

### Build fails on Netlify
**Cause**: Node version mismatch
**Fix**: The `.nvmrc` file in this repo specifies Node 18.18.0. Netlify should auto-detect it.

## Files Required for Deployment

Make sure these files are in your repository:
- ✅ `netlify.toml` (build configuration)
- ✅ `.nvmrc` (Node version)
- ✅ `public/_redirects` (SPA routing)
- ✅ `package.json` (dependencies)

## Need Help?

If you're still seeing a white screen:
1. Check Netlify build logs for errors
2. Verify the "Publish directory" is set to `dist`
3. Clear browser cache and try again
