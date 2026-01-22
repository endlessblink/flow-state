# SOP-019: Auto-Test After Edit Hook

**Created**: January 22, 2026
**Task**: TASK-361
**Status**: Active

---

## Overview

The `auto-test-after-edit.sh` hook automatically runs tests in the background after source code edits. This is part of the 5-Layer Completion Defense System (TASK-334, Layer 2).

## Location

```
.claude/hooks/auto-test-after-edit.sh
```

## Behavior

| Aspect | Description |
|--------|-------------|
| **Trigger** | PostToolUse on `Edit` or `Write` tools |
| **File Types** | `.ts`, `.tsx`, `.vue`, `.js`, `.jsx` |
| **Exclusions** | Test files (`.spec.`, `.test.`), hook files |
| **Execution** | Background (non-blocking) via subshell + `disown` |
| **Timeout** | 60 seconds max |
| **Output** | `🔄 Tests running in background for <file>` |
| **Results** | Saved to `.claude/last-test-results.json` |

## Results File Format

```json
{
  "timestamp": "2026-01-22T10:30:00+00:00",
  "triggeredBy": "/path/to/edited/file.ts",
  "tool": "Edit",
  "exitCode": 0,
  "passed": true,
  "summary": "All tests passed"
}
```

## Integration with Artifact Checker

The `artifact-checker.sh` hook (Layer 1) reads `.claude/last-test-results.json` before allowing "done" claims. Even though tests run asynchronously, results are still verified before completion.

---

## Disabling the Hook

### Option 1: Temporary Disable (Per-Session)

Rename the hook file to prevent execution:

```bash
mv .claude/hooks/auto-test-after-edit.sh .claude/hooks/auto-test-after-edit.sh.disabled
```

To re-enable:

```bash
mv .claude/hooks/auto-test-after-edit.sh.disabled .claude/hooks/auto-test-after-edit.sh
```

### Option 2: Disable via Hook Config

Edit `.claude/settings.json` and remove the hook from the `hooks` array:

```json
{
  "hooks": {
    "PostToolUse": [
      // Remove or comment out the auto-test entry
      // { "command": ".claude/hooks/auto-test-after-edit.sh" }
    ]
  }
}
```

### Option 3: Make Hook Exit Early

Add this line near the top of the script (after the shebang):

```bash
# Temporarily disable auto-testing
exit 0
```

### Option 4: Exclude Specific Files/Patterns

Edit the script to add patterns to skip:

```bash
# Add after the existing exclusion checks (around line 27-29)
# Skip specific directories or patterns
if [[ "$FILE_PATH" =~ my-excluded-dir/ ]]; then
    exit 0
fi
```

---

## Re-enabling the Hook

1. **If renamed**: Rename back to `.sh` extension
2. **If config removed**: Re-add to `.claude/settings.json`
3. **If early exit added**: Remove the `exit 0` line
4. **If patterns added**: Remove the exclusion pattern

---

## Reverting to Synchronous Mode

If you need blocking (synchronous) test execution:

1. Remove the subshell wrapper `( ... ) &` and `disown`
2. Restore the original output messaging

See git history for the original synchronous implementation:

```bash
git show HEAD~1:.claude/hooks/auto-test-after-edit.sh
```

---

## Troubleshooting

### Tests Not Running

1. Check if hook is executable: `ls -la .claude/hooks/auto-test-after-edit.sh`
2. Verify file type matches filter (`.ts`, `.vue`, etc.)
3. Check if file is excluded (test file, hook file)

### Results File Not Updating

1. Check if tests are timing out (60s limit)
2. Verify `npm run test` works manually
3. Check background process: `ps aux | grep npm`

### Want Immediate Feedback

Run tests manually after editing:

```bash
npm run test
```

Or check results file after a few seconds:

```bash
cat .claude/last-test-results.json
```

---

## Related

- **TASK-334**: AI "Done" Claim Verification System
- **Layer 1**: `artifact-checker.sh` - Verifies test results before completion
- **Layer 2**: This hook - Auto-runs tests after edits
- **CLAUDE.md**: Completion Protocol section
