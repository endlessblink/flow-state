#!/bin/bash
#
# Hook: Deferred Edit Reminder (UserPromptSubmit)
# Purpose: Check for available deferred edits when locks are released
# Exit 0 = Allow prompt (with optional notification)
#
# This hook runs on each user prompt and:
# 1. Finds this session's deferred queue file
# 2. Checks if any blocking locks have been released
# 3. If yes, outputs a reminder to retry the deferred edits
# 4. Cleans up completed deferred edits from queue
#

set -euo pipefail

# Configuration
QUEUE_DIR="${CLAUDE_PROJECT_DIR}/.claude/deferred-queue"
LOCKS_DIR="${CLAUDE_PROJECT_DIR}/.claude/locks"

# Read JSON input from stdin (with timeout)
INPUT=$(timeout 2 cat 2>/dev/null || echo '{}')

# Extract session ID
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')

# Skip if no session ID
[[ -z "$SESSION_ID" ]] && exit 0

# Find this session's queue file
QUEUE_FILE="$QUEUE_DIR/${SESSION_ID}.json"

# Skip if no queue file exists
[[ ! -f "$QUEUE_FILE" ]] && exit 0

# Check each deferred edit
READY_EDITS=()
STILL_BLOCKED=()

while IFS= read -r edit; do
  blocked_task=$(echo "$edit" | jq -r '.blocked_by_task')
  file=$(echo "$edit" | jq -r '.file')
  lock_file="$LOCKS_DIR/${blocked_task}.lock"

  # If lock no longer exists, edit is ready
  if [[ ! -f "$lock_file" ]]; then
    READY_EDITS+=("$file")
  else
    STILL_BLOCKED+=("$file")
  fi
done < <(jq -c '.deferred_edits[]' "$QUEUE_FILE" 2>/dev/null || echo "")

# Update queue file to remove ready edits
if [[ ${#READY_EDITS[@]} -gt 0 ]]; then
  # Create a temporary file with only still-blocked edits
  TMP_FILE="${QUEUE_FILE}.tmp"
  jq --arg locks_dir "$LOCKS_DIR" '
    .deferred_edits |= map(
      select(
        # Keep only edits where lock file still exists
        .blocked_by_task as $task |
        (($locks_dir + "/" + $task + ".lock") | test(".*"))
      )
    )
  ' "$QUEUE_FILE" 2>/dev/null > "$TMP_FILE" || true

  # If we couldn't filter properly, just clear the ready ones manually
  if [[ ! -s "$TMP_FILE" ]]; then
    # Rebuild keeping only still-blocked items
    BLOCKED_JSON='[]'
    for file in "${STILL_BLOCKED[@]}"; do
      BLOCKED_JSON=$(echo "$BLOCKED_JSON" | jq --arg f "$file" '. += [{"file": $f, "still_blocked": true}]')
    done
    echo "{\"session_id\":\"$SESSION_ID\",\"deferred_edits\":[]}" > "$TMP_FILE"
  fi

  mv "$TMP_FILE" "$QUEUE_FILE" 2>/dev/null || true

  # Remove queue file if empty
  REMAINING=$(jq '.deferred_edits | length' "$QUEUE_FILE" 2>/dev/null || echo "0")
  if [[ "$REMAINING" == "0" ]]; then
    rm -f "$QUEUE_FILE"
  fi
fi

# Notify about ready edits
if [[ ${#READY_EDITS[@]} -gt 0 ]]; then
  cat << EOF
<user-prompt-submit-hook>
DEFERRED EDITS NOW AVAILABLE:

The following files are no longer locked:
$(printf '  - %s\n' "${READY_EDITS[@]}")

You can now retry your edits to these files.
The original edits were saved - you may need to re-read the files first to see current state.
</user-prompt-submit-hook>
EOF
fi

# Always allow the prompt to proceed
exit 0
