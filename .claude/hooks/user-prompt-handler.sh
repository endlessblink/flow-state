#!/bin/bash
# UNIFIED USER PROMPT HANDLER
# Combines artifact-checker, skill-router, user-confirmation
# Reason: Only first hook receives stdin

set -e

# Read stdin
USER_PROMPT=$(cat 2>/dev/null || echo '')
PROMPT_LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

if [ -z "$PROMPT_LOWER" ]; then
    exit 0
fi

OUTPUT=""

# ============================================
# LAYER 1: ARTIFACT CHECKER - Test Results
# ============================================
RESULTS_FILE="$CLAUDE_PROJECT_DIR/.claude/last-test-results.json"

if [ -f "$RESULTS_FILE" ]; then
    RESULTS_AGE=$(( $(date +%s) - $(stat -c %Y "$RESULTS_FILE" 2>/dev/null || echo 0) ))
    if [ $RESULTS_AGE -gt 600 ]; then
        OUTPUT="[LAYER 1] Test results stale (${RESULTS_AGE}s). Run tests before claiming done."
    else
        PASSED=$(jq -r '.passed' "$RESULTS_FILE" 2>/dev/null || echo "false")
        if [ "$PASSED" != "true" ]; then
            SUMMARY=$(jq -r '.summary' "$RESULTS_FILE" 2>/dev/null || echo "unknown failure")
            OUTPUT="[LAYER 1] TESTS FAILED: $SUMMARY - Fix before claiming done."
        fi
    fi
else
    OUTPUT="[LAYER 1] No test results. Run 'npm test' before claiming done."
fi

# ============================================
# LAYER 4: Completion question detection
# ============================================
if echo "$PROMPT_LOWER" | grep -qE "is it done|are you done|is it ready|finished|status\?|done\?"; then
    if [ -z "$OUTPUT" ]; then
        OUTPUT="[LAYER 4] Completion check - I must provide artifacts + ask you to verify."
    else
        OUTPUT="$OUTPUT | [LAYER 4] Provide artifacts + ask user to verify."
    fi
fi

# ============================================
# SKILL SUGGESTIONS
# ============================================
SKILL=""
if echo "$PROMPT_LOWER" | grep -qE "timer|pomodoro"; then SKILL="dev-fix-timer"; fi
if echo "$PROMPT_LOWER" | grep -qE "bug|broken|fix|debug|not working|error"; then SKILL="dev-debugging"; fi
if echo "$PROMPT_LOWER" | grep -qE "canvas|vue flow|node position"; then SKILL="vue-flow-debug"; fi
if echo "$PROMPT_LOWER" | grep -qE "test|verify|check if"; then SKILL="qa-testing"; fi
if echo "$PROMPT_LOWER" | grep -qE "plan|architecture|strategy"; then SKILL="chief-architect"; fi

if [ -n "$SKILL" ]; then
    if [ -z "$OUTPUT" ]; then
        OUTPUT="[SKILL] Consider: Skill(\"$SKILL\")"
    else
        OUTPUT="$OUTPUT | [SKILL] Consider: Skill(\"$SKILL\")"
    fi
fi

# ============================================
# OUTPUT
# ============================================
if [ -n "$OUTPUT" ]; then
    echo "<user-prompt-submit-hook>$OUTPUT</user-prompt-submit-hook>"
fi

exit 0
