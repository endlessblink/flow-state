#!/bin/bash
# Hook: Constitution Reminder (PreToolUse - Edit/Write only)
# Purpose: Soft reminder to check Constitution + project docs before source file edits
# Exit 0 always — this NEVER blocks, only reminds

# Read JSON input (with timeout to prevent freeze)
INPUT=$(timeout 2 cat 2>/dev/null || echo '{}')

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# Only check Edit and Write tools
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

# Only check source files (not docs, configs, etc.)
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.vue|*.svelte|*.py|*.go|*.rs|*.java|*.c|*.cpp|*.h)
    ;;
  *)
    exit 0
    ;;
esac

# Skip test files — they don't need Constitution checks
case "$FILE_PATH" in
  *test*|*spec*|*__tests__*|*.stories.*)
    exit 0
    ;;
esac

# Rate limit: only remind once per session (use a temp flag file)
FLAG="/tmp/.constitution-reminded-${CLAUDE_SESSION_ID:-$$}"
if [[ -f "$FLAG" ]]; then
  exit 0
fi
touch "$FLAG"

# Soft reminder — shown once per session on first source file edit
echo "Reminder: Development standards in ~/.claude/knowledge/constitution.md | Project docs: system-architecture.md, design-system.md"

exit 0
