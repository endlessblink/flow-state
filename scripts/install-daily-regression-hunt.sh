#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_PATH="$SYSTEMD_USER_DIR/flowstate-daily-regression-hunt.service"
TIMER_PATH="$SYSTEMD_USER_DIR/flowstate-daily-regression-hunt.timer"

mkdir -p "$SYSTEMD_USER_DIR"

cat > "$SERVICE_PATH" <<SERVICE
[Unit]
Description=FlowState daily regression hunt
Documentation=file://$REPO_DIR/docs/MASTER_PLAN.md

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
Environment=TZ=Asia/Jerusalem
ExecStart=/usr/bin/env bash -lc 'npm run regression:daily'
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
