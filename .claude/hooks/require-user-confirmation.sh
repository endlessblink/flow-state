#!/bin/bash
# REQUIRE USER CONFIRMATION HOOK (Layer 4 - TASK-334)
#
# This hook enforces that Claude must ask for user verification
# before marking any task as complete.
#
# It works by:
# 1. Detecting completion-related prompts from the user
# 2. Checking if user has explicitly confirmed the work
# 3. Reminding Claude to ask for verification if not confirmed
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

# Patterns that indicate user is asking about completion status
COMPLETION_QUESTION_PATTERNS="is it done|are you done|is it ready|is it finished|did you finish|status|complete\?|done\?"

# Patterns that indicate user is assigning new work (not checking completion)
NEW_WORK_PATTERNS="please|can you|could you|implement|add|fix|create|update|change|modify|refactor"

# If user is asking a completion question, remind about the protocol
if echo "$PROMPT_LOWER" | grep -qE "$COMPLETION_QUESTION_PATTERNS"; then
    # Don't trigger if this is also assigning new work
    if ! echo "$PROMPT_LOWER" | grep -qE "$NEW_WORK_PATTERNS"; then
        # Check if there's a recent user confirmation
        CONFIRMATION_FILE="$CLAUDE_PROJECT_DIR/.claude/user-confirmed-completion"
        if [ -f "$CONFIRMATION_FILE" ]; then
            CONF_AGE=$(( $(date +%s) - $(stat -c %Y "$CONFIRMATION_FILE" 2>/dev/null || echo 0) ))
            if [ $CONF_AGE -lt 300 ]; then
                # Recent confirmation exists - allow completion claim
                exit 0
            fi
        fi

        # No recent confirmation - remind about protocol
        cat << EOF
<user-prompt-submit-hook>
COMPLETION PROTOCOL REMINDER (Layer 4 - TASK-334):

Before I can say a task is "done", I must:
1. Provide artifacts (git diff, test output, verification steps)
2. Ask: "Can you test this and confirm it works?"
3. Wait for YOUR explicit confirmation

The task is only complete when YOU verify it works.
</user-prompt-submit-hook>
EOF
    fi
fi

# Check for patterns where Claude might be tempted to claim completion prematurely
# This triggers on user prompts that might lead Claude to summarize work as "done"
SUMMARY_REQUEST_PATTERNS="what did you do|summarize|summary|recap|status update"

if echo "$PROMPT_LOWER" | grep -qE "$SUMMARY_REQUEST_PATTERNS"; then
    cat << EOF
<user-prompt-submit-hook>
COMPLETION PROTOCOL REMINDER (Layer 4 - TASK-334):

When summarizing work, remember:
- Use "I've implemented X" NOT "X is done/complete/working"
- Always end with: "Can you test this and confirm it works?"
- Only YOU can declare a task truly complete
</user-prompt-submit-hook>
EOF
fi

exit 0
