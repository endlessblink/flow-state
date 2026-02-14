#!/bin/bash
# predev-port-check.sh — Smart port 5546 conflict resolver
#
# Solves TWO competing problems:
# 1. Orphaned zombies: crashed/killed session leaves Vite on port → next dev start fails
# 2. Multi-instance collision: another Claude session's legit dev server shouldn't be killed
#
# Strategy:
# - PID file (.dev-server.pid) tracks the legitimate dev server
# - If port occupant matches PID file → legitimate, don't kill
# - If port occupant has no PID file or is orphaned (parent=systemd) → kill zombie
# - If port occupant is parented but unhealthy → kill stuck process

PORT=5546
PID_FILE="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state/.dev-server.pid"

kill_port() {
  ALL_PIDS=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$ALL_PIDS" ]; then
    echo "$ALL_PIDS" | xargs kill -9 2>/dev/null
  fi
  rm -f "$PID_FILE"
  sleep 1

  # Verify
  if lsof -ti:$PORT >/dev/null 2>&1; then
    echo "[predev] WARNING: Port $PORT still occupied, retrying..."
    lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
    sleep 1
  fi
}

PID=$(lsof -ti:$PORT 2>/dev/null | head -1)

if [ -z "$PID" ]; then
  rm -f "$PID_FILE"
  echo "[predev] Port $PORT is free"
  exit 0
fi

echo "[predev] Port $PORT occupied by PID $PID"

# Check 1: Does a PID file exist from a legitimate dev server?
if [ -f "$PID_FILE" ]; then
  SAVED_PID=$(cat "$PID_FILE" 2>/dev/null | tr -d ' \n')
  if [ -n "$SAVED_PID" ] && kill -0 "$SAVED_PID" 2>/dev/null; then
    echo "[predev] Legitimate dev server running (PID file: $SAVED_PID)"
    echo "[predev] Another session owns port $PORT. Use 'npm run kill' to force-stop."
    exit 1
  else
    # PID file exists but process is dead — stale lock
    echo "[predev] Stale PID file ($SAVED_PID is dead) — cleaning up"
    rm -f "$PID_FILE"
  fi
fi

# Check 2: No PID file — is this an orphaned process?
PPID_OF_PROC=$(ps -p "$PID" -o ppid= 2>/dev/null | tr -d ' ')

if [ -z "$PPID_OF_PROC" ]; then
  echo "[predev] Process $PID vanished — port should be free"
  rm -f "$PID_FILE"
  exit 0
fi

# Walk up 3 levels of parents to detect systemd/init (orphan indicator)
is_orphan() {
  local check_pid="$1"
  local depth=0
  while [ "$depth" -lt 3 ] && [ -n "$check_pid" ] && [ "$check_pid" != "1" ]; do
    local parent_cmd
    parent_cmd=$(ps -p "$check_pid" -o comm= 2>/dev/null)
    if [[ "$parent_cmd" == "systemd" ]] || [[ "$parent_cmd" == "init" ]]; then
      return 0  # Orphaned
    fi
    check_pid=$(ps -p "$check_pid" -o ppid= 2>/dev/null | tr -d ' ')
    depth=$((depth + 1))
  done
  [ "$check_pid" == "1" ] && return 0  # Reached PID 1 within 3 hops
  return 1
}

PARENT_CMD=$(ps -p "$PPID_OF_PROC" -o comm= 2>/dev/null)

if is_orphan "$PPID_OF_PROC"; then
  echo "[predev] PID $PID is orphaned (ancestor is systemd/init) — killing zombie"
  kill_port
  echo "[predev] Port $PORT cleared"
  exit 0
fi

# Check 3: Has a real parent but no PID file — could be a manual `npx vite` or stuck process
# If it's healthy (serving HTTP), assume it's intentional and protect it
is_healthy() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:$PORT/" 2>/dev/null)
  [ "$code" = "200" ]
}

if is_healthy; then
  echo "[predev] Port $PORT has a healthy server (PID $PID, parent: $PARENT_CMD)"
  echo "[predev] Use 'npm run kill' to force-stop if needed."
  exit 1
else
  echo "[predev] PID $PID is unresponsive (no PID file, parent: $PARENT_CMD) — killing"
  kill_port
  echo "[predev] Port $PORT cleared"
  exit 0
fi
