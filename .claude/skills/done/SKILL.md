---
name: done
description: Task completion workflow - run tests, commit/push, update MASTER_PLAN.md status, create SOP if needed. This skill should be used when a task is complete and ready to be finalized. Triggers on "/done", "mark done", "task complete", "finish task".
---

# Task Completion Workflow

Finalize a completed task: verify tests pass, commit changes, update MASTER_PLAN.md, and optionally create an SOP.

## Workflow

### Step 1: Get Task Information

Ask user for:
1. **Task ID** (e.g., TASK-1017, BUG-1018, FEATURE-1020)
2. **Brief summary** of what was done (1-2 sentences)
3. **SOP needed?** - Was the fix non-obvious and worth documenting?

Use `AskUserQuestion` tool:
```
Questions:
1. "What is the task ID?" (header: "Task ID", free text via Other)
2. "Should an SOP be created for this fix?" (header: "Create SOP", options: Yes/No)
```

### Step 2: Run Tests

Execute test suite to verify everything works:

```bash
npm run test
```

**If tests fail**: STOP. Do not proceed. Report failures to user.

**If tests pass**: Continue to next step.

### Step 3: Git Commit and Push

Stage, commit, and push changes:

```bash
# Check status first
git status

# Stage relevant files (NOT .env or credentials)
git add <specific-files>

# Commit with task ID in message
git commit -m "$(cat <<'EOF'
[TASK-XXX] Brief description of changes

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Push to remote
git push
```

### Step 4: Update MASTER_PLAN.md

**CRITICAL**: Tasks appear in **3 locations** in MASTER_PLAN.md. Update ALL of them:

#### 4a. Summary Table (Roadmap section)

Find the task row and update:
- Add `~~strikethrough~~` around task ID
- Change status to `✅ **DONE**`
- Add completion date

**Before:**
```markdown
| **TASK-1017** | **Mobile: Expanded Date Options** | **P2** | 📋 **PLANNED** | ... |
```

**After:**
```markdown
| ~~**TASK-1017**~~ | ✅ **DONE** **Mobile: Expanded Date Options** | **P2** | ✅ **DONE** (2026-01-23) | ... |
```

#### 4b. Subtasks Lists (if task is a subtask)

Find any bullet points referencing this task and add strikethrough + checkmark:

**Before:**
```markdown
- TASK-1017: Mobile date options
```

**After:**
```markdown
- ~~TASK-1017~~: ✅ Mobile date options
```

#### 4c. Detailed Section (#### headers)

Find the detailed task section and update the header:

**Before:**
```markdown
#### TASK-1017: Mobile Expanded Date Options (📋 PLANNED)
```

**After:**
```markdown
#### ~~TASK-1017~~: Mobile Expanded Date Options (✅ DONE)
```

#### 4d. Verification

Run grep to verify all occurrences updated:

```bash
grep "TASK-1017" docs/MASTER_PLAN.md
```

All matches should show strikethrough or ✅ DONE.

### Step 5: Create SOP (if needed)

If user indicated SOP is needed:

1. **Determine SOP number**: Check `docs/sop/` for highest number, use next
2. **Create SOP file**: `docs/sop/SOP-XXX-<descriptive-name>.md`
3. **Use template**:

```markdown
# SOP-XXX: [Title]

**Created**: [Date]
**Related Task**: [TASK-ID]
**Status**: Active

## Problem

[What problem does this solve?]

## Solution

[Step-by-step solution]

## Key Files

- `path/to/file.ts` - [what it does]

## Verification

[How to verify the fix works]
```

### Step 6: Final Commit (if SOP created)

If SOP was created, commit it:

```bash
git add docs/sop/SOP-XXX-*.md docs/MASTER_PLAN.md
git commit -m "docs: Add SOP-XXX and mark TASK-XXX done

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push
```

### Step 7: Report Completion

Output summary to user:

```
✅ Task [TASK-ID] marked as DONE

Summary:
- Tests: ✅ Passed
- Commit: [commit hash]
- MASTER_PLAN.md: Updated (3 locations)
- SOP: [Created SOP-XXX / Not needed]

Changes pushed to remote.
```

## Important Rules

- **NEVER skip tests** - Always run `npm run test` first
- **Update ALL 3 locations** in MASTER_PLAN.md
- **Use strikethrough** (`~~ID~~`) on the task ID
- **Include task ID** in commit message
- **Only create SOP** if fix was non-obvious
- **Verify with grep** after updating MASTER_PLAN.md
