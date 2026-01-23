#!/bin/bash
#
# FlowState Stress Test Runner
# TASK-338: Run comprehensive stress test suite
#
# Usage:
#   ./scripts/run-stress-tests.sh          # Run all tests
#   ./scripts/run-stress-tests.sh quick    # Quick smoke test
#   ./scripts/run-stress-tests.sh security # Security tests only
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_DIR/reports/stress-test-report"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  FlowState Stress Test Suite               ║${NC}"
echo -e "${BLUE}║  TASK-338: Comprehensive Testing           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Pre-flight checks
echo -e "${YELLOW}Pre-flight checks...${NC}"

# Check dev server
if curl -s http://localhost:5546 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Dev server running on port 5546"
else
    echo -e "  ${RED}✗${NC} Dev server not running"
    echo -e "    Run: ${YELLOW}npm run dev${NC}"
    exit 1
fi

# Check Docker (optional)
if docker ps > /dev/null 2>&1; then
    SUPABASE_CONTAINERS=$(docker ps --filter "name=supabase" --format "{{.Names}}" 2>/dev/null | wc -l)
    if [ "$SUPABASE_CONTAINERS" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} Docker running with $SUPABASE_CONTAINERS Supabase containers"
    else
        echo -e "  ${YELLOW}⚠${NC} Docker running but no Supabase containers"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} Docker not available - container tests will be skipped"
fi

echo ""

# Determine test filter
TEST_FILTER=""
TIMEOUT="120000"

case "${1:-all}" in
    quick)
        echo -e "${BLUE}Running quick smoke tests (@quick tagged)...${NC}"
        TEST_FILTER="--grep @quick"
        TIMEOUT="60000"
        ;;
    security)
        echo -e "${BLUE}Running security tests...${NC}"
        TEST_FILTER="--grep Security"
        ;;
    data)
        echo -e "${BLUE}Running data integrity tests...${NC}"
        TEST_FILTER="--grep \"Data Integrity\""
        ;;
    restore)
        echo -e "${BLUE}Running restore verification tests...${NC}"
        TEST_FILTER="--grep Restore"
        ;;
    container)
        echo -e "${BLUE}Running container stability tests...${NC}"
        TEST_FILTER="--grep Container"
        ;;
    all)
        echo -e "${BLUE}Running all stress tests...${NC}"
        ;;
    *)
        echo -e "${BLUE}Running tests matching: $1${NC}"
        TEST_FILTER="--grep \"$1\""
        ;;
esac

echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

# Run Playwright stress tests
echo -e "${YELLOW}Running Playwright stress tests...${NC}"
cd "$PROJECT_DIR"

npx playwright test \
    --config=tests/stress/playwright.stress.config.ts \
    --timeout=$TIMEOUT \
    --reporter=list,json \
    $TEST_FILTER \
    2>&1 | tee "$REPORT_DIR/test-output.log" || true

# Move JSON results if generated
if [ -f "test-results.json" ]; then
    mv test-results.json "$REPORT_DIR/results.json"
fi

echo ""

# Run performance benchmarks (if running all tests)
if [ "${1:-all}" = "all" ]; then
    echo -e "${YELLOW}Running performance benchmarks...${NC}"
    npm run test:bench 2>&1 | tee -a "$REPORT_DIR/test-output.log" || true
    echo ""
fi

# Generate HTML report
echo -e "${YELLOW}Generating report...${NC}"
node "$SCRIPT_DIR/generate-stress-report.cjs" || true

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Complete                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Report: ${GREEN}$REPORT_DIR/index.html${NC}"
echo ""

# Open report if on desktop
if command -v xdg-open > /dev/null 2>&1; then
    read -p "Open report in browser? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "$REPORT_DIR/index.html"
    fi
fi
