#!/bin/bash
# VPS Deployment Script
# Usage: ./scripts/deploy/deploy-to-vps.sh [USER@HOST] [DEST_DIR]

set -e # Exit immediately if a command exits with a non-zero status.

# Default values (Change these or pass as arguments)
VPS_TARGET=${1:-"root@84.46.253.137"} # Configured from user Request
DEST_DIR=${2:-"/opt/flow-state"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "🚀 ${GREEN}Flow State VPS Deployment${NC}"
echo "============================="

if [ -z "$VPS_TARGET" ]; then
    echo -e "${RED}Error: VPS target not specified.${NC}"
    echo "Usage: ./scripts/deploy/deploy-to-vps.sh user@your-vps-ip [/path/to/app]"
    exit 1
fi

echo -e "Found Deployment Target: ${YELLOW}$VPS_TARGET${NC}"
echo -e "Destination Directory: ${YELLOW}$DEST_DIR${NC}"
echo ""

# 1. Build Verification
echo "🔍 Verifying Build..."
if [ ! -d "dist" ]; then
    echo "Build missing. Running build..."
    npm run build
fi
./scripts/deploy/verify-build.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}Build verification failed. Aborting.${NC}"
    exit 1
fi

# 2. Prepare Remote Directory
echo "📂 Preparing remote directory..."
ssh $VPS_TARGET "mkdir -p $DEST_DIR"

# 3. Transfer Files
echo "Dg Transferring files (rsync)..."
# We exclude node_modules, .git, etc to save time/bandwidth
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude '*.tar.gz' \
    --exclude '*.zip' \
    --exclude 'src-tauri/target' \
    ./ $VPS_TARGET:$DEST_DIR/

# 4. Transfer Environment Configuration
# We don't overwrite .env if it exists, but we upload .env.example
rsync -avz .env.example $VPS_TARGET:$DEST_DIR/
echo -e "${YELLOW}Note: .env files are excluded for security. Please configure .env on the server manually if this is the first deploy.${NC}"

# 5. Transfer Production Configs
# We rename them to standard names on the target for simplicity
rsync -avz docker-compose.prod.yml $VPS_TARGET:$DEST_DIR/docker-compose.yml
rsync -avz Caddyfile.prod $VPS_TARGET:$DEST_DIR/Caddyfile

# 6. Start Application
echo "🐳 Starting Docker containers on VPS..."
ssh $VPS_TARGET "cd $DEST_DIR && docker compose down && docker compose up -d --build"

echo ""
echo -e "✅ ${GREEN}Deployment Complete!${NC}"
echo "-----------------------------------"
echo "Next Steps:"
echo "1. SSH into your VPS: ssh $VPS_TARGET"
echo "2. Go to directory: cd $DEST_DIR"
echo "3. Create/Edit .env file: cp .env.example .env && nano .env"
echo "   (Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)"
echo "4. Restart if needed: docker compose restart"
