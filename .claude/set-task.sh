#!/bin/bash
# Set current task for this Claude Code session
# Usage: .claude/set-task.sh BUG-1091 "VPS: No cross-browser sync"
#        .claude/set-task.sh --clear

TASKS_DIR="$(dirname "$0")/tasks"
mkdir -p "$TASKS_DIR"

# Get Claude session ID from environment or use TTY as fallback
if [ -n "$CLAUDE_SESSION_ID" ]; then
  SESSION_KEY="$CLAUDE_SESSION_ID"
else
  # Use TTY name as unique identifier per terminal
  SESSION_KEY=$(tty | tr '/' '_')
fi

TASK_FILE="$TASKS_DIR/${SESSION_KEY}.json"

if [ "$1" = "--clear" ]; then
  rm -f "$TASK_FILE"
  echo "Cleared task for this session"
  exit 0
fi

if [ -z "$1" ]; then
  echo "Usage: .claude/set-task.sh TASK-123 \"Description\""
  echo "       .claude/set-task.sh --clear"
  exit 1
fi

TASK_ID="$1"
TASK_DESC="${2:-}"

echo "{\"id\":\"$TASK_ID\",\"description\":\"$TASK_DESC\"}" > "$TASK_FILE"
echo "Set task: $TASK_ID - $TASK_DESC"
