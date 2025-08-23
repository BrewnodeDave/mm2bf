# Netlify Deployment Fix

## The "Page Not Found" Issue

The issue is likely one of these configuration problems:

### 1. Base Directory Setting

In your Netlify dashboard:
1. Go to Site settings → Build & deploy → Build settings
2. **Set Base directory to: `webapp`**
3. **Set Publish directory to: `static`** (relative to base)
4. **Set Build command to: `npm run build`**

### 2. Redeploy with Correct Settings

If you haven't set the base directory correctly:

#### Option A: Fix in Netlify Dashboard
1. Go to your site in Netlify dashboard
2. Site settings → Build & deploy → Build settings
3. Edit settings:
   - **Base directory**: `webapp`
   - **Build command**: `npm run build`
   - **Publish directory**: `static`
4. Trigger a new deploy

#### Option B: Redeploy from Scratch
1. Delete the current site from Netlify
2. Create a new site
3. Connect your repository
4. **IMPORTANT**: Set the correct build settings:
   - **Base directory**: `webapp`
   - **Build command**: `npm run build`
   - **Publish directory**: `static`

### 3. Files Updated

I've made these fixes:
- ✅ Fixed `_redirects` file in static directory
- ✅ Simplified `netlify.toml` configuration
- ✅ Removed conflicting redirect rules

### 4. Current File Structure Should Be:

```
webapp/
├── static/
│   ├── index.html          ← Main app
│   ├── app.js             ← Vue.js app
│   └── _redirects         ← Netlify routing (NEW)
├── netlify/
│   └── functions/
│       └── api.js         ← Serverless function
├── netlify.toml           ← Build config (UPDATED)
└── package.json
```

### 5. Test Locally

To test if everything works locally:
```bash
# Install Netlify CLI if you haven't
npm install -g netlify-cli

# From webapp directory
netlify dev
```

This should start a local server that mimics Netlify's behavior.

### 6. If Still Having Issues

1. Check Netlify deploy logs for errors
2. Verify the base directory is set to `webapp`
3. Make sure the publish directory is `static` (relative to base)
4. Ensure your function is properly deployed

### 7. Quick Fix Summary

Most likely fix: **Set base directory to `webapp` in Netlify dashboard** and redeploy.
