#!/usr/bin/env bash
# deploy-electron-update.sh — Build Electron app and deploy to VPS auto-updater
#
# Usage:
#   ./scripts/deploy-electron-update.sh [--notes "Release notes"] [--skip-deploy] [--dry-run]
#
# Prerequisites:
#   1. SSH key at ~/.ssh/id_ed25519 with access to VPS
#   2. electron-builder installed (npm dep)
#
# What it does:
#   1. Builds Vue frontend (npm run build)
#   2. Builds Electron main process (npm run electron:build-main)
#   3. Packages with electron-builder (AppImage + .deb)
#   4. Uploads artifacts + latest-linux.yml to VPS via SCP
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VPS_HOST="${VPS_HOST:?Set VPS_HOST env var}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="/var/www/flowstate/updates/electron"
SSH_KEY="$HOME/.ssh/id_ed25519"
RELEASE_DIR="$PROJECT_DIR/release"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
NOTES=""
SKIP_DEPLOY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --notes) NOTES="$2"; shift 2 ;;
    --skip-deploy) SKIP_DEPLOY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${CYAN}=== FlowState Electron Deploy v${VERSION} ===${NC}"
echo -e "Notes: ${NOTES:-'(none)'}"

node "$PROJECT_DIR/scripts/validate-electron-vite-env.cjs"

# Step 1: Build frontend
echo -e "\n${YELLOW}[1/4] Building Vue frontend...${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: ELECTRON_BUILD=true npm run build${NC}"
else
  ELECTRON_BUILD=true npm run build
fi

# Step 2: Build Electron main process
echo -e "\n${YELLOW}[2/4] Building Electron main process...${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: npm run electron:build-main${NC}"
else
  npm run electron:build-main
fi

# Step 3: Package with electron-builder
echo -e "\n${YELLOW}[3/4] Packaging with electron-builder...${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: npm run electron:patch-builder${NC}"
  echo -e "${CYAN}  [DRY RUN] Would run: npx electron-builder --config electron-builder.yml --linux${NC}"
else
  npm run electron:patch-builder
  npx electron-builder --config electron-builder.yml --linux
  node "$PROJECT_DIR/scripts/validate-electron-package.cjs"
fi

# Check artifacts exist
if [ "$DRY_RUN" = false ]; then
  APPIMAGE=$(find "$RELEASE_DIR" -name "*${VERSION}*.AppImage" -type f 2>/dev/null | head -1)
  DEB=$(find "$RELEASE_DIR" -name "*${VERSION}*.deb" -type f 2>/dev/null | head -1)
  YML=$(find "$RELEASE_DIR" -name "latest-linux.yml" -type f 2>/dev/null | head -1)

  if [ -z "$APPIMAGE" ]; then
    echo -e "${RED}ERROR: No AppImage found in $RELEASE_DIR${NC}"
    exit 1
  fi

  echo -e "${GREEN}  AppImage: $(basename "$APPIMAGE") ($(du -h "$APPIMAGE" | cut -f1))${NC}"
  [ -n "$DEB" ] && echo -e "${GREEN}  Deb: $(basename "$DEB") ($(du -h "$DEB" | cut -f1))${NC}"
  [ -n "$YML" ] && echo -e "${GREEN}  Manifest: $(basename "$YML")${NC}"
fi

# Step 4: Deploy to VPS
if [ "$SKIP_DEPLOY" = true ]; then
  echo -e "\n${YELLOW}[4/4] Skipping deploy (--skip-deploy)${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "\n${YELLOW}[4/4] Deploy (DRY RUN)${NC}"
  echo -e "${CYAN}  Would upload to ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/${NC}"
else
  echo -e "\n${YELLOW}[4/4] Deploying to VPS...${NC}"

  # Create remote directory
  ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "mkdir -p ${VPS_PATH}"

  # Upload artifacts
  scp -i "$SSH_KEY" "$APPIMAGE" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
  [ -n "$DEB" ] && scp -i "$SSH_KEY" "$DEB" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
  [ -n "$YML" ] && scp -i "$SSH_KEY" "$YML" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

  echo -e "${GREEN}  Uploaded to ${VPS_HOST}:${VPS_PATH}/${NC}"
fi

echo -e "\n${GREEN}=== Deploy complete ===${NC}"
echo -e "Version: ${VERSION}"
echo -e "Update URL: https://in-theflow.com/updates/electron/"
