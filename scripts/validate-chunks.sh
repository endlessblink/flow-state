#!/bin/bash
# BUG-1184: Post-deploy chunk integrity verification
# Ensures every JS/CSS chunk referenced in the production bundle exists and loads.
# Catches: stale assets after rsync --delete, partial deploys, Cloudflare cache mismatches.
#
# Usage: DOMAIN=https://in-theflow.com ./scripts/validate-chunks.sh

set -euo pipefail

DOMAIN="${DOMAIN:-https://in-theflow.com}"
FAIL=0
CHECKED=0

echo "🔍 [BUG-1184] Validating chunk integrity on ${DOMAIN}..."

# Step 1: Fetch index.html and extract the main bundle URL
INDEX_HTML=$(curl -sf "${DOMAIN}/" 2>&1) || {
  echo "✗ FATAL: Could not fetch ${DOMAIN}/"
  exit 1
}

MAIN_BUNDLE=$(echo "$INDEX_HTML" | grep -oP 'src="/assets/index-[^"]+' | head -1 | sed 's|src="||')
if [ -z "$MAIN_BUNDLE" ]; then
  echo "✗ FATAL: Could not find main bundle reference in index.html"
  exit 1
fi
echo "  Main bundle: ${MAIN_BUNDLE}"

# Step 2: Check main bundle loads
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DOMAIN}${MAIN_BUNDLE}" 2>&1) || HTTP_CODE="000"
if [ "$HTTP_CODE" != "200" ]; then
  echo "✗ FATAL: Main bundle returned HTTP ${HTTP_CODE}"
  exit 1
fi

# Step 3: Extract ALL direct asset references from index.html (modulepreload, stylesheet, script)
DIRECT_REFS=$(echo "$INDEX_HTML" | grep -oP '(?:href|src)="/assets/[^"]+' | sed 's|.*="/||' | sort -u)

echo "  Checking direct references from index.html..."
for ref in $DIRECT_REFS; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DOMAIN}/${ref}" 2>&1) || HTTP_CODE="000"
  CHECKED=$((CHECKED + 1))
  if [ "$HTTP_CODE" != "200" ]; then
    echo "  ✗ MISSING (${HTTP_CODE}): /${ref}"
    FAIL=$((FAIL + 1))
  fi
done

# Step 4: Extract lazy-loaded chunk references from the main bundle
MAIN_JS=$(curl -sf "${DOMAIN}${MAIN_BUNDLE}" 2>&1) || {
  echo "✗ Could not download main bundle for lazy chunk analysis"
  exit 1
}

LAZY_CHUNKS=$(echo "$MAIN_JS" | grep -oP '"assets/[^"]+\.(js|css)"' | tr -d '"' | sort -u)
LAZY_COUNT=$(echo "$LAZY_CHUNKS" | wc -l)
echo "  Checking ${LAZY_COUNT} lazy-loaded chunks from main bundle..."

for chunk in $LAZY_CHUNKS; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DOMAIN}/${chunk}" 2>&1) || HTTP_CODE="000"
  CHECKED=$((CHECKED + 1))
  if [ "$HTTP_CODE" != "200" ]; then
    echo "  ✗ MISSING (${HTTP_CODE}): /${chunk}"
    FAIL=$((FAIL + 1))
  fi
done

# Step 5: Verify service worker chunk list matches
SW_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DOMAIN}/sw.js" 2>&1) || SW_CODE="000"
if [ "$SW_CODE" = "200" ]; then
  SW_JS=$(curl -sf "${DOMAIN}/sw.js" 2>&1)
  SW_CHUNKS=$(echo "$SW_JS" | grep -oP '"url":"assets/[^"]+\.(js|css)"' | sed 's|"url":"||;s|"||g' | sort -u)
  SW_MISSING=0
  for chunk in $SW_CHUNKS; do
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DOMAIN}/${chunk}" 2>&1) || HTTP_CODE="000"
    CHECKED=$((CHECKED + 1))
    if [ "$HTTP_CODE" != "200" ]; then
      echo "  ✗ SW STALE (${HTTP_CODE}): /${chunk}"
      SW_MISSING=$((SW_MISSING + 1))
      FAIL=$((FAIL + 1))
    fi
  done
  if [ "$SW_MISSING" -gt 0 ]; then
    echo "  ⚠️  Service worker references ${SW_MISSING} chunks that don't exist!"
    echo "     This will cause chunk load failures for users with cached SW."
  fi
fi

# Report
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "✗ CHUNK INTEGRITY FAILED: ${FAIL} missing chunks out of ${CHECKED} checked"
  echo "  Users WILL see 'Failed to fetch dynamically imported module' errors."
  echo "  Fix: redeploy to ensure all assets are in sync."
  exit 1
else
  echo "✓ All ${CHECKED} chunks verified — production assets are consistent"
fi
