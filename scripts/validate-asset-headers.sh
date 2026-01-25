#!/bin/bash
# Validate asset headers to prevent Cloudflare cache MIME type issues
# This runs in CI/CD after deployment to ensure proper headers are set

set -e

DOMAIN="${DOMAIN:-https://in-theflow.com}"
FAILED=0

echo "=== Asset Header Validation ==="
echo "Domain: $DOMAIN"
echo ""

# Function to check a URL for required headers
check_url() {
    local url="$1"
    local expected_type="$2"
    local name="$3"

    echo "Checking $name..."

    # Get headers
    headers=$(curl -sI "$url" 2>/dev/null)

    # Check Content-Type
    content_type=$(echo "$headers" | grep -i "^content-type:" | tr -d '\r' | cut -d' ' -f2-)
    if [[ "$content_type" != *"$expected_type"* ]]; then
        echo "  ✗ Content-Type: expected '$expected_type', got '$content_type'"
        FAILED=1
    else
        echo "  ✓ Content-Type: $content_type"
    fi

    # Check Vary header (CRITICAL for Cloudflare cache)
    vary=$(echo "$headers" | grep -i "^vary:" | tr -d '\r')
    if [[ -z "$vary" ]]; then
        echo "  ✗ Vary header missing (CRITICAL - causes Cloudflare cache issues)"
        FAILED=1
    elif [[ "$vary" != *"Accept"* ]]; then
        echo "  ⚠ Vary header doesn't include 'Accept': $vary"
        FAILED=1
    else
        echo "  ✓ Vary: $vary"
    fi

    # Check Cache-Control
    cache_control=$(echo "$headers" | grep -i "^cache-control:" | tr -d '\r')
    if [[ -z "$cache_control" ]]; then
        echo "  ⚠ Cache-Control header missing"
    else
        echo "  ✓ Cache-Control: $cache_control"
    fi

    # Check X-Content-Type-Options
    xcto=$(echo "$headers" | grep -i "^x-content-type-options:" | tr -d '\r')
    if [[ "$xcto" == *"nosniff"* ]]; then
        echo "  ✓ X-Content-Type-Options: nosniff"
    else
        echo "  ⚠ X-Content-Type-Options: nosniff not set"
    fi

    echo ""
}

# Get actual asset filenames from index.html
echo "Fetching index.html to find asset filenames..."
INDEX_HTML=$(curl -s "$DOMAIN/")

# Extract CSS filename
CSS_FILE=$(echo "$INDEX_HTML" | grep -oE 'href="/assets/index-[a-zA-Z0-9_-]+\.css"' | head -1 | sed 's/href="//;s/"//')
if [[ -n "$CSS_FILE" ]]; then
    check_url "$DOMAIN$CSS_FILE" "text/css" "CSS Asset"
else
    echo "⚠ Could not find CSS file in index.html"
fi

# Extract JS filename
JS_FILE=$(echo "$INDEX_HTML" | grep -oE 'src="/assets/index-[a-zA-Z0-9_-]+\.js"' | head -1 | sed 's/src="//;s/"//')
if [[ -n "$JS_FILE" ]]; then
    check_url "$DOMAIN$JS_FILE" "javascript" "JavaScript Asset"
else
    echo "⚠ Could not find JS file in index.html"
fi

# Check index.html headers (should have no-cache)
echo "Checking index.html..."
index_headers=$(curl -sI "$DOMAIN/" 2>/dev/null)
index_cache=$(echo "$index_headers" | grep -i "^cache-control:" | tr -d '\r')
if [[ "$index_cache" == *"no-cache"* ]] || [[ "$index_cache" == *"no-store"* ]]; then
    echo "  ✓ Cache-Control: $index_cache"
else
    echo "  ⚠ index.html should have 'no-cache' to prevent stale HTML: $index_cache"
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ $FAILED -eq 0 ]]; then
    echo "✓ All critical headers validated successfully"
    exit 0
else
    echo "✗ Some headers are missing or incorrect"
    echo ""
    echo "To fix, update your Caddyfile:"
    echo ""
    echo '  @assets path /assets/*'
    echo '  header @assets Vary "Accept-Encoding, Accept"'
    echo '  header @assets Cache-Control "public, max-age=31536000, immutable"'
    echo '  header @assets X-Content-Type-Options "nosniff"'
    echo ""
    exit 1
fi
