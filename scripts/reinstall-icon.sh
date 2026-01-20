#!/bin/bash
# Reinstall FlowState and refresh KDE Plasma icons
# Usage: ./scripts/reinstall-icon.sh

set -e

echo "=== Reinstalling FlowState deb package ==="
sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_0.1.0_amd64.deb

echo "=== Rebuilding KDE system config ==="
kbuildsycoca6 --noincremental 2>/dev/null || kbuildsycoca5 --noincremental 2>/dev/null

echo "=== Restarting Plasma shell ==="
kquitapp6 plasmashell 2>/dev/null || kquitapp5 plasmashell 2>/dev/null
sleep 1
kstart plasmashell 2>/dev/null || kstart5 plasmashell 2>/dev/null &

echo "=== Done! Check your taskbar ==="
