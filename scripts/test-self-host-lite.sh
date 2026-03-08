#!/usr/bin/env bash
# ============================================================================
# FlowState Self-Host LITE Test
# ============================================================================
# Serves the production build (dist/) and tests against the existing local
# Supabase. Fast (~5 seconds) compared to full Docker stack test.
#
# Tests:
#   1. Frontend serves app HTML from dist/
#   2. SPA fallback routing works
#   3. Auth signup creates user
#   4. Auth signin returns access token
#   5. REST API query works with auth
#   6. docker-compose.self-host.yml is valid
#
# Usage:
#   ./scripts/test-self-host-lite.sh
#
# Prerequisites: node, curl, running local Supabase (supabase start)
#                Run `npm run build` first to create dist/
# ============================================================================

set -euo pipefail

TEST_PORT=13050
LOCAL_SUPABASE="http://127.0.0.1:54321"
SERVE_PID=""

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

cleanup() {
    [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null || true
}
trap cleanup EXIT

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# --- Prerequisites ---
echo -e "${CYAN}[INFO]${NC} Checking prerequisites..."

[ -f dist/index.html ] || { echo -e "${RED}[FAIL]${NC} dist/ not found. Run: npm run build"; exit 1; }

auth_status=$(curl -sf -o /dev/null -w '%{http_code}' "${LOCAL_SUPABASE}/auth/v1/health" 2>/dev/null || echo "000")
[ "$auth_status" != "000" ] || { echo -e "${RED}[FAIL]${NC} Local Supabase not running. Run: supabase start"; exit 1; }

ANON_KEY=$(supabase status -o env 2>/dev/null | grep '^ANON_KEY=' | sed 's/^ANON_KEY="//' | sed 's/"$//')
[ -n "$ANON_KEY" ] || { echo -e "${RED}[FAIL]${NC} Could not read Supabase keys"; exit 1; }

echo -e "${GREEN}[ OK ]${NC} Prerequisites met"

# --- Start static server ---
echo -e "${CYAN}[INFO]${NC} Starting static server on port ${TEST_PORT}..."
npx serve dist -l "$TEST_PORT" -s &>/dev/null &
SERVE_PID=$!

for i in $(seq 1 15); do
    curl -sf "http://localhost:${TEST_PORT}/" >/dev/null 2>&1 && break
    sleep 0.5
done

# --- Tests ---
PASS=0; TOTAL=0
run() {
    TOTAL=$((TOTAL + 1))
    if eval "$2"; then
        echo -e "${GREEN}[ OK ]${NC} Test ${TOTAL}: $1"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}[FAIL]${NC} Test ${TOTAL}: $1"
    fi
}

echo ""
echo -e "${BOLD}Running tests...${NC}"
echo ""

run "Frontend serves app HTML" \
    'curl -sf http://localhost:'"${TEST_PORT}"'/ | grep -q "<div id=\"app\">"'

run "SPA fallback routing" \
    'curl -sf http://localhost:'"${TEST_PORT}"'/some/deep/route | grep -q "<div id=\"app\">"'

email="sh-$(date +%s)@test.local"

run "Auth signup creates user" \
    "curl -sf -X POST ${LOCAL_SUPABASE}/auth/v1/signup -H 'Content-Type: application/json' -H 'apikey: ${ANON_KEY}' -d '{\"email\":\"${email}\",\"password\":\"testpass123\"}' | grep -q '\"id\"'"

run "Auth signin returns token" \
    "curl -sf -X POST '${LOCAL_SUPABASE}/auth/v1/token?grant_type=password' -H 'Content-Type: application/json' -H 'apikey: ${ANON_KEY}' -d '{\"email\":\"${email}\",\"password\":\"testpass123\"}' | grep -q '\"access_token\"'"

token=$(curl -sf -X POST "${LOCAL_SUPABASE}/auth/v1/token?grant_type=password" \
    -H 'Content-Type: application/json' \
    -H "apikey: ${ANON_KEY}" \
    -d "{\"email\":\"${email}\",\"password\":\"testpass123\"}" | \
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).access_token||''))")

run "REST API query with auth" \
    "curl -sf '${LOCAL_SUPABASE}/rest/v1/tasks?select=id&limit=1' -H 'apikey: ${ANON_KEY}' -H 'Authorization: Bearer ${token}' -H 'Accept: application/json' | grep -q '^\['"

run "docker-compose.self-host.yml valid" \
    'docker compose -f docker-compose.self-host.yml config --quiet 2>/dev/null'

# --- Results ---
echo ""
if [ $PASS -eq $TOTAL ]; then
    echo -e "${BOLD}${GREEN}All ${TOTAL} tests passed${NC}"
    exit 0
else
    FAILED=$((TOTAL - PASS))
    echo -e "${BOLD}${RED}${FAILED}/${TOTAL} tests failed${NC}"
    exit 1
fi
