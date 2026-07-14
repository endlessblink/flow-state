#!/usr/bin/env bash
set -euo pipefail

SCRIPT_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_REPO="${FLOWSTATE_REGRESSION_SOURCE_REPO:-$SCRIPT_REPO_DIR}"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
RUNNER_BIN_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/flowstate"
RUNNER_PATH="$RUNNER_BIN_DIR/run-daily-regression-hunt-clean.sh"
SERVICE_PATH="$SYSTEMD_USER_DIR/flowstate-daily-regression-hunt.service"
TIMER_PATH="$SYSTEMD_USER_DIR/flowstate-daily-regression-hunt.timer"

mkdir -p "$SYSTEMD_USER_DIR" "$RUNNER_BIN_DIR"
install -m 0755 "$SCRIPT_REPO_DIR/scripts/run-daily-regression-hunt-clean.sh" "$RUNNER_PATH"

cat > "$SERVICE_PATH" <<SERVICE
[Unit]
Description=FlowState daily regression hunt
Documentation=file://$SOURCE_REPO/docs/MASTER_PLAN.md

[Service]
Type=oneshot
Environment=TZ=Asia/Jerusalem
Environment=FLOWSTATE_REGRESSION_SOURCE_REPO=$SOURCE_REPO
ExecStart=/usr/bin/env bash $RUNNER_PATH --notify
SERVICE

cat > "$TIMER_PATH" <<TIMER
[Unit]
Description=Run FlowState daily regression hunt at 09:30 Asia/Jerusalem

[Timer]
OnCalendar=*-*-* 09:30:00
Persistent=true
Unit=flowstate-daily-regression-hunt.service

[Install]
WantedBy=timers.target
TIMER

systemctl --user daemon-reload
systemctl --user enable --now flowstate-daily-regression-hunt.timer

echo "Installed flowstate-daily-regression-hunt.timer"
systemctl --user list-timers flowstate-daily-regression-hunt.timer
