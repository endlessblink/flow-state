#!/bin/bash
# Set current task for this terminal's Claude Code session
# Usage: source .claude/set-task.sh BUG-1091 "VPS: No cross-browser sync"
#        source .claude/set-task.sh --clear
#
# Or add alias to your .bashrc/.zshrc:
#   alias ct='source /path/to/flow-state/.claude/set-task.sh'
# Then: ct BUG-1091 "description"

if [ "$1" = "--clear" ]; then
  unset CLAUDE_TASK
  echo "Cleared CLAUDE_TASK"
  return 0 2>/dev/null || exit 0
fi

if [ -z "$1" ]; then
  echo "Usage: source .claude/set-task.sh TASK-123 \"Description\""
  echo "       source .claude/set-task.sh --clear"
  echo ""
  echo "Current: ${CLAUDE_TASK:-<not set>}"
  return 1 2>/dev/null || exit 1
fi

TASK_ID="$1"
TASK_DESC="${2:-}"

export CLAUDE_TASK="${TASK_ID}:${TASK_DESC}"
echo "Set CLAUDE_TASK=${CLAUDE_TASK}"
