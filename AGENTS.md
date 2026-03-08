# Agent Instructions

This project uses **MASTER_PLAN.md** (`docs/MASTER_PLAN.md`) as the single source of truth for task tracking.

## Quick Reference

```bash
# Find available work
grep -E "^### (TASK|BUG|FEATURE)-" docs/MASTER_PLAN.md | grep -v "~~" | grep -v DONE

# Check task status
grep "TASK-XXX" docs/MASTER_PLAN.md
```

Or use the `/next` skill to get scored task recommendations.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Add tasks to MASTER_PLAN.md
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update task status** - Mark done tasks in MASTER_PLAN.md (all 3 locations)
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Project Skills

- `next` skill: Find and score available tasks from MASTER_PLAN.md
  - Trigger: `/next`
