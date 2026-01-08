#!/bin/bash
# Cache Header Verification Script
# Verifies proper caching configuration for PWA
# Usage: bash scripts/deploy/verify-caching.sh [domain]

set -e

DOMAIN="${1:-https://pomoflow.yourdomain.com}"
TIMEOUT=10
WARNINGS=0

echo "========================================"
echo "Cache Header Verification"
echo "Domain: $DOMAIN"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

warn() {
  echo -e "${YELLOW}WARNING${NC}: $1"
  ((WARNINGS++))
}

info() {
  echo -e "${BLUE}INFO${NC}: $1"
}

check_cache() {
  local URL=$1
  local NAME=$2
  local EXPECTED=$3

  echo ""
  echo "$NAME"
  echo "URL: $URL"

  HEADERS=$(curl -sI --max-time $TIMEOUT "$URL" 2>/dev/null)
  HTTP_CODE=$(echo "$HEADERS" | head -1 | awk '{print $2}')

  if [ "$HTTP_CODE" != "200" ]; then
    warn "$NAME returned HTTP $HTTP_CODE"
    return
  fi

  CACHE=$(echo "$HEADERS" | grep -i "cache-control" | tr -d '\r\n')

  if [ -z "$CACHE" ]; then
    warn "No cache-control header for $NAME"
  else
    echo "  $CACHE"

    case "$EXPECTED" in
      "no-cache")
        if echo "$CACHE" | grep -qiE "no-cache|no-store|max-age=0"; then
          ok "Correct: Not cached"
        else
          warn "Expected no-cache/no-store for $NAME"
        fi
        ;;
      "long-cache")
        if echo "$CACHE" | grep -qiE "max-age=(31536000|[0-9]{7,})|immutable"; then
          ok "Correct: Long-term cache"
        else
          warn "Expected long cache (max-age >= 1 year) for $NAME"
        fi
        ;;
      "short-cache")
        if echo "$CACHE" | grep -qiE "max-age=[0-9]{1,5}"; then
          ok "Correct: Short-term cache"
        else
          info "Check if cache policy is appropriate for $NAME"
        fi
        ;;
    esac
  fi

  # Check ETag
  ETAG=$(echo "$HEADERS" | grep -i "etag" | tr -d '\r\n')
  if [ -n "$ETAG" ]; then
    echo "  $ETAG"
  fi
}

echo "1. HTML (index.html)"
echo "--------------------"
echo "Expected: no-cache (to allow SW updates)"
check_cache "$DOMAIN/" "index.html" "no-cache"

echo ""
echo "2. Service Worker"
echo "-----------------"
echo "Expected: no-store/no-cache (CRITICAL for updates)"
check_cache "$DOMAIN/sw.js" "sw.js" "no-cache"

echo ""
echo "3. Web App Manifest"
echo "-------------------"
echo "Expected: Short cache (< 1 day) or no-cache"
check_cache "$DOMAIN/manifest.webmanifest" "manifest.webmanifest" "short-cache"

echo ""
echo "4. JavaScript Bundles"
echo "---------------------"
echo "Expected: Long cache with immutable (hashed filenames)"

# Get a JS asset from the HTML
JS_ASSET=$(curl -s --max-time $TIMEOUT "$DOMAIN/" | grep -oP 'assets/[^"]+\.js' | head -1)
if [ -n "$JS_ASSET" ]; then
  check_cache "$DOMAIN/$JS_ASSET" "JS Bundle" "long-cache"
else
  warn "Could not find JS asset to check"
fi

echo ""
echo "5. CSS Bundles"
echo "--------------"
echo "Expected: Long cache with immutable (hashed filenames)"

CSS_ASSET=$(curl -s --max-time $TIMEOUT "$DOMAIN/" | grep -oP 'assets/[^"]+\.css' | head -1)
if [ -n "$CSS_ASSET" ]; then
  check_cache "$DOMAIN/$CSS_ASSET" "CSS Bundle" "long-cache"
else
  info "No CSS asset found (may be inline)"
fi

echo ""
echo "6. Static Assets (Icons/Images)"
echo "--------------------------------"
echo "Expected: Long cache"

# Try common icon paths
ICON_PATHS=("/favicon.ico" "/icons/pwa-192x192.png" "/apple-touch-icon.png")
FOUND_ICON=false

for icon in "${ICON_PATHS[@]}"; do
  HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DOMAIN$icon" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    check_cache "$DOMAIN$icon" "Icon: $icon" "long-cache"
    FOUND_ICON=true
    break
  fi
done

if [ "$FOUND_ICON" = false ]; then
  info "No icon files found to check"
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "Caching Best Practices for PWA:"
echo "  - HTML files: no-cache (allows SW to serve latest)"
echo "  - sw.js: no-store (MUST always fetch from network)"
echo "  - manifest: short cache or no-cache"
echo "  - JS/CSS (hashed): 1 year + immutable"
echo "  - Images/fonts: 1 year cache"
echo ""

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}$WARNINGS warning(s) found${NC}"
  echo "Review caching configuration in nginx.conf"
else
  echo -e "${GREEN}All cache headers look good${NC}"
fi
echo "========================================"
