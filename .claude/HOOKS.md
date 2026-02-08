# Claude Code Hooks

## Active Hooks (registered in .claude/settings.json)

| Event | Script | Purpose |
|-------|--------|---------|
| SessionStart | `skill-announcer.sh` | Prints available skills reminder at session start |
| PreToolUse | `task-lock-enforcer.sh` | Blocks Edit/Write if task is locked by another session |
| UserPromptSubmit | `user-prompt-handler.sh` | Unified handler: test result staleness, completion checks, skill suggestions |

## Global Hooks (registered in ~/.claude/settings.json)

| Event | Command | Purpose |
|-------|---------|---------|
| SessionStart | `bd prime` | Initialize beads task tracking |
| PreCompact | `bd prime` | Re-prime beads after context compaction |

## Hook Behavior

### task-lock-enforcer.sh (PreToolUse)
- Fires on every Edit/Write tool call
- Checks if the target file belongs to a MASTER_PLAN task locked by another session
- If locked: BLOCKS the edit (exit 2), queues it to `.claude/deferred-queue/`
- If not locked: acquires lock and allows the edit
- Skips non-source files (.json, .md, .sh, .lock)
- Stale locks auto-cleaned after 4 hours

### user-prompt-handler.sh (UserPromptSubmit)
- Layer 1: Checks test result freshness (warns if stale >600s)
- Layer 4: Detects completion-check phrases ("is it done?", "finished?")
- Skill suggestions: Maps keywords to recommended skills

### skill-announcer.sh (SessionStart)
- Prints a reminder of available project skills at session start

## Removed Hooks (TASK-1285, Feb 2026)
20 inactive hooks were removed. They existed as files but were never registered in settings.json.
Key ones absorbed into `user-prompt-handler.sh`: artifact-checker, skill-router, require-user-confirmation.
Notable: `destructive-command-blocker.sh` was documented as active in CLAUDE.md but was never registered.
