#!/bin/bash
# Deploy Botty to VPS and restart
set -e

VPS="root@84.46.253.137"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/opt/botty"

echo "=== Deploying Botty to VPS ==="

echo "Syncing source to ${VPS}:${REMOTE_DIR}..."
ssh -i "$SSH_KEY" "$VPS" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete \
  --exclude='.env' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  -e "ssh -i ${SSH_KEY}" \
  "$(dirname "$0")/" \
  "${VPS}:${REMOTE_DIR}/"

echo "Running restart script on VPS..."
ssh -i "$SSH_KEY" "$VPS" "bash ${REMOTE_DIR}/restart-botty.sh"

echo ""
echo "=== Deployment complete ==="
echo "Logs: ssh -i ${SSH_KEY} ${VPS} 'docker logs -f botty'"
