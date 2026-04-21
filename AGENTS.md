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

## Electron-First Rule

- For FlowState changes that the user may need to test in the desktop app or receive through the desktop updater, always build the Electron app, not just the web app.
- Default verification/build target for desktop-facing work:
  - `npm run electron:build`
- If the user needs to update through Electron, version bumping is mandatory before build and deploy. Without a newer version, the updater has nothing to detect.
- For desktop-facing FlowState work, assume the full Electron updater flow is required unless the user explicitly says local-only, skip deploy, or skip push.
- If the user says to "do it", "ship it", "push the update", or otherwise asks to deliver the change, treat that as instruction to complete the full Electron flow end-to-end: version bump, build, deploy, verify updater manifest, commit, and push.
- For any local FlowState code change that fixes behavior the user is testing in the desktop app, default to shipping the Electron update in the same session. Do not leave desktop fixes local unless the user explicitly asks to keep them unshipped.
- Required updater delivery flow:
  - bump version
  - build Electron
  - deploy update artifacts to VPS
  - verify `https://in-theflow.com/updates/electron/latest-linux.yml`
- If a packaged artifact is specifically needed for install/update validation, follow the Electron SOP and package with `electron-builder`.
- Do not stop after browser-only verification when the change is expected to be tested or updated through Electron.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Add tasks to MASTER_PLAN.md
2. **Run quality gates** (if code changed) - Tests, linters, Electron build
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
