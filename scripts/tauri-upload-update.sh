#!/bin/bash
# Upload Tauri update artifacts to VPS
# Usage: npm run tauri:upload-update

set -e

VPS_HOST="84.46.253.137"
VPS_USER="root"
VPS_PATH="/var/www/flowstate/updates/"
SSH_KEY="$HOME/.ssh/id_ed25519"

# Get version from tauri.conf.json
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo "📦 Uploading FlowState v$VERSION to VPS..."

# Check for required files
MANIFEST="./latest.json"
APPIMAGE="./src-tauri/target/release/bundle/appimage/FlowState_${VERSION}_amd64.AppImage.tar.gz"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ Manifest not found. Run: npm run tauri:update-manifest"
  exit 1
fi

if [ ! -f "$APPIMAGE" ]; then
  echo "❌ AppImage not found at $APPIMAGE"
  echo "Run: npm run tauri:build:signed"
  exit 1
fi

echo "📤 Uploading to $VPS_HOST..."
scp -i "$SSH_KEY" "$MANIFEST" "$APPIMAGE" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}"

echo ""
echo "✅ Upload complete!"
echo ""
echo "🔍 Verifying endpoint..."
curl -s "https://in-theflow.com/updates/latest.json" | head -5

echo ""
echo "📋 VPS contents:"
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "ls -la ${VPS_PATH}"
