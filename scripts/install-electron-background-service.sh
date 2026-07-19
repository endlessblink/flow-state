#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_UNIT="$REPO_DIR/infra/electron-background/flowstate-background.service"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
INSTALLED_UNIT="$SYSTEMD_USER_DIR/flowstate-background.service"
LAUNCHER="$HOME/.local/bin/FlowState-launch.sh"
PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/flow-state"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "FlowState background service requires the verified launcher at $LAUNCHER" >&2
  exit 1
fi

mkdir -p "$SYSTEMD_USER_DIR"
install -m 0600 "$SOURCE_UNIT" "$INSTALLED_UNIT"

# The background bridge holds the signed-in session and its bearer token. Repair
# permissions from older installs before starting it.
if [[ -d "$PROFILE_DIR" ]]; then
  chmod 0700 "$PROFILE_DIR"
  for secret_file in "$PROFILE_DIR/local-api.json" "$PROFILE_DIR"/store.json*; do
    if [[ -f "$secret_file" ]]; then
      chmod 0600 "$secret_file"
    fi
  done
fi

systemctl --user daemon-reload
systemctl --user enable --now flowstate-background.service

echo "Installed and started flowstate-background.service"
