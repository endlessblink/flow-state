#!/bin/bash
# Hook: Force atomic prompts by detecting vague/broad requests
# Fires on UserPromptSubmit - BEFORE Claude starts processing

# Read user prompt from stdin (with timeout to prevent freeze)
USER_PROMPT=$(timeout 2 cat 2>/dev/null || echo '')
PROMPT_LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# Detect vague/broad patterns that cause analysis paralysis
VAGUE_PATTERNS="stuck|not working|broken|fix it|test all|verify all|check all|everything|all features|doesn't work|won't work|help me|what's wrong|debug this|figure out|investigate"

if echo "$PROMPT_LOWER" | grep -qiE "$VAGUE_PATTERNS"; then
  # Check if prompt is too short (likely vague)
  WORD_COUNT=$(echo "$USER_PROMPT" | wc -w)

  if [ "$WORD_COUNT" -lt 15 ]; then
    cat << 'EOF'
<user-prompt-submit-hook>
VAGUE PROMPT DETECTED - CLARIFICATION REQUIRED

This prompt may cause analysis paralysis. Before proceeding:

1. Use AskUserQuestion tool to get specifics:
   - What EXACTLY is the symptom? (error message, visual issue, etc.)
   - What file/component is affected?
   - What was the expected vs actual behavior?

2. DO NOT start "burrowing" or exploring broadly
3. DO NOT spawn agents with vague prompts
4. Get ONE specific thing to check first

Example clarifying questions:
- "Which specific element shows the wrong value?"
- "What error message do you see in the console?"
- "Which file should I look at first?"
</user-prompt-submit-hook>
EOF
  fi
fi

exit 0
