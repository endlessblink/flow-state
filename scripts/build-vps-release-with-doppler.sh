#!/usr/bin/env bash
set -euo pipefail

REMOTE_REPO="${1:?usage: build-vps-release-with-doppler.sh REMOTE_REPO}"
NODE_BIN="/opt/flowstate/toolchains/node-v22.22.0-linux-x64/bin"

if [[ ! -d "$REMOTE_REPO" ]]; then
  echo "release worker does not exist: $REMOTE_REPO" >&2
  exit 1
fi

set -a
. /etc/flowstate/doppler-release.env
set +a
export PATH="$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd "$REMOTE_REPO"

if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "release worker is dirty" >&2
  exit 1
fi

/usr/bin/doppler run \
  --project flow-state \
  --config prd \
  --only-secrets VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY \
  -- npm run electron:build:locked

node scripts/flowstate-truth-ledger.cjs --mode non-live --root . --output /tmp/flowstate-release-ledger.json
node scripts/create-flowstate-release-receipt.cjs . release/flowstate-release-receipt.json
