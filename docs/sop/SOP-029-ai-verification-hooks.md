# SOP-029: AI "Done" Claim Verification System

**Created**: January 23, 2026
**Status**: Active
**Task**: TASK-334

## Purpose

Prevent Claude from claiming tasks are "done" without proper verification. This system addresses the fundamental problem that Claude writes both the code AND the tests, making self-verification unreliable.

## Architecture

### 5-Layer Defense System

| Layer | Purpose | Implementation |
|-------|---------|----------------|
| **1. Artifact Check** | Show test status on every prompt | `skill-router-hook.sh` |
| **2. Auto-Test** | Run tests after code edits | `auto-test-after-edit.sh` |
| **3. Falsifiability** | Define success/failure upfront | CLAUDE.md protocol |
| **4. User Confirmation** | Completion protocol reminders | `skill-router-hook.sh` |
| **5. Judge Agent** | Independent evaluation | Dev-Maestro API |

### Key Finding

Only the **first hook** in a UserPromptSubmit chain receives stdin. Multiple separate hooks don't work - the first consumes the input.

**Solution**: Unified `skill-router-hook.sh` handles Layer 1 + Layer 4 + skill suggestions.

## What Claude Sees

On every user message, Claude receives:

```
<system-reminder>
UserPromptSubmit hook success: <user-prompt-submit-hook>
[LAYER 1] ⚠️ TESTS FAILED: 16 failed, 438 passed | [SKILL] dev-debugging
</user-prompt-submit-hook>
</system-reminder>
```

### Warning Types

| Warning | Meaning |
|---------|---------|
| `Test results stale (Xs)` | Tests haven't run in >10 minutes |
| `TESTS FAILED: X failed` | Tests ran but some failed |
| `No test results` | No `.claude/last-test-results.json` exists |

## Behavioral Requirement

When `[LAYER 1]` fires, Claude MUST:

1. **Run tests first** - `npm run test` before responding
2. **Acknowledge results** - State what passed/failed
3. **Not claim "done"** - Until tests pass AND user verifies

This is a **blocker**, not informational noise.

## File Structure

```
.claude/
├── hooks/
│   ├── skill-router-hook.sh      # Layer 1 + 4 + skills (unified)
│   ├── auto-test-after-edit.sh   # Layer 2 (PostToolUse)
│   └── user-prompt-handler.sh    # Backup unified handler
├── last-test-results.json        # Test results storage
└── settings.json                 # Hook registration

dev-maestro/
└── server.js                     # Layer 5 judge endpoint
```

## Hook Details

### skill-router-hook.sh (UserPromptSubmit)

**Runs**: On every user message
**Reads**: `.claude/last-test-results.json`
**Outputs**: `[LAYER 1]` warnings + `[SKILL]` suggestions

```bash
# Core logic
if [ -f "$RESULTS_FILE" ]; then
    RESULTS_AGE=$(( $(date +%s) - $(stat -c %Y "$RESULTS_FILE") ))
    if [ $RESULTS_AGE -gt 600 ]; then
        # Stale warning
    else
        PASSED=$(jq -r '.passed' "$RESULTS_FILE")
        if [ "$PASSED" != "true" ]; then
            # Failed warning
        fi
    fi
fi
```

### auto-test-after-edit.sh (PostToolUse)

**Runs**: After Edit/Write tools on source files (.ts, .vue, .js, etc.)
**Writes**: `.claude/last-test-results.json`
**Background**: Runs async, doesn't block response

```bash
# Only triggers for source files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|vue|js|jsx)$ ]]; then
    exit 0
fi
```

### Judge Endpoint (Layer 5)

**URL**: `POST http://localhost:6010/api/judge/evaluate`
**Modes**:
- `?mode=fast` - Rule-based evaluation (default)
- `?mode=claude` - Spawn Claude judge agent

```bash
curl -X POST http://localhost:6010/api/judge/evaluate?mode=fast \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Implement backup restore",
    "artifacts": {"testOutput": "16 failed"},
    "successCriteria": "Tests pass",
    "claimedCompletion": true
  }'
```

## Test Results JSON Schema

```json
{
  "timestamp": "2026-01-23T19:58:30+02:00",
  "triggeredBy": "src/App.vue",
  "tool": "Edit",
  "exitCode": 1,
  "passed": false,
  "summary": "16 failed, 438 passed"
}
```

## Troubleshooting

### Hook not firing
1. Check `.claude/settings.json` has hook registered
2. Restart Claude Code (settings load at session start)
3. Verify hook is executable: `chmod +x .claude/hooks/skill-router-hook.sh`

### Wrong warning showing
1. Check `.claude/last-test-results.json` timestamp
2. Run `npm run test` to update results
3. Verify `jq` is installed

### Multiple hooks not working
Claude Code only passes stdin to the first hook. Use unified handler approach.

## Maintenance

### Update test results manually
```bash
cat > .claude/last-test-results.json << 'EOF'
{
  "timestamp": "2026-01-23T20:00:00+02:00",
  "triggeredBy": "manual",
  "tool": "Bash",
  "exitCode": 0,
  "passed": true,
  "summary": "All tests passed"
}
EOF
```

### Check hook is receiving input
Add debug logging temporarily:
```bash
exec 2>>/tmp/hook-debug.log
echo "USER_PROMPT: '$USER_PROMPT'" >&2
```

## Related

- **CLAUDE.md**: Completion Protocol section
- **TASK-335**: Judge Agent UI in Dev-Maestro
- **Plan file**: `~/.claude/plans/bubbly-stargazing-galaxy.md`
