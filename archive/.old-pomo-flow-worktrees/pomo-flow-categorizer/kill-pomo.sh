#!/bin/bash

echo "🔍 Searching for Pomo-Flow processes..."
echo ""

KILLED_COUNT=0
KILLED_PORTS=()

# Function to check if a PID belongs to pomo-flow
is_pomo_flow_process() {
  local pid=$1
  local pwd_output=$(pwdx "$pid" 2>/dev/null)

  if [[ $pwd_output == *"pomo-flow"* ]]; then
    return 0
  else
    return 1
  fi
}

# Kill processes on ports 5546-5560 that belong to pomo-flow
echo "🔌 Checking ports 5546-5560 for pomo-flow processes..."
for port in {5546..5560}; do
  PORT_PIDS=$(lsof -ti:$port 2>/dev/null)

  if [ -n "$PORT_PIDS" ]; then
    for pid in $PORT_PIDS; do
      if is_pomo_flow_process "$pid"; then
        echo "  📍 Port $port: Killing pomo-flow PID $pid"
        kill -9 "$pid" 2>/dev/null
        KILLED_COUNT=$((KILLED_COUNT + 1))
        KILLED_PORTS+=($port)
      fi
    done
  fi
done

# Kill vite processes running in pomo-flow directories
echo ""
echo "⚡ Checking for Vite processes in pomo-flow directories..."
VITE_PIDS=$(ps aux | grep '[v]ite' | grep -v grep | awk '{print $2}')

if [ -n "$VITE_PIDS" ]; then
  for pid in $VITE_PIDS; do
    if is_pomo_flow_process "$pid"; then
      echo "  📍 Killing Vite process: PID $pid"
      kill -9 "$pid" 2>/dev/null
      KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
  done
fi

# Kill node processes with pomo-flow in working directory
echo ""
echo "🟢 Checking for Node.js processes in pomo-flow directories..."
NODE_PIDS=$(ps aux | grep '[n]ode' | grep -v grep | awk '{print $2}')

if [ -n "$NODE_PIDS" ]; then
  for pid in $NODE_PIDS; do
    if is_pomo_flow_process "$pid"; then
      # Additional check: only kill if it looks like a dev server
      CMD=$(ps -p "$pid" -o command= 2>/dev/null)
      if [[ $CMD == *"vite"* ]] || [[ $CMD == *"node_modules"* ]] || [[ $CMD == *"npm"* ]]; then
        echo "  📍 Killing Node.js process: PID $pid"
        kill -9 "$pid" 2>/dev/null
        KILLED_COUNT=$((KILLED_COUNT + 1))
      fi
    fi
  done
fi

# Kill npm processes in pomo-flow directories
echo ""
echo "📦 Checking for npm processes in pomo-flow directories..."
NPM_PIDS=$(ps aux | grep '[n]pm.*dev' | grep -v grep | awk '{print $2}')

if [ -n "$NPM_PIDS" ]; then
  for pid in $NPM_PIDS; do
    if is_pomo_flow_process "$pid"; then
      echo "  📍 Killing npm dev process: PID $pid"
      kill -9 "$pid" 2>/dev/null
      KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
  done
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $KILLED_COUNT -eq 0 ]; then
  echo "✨ No pomo-flow processes found running."
else
  echo "✅ Terminated $KILLED_COUNT pomo-flow process(es)"

  if [ ${#KILLED_PORTS[@]} -gt 0 ]; then
    UNIQUE_PORTS=($(printf "%s\n" "${KILLED_PORTS[@]}" | sort -u))
    echo "🔌 Cleared ports: ${UNIQUE_PORTS[*]}"
  fi
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To verify ports are clear, run: lsof -i:5546-5560"
