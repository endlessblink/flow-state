#!/bin/bash

# Support --quiet flag for use in predev script
QUIET=false
if [[ "$1" == "--quiet" ]]; then
  QUIET=true
fi

log() {
  if [[ "$QUIET" == "false" ]]; then
    echo "$@"
  fi
}

log "🔍 Searching for FlowState processes..."
log ""

KILLED_COUNT=0
KILLED_PORTS=()

# TASK-330: EMERGENCY BACKUP before killing (skip in quiet mode for speed)
if [[ "$QUIET" == "false" ]]; then
  log "💾 [TASK-330] Triggering emergency shadow backup..."
  if [ -f "./scripts/shadow-mirror.cjs" ]; then
    node ./scripts/shadow-mirror.cjs 2>/dev/null || log "⚠️  Warning: Shadow backup failed, proceeding with kill..."
  else
    log "⚠️  Warning: shadow-mirror.cjs not found, skipping emergency backup."
  fi
  log ""
fi

# Function to check if a PID belongs to flow-state
is_flow_state_process() {
  local pid=$1
  local pwd_output
  pwd_output=$(timeout 1 pwdx "$pid" 2>/dev/null) || return 1

  if [[ $pwd_output == *"flow-state"* ]]; then
    return 0
  else
    return 1
  fi
}

# Kill processes on ports 5546-5560 that belong to flow-state
log "🔌 Checking ports 5546-5560 for FlowState processes..."
for port in {5546..5560}; do
  PORT_PIDS=$(lsof -ti:$port 2>/dev/null)

  if [ -n "$PORT_PIDS" ]; then
    for pid in $PORT_PIDS; do
      if is_flow_state_process "$pid"; then
        log "  📍 Port $port: Killing FlowState PID $pid"
        kill -9 "$pid" 2>/dev/null
        KILLED_COUNT=$((KILLED_COUNT + 1))
        KILLED_PORTS+=($port)
      fi
    done
  fi
done

# Kill vite processes running in flow-state directories
log ""
log "⚡ Checking for Vite processes in FlowState directories..."
VITE_PIDS=$(ps aux | grep '[v]ite' | grep -v grep | awk '{print $2}')

if [ -n "$VITE_PIDS" ]; then
  for pid in $VITE_PIDS; do
    if is_flow_state_process "$pid"; then
      log "  📍 Killing Vite process: PID $pid"
      kill -9 "$pid" 2>/dev/null
      KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
  done
fi

# Kill node processes with flow-state in working directory
log ""
log "🟢 Checking for Node.js processes in FlowState directories..."
NODE_PIDS=$(ps aux | grep '[n]ode' | grep -v grep | awk '{print $2}')

if [ -n "$NODE_PIDS" ]; then
  for pid in $NODE_PIDS; do
    if is_flow_state_process "$pid"; then
      # Additional check: only kill if it looks like a dev server
      CMD=$(ps -p "$pid" -o command= 2>/dev/null)
      if [[ $CMD == *"vite"* ]] || [[ $CMD == *"node_modules"* ]] || [[ $CMD == *"npm"* ]]; then
      log "  📍 Killing Node.js process: PID $pid"
        kill -9 "$pid" 2>/dev/null
        KILLED_COUNT=$((KILLED_COUNT + 1))
      fi
    fi
  done
fi

# Kill npm processes in flow-state directories
log ""
log "📦 Checking for npm processes in FlowState directories..."
NPM_PIDS=$(ps aux | grep '[n]pm.*dev' | grep -v grep | awk '{print $2}')

if [ -n "$NPM_PIDS" ]; then
  for pid in $NPM_PIDS; do
    if is_flow_state_process "$pid"; then
      log "  📍 Killing npm dev process: PID $pid"
      kill -9 "$pid" 2>/dev/null
      KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
  done
fi

# Clean up PID file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rm -f "$SCRIPT_DIR/.dev-server.pid"

# Summary
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $KILLED_COUNT -eq 0 ]; then
      log "✨ No FlowState processes found running."
else
      log "✅ Terminated $KILLED_COUNT FlowState process(es)"

  if [ ${#KILLED_PORTS[@]} -gt 0 ]; then
    UNIQUE_PORTS=($(printf "%s\n" "${KILLED_PORTS[@]}" | sort -u))
      log "🔌 Cleared ports: ${UNIQUE_PORTS[*]}"
  fi
fi
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "To verify ports are clear, run: lsof -i:5546-5560"
