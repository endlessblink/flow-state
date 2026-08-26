#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${FLOWSTATE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
NODE_BIN="/opt/flowstate/toolchains/node-v22.22.0-linux-x64/bin"
RELEASE_VERSION="$(node -p "require('./package.json').version")"
REMOTE_REPO="/var/tmp/flowstate-release-${RELEASE_VERSION}/repo"
REMOTE_SECRET_FILE="${FLOWSTATE_DOPPLER_SECRET_FILE:-/etc/flowstate/doppler-release.env}"

if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "set -e; export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; mkdir -p \"$(dirname '${REMOTE_REPO}')\"; if [[ ! -d '${REMOTE_REPO}/.git' ]]; then git clone --branch master --single-branch https://github.com/endlessblink/flow-state.git '${REMOTE_REPO}'; else git -C '${REMOTE_REPO}' fetch origin master; git -C '${REMOTE_REPO}' reset --hard origin/master; git -C '${REMOTE_REPO}' clean -fdx; fi; test \"\$(sed -n 's/.*\\\"version\\\": \\\"\\([^\\\"]*\\\).*/\\1/p' '${REMOTE_REPO}/package.json' | head -1)\" = '${RELEASE_VERSION}'; cd '${REMOTE_REPO}'; '${NODE_BIN}/npm' ci --ignore-scripts --no-audit --no-fund"

if ! ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "test -s '${REMOTE_SECRET_FILE}' && grep -q '^DOPPLER_TOKEN=.' '${REMOTE_SECRET_FILE}'"; then
  read -r -s -p "Doppler service token (saved root-only on VPS for future releases): " DOPPLER_TOKEN
  echo
  if [[ -z "$DOPPLER_TOKEN" ]]; then
    echo "A Doppler token is required." >&2
    exit 1
  fi
  printf '%s\n' "$DOPPLER_TOKEN" | ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
    "set -e; umask 077; install -d -m 700 \"$(dirname '${REMOTE_SECRET_FILE}')\"; IFS= read -r token; test -n \"\$token\"; printf 'DOPPLER_TOKEN=%s\\n' \"\$token\" > '${REMOTE_SECRET_FILE}.tmp'; chmod 600 '${REMOTE_SECRET_FILE}.tmp'; mv '${REMOTE_SECRET_FILE}.tmp' '${REMOTE_SECRET_FILE}'"
  unset DOPPLER_TOKEN
fi

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "set -e; . '${REMOTE_SECRET_FILE}'; export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; cd '${REMOTE_REPO}'; /usr/bin/doppler run -- '${NODE_BIN}/npm' run electron:build:locked"

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; cd '${REMOTE_REPO}'; bash scripts/promote-flowstate-release.sh /var/www/flowstate '${REMOTE_REPO}/dist' '${REMOTE_REPO}/release' '${REMOTE_REPO}/release/flowstate-release-receipt.json'"
