#!/bin/bash

# Cloudflare Pages Deployment Script
# This script helps prepare and deploy the zip-uploader frontend

echo "🚀 Preparing zip-uploader for Cloudflare Pages deployment..."

# Check if we're in the right directory
if [ ! -f "client/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd client
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed! Please check the error messages above."
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "📁 Your built files are in: client/dist/"
echo ""
echo "🌐 Next steps:"
echo "1. Go to https://dash.cloudflare.com"
echo "2. Navigate to Pages → Create a project"
echo "3. Choose 'Upload assets'"
echo "4. Drag and drop the contents of client/dist/"
echo "5. Give your project a name and deploy!"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
