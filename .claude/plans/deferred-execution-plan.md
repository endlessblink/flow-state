# Plan: Deferred Execution for Multi-Agent File Locking

**Created**: January 22, 2026
**Status**: Planning
**Goal**: When an agent is blocked by a file lock, defer the edit and let agent work on other tasks

---

## Research Summary

Based on research from:
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Hook Control Flow](https://stevekinney.com/courses/ai-development/claude-code-hook-control-flow)
- [DynTaskMAS Paper](https://arxiv.org/abs/2503.07675) - Asynchronous parallel execution patterns
- [Multi-Agent Orchestration Patterns](https://www.kore.ai/blog/choosing-the-right-orchestration-pattern-for-multi-agent-systems)

### Key Findings

1. **Exit Code 2** blocks and provides feedback to Claude via `stderr`
2. **`decision: "block"` with `reason`** guides Claude on next steps
3. No native "defer and retry later" in hooks - must implement externally
4. Successful patterns use **immediate feedback loops** not queues
5. [DynTaskMAS](https://arxiv.org/abs/2503.07675) shows 21-33% efficiency gains with async task graphs

---

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEFERRED EXECUTION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Block Detection & Deferral                                    │
│  ─────────────────────────────────────                                  │
│                                                                          │
│    Agent B tries Edit(file.vue)                                         │
│           │                                                              │
│           ▼                                                              │
│    ┌──────────────────────────────────────┐                             │
│    │   PreToolUse: task-lock-enforcer.sh   │                             │
│    │                                        │                             │
│    │   1. Detect lock by Agent A            │                             │
│    │   2. Save deferred edit to queue       │                             │
│    │   3. Exit 2 with guidance message      │                             │
│    └──────────────────────────────────────┘                             │
│           │                                                              │
│           ▼                                                              │
│    Message to Claude:                                                    │
│    "DEFERRED: file.vue locked by TASK-123.                              │
│     Saved to queue. Work on other tasks: `bd ready`                     │
│     You'll be notified when available."                                 │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 2: Queue Storage                                                  │
│  ──────────────────────                                                  │
│                                                                          │
│    .claude/deferred-queue/                                               │
│    ├── SESSION-abc123.json                                               │
│    │   {                                                                 │
│    │     "session_id": "abc123",                                         │
│    │     "deferred_edits": [                                             │
│    │       {                                                             │
│    │         "file": "src/file.vue",                                     │
│    │         "blocked_by_task": "TASK-123",                              │
│    │         "blocked_by_session": "xyz789",                             │
│    │         "timestamp": 1737580000,                                    │
│    │         "tool_input": { /* original Edit params */ }                │
│    │       }                                                             │
│    │     ]                                                               │
│    │   }                                                                 │
│    └── ...                                                               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 3: Lock Release Notification                                      │
│  ────────────────────────────────────                                   │
│                                                                          │
│    Option A: Background Watcher (inotifywait)                           │
│    ───────────────────────────────────────────                          │
│    ┌──────────────────────────────────────┐                             │
│    │   deferred-watcher.sh (background)    │                             │
│    │                                        │                             │
│    │   inotifywait -m .claude/locks/       │                             │
│    │   On DELETE event:                     │                             │
│    │     → Check deferred-queue for match   │                             │
│    │     → Write notification file          │                             │
│    │     → Or inject into agent context     │                             │
│    └──────────────────────────────────────┘                             │
│                                                                          │
│    Option B: Beads Integration                                           │
│    ───────────────────────────────                                       │
│    When blocked:                                                         │
│      bd create --title="DEFERRED: Edit file.vue" --type=task            │
│      bd dep add $DEFERRED_ID $BLOCKING_TASK_ID                          │
│                                                                          │
│    When lock releases:                                                   │
│      bd update $BLOCKING_TASK_ID --status=done                          │
│      → $DEFERRED_ID automatically becomes "ready"                       │
│      → `bd ready` shows it to agent                                     │
│                                                                          │
│    Option C: UserPromptSubmit Reminder                                   │
│    ─────────────────────────────────────                                 │
│    ┌──────────────────────────────────────┐                             │
│    │   UserPromptSubmit hook               │                             │
│    │                                        │                             │
│    │   Check deferred-queue for session    │                             │
│    │   Check if blocking locks released    │                             │
│    │   If yes → Inject reminder:           │                             │
│    │   "REMINDER: Your deferred edit to    │                             │
│    │    file.vue is now available!"        │                             │
│    └──────────────────────────────────────┘                             │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 4: Auto-Retry                                                     │
│  ───────────────────                                                     │
│                                                                          │
│    When agent receives notification:                                     │
│    1. Agent sees: "Your deferred edit is ready"                         │
│    2. Agent recalls the original edit intention                          │
│    3. Agent re-executes the Edit tool                                    │
│    4. PreToolUse hook now allows (lock available)                        │
│    5. Edit succeeds                                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Options Comparison

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **A: Background Watcher** | Instant notification, no polling | Requires daemon process, resource overhead | High |
| **B: Beads Integration** | Native dependency tracking, visible in `bd ready` | Requires beads, creates extra issues | Medium |
| **C: UserPromptSubmit Hook** | Simple, no daemon, works with existing hooks | Only checks on user prompt, slight delay | Low |
| **A+C Combined** | Best of both: instant + reliable | More complex setup | Medium-High |

---

## Recommended Implementation: Option C + Beads (Hybrid)

### Why This Approach

1. **No daemon required** - Works within existing hook system
2. **Beads provides visibility** - Deferred tasks show in `bd ready`
3. **UserPromptSubmit catches stragglers** - Reliable notification
4. **Low overhead** - Only runs when agent is active

### Implementation Steps

#### Step 1: Modify `task-lock-enforcer.sh`

When blocked, instead of waiting:
```bash
# Save to deferred queue
save_deferred_edit() {
  local session_id="$1"
  local file_path="$2"
  local blocking_task="$3"
  local tool_input="$4"

  QUEUE_FILE="$CLAUDE_PROJECT_DIR/.claude/deferred-queue/${session_id}.json"
  mkdir -p "$(dirname "$QUEUE_FILE")"

  # Append to session's deferred edits
  jq --arg file "$file_path" \
     --arg task "$blocking_task" \
     --arg input "$tool_input" \
     --arg ts "$(date +%s)" \
     '.deferred_edits += [{
       file: $file,
       blocked_by_task: $task,
       tool_input: ($input | fromjson),
       timestamp: ($ts | tonumber)
     }]' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
}

# Create beads dependency
create_beads_dependency() {
  local blocking_task="$1"
  local file_path="$2"

  # Create waiting issue in beads
  DEFERRED_ID=$(bd create --title="DEFERRED: Edit $file_path" --type=task --priority=1 2>/dev/null | grep -oE 'beads-[a-z0-9]+')

  if [[ -n "$DEFERRED_ID" ]]; then
    # Add dependency on blocking task
    bd dep add "$DEFERRED_ID" "$blocking_task" 2>/dev/null
    echo "$DEFERRED_ID"
  fi
}

# Exit with guidance instead of blocking wait
cat >&2 << EOF
📋 DEFERRED: Edit to $FILENAME queued (blocked by $TASK_ID)

The file is currently locked by another session. Your edit has been saved.

Next steps:
1. Work on other available tasks: \`bd ready\`
2. You'll be notified when $TASK_ID completes
3. Then retry your edit to $FILENAME

Deferred edit saved to: .claude/deferred-queue/
EOF

exit 2
```

#### Step 2: Create `deferred-reminder.sh` (UserPromptSubmit hook)

```bash
#!/bin/bash
# Check for available deferred edits on each user prompt

QUEUE_DIR="$CLAUDE_PROJECT_DIR/.claude/deferred-queue"
LOCKS_DIR="$CLAUDE_PROJECT_DIR/.claude/locks"

# Find this session's queue file
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
QUEUE_FILE="$QUEUE_DIR/${SESSION_ID}.json"

[[ ! -f "$QUEUE_FILE" ]] && exit 0

# Check each deferred edit
READY_EDITS=()
while read -r edit; do
  blocked_task=$(echo "$edit" | jq -r '.blocked_by_task')
  file=$(echo "$edit" | jq -r '.file')
  lock_file="$LOCKS_DIR/${blocked_task}.lock"

  # If lock no longer exists, edit is ready
  if [[ ! -f "$lock_file" ]]; then
    READY_EDITS+=("$file")
  fi
done < <(jq -c '.deferred_edits[]' "$QUEUE_FILE" 2>/dev/null)

# Notify about ready edits
if [[ ${#READY_EDITS[@]} -gt 0 ]]; then
  cat << EOF
<user-prompt-submit-hook>
🔓 DEFERRED EDITS NOW AVAILABLE:

The following files are no longer locked:
$(printf '  - %s\n' "${READY_EDITS[@]}")

You can now retry your edits to these files.
</user-prompt-submit-hook>
EOF
fi

exit 0
```

#### Step 3: Add to `.claude/settings.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/deferred-reminder.sh"
          },
          // ... existing hooks
        ]
      }
    ]
  }
}
```

---

## File Structure

```
.claude/
├── hooks/
│   ├── task-lock-enforcer.sh      # Modified: saves deferred edits
│   └── deferred-reminder.sh       # New: checks for available edits
├── deferred-queue/
│   ├── SESSION-abc123.json        # Per-session deferred edits
│   └── SESSION-xyz789.json
├── locks/
│   └── TASK-123.lock
└── settings.json                  # Hook configuration
```

---

## Testing Plan

1. **Start two Claude sessions** on same project
2. **Session A**: Start editing `file.vue` (acquires lock)
3. **Session B**: Try to edit `file.vue` → Should see DEFERRED message
4. **Session B**: Check `bd ready` → Should show other tasks
5. **Session A**: Complete edit (releases lock)
6. **Session B**: Next prompt → Should see "DEFERRED EDITS NOW AVAILABLE"
7. **Session B**: Retry edit → Should succeed

---

## Future Enhancements

1. **Background watcher** for instant notification (no wait for user prompt)
2. **Auto-retry** mechanism that automatically re-executes deferred edits
3. **Priority queue** for ordering deferred edits
4. **Timeout/expiry** for stale deferred edits
5. **Dashboard integration** in Dev-Maestro showing queue status

---

## References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [DynTaskMAS: Async Multi-Agent Systems](https://arxiv.org/abs/2503.07675)
- [Multi-Agent Orchestration Patterns](https://www.kore.ai/blog/choosing-the-right-orchestration-pattern-for-multi-agent-systems)
- [DataCamp Claude Code Hooks Guide](https://www.datacamp.com/tutorial/claude-code-hooks)
