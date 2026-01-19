#!/bin/bash
# Dev Maestro Launcher with Auto-Update
# Generated for: flow-state

INSTALL_DIR="${DEV_MAESTRO_DIR:-$HOME/.dev-maestro}"
CONFIG_FILE="$INSTALL_DIR/local/config.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Install if not present
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}Dev Maestro not installed. Installing...${NC}"
    curl -sSL https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh | bash -s -- --master-plan "/media/endlessblink/data/my-projects/ai-development/productivity/flow-state/docs/MASTER_PLAN.md"
fi

# Read autoUpdate setting from local config (default: true)
AUTO_UPDATE=true
if [ -f "$CONFIG_FILE" ]; then
    CONFIG_AUTO=$(grep -o '"autoUpdate"[[:space:]]*:[[:space:]]*\(true\|false\)' "$CONFIG_FILE" 2>/dev/null | grep -o '\(true\|false\)$')
    [ "$CONFIG_AUTO" = "false" ] && AUTO_UPDATE=false
fi

# Auto-update check (blocking)
update_if_available() {
    cd "$INSTALL_DIR" || return 0

    if ! timeout 10 git fetch origin main --quiet 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Could not check for updates (network unavailable)${NC}"
        return 0
    fi

    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/main 2>/dev/null)

    if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
        return 0
    fi

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo -e "${BLUE}🔄 Dev Maestro update available...${NC}"
        git stash --quiet 2>/dev/null || true
        if git pull origin main --quiet 2>/dev/null; then
            if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package.json"; then
                echo -e "${BLUE}📦 Dependencies changed, running npm install...${NC}"
                npm install --silent 2>/dev/null
            fi
            echo -e "${GREEN}✅ Updated to latest version${NC}"
        fi
    else
        echo -e "${GREEN}✓ Dev Maestro is up to date${NC}"
    fi
}

# Run update check unless disabled
if [[ "$*" != *"--no-update"* ]] && [ "$AUTO_UPDATE" = "true" ]; then
    update_if_available
fi

# Use the configured MASTER_PLAN.md path for this project
export MASTER_PLAN_PATH="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state/docs/MASTER_PLAN.md"

cd "$INSTALL_DIR" && npm start
