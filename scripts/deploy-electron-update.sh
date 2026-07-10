#!/usr/bin/env bash
# deploy-electron-update.sh — Build Electron app and deploy to VPS auto-updater
#
# Usage:
#   ./scripts/deploy-electron-update.sh [--notes "Release notes"] [--skip-deploy] [--skip-guard] [--skip-tests] [--dry-run]
#
# Prerequisites:
#   1. SSH key at ~/.ssh/id_ed25519 with access to VPS
#   2. electron-builder installed (npm dep)
#
# What it does:
#   1. Runs the Electron sync/auth/canvas regression guard
#   2. Runs the canonical Electron build (frontend, main process, patch, package, validate)
#   3. Uploads artifacts + latest-linux.yml to VPS via SCP
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
SKIP_GUARD="${SKIP_GUARD:-false}"
DRY_RUN=false

SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --notes) NOTES="$2"; shift 2 ;;
    --skip-deploy) SKIP_DEPLOY=true; shift ;;
    --skip-guard) SKIP_GUARD=true; shift ;;
    --skip-tests) SKIP_TESTS=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${CYAN}=== FlowState Electron Deploy v${VERSION} ===${NC}"
echo -e "Notes: ${NOTES:-'(none)'}"

node "$PROJECT_DIR/scripts/validate-electron-vite-env.cjs"

# Step 1: Run the Electron sync/auth/canvas regression sentinel before packaging.
echo -e "\n${YELLOW}[1/3] Electron sync regression guard...${NC}"
if [ "$SKIP_GUARD" = true ]; then
  echo -e "${YELLOW}  Skipping guard (--skip-guard / SKIP_GUARD=true)${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: npm run guard:electron-sync${NC}"
else
  # Run the guard in test mode. Doppler injects NODE_ENV=production, under which vite
  # mis-externalizes node builtins (await import('node:fs') → readFileSync undefined,
  # path.resolve undefined), spuriously failing source-integrity guards. A test step must
  # not inherit the production build env. The build step below still runs in production.
  NODE_ENV=test npm run guard:electron-sync
fi

# Step 1b (TASK-1904 follow-up): FULL ship gate — type-check + the complete unit
# suite. The July 2026 regression hunt found 17 broken tests that sat unnoticed
# because nothing forced them to run before a release; this makes the pipeline
# physically refuse to ship a regression these tests can see (~3-5 min).
# Emergency hotfix escape hatch: --skip-tests (loud, on your head).
echo -e "\n${YELLOW}[1b/3] Full ship gate (type-check + unit suite)...${NC}"
if [ "$SKIP_TESTS" = true ] || [ "$SKIP_GUARD" = true ]; then
  echo -e "${RED}  ⚠ SHIP GATE SKIPPED (--skip-tests/--skip-guard). This release is NOT regression-checked.${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: npm run type-check && npm run test${NC}"
else
  echo -e "  type-check (vue-tsc)..."
  NODE_ENV=test npm run type-check
  echo -e "  full unit suite (vitest)..."
  NODE_ENV=test npm run test
  echo -e "${GREEN}  ✓ Ship gate green${NC}"
fi

# Step 2: Build and package Electron app through the canonical release command
echo -e "\n${YELLOW}[2/3] Building and packaging Electron app...${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}  [DRY RUN] Would run: npm run electron:build${NC}"
else
  npm run electron:build
fi

# Check artifacts exist
if [ "$DRY_RUN" = false ]; then
  YML="$RELEASE_DIR/latest-linux.yml"

  if [ ! -s "$YML" ]; then
    echo -e "${RED}ERROR: Missing or empty updater manifest: $YML${NC}"
    exit 1
  fi

  # Bind deployment to every file named by the manifest. This fails closed on
  # a missing file, unsafe path, wrong size/checksum, or version mismatch.
  VALIDATED_FILES=$(node "$PROJECT_DIR/scripts/electron-release-collision-guard.cjs" \
    --local "$YML" \
    --artifacts-dir "$RELEASE_DIR" \
    --expected-version "$VERSION" \
    --print-files)
  mapfile -t RELEASE_FILES <<< "$VALIDATED_FILES"
  LOCAL_ARTIFACTS=()
  for artifact in "${RELEASE_FILES[@]}"; do
    LOCAL_ARTIFACTS+=("$RELEASE_DIR/$artifact")
    echo -e "${GREEN}  Artifact: $artifact ($(du -h "$RELEASE_DIR/$artifact" | cut -f1))${NC}"
  done
  echo -e "${GREEN}  Manifest: $(basename "$YML")${NC}"
fi

# Step 3: Deploy to VPS
if [ "$SKIP_DEPLOY" = true ]; then
  echo -e "\n${YELLOW}[3/3] Skipping deploy (--skip-deploy)${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "\n${YELLOW}[3/3] Deploy (DRY RUN)${NC}"
  echo -e "${CYAN}  Would upload to ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/${NC}"
else
  echo -e "\n${YELLOW}[3/3] Deploying to VPS...${NC}"

  # Create the release directory and a deploy-unique staging directory. Uploads
  # can happen concurrently, but promotion is serialized below.
  ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "mkdir -p ${VPS_PATH}"
  REMOTE_STAGE=$(ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "mktemp -d '${VPS_PATH}/.staging-${VERSION}-XXXXXX'")
  cleanup_remote_stage() {
    ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "rm -rf -- '$REMOTE_STAGE'" >/dev/null 2>&1 || true
  }
  trap cleanup_remote_stage EXIT

  # Stage the validated release under unique names. Under the remote flock, the
  # promotion script re-reads the live manifest, rejects collisions/downgrades,
  # verifies every staged byte, then publishes the manifest last.
  scp -i "$SSH_KEY" \
    "${LOCAL_ARTIFACTS[@]}" \
    "$YML" \
    "$PROJECT_DIR/scripts/electron-release-collision-guard.cjs" \
    "$PROJECT_DIR/scripts/promote-electron-release.sh" \
    "${VPS_USER}@${VPS_HOST}:${REMOTE_STAGE}/"
  ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "flock -x '${VPS_PATH}/.deploy.lock' bash '${REMOTE_STAGE}/promote-electron-release.sh' '${VPS_PATH}' '${REMOTE_STAGE}'"
  cleanup_remote_stage
  trap - EXIT

  echo -e "${GREEN}  Uploaded to ${VPS_HOST}:${VPS_PATH}/${NC}"
fi

echo -e "\n${GREEN}=== Deploy complete ===${NC}"
echo -e "Version: ${VERSION}"
echo -e "Update URL: https://in-theflow.com/updates/electron/"
