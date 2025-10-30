#!/bin/bash

# Large File Upload Architecture Deployment Script
# This script deploys both the backend and frontend workers

set -e

echo "🚀 Deploying Large File Upload Architecture..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

# Deploy Backend Worker
print_status "Deploying Backend Worker (zip-uploader-worker)..."
cd backend-worker

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found in backend-worker directory"
    exit 1
fi

# Deploy backend worker
if wrangler deploy; then
    print_success "Backend worker deployed successfully!"
    BACKEND_URL=$(wrangler whoami | grep -o 'https://[^/]*' | head -1)
    BACKEND_URL="${BACKEND_URL}/zip-uploader-worker"
    print_status "Backend URL: $BACKEND_URL"
else
    print_error "Failed to deploy backend worker"
    exit 1
fi

cd ..

# Deploy Frontend Worker
print_status "Deploying Frontend Worker (zip-uploader-frontend)..."
cd frontend-worker

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found in frontend-worker directory"
    exit 1
fi

# # Update backend URL in frontend worker config
# if [ ! -z "$BACKEND_URL" ]; then
#     print_status "Updating backend URL in frontend worker configuration..."
#     sed -i.bak "s|BACKEND_WORKER_URL = \".*\"|BACKEND_WORKER_URL = \"$BACKEND_URL\"|g" wrangler.toml
#     print_success "Backend URL updated to: $BACKEND_URL"
# fi

# Deploy frontend worker
if wrangler deploy; then
    print_success "Frontend worker deployed successfully!"
    FRONTEND_URL=$(wrangler whoami | grep -o 'https://[^/]*' | head -1)
    FRONTEND_URL="${FRONTEND_URL}/zip-uploader-frontend"
    print_status "Frontend URL: $FRONTEND_URL"
else
    print_error "Failed to deploy frontend worker"
    exit 1
fi

cd ..
echo ""
print_success "🚀 All done! Your large file upload architecture is ready to use."

