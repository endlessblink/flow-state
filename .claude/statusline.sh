#!/bin/bash

# Pomo-Flow Status Line Script
# Shows worktree name, active port, and Claude Code model

# Read JSON input from Claude Code
read -r JSON_DATA

# Extract current working directory and model name
CWD=$(echo "$JSON_DATA" | jq -r '.cwd // empty' 2>/dev/null)
MODEL=$(echo "$JSON_DATA" | jq -r '.model.display_name // "Claude"' 2>/dev/null)

# Fallback if jq fails or fields are missing
if [ -z "$CWD" ]; then
  CWD=$(pwd)
fi
if [ -z "$MODEL" ]; then
  MODEL="Claude"
fi

# Extract worktree name from path
WORKTREE_NAME="${CWD##*/}"

# Try to find actual running Vite port for this worktree
ACTUAL_PORT=""
if command -v pwdx &> /dev/null; then
  # Find Vite processes in current worktree by checking command lines
  while read -r pid; do
    # Get process working directory (handle spaces in path)
    PROC_DIR=$(pwdx "$pid" 2>/dev/null | cut -d' ' -f2-)

    # Check if process is running in current worktree
    if [[ "$PROC_DIR" == "$CWD"* ]] || [[ "$PROC_DIR" == "$CWD" ]]; then
      # Read full command line from /proc
      CMDLINE=$(cat /proc/"$pid"/cmdline 2>/dev/null | tr '\0' ' ')

      # Check if it's a Vite process
      if [[ "$CMDLINE" == *"vite"* ]] && [[ "$CMDLINE" == *"--port"* ]]; then
        # Extract port from command line (take last --port if multiple)
        PORT=$(echo "$CMDLINE" | grep -oP -- '--port\s+\K\d+' | tail -1)

        if [ -n "$PORT" ]; then
          ACTUAL_PORT="$PORT"
          break
        fi
      fi
    fi
  done < <(pgrep -x node 2>/dev/null)
fi

# Determine port status
if [ -n "$ACTUAL_PORT" ]; then
  PORT_STATUS="$ACTUAL_PORT ✓"
else
  # Fallback: read from vite.config.ts
  CONFIG_PORT=""
  if [ -f "$CWD/vite.config.ts" ]; then
    CONFIG_PORT=$(grep -oP "port:\s*\K\d+" "$CWD/vite.config.ts" 2>/dev/null | head -1)
  fi

  # Default to 5546 if not found
  CONFIG_PORT="${CONFIG_PORT:-5546}"
  PORT_STATUS="$CONFIG_PORT (config)"
fi

# Output status line
echo "📍 $WORKTREE_NAME :$PORT_STATUS | $MODEL"
