#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_REPO="${FLOWSTATE_REGRESSION_SOURCE_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RUNNER_DIR="${FLOWSTATE_REGRESSION_RUNNER_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/flowstate-regression-runner}"
REPORT_DIR="${FLOWSTATE_REGRESSION_REPORT_DIR:-$SOURCE_REPO/reports/regression-hunt}"
DEPENDENCY_ROOT="${FLOWSTATE_REGRESSION_DEPENDENCY_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/flowstate-regression-dependencies}"
PREFLIGHT=true
NOTIFY_PREFLIGHT=false

for arg in "$@"; do
  if [ "$arg" = '--notify' ]; then
    NOTIFY_PREFLIGHT=true
    break
  fi
done

notify_preflight_failure() {
  local exit_code=$?
  if [ "$PREFLIGHT" = true ] && [ "$NOTIFY_PREFLIGHT" = true ] && command -v notify-send >/dev/null 2>&1; then
    notify-send \
      --urgency=critical \
      --app-name=FlowState \
      'FlowState regression runner failed before checks' \
      "Could not prepare clean origin/master. Check flowstate-daily-regression-hunt.service." \
      || true
  fi
  exit "$exit_code"
}

trap notify_preflight_failure ERR

mkdir -p "$(dirname "$RUNNER_DIR")" "$REPORT_DIR"

# The primary checkout is frequently used for long-running work. Refresh the
# remote ref without rebasing, cleaning, or otherwise touching that checkout.
git -C "$SOURCE_REPO" fetch --quiet origin master

if [ -e "$RUNNER_DIR/.git" ]; then
  # This directory is dedicated to the watchdog, so resetting it is safe. Tests
  # must describe current origin/master rather than arbitrary in-progress files.
  git -C "$RUNNER_DIR" reset --hard origin/master
  git -C "$RUNNER_DIR" clean -ffdx
else
  if [ -e "$RUNNER_DIR" ]; then
    echo "Regression runner exists but is not a git worktree: $RUNNER_DIR" >&2
    exit 1
  fi
  git -C "$SOURCE_REPO" worktree prune
  git -C "$SOURCE_REPO" worktree add --detach "$RUNNER_DIR" origin/master
fi

# Install dependencies from the exact inputs and runtime being tested. Native
# modules, platform packages, and the repo's postinstall patch can all change
# compatibility without changing package-lock.json, so every one of those
# inputs participates in the immutable runner-owned cache key.
LOCK_HASH="$(sha256sum "$RUNNER_DIR/package-lock.json" | cut -d ' ' -f 1)"
PACKAGE_HASH="$(sha256sum "$RUNNER_DIR/package.json" | cut -d ' ' -f 1)"
PATCH_HASH="$(sha256sum "$RUNNER_DIR/scripts/patch-electron-builder-dependency-parser.cjs" | cut -d ' ' -f 1)"
PLATFORM="$(uname -s)-$(uname -m)"
NODE_ABI="$(node -p 'process.versions.modules')"
NODE_VERSION="$(node -p 'process.version')"
NPM_VERSION="$(npm --version)"
DEPENDENCY_DIR="$DEPENDENCY_ROOT/$LOCK_HASH-$PACKAGE_HASH-$PATCH_HASH-$PLATFORM-$NODE_ABI-$NODE_VERSION-$NPM_VERSION"
if [ ! -d "$DEPENDENCY_DIR/node_modules" ]; then
  rm -rf "$DEPENDENCY_DIR"
  npm ci --prefix "$RUNNER_DIR"
  mkdir -p "$DEPENDENCY_DIR"
  mv "$RUNNER_DIR/node_modules" "$DEPENDENCY_DIR/node_modules"
fi
ln -s "$DEPENDENCY_DIR/node_modules" "$RUNNER_DIR/node_modules"

cd "$RUNNER_DIR"
PREFLIGHT=false
npm run regression:daily -- --report-dir "$REPORT_DIR" "$@"
