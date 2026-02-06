#!/bin/bash
# Agent Dashboard - Watch all running Claude subagents in real-time
# Usage: ./scripts/agent-dashboard.sh

TASK_DIR="/tmp/claude-1000/-media-endlessblink-data-my-projects-ai-development-productivity-flow-state/tasks"
SESSION="agents"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null

# Find all .output files modified in last 30 minutes (active agents)
mapfile -t FILES < <(find "$TASK_DIR" -name "*.output" -mmin -30 -type f 2>/dev/null | sort)

if [ ${#FILES[@]} -eq 0 ]; then
    echo "No active agents found in $TASK_DIR"
    exit 1
fi

echo "Found ${#FILES[@]} agent output files"

# Create tmux session with first file
tmux new-session -d -s "$SESSION" "echo '=== Agent: $(basename ${FILES[0]} .output) ===' && tail -f '${FILES[0]}'"

# Add remaining files as split panes
for ((i=1; i<${#FILES[@]} && i<8; i++)); do
    # Alternate horizontal and vertical splits for a grid
    if (( i % 2 == 1 )); then
        tmux split-window -t "$SESSION" -h "echo '=== Agent: $(basename ${FILES[$i]} .output) ===' && tail -f '${FILES[$i]}'"
    else
        tmux split-window -t "$SESSION" -v "echo '=== Agent: $(basename ${FILES[$i]} .output) ===' && tail -f '${FILES[$i]}'"
    fi
    tmux select-layout -t "$SESSION" tiled
done

# Attach
tmux attach -t "$SESSION"
