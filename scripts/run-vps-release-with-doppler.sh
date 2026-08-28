#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo "release mode flags are not accepted by the production VPS helper" >&2
  exit 2
fi

VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${FLOWSTATE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
NODE_BIN="/opt/flowstate/toolchains/node-v22.22.0-linux-x64/bin"
RELEASE_VERSION="$(node -p "require('./package.json').version")"
REMOTE_REPO="/var/tmp/flowstate-release-${RELEASE_VERSION}/repo"
RELEASE_COMMIT="$(git rev-parse HEAD)"

if [[ ! "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve an immutable release commit" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "Refusing VPS build from a dirty source checkout" >&2
  exit 1
fi

if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "set -a; . /etc/flowstate/doppler-release.env; set +a; export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; cd '${REMOTE_REPO}'; if git status --porcelain --untracked-files=all | grep -q .; then echo 'remote release worker is dirty' >&2; exit 1; fi; git rev-parse HEAD | grep -Fx '${RELEASE_COMMIT}' >/dev/null; git cat-file -e '${RELEASE_COMMIT}^{commit}'; export DOPPLER_PROJECT=flow-state DOPPLER_CONFIG=prd; /usr/bin/doppler run --project flow-state --config prd -- '${NODE_BIN}/npm' run electron:build:locked"

ssh -T -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "export PATH='${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; cd '${REMOTE_REPO}'; bash scripts/promote-flowstate-release.sh /var/www/flowstate '${REMOTE_REPO}/dist' '${REMOTE_REPO}/release' '${REMOTE_REPO}/release/flowstate-release-receipt.json'"
