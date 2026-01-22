# SOP-019: Multi-Agent File Locking & Queue System

**Created**: January 22, 2026
**Status**: Active
**Purpose**: Prevent file conflicts when multiple Claude Code sessions work on the same codebase

---

## Problem Statement

When multiple Claude Code agents work on the same project simultaneously:
- Agent A edits `file.vue`
- Agent B (with stale cache) also edits `file.vue`
- Agent B's write overwrites Agent A's changes
- Work is lost with no warning

## Solution Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Coordination                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Agent A    │    │   Agent B    │    │   Agent C    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PreToolUse Hook: task-lock-enforcer.sh      │   │
│  │                                                          │   │
│  │  1. Extract file path from Edit/Write tool call          │   │
│  │  2. Match file to TASK in MASTER_PLAN.md                 │   │
│  │  3. Check .claude/locks/TASK-XXX.lock                    │   │
│  │  4. If locked by other session → WAIT or BLOCK           │   │
│  │  5. If available → Acquire lock and ALLOW                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  .claude/locks/                          │   │
│  │                                                          │   │
│  │  TASK-123.lock  ←── { session_id, timestamp, files }    │   │
│  │  TASK-456.lock                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Lock File Format

```json
{
  "task_id": "TASK-123",
  "session_id": "abc123def456",
  "timestamp": 1737578400,
  "locked_at": "2026-01-22 21:00:00",
  "files_touched": ["src/composables/useTauriStartup.ts"]
}
```

### Queue Behavior

| Scenario | Behavior |
|----------|----------|
| File not in MASTER_PLAN | Allow edit (no tracking) |
| File in task, not locked | Acquire lock, allow edit |
| File in task, locked by self | Refresh lock, allow edit |
| File in task, locked by other | **Defer edit**, save to queue, suggest working on other tasks |

### Deferred Execution System

Instead of blocking/waiting, the system now **defers edits** and lets agents work on other tasks:

1. **When blocked**: Edit is saved to `.claude/deferred-queue/{session_id}.json`
2. **Agent continues**: Can work on other tasks via `bd ready`
3. **Lock released**: `deferred-reminder.sh` hook notifies agent on next prompt
4. **Retry available**: Agent can re-attempt the edit

**Benefits:**
- No frozen/stuck agents
- Better multi-agent parallelism
- Agents stay productive while waiting

---

## Setup Instructions

### 1. Enable the Hook

In `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/task-lock-enforcer.sh"
          }
        ]
      }
    ]
  }
}
```

### 2. Create Locks Directory

```bash
mkdir -p .claude/locks
echo "*.lock" > .claude/locks/.gitignore
```

### 3. Map Files to Tasks in MASTER_PLAN.md

Tasks must have files listed in the "Primary Files" column:

```markdown
| ID | Status | Primary Files | Description |
|----|--------|---------------|-------------|
| TASK-123 | IN_PROGRESS | `useTauriStartup.ts, App.vue` | Tauri startup debugging |
| TASK-456 | TODO | `canvas/*.ts` | Canvas refactor |
```

**Pattern matching supported:**
- Exact filename: `App.vue`
- Glob patterns: `*.stories.ts`, `src/stores/*.ts`
- Directory patterns: `canvas/*.ts`

### 4. Install inotifywait (Recommended)

```bash
# Ubuntu/Debian
sudo apt install inotify-tools

# macOS
brew install fswatch  # Note: different tool, may need adaptation

# Check if available
which inotifywait
```

---

## Configuration

Edit `task-lock-enforcer.sh` to adjust:

```bash
LOCK_EXPIRY_HOURS=4     # Auto-clear stale locks after 4 hours
MAX_WAIT_SECONDS=300    # Wait up to 5 minutes in queue
POLL_INTERVAL=15        # Fallback polling interval (if no inotifywait)
```

---

## Usage

### For Agents

Agents don't need to do anything special. The hook handles locking automatically.

**When blocked (deferred):**
```
📋 DEFERRED: Edit to file.vue queued (blocked by TASK-123)

The file is currently locked by session abc123... (since 2026-01-22 21:00:00).
Your edit has been saved to the deferred queue.

NEXT STEPS:
1. Work on other available tasks: `bd ready`
2. You'll be notified when TASK-123 completes
3. Then retry your edit to file.vue
```

**When lock released (on next prompt):**
```
DEFERRED EDITS NOW AVAILABLE:

The following files are no longer locked:
  - src/file.vue

You can now retry your edits to these files.
```

### Manual Lock Management

```bash
# View active locks
ls -la .claude/locks/

# Check specific lock
cat .claude/locks/TASK-123.lock | jq

# Force release a lock (if agent crashed)
rm .claude/locks/TASK-123.lock

# Clear all stale locks
find .claude/locks -name "*.lock" -mmin +240 -delete
```

### Coordination with Beads

```bash
# Before starting work, claim the task
bd update TASK-123 --status=in_progress

# Check what's available (not blocked)
bd ready

# When done, close the task (lock auto-releases on session end)
bd close TASK-123
```

---

## Troubleshooting

### Lock Not Being Acquired

**Check:** Is the file listed in MASTER_PLAN.md?
```bash
grep "filename.vue" docs/MASTER_PLAN.md
```

**Check:** Is the hook enabled?
```bash
cat .claude/settings.json | jq '.hooks.PreToolUse'
```

### Agent Stuck Waiting

**Check:** Is the lock holder still active?
```bash
cat .claude/locks/TASK-XXX.lock
# Check if session_id corresponds to active agent
```

**Fix:** Remove stale lock
```bash
rm .claude/locks/TASK-XXX.lock
```

### Multiple Agents Claiming Same Lock

This shouldn't happen (hook is synchronous), but if it does:
- The second agent's Edit will overwrite the first's lock
- First agent's subsequent edits will be blocked

**Prevention:** Ensure hooks are enabled on ALL Claude sessions

---

## Integration with Dev-Maestro

Dev-Maestro can orchestrate multi-agent workflows with file locking:

1. **Task Assignment**: Maestro assigns tasks with file lists
2. **Lock Monitoring**: Maestro dashboard shows active locks
3. **Queue Visualization**: See which agents are waiting
4. **Auto-Release**: Detect crashed agents and release their locks

See: `~/.dev-maestro/plugins/file-locking/` (if installed)

---

## Files

| File | Purpose |
|------|---------|
| `.claude/hooks/task-lock-enforcer.sh` | Main hook script (PreToolUse) |
| `.claude/hooks/deferred-reminder.sh` | Deferred edit notification (UserPromptSubmit) |
| `.claude/settings.json` | Hook configuration |
| `.claude/locks/*.lock` | Active lock files |
| `.claude/deferred-queue/*.json` | Deferred edit queues per session |
| `docs/MASTER_PLAN.md` | Task-to-file mapping |

### Deferred Queue Format

```json
{
  "session_id": "abc123...",
  "deferred_edits": [
    {
      "file": "src/file.vue",
      "blocked_by_task": "TASK-123",
      "blocked_by_session": "xyz789...",
      "tool_input": { /* original Edit params */ },
      "timestamp": 1737580000
    }
  ]
}
```

---

## Changelog

- **2026-01-22**: Implemented deferred execution (save to queue, work on other tasks)
- **2026-01-22**: Added deferred-reminder.sh hook for lock release notification
- **2026-01-22**: Added queue/wait behavior instead of immediate block
- **2026-01-22**: Initial implementation with inotifywait support
