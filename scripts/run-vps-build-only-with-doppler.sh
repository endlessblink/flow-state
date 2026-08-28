#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo "build-only mode does not accept positional arguments" >&2
  exit 2
fi

VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${FLOWSTATE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
RELEASE_VERSION="$(node -p "require('./package.json').version")"
RELEASE_COMMIT="$(git rev-parse HEAD)"
REMOTE_REPO="${VPS_BUILD_REPO:-/var/tmp/flowstate-release-${RELEASE_VERSION}/repo}"

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 13)) process.exit(1)" \
  || { echo "Node 22.13+ is required for the release build" >&2; exit 1; }
if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "Refusing build from a dirty source checkout" >&2
  exit 1
fi
if [[ ! "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve an immutable release commit" >&2
  exit 1
fi
if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

REMOTE_RUNNER="/var/tmp/flowstate-build-only-${RELEASE_VERSION}-${RELEASE_COMMIT}.sh"
cleanup() { rm -f "$LOCAL_RUNNER"; }
trap cleanup EXIT
LOCAL_RUNNER="$(mktemp)"
sed \
  -e "s#__FLOWSTATE_REPO__#${REMOTE_REPO}#g" \
  -e "s#__FLOWSTATE_COMMIT__#${RELEASE_COMMIT}#g" \
  scripts/vps-build-only-remote.sh > "$LOCAL_RUNNER"
scp -q -i "$SSH_KEY" "$LOCAL_RUNNER" "${VPS_USER}@${VPS_HOST}:${REMOTE_RUNNER}"
ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" /bin/bash "$REMOTE_RUNNER"
