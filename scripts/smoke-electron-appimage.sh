#!/usr/bin/env bash
# smoke-electron-appimage.sh — launch the packaged AppImage and fail on
# main-process module/load crashes before the artifact is installed or deployed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$PROJECT_DIR/release"

VERSION="$(node -p "require('$PROJECT_DIR/package.json').version")"
APPIMAGE="${1:-}"

if [ -z "$APPIMAGE" ]; then
  APPIMAGE="$(find "$RELEASE_DIR" -name "FlowState-${VERSION}-*.AppImage" -type f 2>/dev/null | head -1)"
fi

if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "[electron-appimage-smoke] ERROR: AppImage not found for version ${VERSION}." >&2
  exit 1
fi

TMP_HOME="$(mktemp -d)"
LOG_FILE="$(mktemp)"
cleanup() {
  rm -rf "$TMP_HOME"
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

RUNNER=(timeout 12s)
if command -v xvfb-run >/dev/null 2>&1; then
  RUNNER+=(xvfb-run -a)
fi

set +e
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/.config" XDG_CACHE_HOME="$TMP_HOME/.cache" \
  "${RUNNER[@]}" "$APPIMAGE" --no-sandbox --enable-logging=stderr >"$LOG_FILE" 2>&1
STATUS=$?
set -e

CRASH_PATTERN="Cannot find module|A JavaScript error occurred in the main process|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND"

if grep -Eiq "$CRASH_PATTERN" "$LOG_FILE"; then
  echo "[electron-appimage-smoke] ERROR: packaged AppImage hit a main-process module/load crash:" >&2
  grep -Ei "$CRASH_PATTERN" "$LOG_FILE" >&2
  exit 1
fi

# timeout exits 124 when the app stays alive for the smoke window. That is a
# pass: the failure class we are guarding exits early with a main-process crash.
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 124 ]; then
  echo "[electron-appimage-smoke] ERROR: packaged AppImage exited early with status ${STATUS}." >&2
  tail -80 "$LOG_FILE" >&2
  exit 1
fi

echo "[electron-appimage-smoke] Packaged AppImage launched without main-process module/load crashes."
