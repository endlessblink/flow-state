#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_UNIT="$REPO_DIR/infra/electron-background/flowstate-background.service"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
INSTALLED_UNIT="$SYSTEMD_USER_DIR/flowstate-background.service"

mkdir -p "$SYSTEMD_USER_DIR"
install -m 0600 "$SOURCE_UNIT" "$INSTALLED_UNIT"
systemctl --user daemon-reload
systemctl --user enable --now flowstate-background.service

echo "Installed and started flowstate-background.service"
