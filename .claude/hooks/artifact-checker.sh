#!/bin/bash
# ARTIFACT CHECKER HOOK (Layer 1 - TASK-334)
#
# This UserPromptSubmit hook detects when Claude claims completion
# and checks if required artifacts have been provided.
#
# Created: January 20, 2026

# Read user prompt from stdin
USER_PROMPT=$(timeout 2 cat 2>/dev/null || echo '')

# Convert to lowercase for matching
PROMPT_LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# Exit early if no prompt
if [ -z "$PROMPT_LOWER" ]; then
    exit 0
fi

# Check if this is a response to a completion claim (user confirming or rejecting)
# These patterns indicate the user is responding to Claude's verification request
CONFIRMATION_PATTERNS="yes|confirmed|works|verified|looks good|lgtm|approved|ship it|merge it"
REJECTION_PATTERNS="no|doesn't work|broken|failed|not working|try again|fix"

if echo "$PROMPT_LOWER" | grep -qE "$CONFIRMATION_PATTERNS"; then
    # User confirmed - this is the Layer 4 gate being satisfied
    # Create a confirmation marker file
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude"
    echo "$(date -Iseconds)" > "$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion"
    exit 0
fi

if echo "$PROMPT_LOWER" | grep -qE "$REJECTION_PATTERNS"; then
    # User rejected - remove any confirmation marker
    rm -f "$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion" 2>/dev/null
    exit 0
fi

# Check if test results exist and are recent (within 10 minutes)
RESULTS_FILE="$CLAUDE_PROJECT_DIR/.claude/last-test-results.json"
ARTIFACT_WARNING=""

if [ -f "$RESULTS_FILE" ]; then
    # Check if results are recent
    RESULTS_AGE=$(( $(date +%s) - $(stat -c %Y "$RESULTS_FILE" 2>/dev/null || echo 0) ))
    if [ $RESULTS_AGE -gt 600 ]; then
        ARTIFACT_WARNING="⚠️ Test results are stale (${RESULTS_AGE}s old). Run tests again before claiming completion."
    else
        # Check if tests passed
        PASSED=$(jq -r '.passed // false' "$RESULTS_FILE" 2>/dev/null)
        if [ "$PASSED" != "true" ]; then
            SUMMARY=$(jq -r '.summary // "unknown"' "$RESULTS_FILE" 2>/dev/null)
            ARTIFACT_WARNING="⚠️ Last test run FAILED: $SUMMARY. Fix tests before claiming completion."
        fi
    fi
else
    ARTIFACT_WARNING="⚠️ No test results found. Run 'npm run test' before claiming completion."
fi

# Output warning if artifacts are missing/stale/failed
# Show on EVERY prompt (not just specific patterns) so user always sees test status
if [ -n "$ARTIFACT_WARNING" ]; then
    cat << EOF
<user-prompt-submit-hook>
⚠️ LAYER 1 - ARTIFACT CHECK:
$ARTIFACT_WARNING
</user-prompt-submit-hook>
EOF
fi

exit 0
