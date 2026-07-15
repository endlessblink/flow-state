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

# Embed immutable, non-secret source provenance before electron-builder seals
# app.asar. Remove any prior ledger first so it cannot be mistaken for this build.
rm -f "$ROOT_DIR/dist-electron/flowstate-truth-ledger.json"
node "$ROOT_DIR/scripts/flowstate-truth-ledger.cjs" \
  --mode non-live \
  --root "$ROOT_DIR" \
  --output "$ROOT_DIR/dist-electron/flowstate-truth-ledger.json"
electron-builder --config electron-builder.yml

# Release provenance must be safe to generate in CI and local packaging. Live
# updater, installed-AppImage, and sidecar probes remain opt-in to the standalone
# ledger command and are never contacted by the canonical build.
node "$ROOT_DIR/scripts/flowstate-truth-ledger.cjs" \
  --mode non-live \
  --root "$ROOT_DIR" \
  --output "$ROOT_DIR/release/flowstate-truth-ledger.json"
