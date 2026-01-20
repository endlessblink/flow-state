#!/bin/bash
# AUTO-TEST AFTER EDIT HOOK (Layer 2 - TASK-334)
#
# This PostToolUse hook automatically runs tests after code edits
# and logs results for the artifact-checker to verify.
#
# Created: January 20, 2026

# Read tool input from stdin
INPUT=$(timeout 2 cat 2>/dev/null || echo '{}')

# Extract tool name and file path
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Only run for Edit and Write tools
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
    exit 0
fi

# Only run for source code files (not configs, docs, etc.)
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|vue|js|jsx)$ ]]; then
    exit 0
fi

# Skip if in test files or hooks
if [[ "$FILE_PATH" =~ \.spec\. || "$FILE_PATH" =~ \.test\. || "$FILE_PATH" =~ \.claude/hooks ]]; then
    exit 0
fi

# Results file for artifact-checker to verify
RESULTS_FILE="$CLAUDE_PROJECT_DIR/.claude/last-test-results.json"
mkdir -p "$(dirname "$RESULTS_FILE")"

# Run tests and capture results (async, don't block)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Run npm test with timeout and capture output
TEST_OUTPUT=$(timeout 60 npm run test --silent 2>&1 || echo "TESTS_FAILED")
TEST_EXIT=$?
TIMESTAMP=$(date -Iseconds)

# Determine if tests passed
if [[ $TEST_EXIT -eq 0 && ! "$TEST_OUTPUT" =~ "FAIL" && ! "$TEST_OUTPUT" =~ "Error" ]]; then
    PASSED="true"
    SUMMARY="All tests passed"
else
    PASSED="false"
    # Extract failure count if available
    FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | head -1 || echo "unknown failures")
    SUMMARY="Tests failed: $FAIL_COUNT"
fi

# Write results JSON
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "triggeredBy": "$FILE_PATH",
  "tool": "$TOOL_NAME",
  "exitCode": $TEST_EXIT,
  "passed": $PASSED,
  "summary": "$SUMMARY"
}
EOF

# Output reminder to Claude
if [[ "$PASSED" == "false" ]]; then
    cat << EOF
<post-tool-use-hook>
⚠️ TESTS FAILED after editing $FILE_PATH
Summary: $SUMMARY
Before claiming "done", fix the failing tests.
Test results saved to: .claude/last-test-results.json
</post-tool-use-hook>
EOF
else
    cat << EOF
<post-tool-use-hook>
✓ Tests passed after editing $FILE_PATH
Test results saved to: .claude/last-test-results.json
</post-tool-use-hook>
EOF
fi

exit 0
