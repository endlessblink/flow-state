#!/bin/bash
# masterplan-beads-sync.sh
#
# Post-tool hook that syncs MASTER_PLAN.md changes to beads.
# This hook is triggered after Edit/Write tools modify files.
#
# To install: Add to .claude/settings.json hooks section
#
# Environment variables set by Claude Code:
#   CLAUDE_FILE_PATH - The file that was modified

set -e

# Only run if MASTER_PLAN.md was modified
if [[ "$CLAUDE_FILE_PATH" == *"MASTER_PLAN.md" ]] || [[ "$1" == *"MASTER_PLAN.md" ]]; then
  # Get the project root (parent of .claude directory)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

  # Check if sync script exists
  if [[ -f "$PROJECT_ROOT/scripts/sync-masterplan-to-beads.cjs" ]]; then
    echo "🔄 Auto-syncing MASTER_PLAN.md → beads..."
    cd "$PROJECT_ROOT"

    # Run sync in background to avoid blocking Claude Code
    # Use --quiet to suppress output unless there are errors
    node scripts/sync-masterplan-to-beads.cjs 2>&1 | while read line; do
      # Only show important lines
      if [[ "$line" == *"Error"* ]] || [[ "$line" == *"Created"* ]] || [[ "$line" == *"Updated"* ]]; then
        echo "  $line"
      fi
    done

    echo "✓ Beads sync complete"
  fi
fi
