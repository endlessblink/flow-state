#!/bin/bash
# Dev Manager Install/Update Script
# Usage: curl -sSL https://raw.githubusercontent.com/endlessblink/pomo-flow/master/dev-manager/install.sh | bash

set -e

# Configuration
REPO_URL="https://github.com/endlessblink/pomo-flow.git"
INSTALL_DIR="${DEV_MANAGER_DIR:-$HOME/.dev-manager}"
BRANCH="${DEV_MANAGER_BRANCH:-master}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║           DEV MANAGER INSTALLER / UPDATER              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for required tools
command -v git >/dev/null 2>&1 || { echo -e "${RED}Error: git is required but not installed.${NC}" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: node is required but not installed.${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}Error: npm is required but not installed.${NC}" >&2; exit 1; }

# Determine if this is an install or update
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}Existing installation found. Updating...${NC}"
    cd "$INSTALL_DIR"

    # Stash any local changes
    if ! git diff --quiet 2>/dev/null; then
        echo -e "${YELLOW}Stashing local changes...${NC}"
        git stash
    fi

    # Fetch and pull latest
    echo -e "${BLUE}Fetching latest changes from $BRANCH...${NC}"
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git pull origin "$BRANCH"

    echo -e "${GREEN}✓ Updated to latest version${NC}"
else
    echo -e "${BLUE}Installing dev-manager to $INSTALL_DIR...${NC}"

    # Clone the repository (sparse checkout for dev-manager + docs)
    git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    git sparse-checkout set dev-manager docs

    echo -e "${GREEN}✓ Cloned repository${NC}"
fi

# Navigate to dev-manager directory
cd "$INSTALL_DIR/dev-manager"

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install --silent

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create .env if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from template${NC}"
fi

# Show version info
VERSION=$(git log -1 --format="%h %s" 2>/dev/null || echo "unknown")
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗"
echo -e "║           INSTALLATION COMPLETE                         ║"
echo -e "╠════════════════════════════════════════════════════════╣"
echo -e "║  Location: $INSTALL_DIR/dev-manager"
echo -e "║  Version:  $VERSION"
echo -e "║                                                        ║"
echo -e "║  To start:                                             ║"
echo -e "║    cd $INSTALL_DIR/dev-manager && npm start"
echo -e "║                                                        ║"
echo -e "║  Or add alias to ~/.bashrc:                            ║"
echo -e "║    alias dev-manager='node $INSTALL_DIR/dev-manager/server.js'"
echo -e "╚════════════════════════════════════════════════════════╝${NC}"

# Optional: Start the server
if [ "$1" = "--start" ]; then
    echo ""
    echo -e "${BLUE}Starting dev-manager...${NC}"
    node server.js
fi
