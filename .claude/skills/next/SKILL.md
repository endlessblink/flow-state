---
name: next
description: Analyze beads and MASTER_PLAN.md to recommend the best task to work on next. Checks both systems, scores by priority (P0-P3), considers IN PROGRESS tasks, blocked dependencies, and quick wins. Use when starting a session or deciding what to tackle.
---

# What's Next?

Analyze beads and MASTER_PLAN.md to recommend the best task to work on.

## Workflow

### Step 1: Check Beads System

Run these commands:

```bash
bd ready        # Issues ready to work (no blockers)
bd list --status=in_progress  # Your active work (might need to finish first)
bd blocked      # See what's stuck
```

### Step 2: Parse MASTER_PLAN.md

Search for tasks by status and priority:

```bash
# Find all non-done tasks with their priority
grep -E "^\| \*\*(TASK|BUG|FEATURE)-[0-9]+\*\*" docs/MASTER_PLAN.md | grep -v "DONE" | head -40
```

### Step 3: Priority Scoring

Score each task using this formula:

| Factor | Points |
|--------|--------|
| P0 (Critical) | +100 |
| P1 (High) | +50 |
| P2 (Medium) | +20 |
| P3 (Low) | +5 |
| IN PROGRESS (yours) | +30 (finish what you started) |
| REVIEW (needs verification) | +25 |
| PLANNED (not started) | +10 |
| Has blockers | -50 |
| Blocks other tasks | +15 (unblocks more work) |

### Step 4: Check for Uncommitted Work

```bash
git status  # Any uncommitted work to finish?
git stash list  # Stashed changes to apply?
```

If there's uncommitted work, mention it: "You have uncommitted changes in X files - consider committing or stashing first."

### Step 5: Present Recommendations

Output in this format:

```
## What's Next?

### Active Work (Finish First)
- [List any IN PROGRESS tasks - you should finish these]

### Top Recommendations
| Rank | Task | Priority | Status | Rationale |
|------|------|----------|--------|-----------|
| 1 | BUG-333 | P0 | IN PROGRESS | Finish active P0 work first |
| 2 | TASK-330 | P0 | PLANNED | Critical reliability issue |
| 3 | BUG-341 | P1 | IN PROGRESS | Unfinished debugging work |

### Blocked (Need Attention)
- [Any blocked tasks and what's blocking them]

### Quick Wins (< 30 min)
- [Any small tasks that could be knocked out quickly]
```

## Rules

1. **Finish before starting** - Always prioritize IN PROGRESS tasks over PLANNED
2. **P0 trumps all** - Critical bugs/issues come first regardless of other factors
3. **Unblock others** - Tasks that block multiple other tasks get priority bump
4. **REVIEW tasks** - These need verification, often quick to close out
5. **Don't overwhelm** - Show max 5 recommendations, not the entire backlog
