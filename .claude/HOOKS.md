# Claude Code Hooks

This project uses Claude Code hooks to enforce workflows, prevent conflicts, and maintain code quality.

## Quick Reference

| Event | Hook | Purpose |
|-------|------|---------|
| SessionStart | `session-lock-awareness.sh` | Shows active locks from other sessions |
| SessionEnd | `session-lock-release.sh` | Releases task locks automatically |
| PreToolUse | `task-lock-enforcer.sh` | Blocks edits to locked task files |
| PreToolUse | `check-npm-scripts.sh` | Validates npm scripts before running |
| UserPromptSubmit | `master-plan-reminder.sh` | Reminds to check MASTER_PLAN.md |
| UserPromptSubmit | `dependency-check-reminder.sh` | Checks task dependencies |
| UserPromptSubmit | `ask-questions-reminder.sh` | Reminds to use AskUserQuestion tool |
| UserPromptSubmit | `task-disappearance-helper.sh` | Helps debug task data loss |
| UserPromptSubmit | `misunderstanding-detector.sh` | Detects potential misunderstandings |
| PostToolUse | `validate-master-plan.sh` | Validates MASTER_PLAN.md format |
| PostToolUse | `auto-sync-task-status.sh` | Syncs task status after edits |

## Hook Details

### Session Lifecycle

#### `session-lock-awareness.sh`
- **Event:** SessionStart
- **Purpose:** Informs you of any active task locks from other Claude Code sessions
- **Output:** List of locked tasks or "No active locks"

#### `session-lock-release.sh`
- **Event:** SessionEnd
- **Purpose:** Automatically releases any task locks owned by the ending session
- **Lock location:** `.claude/locks/TASK-XXX.lock`

### Pre-Tool Hooks

#### `task-lock-enforcer.sh`
- **Event:** PreToolUse (Edit|Write)
- **Purpose:** Prevents multiple Claude instances from editing the same MASTER_PLAN task files
- **Behavior:** Blocks edit with exit code 2 if file is locked by another session
- **Lock expiry:** 4 hours (stale locks auto-cleaned)

#### `check-npm-scripts.sh`
- **Event:** PreToolUse (Bash)
- **Purpose:** Validates npm commands reference existing scripts in package.json
- **Protects:** Prevents running non-existent npm scripts

### User Prompt Hooks

#### `master-plan-reminder.sh`
- **Event:** UserPromptSubmit
- **Purpose:** Reminds to check docs/MASTER_PLAN.md for task tracking
- **Output:** Brief reminder about task ID format (TASK-XXX, BUG-XXX, etc.)

#### `dependency-check-reminder.sh`
- **Event:** UserPromptSubmit
- **Purpose:** Reminds to check Task Dependency Index before starting work
- **Output:** Brief reminder about file conflict checking

#### `ask-questions-reminder.sh`
- **Event:** UserPromptSubmit
- **Purpose:** Reminds to use AskUserQuestion tool instead of inline questions
- **Output:** Brief reminder about proper question handling

#### `task-disappearance-helper.sh`
- **Event:** UserPromptSubmit
- **Purpose:** Provides guidance when debugging task data loss (BUG-020)
- **Output:** Points to taskDisappearanceLogger utility

#### `misunderstanding-detector.sh`
- **Event:** UserPromptSubmit
- **Purpose:** Detects potentially ambiguous user requests
- **Output:** Suggestions for clarification when needed

### Post-Tool Hooks

#### `validate-master-plan.sh`
- **Event:** PostToolUse (Edit|Write)
- **Purpose:** Validates MASTER_PLAN.md format after edits
- **Checks:** Task ID format, table structure, status values

#### `auto-sync-task-status.sh`
- **Event:** PostToolUse (Edit|Write)
- **Purpose:** Automatically syncs task status between code and MASTER_PLAN
- **Behavior:** Updates status when task-related files are modified

## Configuration

Hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [...],
    "SessionEnd": [...],
    "PreToolUse": [...],
    "UserPromptSubmit": [...],
    "PostToolUse": [...]
  }
}
```

## Troubleshooting

### Hook not triggering
1. Check the hook has execute permissions: `chmod +x .claude/hooks/<hook>.sh`
2. Verify the matcher pattern in settings.json matches the tool name
3. Check hook timeout (default 5-10 seconds)

### Blocked by task lock
1. Wait for other session to complete
2. Or manually delete: `rm .claude/locks/TASK-XXX.lock`
3. Stale locks (>4 hours) are auto-cleaned

### Hook errors
- Hooks write to stderr for debugging
- Check `/tmp/` for any debug logs
- Exit code 2 = block the operation
- Exit code 0 = allow the operation

## Adding New Hooks

1. Create script in `.claude/hooks/`
2. Make executable: `chmod +x .claude/hooks/your-hook.sh`
3. Add to `.claude/settings.json` under appropriate event
4. Test with a simple operation

---

**Last Updated:** December 2024
