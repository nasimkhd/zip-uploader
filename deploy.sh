#!/bin/bash

# Large File Upload Architecture Deployment Script
# This script deploys both the backend and frontend workers
# Supports deploying to staging and/or production environments

set -e

echo "🚀 Large File Upload Architecture Deployment Script"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_question() {
    echo -e "${CYAN}[?]${NC} $1"
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

# Function to deploy backend worker
deploy_backend() {
    local env=$1
    
    if [ "$env" = "staging" ]; then
        print_status "Deploying Backend Worker to STAGING (zip-uploader-worker)..."
    else
        print_status "Deploying Backend Worker to PRODUCTION (zip-uploader-worker)..."
    fi
    
    cd backend-worker
    
    # Check if wrangler.toml exists
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml not found in backend-worker directory"
        cd ..
        return 1
    fi
    
    # Deploy backend worker
    # For production, use no flag (default environment)
    # For staging, use --env staging
    if [ "$env" = "staging" ]; then
        if wrangler deploy --env staging; then
            print_success "Backend worker deployed successfully to $env!"
            cd ..
            return 0
        else
            print_error "Failed to deploy backend worker to $env"
            cd ..
            return 1
        fi
    else
        if wrangler deploy; then
            print_success "Backend worker deployed successfully to $env!"
            cd ..
            return 0
        else
            print_error "Failed to deploy backend worker to $env"
            cd ..
            return 1
        fi
    fi
}

# Function to deploy frontend worker
deploy_frontend() {
    local env=$1
    
    if [ "$env" = "staging" ]; then
        print_status "Deploying Frontend Worker to STAGING (zip-uploader-frontend)..."
    else
        print_status "Deploying Frontend Worker to PRODUCTION (zip-uploader-frontend)..."
    fi
    
    cd frontend-worker
    
    # Check if wrangler.toml exists
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml not found in frontend-worker directory"
        cd ..
        return 1
    fi
    
    # Deploy frontend worker
    # For production, use no flag (default environment)
    # For staging, use --env staging
    if [ "$env" = "staging" ]; then
        if wrangler deploy --env staging; then
            print_success "Frontend worker deployed successfully to $env!"
            cd ..
            return 0
        else
            print_error "Failed to deploy frontend worker to $env"
            cd ..
            return 1
        fi
    else
        if wrangler deploy; then
            print_success "Frontend worker deployed successfully to $env!"
            cd ..
            return 0
        else
            print_error "Failed to deploy frontend worker to $env"
            cd ..
            return 1
        fi
    fi
}

# Function to confirm deployment
confirm_deployment() {
    local env=$1
    print_question "Are you sure you want to deploy to $env? (yes/no)"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            print_warning "Deployment to $env cancelled."
            return 1
            ;;
    esac
}

# Ask which environments to deploy
print_question "Which environment(s) would you like to deploy to?"
echo "  1) Staging only"
echo "  2) Production only"
echo "  3) Both (Staging first, then Production)"
echo ""
read -p "Enter your choice (1-3): " choice

DEPLOY_STAGING=false
DEPLOY_PROD=false

case $choice in
    1)
        DEPLOY_STAGING=true
        ;;
    2)
        DEPLOY_PROD=true
        ;;
    3)
        DEPLOY_STAGING=true
        DEPLOY_PROD=true
        ;;
    *)
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
print_status "Deployment Plan:"
if [ "$DEPLOY_STAGING" = true ]; then
    echo "  ✓ Staging (backend + frontend)"
fi
if [ "$DEPLOY_PROD" = true ]; then
    echo "  ✓ Production (backend + frontend)"
fi
echo ""

# Deploy to Staging
if [ "$DEPLOY_STAGING" = true ]; then
    if confirm_deployment "STAGING"; then
        echo ""
        print_status "=== Deploying to STAGING ==="
        
        # Deploy backend
        if ! deploy_backend "staging"; then
            print_error "Staging deployment failed at backend step"
            exit 1
        fi
        
        echo ""
        
        # Deploy frontend
        if ! deploy_frontend "staging"; then
            print_error "Staging deployment failed at frontend step"
            exit 1
        fi
        
        echo ""
        print_success "✅ Staging deployment completed!"
        echo ""
    else
        DEPLOY_STAGING=false
    fi
fi

# Deploy to Production
if [ "$DEPLOY_PROD" = true ]; then
    if confirm_deployment "PRODUCTION"; then
        echo ""
        print_status "=== Deploying to PRODUCTION ==="
        
        # Deploy backend
        if ! deploy_backend "production"; then
            print_error "Production deployment failed at backend step"
            exit 1
        fi
        
        echo ""
        
        # Deploy frontend
        if ! deploy_frontend "production"; then
            print_error "Production deployment failed at frontend step"
            exit 1
        fi
        
        echo ""
        print_success "✅ Production deployment completed!"
        echo ""
    else
        DEPLOY_PROD=false
    fi
fi

# Final summary
echo ""
if [ "$DEPLOY_STAGING" = true ] || [ "$DEPLOY_PROD" = true ]; then
    print_success "🚀 Deployment summary:"
    if [ "$DEPLOY_STAGING" = true ]; then
        echo "  ✓ Staging: https://zip-uploader-worker-staging.andrea-4a3.workers.dev"
        echo "  ✓ Staging Frontend: https://zip-uploader-frontend-staging.andrea-4a3.workers.dev"
    fi
    if [ "$DEPLOY_PROD" = true ]; then
        echo "  ✓ Production: https://zip-uploader-worker.andrea-4a3.workers.dev"
        echo "  ✓ Production Frontend: https://zip-uploader-frontend.andrea-4a3.workers.dev"
    fi
    print_success "All requested deployments completed successfully! 🎉"
else
    print_warning "No deployments were executed."
fi
