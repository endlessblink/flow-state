#!/bin/bash
# CORS Validation Script for FlowState Production
# Usage: ./scripts/validate-cors.sh [--verbose]
# Exit codes: 0 = success, 1 = CORS failure

set -e

API_URL="${API_URL:-https://api.in-theflow.com}"
ORIGIN="${ORIGIN:-https://in-theflow.com}"
VERBOSE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    if [ "$2" = "pass" ]; then
        echo -e "${GREEN}✓${NC} $1"
    elif [ "$2" = "fail" ]; then
        echo -e "${RED}✗${NC} $1"
    else
        echo -e "${YELLOW}○${NC} $1"
    fi
}

echo "================================================"
echo "FlowState CORS Validation"
echo "API: $API_URL"
echo "Origin: $ORIGIN"
echo "================================================"
echo ""

FAILURES=0

# Test 1: Basic OPTIONS preflight
echo "Test 1: OPTIONS preflight response..."
PREFLIGHT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,apikey")

if [ "$PREFLIGHT" = "204" ] || [ "$PREFLIGHT" = "200" ]; then
    print_status "Preflight returns $PREFLIGHT" "pass"
else
    print_status "Preflight returns $PREFLIGHT (expected 204)" "fail"
    ((FAILURES++))
fi

# Test 2: Access-Control-Allow-Origin header
echo ""
echo "Test 2: Access-Control-Allow-Origin header..."
ACAO=$(curl -s --max-time 10 -I \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control-allow-origin" | head -1)

if echo "$ACAO" | grep -q "$ORIGIN"; then
    print_status "Origin header correct: $ACAO" "pass"
else
    print_status "Origin header missing or incorrect: $ACAO" "fail"
    ((FAILURES++))
fi

# Test 3: No duplicate CORS headers
echo ""
echo "Test 3: No duplicate Access-Control headers..."
ACAO_COUNT=$(curl -s --max-time 10 -I \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -ci "access-control-allow-origin" || echo "0")

if [ "$ACAO_COUNT" = "1" ]; then
    print_status "Single Access-Control-Allow-Origin header" "pass"
else
    print_status "Found $ACAO_COUNT Access-Control-Allow-Origin headers (expected 1)" "fail"
    ((FAILURES++))
fi

# Test 4: Authorization header allowed
echo ""
echo "Test 4: Authorization header in Access-Control-Allow-Headers..."
ACAH=$(curl -s --max-time 10 -I \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization" 2>/dev/null | grep -i "access-control-allow-headers" | head -1)

if echo "$ACAH" | grep -qi "authorization"; then
    print_status "Authorization header allowed" "pass"
else
    print_status "Authorization header NOT in allowed headers" "fail"
    ((FAILURES++))
fi

# Test 5: PostgREST headers allowed (accept-profile)
echo ""
echo "Test 5: PostgREST headers (accept-profile) allowed..."
PREFLIGHT_PROFILE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: accept-profile")

if [ "$PREFLIGHT_PROFILE" = "204" ] || [ "$PREFLIGHT_PROFILE" = "200" ]; then
    print_status "accept-profile header allowed" "pass"
else
    print_status "accept-profile header NOT allowed (got $PREFLIGHT_PROFILE)" "fail"
    ((FAILURES++))
fi

# Test 6: Supabase SDK headers allowed (x-supabase-api-version)
echo ""
echo "Test 6: Supabase SDK headers (x-supabase-api-version) allowed..."
PREFLIGHT_SDK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: x-supabase-api-version")

if [ "$PREFLIGHT_SDK" = "204" ] || [ "$PREFLIGHT_SDK" = "200" ]; then
    print_status "x-supabase-api-version header allowed" "pass"
else
    print_status "x-supabase-api-version header NOT allowed (got $PREFLIGHT_SDK)" "fail"
    ((FAILURES++))
fi

# Test 7: Credentials allowed
echo ""
echo "Test 7: Credentials allowed..."
ACAC=$(curl -s --max-time 10 -I \
    -X OPTIONS "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control-allow-credentials" | head -1)

if echo "$ACAC" | grep -qi "true"; then
    print_status "Credentials allowed: true" "pass"
else
    print_status "Credentials NOT allowed or missing" "fail"
    ((FAILURES++))
fi

# Test 8: Actual GET request with auth header
echo ""
echo "Test 8: GET request with Authorization header..."
GET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    "$API_URL/rest/v1/" \
    -H "Origin: $ORIGIN" \
    -H "apikey: test" \
    -H "Authorization: Bearer test")

# We expect 401 (unauthorized) but NOT a CORS error
if [ "$GET_RESPONSE" = "401" ] || [ "$GET_RESPONSE" = "200" ]; then
    print_status "GET request not blocked by CORS (got $GET_RESPONSE)" "pass"
elif [ "$GET_RESPONSE" = "0" ]; then
    print_status "GET request failed (network/CORS block)" "fail"
    ((FAILURES++))
else
    print_status "GET request returned $GET_RESPONSE" "info"
fi

# Summary
echo ""
echo "================================================"
if [ "$FAILURES" -eq 0 ]; then
    echo -e "${GREEN}All CORS tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAILURES CORS test(s) failed!${NC}"
    exit 1
fi
