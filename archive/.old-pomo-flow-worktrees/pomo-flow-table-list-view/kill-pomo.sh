#!/bin/bash

echo "🔍 Searching for Pomo-Flow processes..."

# Kill processes using port 5546
PORT_PIDS=$(lsof -ti:5546 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  echo "📍 Found processes on port 5546: $PORT_PIDS"
  echo "$PORT_PIDS" | xargs kill -9 2>/dev/null
  echo "✅ Killed processes on port 5546"
else
  echo "ℹ️  No processes found on port 5546"
fi

# Kill vite processes
VITE_PIDS=$(ps aux | grep '[v]ite.*5546' | awk '{print $2}')
if [ -n "$VITE_PIDS" ]; then
  echo "📍 Found Vite processes: $VITE_PIDS"
  echo "$VITE_PIDS" | xargs kill -9 2>/dev/null
  echo "✅ Killed Vite processes"
else
  echo "ℹ️  No Vite processes found"
fi

# Kill node processes with pomo-flow in command
NODE_PIDS=$(ps aux | grep '[n]ode.*pomo-flow' | awk '{print $2}')
if [ -n "$NODE_PIDS" ]; then
  echo "📍 Found Node.js pomo-flow processes: $NODE_PIDS"
  echo "$NODE_PIDS" | xargs kill -9 2>/dev/null
  echo "✅ Killed Node.js pomo-flow processes"
else
  echo "ℹ️  No Node.js pomo-flow processes found"
fi

# Kill npm processes in this directory
NPM_PIDS=$(ps aux | grep '[n]pm.*dev' | grep 'pomo-flow' | awk '{print $2}')
if [ -n "$NPM_PIDS" ]; then
  echo "📍 Found npm dev processes: $NPM_PIDS"
  echo "$NPM_PIDS" | xargs kill -9 2>/dev/null
  echo "✅ Killed npm dev processes"
else
  echo "ℹ️  No npm dev processes found"
fi

echo ""
echo "✨ Done! All Pomo-Flow processes have been terminated."
echo ""
echo "To verify, run: lsof -i:5546"
