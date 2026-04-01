#!/usr/bin/env bash
# ============================================================================
# FlowState Self-Host E2E Test
# ============================================================================
# Spins up the full self-hosted stack (Postgres, GoTrue, PostgREST, Realtime,
# Kong, nginx) with isolated ports and project name, runs 6 functional tests,
# then tears everything down.
#
# Usage:
#   ./scripts/test-self-host.sh          # Run tests, then tear down
#   ./scripts/test-self-host.sh --keep   # Run tests, keep stack running for manual testing
#
# With --keep the stack stays up after tests pass so you can open
# http://localhost:13050 in your browser. Tear it down manually with:
#   docker compose -p flowstate-test -f docker-compose.self-host.yml \
#     --env-file .env.self-host.test down -v
#
# Requirements: docker, docker compose, openssl, node, curl
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — isolated from any real .env.self-host
# ---------------------------------------------------------------------------
PROJECT_NAME="flowstate-test"
COMPOSE_FILE="docker-compose.self-host.yml"
ENV_FILE=".env.self-host.test"

# Non-default ports to avoid clashing with a running instance
TEST_FLOWSTATE_PORT=13050
TEST_KONG_PORT=18000
TEST_KONG_HTTPS_PORT=18443
TEST_POSTGRES_PORT=15432

HEALTH_TIMEOUT=180   # seconds to wait for stack to be healthy
HEALTH_INTERVAL=5
KEEP_RUNNING=false   # --keep flag: skip cleanup after tests pass

# ---------------------------------------------------------------------------
# Colors & helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[ OK ]${NC} $*"; }
fail()    { echo -e "${RED}[FAIL]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --keep) KEEP_RUNNING=true ;;
        --help|-h)
            echo "Usage: $0 [--keep]"
            echo "  --keep  Keep the stack running after tests pass for manual browser testing"
            exit 0
            ;;
        *) warn "Unknown argument: $arg" ;;
    esac
done

# ---------------------------------------------------------------------------
# Cleanup trap — always tears down the stack on error; skips if --keep + pass
# ---------------------------------------------------------------------------
TEST_PASSED=false

cleanup() {
    if [ "$KEEP_RUNNING" = true ] && [ "$TEST_PASSED" = true ]; then
        echo ""
        success "Stack kept running (--keep flag)"
        echo ""
        echo -e "  ${BOLD}App:${NC}  http://localhost:${TEST_FLOWSTATE_PORT}"
        echo -e "  ${BOLD}API:${NC}  http://localhost:${TEST_KONG_PORT}"
        echo ""
        echo "  To tear down:"
        echo "    docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE} --env-file ${ENV_FILE} down -v"
        echo ""
        return
    fi
    echo ""
    info "Cleaning up test stack..."
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --remove-orphans 2>/dev/null || true
    rm -f "$ENV_FILE"
    info "Cleanup complete."
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Detect project root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."
for cmd in docker openssl node curl; do
    if ! command -v "$cmd" &>/dev/null; then
        fail "Missing required tool: $cmd"
        exit 1
    fi
done

if ! docker compose version &>/dev/null 2>&1; then
    fail "docker compose plugin not found"
    exit 1
fi
success "All prerequisites met"

# ---------------------------------------------------------------------------
# Generate secrets
# ---------------------------------------------------------------------------
info "Generating test secrets..."

POSTGRES_PASSWORD="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"

read -r ANON_KEY SERVICE_ROLE_KEY <<< "$(node -e "
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const exp = Math.floor(Date.now() / 1000) + (10 * 365.25 * 24 * 60 * 60);
function jwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}
const anon = jwt({ iss: 'supabase', ref: 'self-hosted', role: 'anon', iat: Math.floor(Date.now()/1000), exp });
const service = jwt({ iss: 'supabase', ref: 'self-hosted', role: 'service_role', iat: Math.floor(Date.now()/1000), exp });
process.stdout.write(anon + ' ' + service);
")"

success "Secrets generated"

# ---------------------------------------------------------------------------
# Write isolated env file
# ---------------------------------------------------------------------------
cat > "$ENV_FILE" << ENVEOF
# Auto-generated by test-self-host.sh — DO NOT EDIT
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=postgres
POSTGRES_PORT=${TEST_POSTGRES_PORT}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SITE_URL=http://localhost:${TEST_FLOWSTATE_PORT}
API_EXTERNAL_URL=http://localhost:${TEST_KONG_PORT}
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
VITE_SUPABASE_URL=http://localhost:${TEST_KONG_PORT}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
FLOWSTATE_PORT=${TEST_FLOWSTATE_PORT}
KONG_HTTP_PORT=${TEST_KONG_PORT}
KONG_HTTPS_PORT=${TEST_KONG_HTTPS_PORT}
ENVEOF

success "Wrote $ENV_FILE"

# ---------------------------------------------------------------------------
# Build & start the stack
# ---------------------------------------------------------------------------
info "Starting Docker Compose stack (project: ${PROJECT_NAME})..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build 2>&1 | tail -5

# ---------------------------------------------------------------------------
# Wait for health checks
# ---------------------------------------------------------------------------
info "Waiting for services to become healthy (timeout: ${HEALTH_TIMEOUT}s)..."

elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    # Count services that are NOT healthy yet
    not_ready=$(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        ps --format json 2>/dev/null | \
        node -e "
            let d='';
            process.stdin.on('data',c=>d+=c);
            process.stdin.on('end',()=>{
                try {
                    const svcs=d.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
                    const bad=svcs.filter(s=>s.Health!=='healthy'&&s.State==='running'&&s.Service!=='migrate');
                    process.stdout.write(String(bad.length));
                } catch(e) { process.stdout.write('?'); }
            });
        " 2>/dev/null || echo "?")

    if [ "$not_ready" = "0" ]; then
        echo ""
        success "All services healthy after ${elapsed}s"
        break
    fi

    printf "\r  Waiting... %ds / %ds (not ready: %s)" "$elapsed" "$HEALTH_TIMEOUT" "$not_ready"
    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))
done

if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
    echo ""
    fail "Timed out waiting for services to become healthy"
    echo ""
    info "Service status:"
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    info "Logs (last 30 lines per service):"
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=30
    exit 1
fi

# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------
PASS=0
TOTAL=0

run_test() {
    local name="$1"
    shift
    TOTAL=$((TOTAL + 1))
    if "$@"; then
        success "Test ${TOTAL}: ${name}"
        PASS=$((PASS + 1))
    else
        fail "Test ${TOTAL}: ${name}"
    fi
}

echo ""
echo -e "${BOLD}Running E2E tests...${NC}"
echo ""

# --- Test 1: Frontend serves HTML with <div id="app"> ---
run_test "Frontend serves app HTML" bash -c "
    curl -sf http://localhost:${TEST_FLOWSTATE_PORT}/ | grep -q '<div id=\"app\">'
"

# --- Test 2: Frontend /health returns ok ---
run_test "Frontend /health returns ok" bash -c "
    body=\$(curl -sf http://localhost:${TEST_FLOWSTATE_PORT}/health)
    [ \"\$body\" = 'ok' ]
"

# --- Test 3: Kong API gateway reachable ---
run_test "Kong API gateway reachable" bash -c "
    status=\$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:${TEST_KONG_PORT}/)
    # Kong returns 404 for root (no route), but that proves it's running
    [ \"\$status\" = '404' ] || [ \"\$status\" = '200' ]
"

# --- Test 4: Auth signup works (GoTrue via Kong) ---
SIGNUP_RESPONSE=""
run_test "Auth signup creates user" bash -c "
    resp=\$(curl -sf -X POST http://localhost:${TEST_KONG_PORT}/auth/v1/signup \
        -H 'Content-Type: application/json' \
        -H 'apikey: ${ANON_KEY}' \
        -d '{\"email\":\"test@flowstate.local\",\"password\":\"testpassword123\"}')
    echo \"\$resp\" > /tmp/flowstate-test-signup.json
    echo \"\$resp\" | node -e \"
        let d='';
        process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
            const j=JSON.parse(d);
            if(j.id || j.access_token) process.exit(0);
            else { console.error('No id or access_token in response:', d); process.exit(1); }
        });
    \"
"

# --- Test 5: Auth sign-in works (get access token) ---
ACCESS_TOKEN=""
run_test "Auth sign-in returns access token" bash -c "
    resp=\$(curl -sf -X POST http://localhost:${TEST_KONG_PORT}/auth/v1/token?grant_type=password \
        -H 'Content-Type: application/json' \
        -H 'apikey: ${ANON_KEY}' \
        -d '{\"email\":\"test@flowstate.local\",\"password\":\"testpassword123\"}')
    echo \"\$resp\" > /tmp/flowstate-test-signin.json
    echo \"\$resp\" | node -e \"
        let d='';
        process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
            const j=JSON.parse(d);
            if(j.access_token) process.exit(0);
            else { console.error('No access_token:', d); process.exit(1); }
        });
    \"
"

# --- Test 6: REST API returns [] for tasks with auth ---
run_test "REST API returns empty tasks list" bash -c "
    # Extract the token from sign-in response
    token=\$(cat /tmp/flowstate-test-signin.json | node -e \"
        let d='';
        process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).access_token||''));
    \")
    if [ -z \"\$token\" ]; then
        echo 'No access token available (sign-in may have failed)'
        exit 1
    fi
    resp=\$(curl -sf http://localhost:${TEST_KONG_PORT}/rest/v1/tasks?select=id \
        -H 'apikey: ${ANON_KEY}' \
        -H \"Authorization: Bearer \$token\" \
        -H 'Accept: application/json')
    [ \"\$resp\" = '[]' ]
"

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up temp files
rm -f /tmp/flowstate-test-signup.json /tmp/flowstate-test-signin.json

if [ $PASS -eq $TOTAL ]; then
    echo -e "${BOLD}${GREEN}  All ${TOTAL} tests passed${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    TEST_PASSED=true
    exit 0
else
    FAILED=$((TOTAL - PASS))
    echo -e "${BOLD}${RED}  ${FAILED}/${TOTAL} tests failed${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    info "Service logs (last 20 lines):"
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=20 2>/dev/null || true
    echo ""
    exit 1
fi
