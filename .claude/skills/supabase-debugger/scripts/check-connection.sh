#!/bin/bash
# Supabase Connection Diagnostic Script
# Usage: ./check-connection.sh [supabase-url] [anon-key]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "  Supabase Connection Diagnostics"
echo "======================================"
echo ""

# Check Docker
echo -n "Checking Docker... "
if docker ps > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "  Docker is not running. Start Docker Desktop first."
    exit 1
fi

# Check Supabase CLI
echo -n "Checking Supabase CLI... "
if command -v supabase &> /dev/null; then
    VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}OK${NC} ($VERSION)"
else
    echo -e "${YELLOW}NOT FOUND${NC}"
    echo "  Install with: npm install -g supabase"
fi

# Check Supabase status
echo -n "Checking Supabase services... "
if npx supabase status > /dev/null 2>&1; then
    echo -e "${GREEN}RUNNING${NC}"
else
    echo -e "${YELLOW}NOT RUNNING${NC}"
    echo "  Start with: npx supabase start"
fi

echo ""
echo "Service Endpoints:"
echo "--------------------------------------"

# Get Supabase status
STATUS=$(npx supabase status 2>/dev/null || echo "")

if [ -n "$STATUS" ]; then
    echo "$STATUS" | grep -E "API URL|DB URL|Studio URL|Anon key|Service role key" | while read line; do
        echo "  $line"
    done
fi

echo ""
echo "Connectivity Tests:"
echo "--------------------------------------"

# Default URLs for local Supabase
SUPABASE_URL=${1:-"http://localhost:54321"}
DB_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Test REST API
echo -n "REST API ($SUPABASE_URL)... "
if curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" | grep -q "200\|401"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test Auth service
echo -n "Auth Service... "
if curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/auth/v1/health" | grep -q "200"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test PostgreSQL
echo -n "PostgreSQL (localhost:5432)... "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    if psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
fi

# Test Studio
echo -n "Studio Dashboard (localhost:54323)... "
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:54323" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}NOT AVAILABLE${NC}"
fi

echo ""
echo "Database Status:"
echo "--------------------------------------"

# Test database queries
CONN_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle'" 2>/dev/null || echo "N/A")
echo "  Active connections: $CONN_COUNT"

MAX_CONN=$(psql "$DB_URL" -t -c "SHOW max_connections" 2>/dev/null || echo "N/A")
echo "  Max connections: $MAX_CONN"

# Check pg_stat_statements
HAS_STATS=$(psql "$DB_URL" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'" 2>/dev/null || echo "")
if [ -n "$HAS_STATS" ]; then
    echo -e "  Query stats: ${GREEN}Enabled${NC}"
else
    echo -e "  Query stats: ${YELLOW}Not enabled${NC}"
    echo "    Enable with: CREATE EXTENSION pg_stat_statements;"
fi

echo ""
echo "======================================"
echo "  Diagnostics Complete"
echo "======================================"
