#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${FLOWSTATE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
REMOTE_SECRET_FILE="${FLOWSTATE_DOPPLER_SECRET_FILE:-/etc/flowstate/doppler-release.env}"

if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

read -r -s -p "Doppler service token (stored root-only on the VPS): " token
echo
if [[ -z "$token" ]]; then
  echo "A Doppler token is required." >&2
  exit 1
fi

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "set -e; install -d -m 700 \"$(dirname '${REMOTE_SECRET_FILE}')\"; test -d '${REMOTE_SECRET_FILE%/*}'"

printf '%s\n' "$token" | ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "set -e; umask 077; IFS= read -r token; test -n \"\$token\"; printf 'DOPPLER_TOKEN=%s\\n' \"\$token\" > '${REMOTE_SECRET_FILE}.tmp'; chmod 600 '${REMOTE_SECRET_FILE}.tmp'; mv '${REMOTE_SECRET_FILE}.tmp' '${REMOTE_SECRET_FILE}'; test \"\$(stat -c %a '${REMOTE_SECRET_FILE}')\" = 600"

unset token
echo "Doppler credential stored on the VPS. Future release runs will reuse it automatically."
