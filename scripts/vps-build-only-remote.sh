#!/usr/bin/env bash
set -euo pipefail

REMOTE_REPO="__FLOWSTATE_REPO__"
EXPECTED_COMMIT="__FLOWSTATE_COMMIT__"
trap 'rm -f -- "$0"' EXIT

export PATH="/opt/flowstate/toolchains/node-v22.22.0-linux-x64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd "$REMOTE_REPO"
test -z "$(git status --porcelain --untracked-files=all)"
test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"
git cat-file -e "${EXPECTED_COMMIT}^{commit}"
set -a
. /etc/flowstate/doppler-release.env
set +a
export DOPPLER_PROJECT=flow-state DOPPLER_CONFIG=prd
/usr/bin/doppler run --project flow-state --config prd -- npm run electron:build:locked
