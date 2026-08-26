#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${FLOWSTATE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
REMOTE_REPO="/var/tmp/flowstate-release-1.4.465/repo"
NODE_BIN="/opt/flowstate/toolchains/node-v22.22.0-linux-x64/bin"

if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

read -r -s -p "Doppler service token: " DOPPLER_TOKEN
echo

if [[ -z "$DOPPLER_TOKEN" ]]; then
  echo "A Doppler token is required." >&2
  exit 1
fi

export DOPPLER_TOKEN

cleanup() {
  unset DOPPLER_TOKEN
}
trap cleanup EXIT

printf '%s\n' "$DOPPLER_TOKEN" | ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "IFS= read -r DOPPLER_TOKEN; export DOPPLER_TOKEN; export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; cd '${REMOTE_REPO}'; /usr/bin/doppler run -- '${NODE_BIN}/npm' run electron:build:locked"
