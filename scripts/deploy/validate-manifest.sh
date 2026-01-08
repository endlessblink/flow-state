#!/bin/bash
# PWA Manifest Validation Script
# Validates manifest.webmanifest for PWA compliance
# Usage: bash scripts/deploy/validate-manifest.sh

set -e

MANIFEST="${1:-dist/manifest.webmanifest}"
ERRORS=0

echo "========================================"
echo "PWA Manifest Validation"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Check manifest exists
if [ ! -f "$MANIFEST" ]; then
  err "Manifest not found at $MANIFEST"
  echo ""
  echo "PWA not yet implemented. This is expected until PWA setup is complete."
  exit 0
fi

echo "Manifest file: $MANIFEST"
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
  err "jq is required for manifest validation. Install with: sudo apt install jq"
  exit 1
fi

# Validate JSON syntax
if ! jq empty "$MANIFEST" 2>/dev/null; then
  err "Invalid JSON in manifest"
  exit 1
fi

ok "Valid JSON syntax"
echo ""

echo "1. Required Fields"
echo "------------------"

# Required fields for PWA installability
REQUIRED_FIELDS=("name" "short_name" "icons" "start_url" "display")

for field in "${REQUIRED_FIELDS[@]}"; do
  VALUE=$(jq -r ".$field // \"__MISSING__\"" "$MANIFEST")
  if [ "$VALUE" = "__MISSING__" ] || [ "$VALUE" = "null" ]; then
    err "Missing required field: $field"
  else
    if [ "$field" = "icons" ]; then
      ICON_COUNT=$(jq '.icons | length' "$MANIFEST")
      ok "$field: $ICON_COUNT icon(s) defined"
    else
      ok "$field: $VALUE"
    fi
  fi
done

echo ""
echo "2. Recommended Fields"
echo "---------------------"

RECOMMENDED_FIELDS=("theme_color" "background_color" "description" "orientation" "scope")

for field in "${RECOMMENDED_FIELDS[@]}"; do
  VALUE=$(jq -r ".$field // \"__MISSING__\"" "$MANIFEST")
  if [ "$VALUE" = "__MISSING__" ] || [ "$VALUE" = "null" ]; then
    warn "Missing recommended field: $field"
  else
    ok "$field: $VALUE"
  fi
done

echo ""
echo "3. Icon Validation"
echo "------------------"

# Check for required icon sizes (for installability)
REQUIRED_SIZES=("192x192" "512x512")
ICON_SIZES=$(jq -r '.icons[].sizes // empty' "$MANIFEST")

for size in "${REQUIRED_SIZES[@]}"; do
  if echo "$ICON_SIZES" | grep -q "$size"; then
    ok "Icon size $size present"
  else
    err "Missing required icon size: $size"
  fi
done

# Check for maskable icon
MASKABLE=$(jq -r '.icons[] | select(.purpose == "maskable" or .purpose == "any maskable") | .sizes' "$MANIFEST" 2>/dev/null)
if [ -n "$MASKABLE" ]; then
  ok "Maskable icon present ($MASKABLE)"
else
  warn "No maskable icon defined (recommended for Android)"
fi

echo ""
echo "4. Display Mode"
echo "---------------"

DISPLAY=$(jq -r '.display // "browser"' "$MANIFEST")
VALID_DISPLAYS=("fullscreen" "standalone" "minimal-ui" "browser")

if [[ " ${VALID_DISPLAYS[*]} " =~ " ${DISPLAY} " ]]; then
  ok "Display mode: $DISPLAY"
  if [ "$DISPLAY" = "browser" ]; then
    warn "Display mode 'browser' won't provide app-like experience"
  fi
else
  err "Invalid display mode: $DISPLAY"
fi

echo ""
echo "5. Start URL"
echo "------------"

START_URL=$(jq -r '.start_url // "/"' "$MANIFEST")
ok "Start URL: $START_URL"

if [[ "$START_URL" == http* ]]; then
  warn "start_url should be relative, not absolute"
fi

echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}: $ERRORS error(s) found"
  exit 1
else
  echo -e "${GREEN}PASSED${NC}: Manifest validation complete"
fi
echo "========================================"
