#!/bin/bash
# BUG-339: Quick install and test script
set -e

cd /media/endlessblink/data/my-projects/ai-development/productivity/flow-state

echo "=== Killing old processes ==="
pkill -f flow-state 2>/dev/null || true
sleep 1

echo ""
echo "=== Installing FlowState ==="
sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_0.1.0_amd64.deb

echo ""
echo "=== Launching FlowState ==="
/usr/bin/flow-state > /tmp/flowstate-test.log 2>&1 &
echo "PID: $!"
sleep 3

echo ""
echo "=== Watching logs (Ctrl+C to stop) ==="
echo ""
tail -f /tmp/flowstate-test.log | grep --line-buffered -E '\[AUTH\]|\[GUEST\]|\[PERSISTENCE\]|tasks|Tasks|duplicate'
