#!/bin/bash
# Hook: Detect broad Task prompts and force parallel decomposition
# Instead of one agent thinking about everything, spawn multiple focused agents

# Log that hook was called (for debugging)
echo "DEBUG: atomic-task-injector.sh called" >> /tmp/atomic-hook-debug.log
date >> /tmp/atomic-hook-debug.log

# Read JSON input from stdin (with timeout to prevent freeze in Zellij)
INPUT=$(timeout 2 cat 2>/dev/null || echo '{}')

# Log input
echo "INPUT: $INPUT" >> /tmp/atomic-hook-debug.log

# Extract tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
echo "TOOL_NAME: $TOOL_NAME" >> /tmp/atomic-hook-debug.log

# Only apply to Task tool
if [[ "$TOOL_NAME" != "Task" ]]; then
  echo "Skipping - not Task tool" >> /tmp/atomic-hook-debug.log
  exit 0
fi

# Extract the prompt being sent to the agent
PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // ""')
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

echo "PROMPT: $PROMPT" >> /tmp/atomic-hook-debug.log

# Detect broad/vague prompt patterns
BROAD_PATTERNS="test all|verify all|fix all|check all|test everything|verify everything|fix everything|all features|all issues|all three|multiple issues|several|layer [0-9]|phase [0-9]|systematically test|comprehensive|and also|as well as"

if echo "$PROMPT_LOWER" | grep -qiE "$BROAD_PATTERNS"; then
  echo "BROAD PATTERN DETECTED - BLOCKING" >> /tmp/atomic-hook-debug.log
  cat << 'EOF'
BROAD TASK DETECTED - USE PARALLEL DECOMPOSITION

This task is too broad for a single agent. Instead:

SPAWN MULTIPLE PARALLEL AGENTS - each with ONE specific goal:

Example - Instead of "test all parent-child features":
```
Agent 1: "Take screenshot of canvas. Report if any groups show task count badges (X)."
Agent 2: "Drag one task into a group. Report if it stays inside the group boundary."
Agent 3: "Drag a group 100px right. Report if child tasks moved with it."
```

HOW TO DO THIS:
1. Break the broad task into 3-5 atomic sub-tasks
2. Call the Task tool MULTIPLE TIMES in the SAME message (parallel execution)
3. Each agent gets ONE specific check with clear success criteria

DO NOT send a single agent to "think about all aspects" - that causes analysis paralysis.

BLOCKED: Decompose this task into atomic sub-tasks first.
EOF
  exit 2
fi

echo "Prompt seems atomic - allowing" >> /tmp/atomic-hook-debug.log
# Prompt seems atomic enough
exit 0
