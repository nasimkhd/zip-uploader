# Cloudflare Pages Deployment Guide

This guide will help you deploy the zip-uploader frontend to Cloudflare Pages.

## Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Method 1: Direct Upload (Quickest)

1. **Build the project locally:**
   ```bash
   cd client
   npm run build
   ```

2. **Go to Cloudflare Pages:**
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to "Pages" in the sidebar
   - Click "Create a project"

3. **Upload the build:**
   - Select "Upload assets"
   - Drag and drop the `client/dist` folder contents
   - Give your project a name (e.g., "zip-uploader")
   - Click "Deploy site"

### Method 2: Git Integration (Recommended)

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Connect to Cloudflare Pages:**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to "Pages" → "Create a project"
   - Select "Connect to Git"
   - Choose your repository

3. **Configure build settings:**
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `client/dist`
   - **Root directory:** `client`

4. **Environment Variables (if needed):**
   - Add `VITE_API_URL` with your production API URL
   - Example: `https://your-api-domain.com`

5. **Deploy:**
   - Click "Save and Deploy"
   - Cloudflare will automatically build and deploy your site

## Configuration Files Added

The following files have been added to optimize your deployment:

### `client/_headers`
- Security headers for better protection
- Cache optimization for static assets

### `client/_redirects`
- Handles client-side routing for SPA
- Ensures all routes work properly

### `client/vite.config.ts`
- Optimized build configuration
- Code splitting for better performance
- Production-ready settings

## Post-Deployment

1. **Custom Domain (Optional):**
   - Go to your Pages project
   - Navigate to "Custom domains"
   - Add your domain

2. **Environment Variables:**
   - Update `VITE_API_URL` to point to your production backend
   - Redeploy if you change environment variables

3. **Monitoring:**
   - Check the "Functions" tab for any serverless function logs
   - Monitor "Analytics" for traffic insights

## Troubleshooting

### Build Failures
- Ensure all dependencies are in `package.json`
- Check that `npm run build` works locally
- Review build logs in Cloudflare Pages dashboard

### API Connection Issues
- Verify `VITE_API_URL` environment variable is set correctly
- Ensure your backend server is accessible from the internet
- Check CORS settings on your backend

### Routing Issues
- The `_redirects` file should handle SPA routing
- If you have custom routes, update the redirects file

## Performance Tips

1. **Enable Cloudflare features:**
   - Auto Minify (HTML, CSS, JS)
   - Brotli compression
   - Browser Cache TTL

2. **Monitor Core Web Vitals:**
   - Use Cloudflare Analytics
   - Check Google PageSpeed Insights

## Security Considerations

- The `_headers` file includes security headers
- Consider adding CSP (Content Security Policy) headers
- Ensure your API endpoints have proper authentication

## Cost

- Cloudflare Pages free tier includes:
  - Unlimited static sites
  - 500 builds per month
  - 20,000 requests per month
  - Custom domains

For most projects, the free tier is sufficient.
