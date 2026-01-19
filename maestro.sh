#!/bin/bash
# Dev Maestro Launcher
# Starts Dev Maestro with this project's MASTER_PLAN.md

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.dev-maestro"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Dev Maestro not installed. Installing..."
    curl -sSL https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh | bash
fi

# Export project root so Dev Maestro knows where to find MASTER_PLAN.md
export MASTER_PLAN_PATH="$SCRIPT_DIR/docs/MASTER_PLAN.md"

echo "Starting Dev Maestro..."
echo "  Project: $SCRIPT_DIR"
echo "  MASTER_PLAN: $MASTER_PLAN_PATH"
echo "  URL: http://localhost:6010"

cd "$INSTALL_DIR" && npm start
