# SOP: Multi-Instance Task Locking System

**Date**: December 20, 2025
**Task**: TASK-031
**Status**: COMPLETED

---

## Problem Statement

Multiple Claude Code instances working on the same project could simultaneously edit files belonging to the same MASTER_PLAN task, causing:
- Merge conflicts
- Lost work
- Inconsistent state
- Wasted effort

The existing hooks only printed reminders but didn't actually **block** conflicting operations.

---

## Root Cause Analysis

| Issue | Description |
|-------|-------------|
| Exit code 0 | All hooks exited with 0 (allow) instead of 2 (block) |
| PostToolUse timing | Hooks ran AFTER edits - too late to prevent conflicts |
| No coordination | No file-based locking between Claude Code instances |
| No PreToolUse hook | Nothing checked for conflicts BEFORE allowing edits |

---

## Solution Implemented

### Architecture

```
Session A starts editing tasks.ts
    ↓
PreToolUse hook runs (task-lock-enforcer.sh)
    ↓
Check: Does tasks.ts belong to a MASTER_PLAN task?
    ↓ Yes: TASK-022
Check: Is TASK-022 locked?
    ↓ No
Create lock: .claude/locks/TASK-022.lock
    ↓
Allow edit (exit 0)
```

```
Session B tries to edit tasks.ts (while A is active)
    ↓
PreToolUse hook runs (task-lock-enforcer.sh)
    ↓
Check: Does tasks.ts belong to a MASTER_PLAN task?
    ↓ Yes: TASK-022
Check: Is TASK-022 locked?
    ↓ Yes: By session A
BLOCK edit (exit 2) with error message
```

### Components Created

| File | Purpose |
|------|---------|
| `.claude/hooks/task-lock-enforcer.sh` | PreToolUse hook - blocks conflicting edits |
| `.claude/hooks/session-lock-awareness.sh` | SessionStart hook - warns about active locks |
| `.claude/hooks/session-lock-release.sh` | SessionEnd hook - releases locks on exit |
| `.claude/locks/` | Directory for lock files |
| `.claude/locks/.gitignore` | Prevents lock files from being committed |

### Lock File Format

```json
{
  "task_id": "TASK-022",
  "session_id": "abc123...",
  "timestamp": 1734693538,
  "locked_at": "2025-12-20 09:58:58",
  "files_touched": ["/path/to/tasks.ts"]
}
```

### Settings Configuration

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-lock-awareness.sh",
        "timeout": 5
      }]
    }],
    "SessionEnd": [{
      "hooks": [{
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-lock-release.sh",
        "timeout": 5
      }]
    }],
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/task-lock-enforcer.sh",
        "timeout": 10
      }]
    }]
  }
}
```

---

## Key Technical Details

### Exit Codes (Critical)

| Code | Meaning | Effect |
|------|---------|--------|
| 0 | Success | Tool call proceeds normally |
| 2 | Blocking error | **Tool call is blocked**, stderr shown to Claude |
| 1 | Non-blocking error | Tool proceeds, error logged |

### Lock Expiry

- Locks auto-expire after **4 hours** (configurable)
- Stale locks cleaned on every hook execution
- Prevents orphaned locks from blocking work indefinitely

### File Matching

The hook matches edited files against MASTER_PLAN.md Task Dependency Index:
- Direct filename match: `tasks.ts`
- Glob patterns: `*.stories.ts`, `src/stores/*.ts`
- Skips: `.json`, `.md`, `.sh`, `.lock` files

---

## Verification Tests

```bash
# Test 1: Lock acquisition (same session)
echo '{"session_id": "session-A", "tool_name": "Edit", "tool_input": {"file_path": "src/stores/tasks.ts"}}' | \
  CLAUDE_PROJECT_DIR=/path/to/project .claude/hooks/task-lock-enforcer.sh
# Expected: Exit 0, lock created

# Test 2: Blocking (different session)
echo '{"session_id": "session-B", "tool_name": "Edit", "tool_input": {"file_path": "src/stores/tasks.ts"}}' | \
  CLAUDE_PROJECT_DIR=/path/to/project .claude/hooks/task-lock-enforcer.sh 2>&1
# Expected: Exit 2, error message about TASK conflict
```

---

## Rollback Procedure

If issues occur:

```bash
# 1. Remove the hooks from settings.json
# Delete PreToolUse, SessionStart, SessionEnd sections

# 2. Clear all locks
rm -rf .claude/locks/*.lock

# 3. Optionally remove hook scripts
rm .claude/hooks/task-lock-enforcer.sh
rm .claude/hooks/session-lock-awareness.sh
rm .claude/hooks/session-lock-release.sh
```

---

## Monitoring

### Check Active Locks
```bash
ls -la .claude/locks/
cat .claude/locks/*.lock | jq .
```

### Manual Lock Release
```bash
rm .claude/locks/TASK-XXX.lock
```

---

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Mastery (GitHub)](https://github.com/disler/claude-code-hooks-mastery)
- [Claude Flow Wiki](https://github.com/ruvnet/claude-flow/wiki/Hooks-System)
