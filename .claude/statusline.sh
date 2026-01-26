#!/bin/bash

# FlowState Status Line Script
# Shows worktree name, current task, active port, and Claude Code model

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

# Detect current task from MASTER_PLAN.md (look for IN PROGRESS tasks)
CURRENT_TASK=""
TASK_DESC=""
if [ -f "$CWD/docs/MASTER_PLAN.md" ]; then
  # Find task with IN PROGRESS or 🔄 status in the table
  TASK_LINE=$(grep -E "^\|.*\|.*(IN PROGRESS|🔄)" "$CWD/docs/MASTER_PLAN.md" 2>/dev/null | head -1)
  if [ -n "$TASK_LINE" ]; then
    # Extract task ID (TASK-XXX, BUG-XXX, etc.)
    CURRENT_TASK=$(echo "$TASK_LINE" | grep -oE "(TASK|BUG|ROAD|IDEA|ISSUE)-[0-9]+" | head -1)
    # Extract description from column 2 (between first and second |)
    # Format: | ID | Description | Priority | Status | ...
    TASK_DESC=$(echo "$TASK_LINE" | cut -d'|' -f3 | sed 's/^\s*\*\*//; s/\*\*\s*$//; s/^\s*//; s/\s*$//')
    # Trim to 30 chars
    if [ ${#TASK_DESC} -gt 30 ]; then
      TASK_DESC="${TASK_DESC:0:30}…"
    fi
  fi
fi

# Also check .claude/current-task.json as override
if [ -f "$CWD/.claude/current-task.json" ]; then
  JSON_TASK=$(jq -r '.id // ""' "$CWD/.claude/current-task.json" 2>/dev/null)
  JSON_DESC=$(jq -r '.description // ""' "$CWD/.claude/current-task.json" 2>/dev/null)
  if [ -n "$JSON_TASK" ]; then
    CURRENT_TASK="$JSON_TASK"
    if [ -n "$JSON_DESC" ]; then
      TASK_DESC="${JSON_DESC:0:25}"
      if [ ${#JSON_DESC} -gt 25 ]; then
        TASK_DESC="${TASK_DESC}…"
      fi
    fi
  fi
fi

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

# Build task display string
TASK_DISPLAY=""
if [ -n "$CURRENT_TASK" ]; then
  if [ -n "$TASK_DESC" ]; then
    TASK_DISPLAY=" | 🎯 $CURRENT_TASK: $TASK_DESC"
  else
    TASK_DISPLAY=" | 🎯 $CURRENT_TASK"
  fi
fi

# Output status line
echo "📍 $WORKTREE_NAME :$PORT_STATUS$TASK_DISPLAY | $MODEL"
