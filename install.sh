#!/bin/bash
set -e
cd /media/endlessblink/data/my-projects/ai-development/productivity/flow-state

echo "=== Killing existing processes ==="
pkill -9 -f flow-state 2>/dev/null || true
sleep 1

echo "=== Clearing localStorage ==="
rm -rf ~/.local/share/com.pomoflow.desktop/localstorage/*

echo "=== Installing new build ==="
sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_0.1.0_amd64.deb

echo "=== Launching app with log capture ==="
echo "Check console in DevTools (Ctrl+Shift+I) for [BUG-339-DEBUG] messages"
/usr/bin/flow-state 2>&1 | tee /tmp/flowstate-debug.log &

echo "PID: $!"
echo ""
echo "To view logs: tail -f /tmp/flowstate-debug.log"
