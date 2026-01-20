#!/bin/bash
# BUG-339 Auth Reliability Test Script
# Tests: session persistence, token refresh, no duplicates on sign-in

set -e

echo "============================================================"
echo "BUG-339 Auth Reliability Test"
echo "============================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build check (verifies TypeScript compiles)
echo -e "${YELLOW}Step 1: Running build verification...${NC}"
npm run build 2>&1 | tail -10
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build verification passed${NC}"
else
    echo -e "${RED}❌ Build verification failed${NC}"
    exit 1
fi
echo ""

# Step 2: Run migration verification
echo -e "${YELLOW}Step 2: Running migration logic verification...${NC}"
node scripts/verify-bug339-migration.cjs
echo ""

# Step 3: Build the app
echo -e "${YELLOW}Step 3: Building Tauri app...${NC}"
npm run tauri build 2>&1 | tail -30
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tauri build successful${NC}"
else
    echo -e "${RED}❌ Tauri build failed${NC}"
    exit 1
fi
echo ""

# Step 4: Find and install the .deb
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" -type f | head -1)
if [ -z "$DEB_FILE" ]; then
    echo -e "${RED}❌ No .deb file found${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 4: Installing $DEB_FILE...${NC}"
sudo dpkg -i "$DEB_FILE"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Installation successful${NC}"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi
echo ""

# Step 5: Kill any running instances
echo -e "${YELLOW}Step 5: Killing existing FlowState processes...${NC}"
pkill -f "flow-state" 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅ Processes killed${NC}"
echo ""

# Step 6: Clear KDE caches (if KDE)
if command -v kbuildsycoca6 &> /dev/null; then
    echo -e "${YELLOW}Step 6: Refreshing KDE caches...${NC}"
    kbuildsycoca6 --noincremental 2>/dev/null || true
    echo -e "${GREEN}✅ KDE caches refreshed${NC}"
    echo ""
fi

# Step 7: Launch the app
echo -e "${YELLOW}Step 7: Launching FlowState...${NC}"
nohup /usr/bin/flow-state > /tmp/flowstate-test.log 2>&1 &
APP_PID=$!
echo "App launched with PID: $APP_PID"
echo "Logs: /tmp/flowstate-test.log"
echo ""

# Wait for app to start
sleep 3

echo "============================================================"
echo -e "${GREEN}BUILD AND INSTALL COMPLETE${NC}"
echo "============================================================"
echo ""
echo "MANUAL VERIFICATION STEPS:"
echo ""
echo "1. CHECK CONSOLE LOGS:"
echo "   tail -f /tmp/flowstate-test.log | grep AUTH"
echo ""
echo "   Look for:"
echo "   - '[AUTH] Scheduling token refresh in X minutes' (proactive refresh)"
echo "   - '[AUTH] Session refreshed successfully' (if token was expired)"
echo "   - '[AUTH] Guest data already migrated' (if you signed in before)"
echo ""
echo "2. TEST SESSION PERSISTENCE:"
echo "   a) Sign in to the app"
echo "   b) Close the app completely: pkill -f flow-state"
echo "   c) Reopen: /usr/bin/flow-state &"
echo "   d) You should still be signed in"
echo ""
echo "3. TEST NO DUPLICATES:"
echo "   a) Sign out"
echo "   b) Create 2-3 tasks while signed out"
echo "   c) Sign in"
echo "   d) Check: tasks migrated, no duplicates"
echo "   e) Sign out and sign in again"
echo "   f) Check: still no duplicates"
echo ""
echo "4. TEST TOKEN REFRESH (long test):"
echo "   a) Leave app running for 55+ minutes"
echo "   b) Check logs for '[AUTH] Proactive token refresh'"
echo "   c) App should NOT sign you out"
echo ""
echo "============================================================"
echo "To view live auth logs:"
echo "  tail -f /tmp/flowstate-test.log | grep -E '(AUTH|auth)'"
echo "============================================================"
