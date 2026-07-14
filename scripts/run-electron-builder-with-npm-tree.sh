#!/usr/bin/env bash
set -euo pipefail

TREE_FILE="$(mktemp -t flowstate-electron-npm-tree.XXXXXX.json)"
cleanup() {
  rm -f "$TREE_FILE"
}
trap cleanup EXIT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
mkdir -p "$ROOT_DIR/release"
find "$ROOT_DIR/release" -maxdepth 1 -type f \
  \( -name "FlowState-${VERSION}-*.AppImage" \
     -o -name "FlowState-${VERSION}-*.AppImage.blockmap" \
     -o -name "FlowState_${VERSION}_*.deb" \
     -o -name "latest-linux.yml" \) \
  -delete

npm list -a --include prod --include optional --omit dev --json --long --silent --loglevel=error > "$TREE_FILE"

export FLOWSTATE_ELECTRON_NPM_TREE_JSON="$TREE_FILE"
electron-builder --config electron-builder.yml
