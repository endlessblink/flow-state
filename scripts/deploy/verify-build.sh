#!/bin/bash
# PWA Build Verification Script
# Run after `npm run build` to validate deployment artifacts
# Usage: bash scripts/deploy/verify-build.sh

set -e

BUILD_DIR="${1:-dist}"
MAX_SIZE_MB=5
ERRORS=0

echo "========================================"
echo "PWA Build Artifact Verification"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

warn() {
  echo -e "${YELLOW}WARNING${NC}: $1"
}

err() {
  echo -e "${RED}ERROR${NC}: $1"
  ((ERRORS++))
}

# Check build directory exists
if [ ! -d "$BUILD_DIR" ]; then
  err "Build directory '$BUILD_DIR' not found. Run 'npm run build' first."
  exit 1
fi

echo "1. Required Files"
echo "-----------------"

# Check required files
REQUIRED_FILES=(
  "$BUILD_DIR/index.html"
)

# PWA files are required for production convergence: the installed PWA must
# receive the same release worker and manifest as the Electron runtime.
PWA_FILES=(
  "$BUILD_DIR/sw.js"
  "$BUILD_DIR/manifest.webmanifest"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    ok "$file exists"
  else
    err "$file missing"
  fi
done

echo ""
echo "2. PWA Files"
echo "-------------"

for file in "${PWA_FILES[@]}"; do
  if [ -f "$file" ]; then
    ok "$file exists"
  else
    err "$file missing"
  fi
done

echo ""
echo "3. Asset Bundles"
echo "----------------"

# Check JS bundles
JS_COUNT=$(ls "$BUILD_DIR/assets/"*.js 2>/dev/null | wc -l)
if [ "$JS_COUNT" -ge 1 ]; then
  ok "$JS_COUNT JavaScript bundle(s) found"
  ls -lh "$BUILD_DIR/assets/"*.js | head -5
else
  err "No JavaScript bundles found in $BUILD_DIR/assets/"
fi

# The worker must belong to this exact build, not merely exist beside it. An
# additive upload can otherwise publish fresh index.html while leaving an old
# worker that precaches a previous hashed entrypoint and hangs first boot.
MAIN_JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$BUILD_DIR/index.html" | head -1 || true)
if [ -z "$MAIN_JS" ]; then
  err "index.html does not reference a hashed index JavaScript bundle"
elif grep -Fq "$MAIN_JS" "$BUILD_DIR/sw.js"; then
  ok "Service worker references the current index bundle: $MAIN_JS"
else
  err "Service worker does not reference the current index bundle: $MAIN_JS"
fi

echo ""

# Check CSS bundles
CSS_COUNT=$(ls "$BUILD_DIR/assets/"*.css 2>/dev/null | wc -l)
if [ "$CSS_COUNT" -ge 1 ]; then
  ok "$CSS_COUNT CSS bundle(s) found"
  ls -lh "$BUILD_DIR/assets/"*.css | head -3
else
  warn "No CSS bundles found (may be inline)"
fi

echo ""
echo "4. Build Size"
echo "-------------"

# Check total build size
TOTAL_SIZE=$(du -sm "$BUILD_DIR" | cut -f1)
if [ "$TOTAL_SIZE" -gt "$MAX_SIZE_MB" ]; then
  warn "Build size ${TOTAL_SIZE}MB exceeds ${MAX_SIZE_MB}MB target"
else
  ok "Build size: ${TOTAL_SIZE}MB (target: < ${MAX_SIZE_MB}MB)"
fi

# Show largest files
echo ""
echo "Largest files:"
find "$BUILD_DIR" -type f -exec du -h {} + | sort -rh | head -5

echo ""
echo "5. Source Maps"
echo "--------------"

# Check for source maps (should not exist in production)
MAP_COUNT=$(find "$BUILD_DIR" -name "*.map" 2>/dev/null | wc -l)
if [ "$MAP_COUNT" -gt 0 ]; then
  warn "$MAP_COUNT source map(s) found in production build"
  find "$BUILD_DIR" -name "*.map" | head -3
else
  ok "No source maps in production build"
fi

echo ""
echo "6. Index.html Verification"
echo "--------------------------"

# Check index.html references
if grep -q "<script" "$BUILD_DIR/index.html"; then
  ok "Script tags present in index.html"
else
  err "No script tags in index.html"
fi

if grep -q "assets/" "$BUILD_DIR/index.html"; then
  ok "Asset references found in index.html"
else
  warn "No asset references in index.html"
fi

echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}: $ERRORS error(s) found"
  exit 1
else
  echo -e "${GREEN}PASSED${NC}: Build verification complete"
fi
echo "========================================"
