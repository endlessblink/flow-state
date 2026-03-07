#!/bin/bash
# Developer-only script for local testing. Not used in production or CI/CD.
# For production deployment, use ./scripts/deploy-tauri-update.sh
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "=== Killing existing processes ==="
pkill -9 -f flow-state 2>/dev/null || true
sleep 1

echo "=== Clearing localStorage ==="
rm -rf ~/.local/share/com.pomoflow.desktop/localstorage/*

echo "=== Installing new build ==="
DEB_FILE=$(ls -t src-tauri/target/release/bundle/deb/FlowState_*.deb 2>/dev/null | head -1)
if [ -z "$DEB_FILE" ]; then
    echo "ERROR: No .deb file found. Run 'npm run tauri build' first."
    exit 1
fi
sudo dpkg -i "$DEB_FILE"

echo "=== Launching app with log capture ==="
echo "Check console in DevTools (Ctrl+Shift+I) for [BUG-339-DEBUG] messages"
/usr/bin/flow-state 2>&1 | tee /tmp/flowstate-debug.log &

echo "PID: $!"
echo ""
echo "To view logs: tail -f /tmp/flowstate-debug.log"
