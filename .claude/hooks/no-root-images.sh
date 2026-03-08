#!/usr/bin/env bash
# Hook: Block image files from being created in the project root.
# Redirects to .dev/screenshots/ instead.

set -euo pipefail

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path from the tool input (works for Write tool)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // ""' 2>/dev/null || echo "")

# Get project root
PROJECT_ROOT="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state"

# Check if it's an image file in the project root
if echo "$FILE_PATH" | grep -qiE "^${PROJECT_ROOT}/[^/]+\.(png|jpg|jpeg|gif|webp|bmp|svg)$"; then
  FILENAME=$(basename "$FILE_PATH")
  echo "BLOCKED: Do not save images to the project root."
  echo "Save to .dev/screenshots/${FILENAME} instead."
  exit 2
fi

exit 0
