#!/usr/bin/env bash
# deploy-tauri-update.sh — Build signed Tauri app and deploy to VPS auto-updater
#
# Usage:
#   ./scripts/deploy-tauri-update.sh [--notes "Release notes"] [--skip-deploy] [--dry-run]
#
# Prerequisites (one-time setup):
#   1. sudo apt-get install -y libsecret-tools
#   2. secret-tool store --label="FlowState Tauri Signing Key" service flowstate type signing-key
#      (enter your signing password when prompted)
#   3. SSH key at ~/.ssh/id_ed25519 with access to VPS
#   4. Signing private key at ~/.tauri/flow-state.key
#
# What it does:
#   1. Retrieves signing password from system keyring (KWallet)
#   2. Builds Vue frontend (npm run build)
#   3. Builds signed Tauri app (npx tauri build)
#   4. Generates update manifest (latest.json)
#   5. Uploads artifacts + manifest to VPS via SCP
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VPS_HOST="84.46.253.137"
VPS_USER="root"
VPS_PATH="/var/www/flowstate/updates"
SSH_KEY="$HOME/.ssh/id_ed25519"
SIGNING_KEY="$HOME/.tauri/flow-state.key"
BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle"

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
    --help|-h)
      echo "Usage: $0 [--notes \"Release notes\"] [--skip-deploy] [--dry-run]"
      echo ""
      echo "Options:"
      echo "  --notes <text>    Release notes for the update manifest"
      echo "  --skip-deploy     Build and sign only, don't upload to VPS"
      echo "  --dry-run         Show what would happen without doing anything"
      echo "  --help, -h        Show this help"
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  FlowState Tauri Auto-Updater Deploy${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# --- Pre-flight checks ---
echo -e "${YELLOW}[1/6] Pre-flight checks...${NC}"

if ! command -v secret-tool &>/dev/null; then
  echo -e "  ${YELLOW}secret-tool not found — assuming passwordless key${NC}"
fi

if [[ ! -f "$SIGNING_KEY" ]]; then
  echo -e "${RED}ERROR: Signing key not found at $SIGNING_KEY${NC}"
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]] && [[ "$SKIP_DEPLOY" == false ]]; then
  echo -e "${RED}ERROR: SSH key not found at $SSH_KEY${NC}"
  exit 1
fi

# Retrieve password from keyring (optional — passwordless keys don't need one)
if command -v secret-tool &>/dev/null; then
  SIGNING_PASSWORD=$(secret-tool lookup service flowstate type signing-key 2>/dev/null || true)
else
  SIGNING_PASSWORD=""
fi
if [[ -z "$SIGNING_PASSWORD" ]]; then
  echo -e "  ${YELLOW}No password in keyring — using passwordless key${NC}"
fi

# Read version
VERSION=$(node -p "require('$PROJECT_DIR/src-tauri/tauri.conf.json').version")
echo -e "  Version: ${GREEN}$VERSION${NC}"
echo -e "  Deploy:  ${GREEN}$(if $SKIP_DEPLOY; then echo 'skip'; else echo "$VPS_HOST:$VPS_PATH"; fi)${NC}"
echo -e "  Notes:   ${GREEN}${NOTES:-"FlowState v$VERSION"}${NC}"
echo ""

if $DRY_RUN; then
  echo -e "${YELLOW}DRY RUN — exiting without changes.${NC}"
  exit 0
fi

# --- Build ---
echo -e "${YELLOW}[2/6] Building Vue frontend...${NC}"
cd "$PROJECT_DIR"
npm run build

echo -e "${YELLOW}[3/6] Building signed Tauri app...${NC}"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$SIGNING_PASSWORD"
npx tauri build

# Verify signature was generated
APPIMAGE_SIG=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage.tar.gz.sig" 2>/dev/null | head -1)
if [[ -z "$APPIMAGE_SIG" ]]; then
  echo -e "${RED}ERROR: No signed artifacts found. Build may have failed to sign.${NC}"
  exit 1
fi
echo -e "  ${GREEN}Signature found: $(basename "$APPIMAGE_SIG")${NC}"

# --- Generate manifest ---
echo -e "${YELLOW}[4/6] Generating update manifest...${NC}"
if [[ -n "$NOTES" ]]; then
  npm run tauri:update-manifest -- --notes "$NOTES"
else
  npm run tauri:update-manifest
fi

# Verify manifest
if [[ ! -f "$PROJECT_DIR/latest.json" ]]; then
  echo -e "${RED}ERROR: latest.json not generated.${NC}"
  exit 1
fi
echo -e "  ${GREEN}Manifest generated: latest.json${NC}"

if $SKIP_DEPLOY; then
  echo ""
  echo -e "${GREEN}Build complete (deploy skipped).${NC}"
  echo "  Artifacts: $BUNDLE_DIR/appimage/"
  echo "  Manifest:  $PROJECT_DIR/latest.json"
  exit 0
fi

# --- Deploy to VPS ---
echo -e "${YELLOW}[5/6] Uploading to VPS...${NC}"

APPIMAGE_ARCHIVE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage.tar.gz" ! -name "*.sig" 2>/dev/null | head -1)

if [[ -z "$APPIMAGE_ARCHIVE" ]]; then
  echo -e "${RED}ERROR: AppImage archive not found.${NC}"
  exit 1
fi

# Ensure remote directory exists
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "mkdir -p $VPS_PATH"

scp -i "$SSH_KEY" \
  "$APPIMAGE_ARCHIVE" \
  "$APPIMAGE_SIG" \
  "$PROJECT_DIR/latest.json" \
  "$VPS_USER@$VPS_HOST:$VPS_PATH/"

# --- Verify ---
echo -e "${YELLOW}[6/6] Verifying deployment...${NC}"
REMOTE_VERSION=$(ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "cat $VPS_PATH/latest.json" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version" 2>/dev/null || echo "FAILED")

if [[ "$REMOTE_VERSION" == "$VERSION" ]]; then
  echo -e "  ${GREEN}Verified: VPS manifest version = $REMOTE_VERSION${NC}"
else
  echo -e "${RED}WARNING: Version mismatch! Local=$VERSION, Remote=$REMOTE_VERSION${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${GREEN}  Version: $VERSION${NC}"
echo -e "${GREEN}  Endpoint: https://in-theflow.com/updates/latest.json${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Users will see the update notification on next app launch."
