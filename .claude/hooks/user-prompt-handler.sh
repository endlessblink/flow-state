#!/bin/bash
# UNIFIED USER PROMPT HANDLER
# Combines: skill-router, artifact-checker, require-user-confirmation
# Reason: Only first hook in chain receives stdin, so we must combine them

# Read user prompt from stdin ONCE
USER_PROMPT=$(timeout 2 cat 2>/dev/null || echo '')
PROMPT_LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# Exit early if no prompt
if [ -z "$PROMPT_LOWER" ]; then
    exit 0
fi

OUTPUT=""

# ============================================
# LAYER 1: ARTIFACT CHECKER
# ============================================
CONFIRMATION_PATTERNS="yes|confirmed|works|verified|looks good|lgtm|approved|ship it|merge it"
REJECTION_PATTERNS="no|doesn't work|broken|failed|not working|try again|fix"

# Handle confirmations/rejections
if echo "$PROMPT_LOWER" | grep -qE "$CONFIRMATION_PATTERNS"; then
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude"
    echo "$(date -Iseconds)" > "$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion"
elif echo "$PROMPT_LOWER" | grep -qE "$REJECTION_PATTERNS"; then
    rm -f "$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion" 2>/dev/null
fi

# Check test results
RESULTS_FILE="$CLAUDE_PROJECT_DIR/.claude/last-test-results.json"
ARTIFACT_WARNING=""

if [ -f "$RESULTS_FILE" ]; then
    RESULTS_AGE=$(( $(date +%s) - $(stat -c %Y "$RESULTS_FILE" 2>/dev/null || echo 0) ))
    if [ $RESULTS_AGE -gt 600 ]; then
        ARTIFACT_WARNING="⚠️ Test results are stale (${RESULTS_AGE}s old). Run tests before claiming completion."
    else
        PASSED=$(jq -r '.passed // false' "$RESULTS_FILE" 2>/dev/null)
        if [ "$PASSED" != "true" ]; then
            SUMMARY=$(jq -r '.summary // "unknown"' "$RESULTS_FILE" 2>/dev/null)
            ARTIFACT_WARNING="⚠️ Tests FAILED: $SUMMARY"
        fi
    fi
else
    ARTIFACT_WARNING="⚠️ No test results found. Run 'npm run test' before claiming completion."
fi

if [ -n "$ARTIFACT_WARNING" ]; then
    OUTPUT+="LAYER 1 - ARTIFACT CHECK: $ARTIFACT_WARNING
"
fi

# ============================================
# LAYER 4: USER CONFIRMATION REMINDER
# ============================================
COMPLETION_QUESTION_PATTERNS="is it done|are you done|is it ready|is it finished|did you finish|status\?|complete\?|done\?"
NEW_WORK_PATTERNS="please|can you|could you|implement|add|create|update|change|modify|refactor"

if echo "$PROMPT_LOWER" | grep -qE "$COMPLETION_QUESTION_PATTERNS"; then
    if ! echo "$PROMPT_LOWER" | grep -qE "$NEW_WORK_PATTERNS"; then
        CONFIRMATION_FILE="$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion"
        NEEDS_REMINDER=true
        if [ -f "$CONFIRMATION_FILE" ]; then
            CONF_AGE=$(( $(date +%s) - $(stat -c %Y "$CONFIRMATION_FILE" 2>/dev/null || echo 0) ))
            if [ $CONF_AGE -lt 300 ]; then
                NEEDS_REMINDER=false
            fi
        fi
        if [ "$NEEDS_REMINDER" = true ]; then
            OUTPUT+="LAYER 4 - COMPLETION PROTOCOL: Before saying 'done', I must provide artifacts + ask you to verify.
"
        fi
    fi
fi

# ============================================
# SKILL ROUTER (suggestions only)
# ============================================
SKILL_MAPPINGS=(
    "dev-fix-timer:timer|pomodoro|countdown|session time"
    "dev-debugging:keyboard|shortcut|hotkey|task store|tasks don't save|bug|broken|fix|debug|not working|disappear|crash|error|issue|missing|stuck"
    "ops-port-manager:port conflict|server won't start|address in use|eaddrinuse"
    "supabase-debugger:supabase|rls policy|row level|realtime subscription"
    "vue-flow-debug:vue flow|canvas|nested node|node position"
    "dev-storybook:storybook|story file|component story"
    "smart-doc-manager:documentation|consolidate docs|master plan|roadmap"
    "skill-creator-doctor:create skill|fix skill|skill won't load"
    "qa-testing:playwright|verify|check if|test if|run test|does.*work|audit"
    "chief-architect:plan feature|breakdown task|implementation strategy|architecture"
)

MATCHED_SKILL=""
for mapping in "${SKILL_MAPPINGS[@]}"; do
    skill="${mapping%%:*}"
    triggers="${mapping#*:}"
    if echo "$PROMPT_LOWER" | grep -qE "$triggers"; then
        MATCHED_SKILL="$skill"
        break
    fi
done

if [ -n "$MATCHED_SKILL" ]; then
    OUTPUT+="SKILL SUGGESTION: Consider using Skill(\"$MATCHED_SKILL\")
"
fi

# ============================================
# OUTPUT
# ============================================
if [ -n "$OUTPUT" ]; then
    echo "<user-prompt-submit-hook>"
    echo "$OUTPUT"
    echo "</user-prompt-submit-hook>"
fi

exit 0
