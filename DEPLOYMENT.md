# Vercel Deployment Guide

This guide explains how to deploy your React app to Vercel and fix common 404 errors.

## Files Added for Vercel Deployment

### 1. `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/(.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot))",
      "dest": "/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 2. `public/_redirects`
```
/*    /index.html   200
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel --prod
```

### Option 2: Deploy via Git Integration
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Vercel will automatically detect the React app and deploy it

## Configuration Details

### Build Settings
- **Build Command**: `npm run build` (automatically detected)
- **Output Directory**: `dist`
- **Install Command**: `npm install` (automatically detected)

### Environment Variables
If you have any environment variables, add them in Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add your variables

## Common Issues & Solutions

### 404 Error on Refresh
✅ **Fixed by**: `vercel.json` routes configuration that redirects all paths to `index.html`

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure `dist` directory is created during build
- Verify webpack configuration

### Large Bundle Size
- Consider code splitting with `React.lazy()`
- Use webpack bundle analyzer to identify large dependencies

## Testing Deployment

### Local Testing
```bash
# Build the project
npm run build

# Serve the dist folder locally
npx serve dist
```

### Production Testing
After deployment, test these scenarios:
1. Visit the main URL
2. Refresh the page (should not show 404)
3. Navigate to different routes and refresh
4. Test the coupon printing functionality

## Performance Optimization

The current build shows warnings about bundle size. Consider:
- Lazy loading components
- Tree shaking unused code
- Compressing assets
- Using a CDN for static files

Your app is now ready for Vercel deployment! 🚀