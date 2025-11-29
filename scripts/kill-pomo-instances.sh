#!/bin/bash

# PomoFlow Process Cleanup Script
# Kills all running PomoFlow-specific processes

set +e  # Don't exit on error

echo "🔍 Searching for PomoFlow processes..."
echo ""

KILLED_ANY=false

# Function to kill processes on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo "📍 Port $port:"
        for pid in $pids; do
            local proc_name=$(ps -p $pid -o comm= 2>/dev/null)
            echo "  └─ Killing PID $pid ($proc_name)"
            kill -9 $pid 2>/dev/null
        done
        KILLED_ANY=true
    fi
}

# Function to kill processes by pattern
kill_pattern() {
    local pattern=$1
    local description=$2
    local pids=$(pgrep -f "$pattern" 2>/dev/null)

    if [ -n "$pids" ]; then
        echo "🎯 $description:"
        for pid in $pids; do
            local cmd=$(ps -p $pid -o args= 2>/dev/null | cut -c1-80)
            echo "  └─ Killing PID $pid"
            echo "     ($cmd...)"
            kill -9 $pid 2>/dev/null
        done
        KILLED_ANY=true
    fi
}

# Kill dev servers on PomoFlow ports
kill_port 5546
kill_port 5547
kill_port 6006  # Storybook

echo ""

# Kill npm/node processes running from pomo-flow directory
kill_pattern "pomo-flow.*npm" "NPM processes in pomo-flow"
kill_pattern "pomo-flow.*node" "Node processes in pomo-flow"
kill_pattern "pomo-flow.*vite" "Vite processes in pomo-flow"
kill_pattern "pomo-flow.*playwright" "Playwright processes in pomo-flow"

echo ""

if [ "$KILLED_ANY" = true ]; then
    echo "✅ PomoFlow processes terminated"
else
    echo "✨ No PomoFlow processes found running"
fi

echo ""
echo "🔍 Verifying cleanup..."
echo "Port 5546: $(lsof -ti:5546 2>/dev/null | wc -l | tr -d ' ') processes"
echo "Port 5547: $(lsof -ti:5547 2>/dev/null | wc -l | tr -d ' ') processes"
echo "Port 6006: $(lsof -ti:6006 2>/dev/null | wc -l | tr -d ' ') processes"

exit 0
