# 🚀 Netlify Deployment Guide

## Deploy to Netlify

Your webapp is now configured for Netlify deployment! Here's how to deploy:

### Method 1: Netlify Dashboard (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure for Netlify deployment"
   git push origin netlify
   ```

2. **Deploy via Netlify Dashboard**:
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "New site from Git"
   - Connect your GitHub repository
   - Select the `netlify` branch
   - **Set build settings**:
     - Base directory: `webapp`
     - Build command: `npm run build`
     - Publish directory: `webapp/static`
   - Click "Deploy site"

### Method 2: Netlify CLI

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy from webapp directory**:
   ```bash
   cd webapp
   netlify init
   netlify deploy
   netlify deploy --prod  # For production deployment
   ```

## 🏗️ Project Structure for Netlify

```
webapp/
├── netlify/
│   └── functions/
│       └── api.js           # All API endpoints as one function
├── static/                  # Static files (HTML, CSS, JS)
│   ├── index.html
│   └── app.js
├── src/                     # Backend logic
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies
└── index.js                # Local development server
```

## 🔧 How Netlify Deployment Works

- **Static Files**: Served from `static/` directory
- **API Functions**: Handled by `netlify/functions/api.js`
- **Routing**: Configured in `netlify.toml`
- **File Uploads**: Use `/tmp/` directory in serverless functions

### API Routes Available:

- `/.netlify/functions/api/health`
- `/.netlify/functions/api/parse`
- `/.netlify/functions/api/test-connection`
- `/.netlify/functions/api/analyze-matches`
- `/.netlify/functions/api/sync`
- `/.netlify/functions/api/generate-reports`

## 🌐 URL Structure

After deployment on Netlify:
- **Homepage**: `https://your-site-name.netlify.app/`
- **API calls**: `https://your-site-name.netlify.app/api/health` etc.

## 🏠 Local Development

For local development with Netlify functions:

```bash
# Option 1: Use regular dev server
npm run dev

# Option 2: Use Netlify dev (simulates production)
netlify dev
```

## 🔧 Configuration Files

- **`netlify.toml`**: Deployment and routing configuration
- **`netlify/functions/api.js`**: Serverless function handling all API routes
- **`package.json`**: Updated with Netlify dependencies

## 📝 Environment Variables

You can add environment variables in Netlify:
1. Go to Site settings → Environment variables
2. Add any needed variables for your app

## ✅ Ready to Deploy!

Your webapp is now configured for Netlify. The main differences from Vercel:

- ✅ Uses `netlify.toml` instead of `vercel.json`
- ✅ Functions in `netlify/functions/` directory
- ✅ Static files served from `static/` directory
- ✅ All API routes handled by single function file

Deploy and your app will be live on Netlify!
