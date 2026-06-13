#!/usr/bin/env bash
set -euo pipefail

TREE_FILE="$(mktemp -t flowstate-electron-npm-tree.XXXXXX.json)"
cleanup() {
  rm -f "$TREE_FILE"
}
trap cleanup EXIT

npm list -a --include prod --include optional --omit dev --json --long --silent --loglevel=error > "$TREE_FILE"

export FLOWSTATE_ELECTRON_NPM_TREE_JSON="$TREE_FILE"
electron-builder --config electron-builder.yml
