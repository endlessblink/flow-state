# CLAUDE.md

# NEVER EVER CLAIM SUCCESS THAT SOMETHING IS READY, DONE, READY FOR PRODUCTION ETC UNTIL THE USER CONFIRMS IT by actually testing or using the feature!!!!

# MASTER_PLAN Workflow (MANDATORY)

**IMPORTANT: Follow this workflow for EVERY task:**

1. **Before starting**: Add task to `docs/MASTER_PLAN.md` with proper ID format (TASK-XXX, BUG-XXX, etc.)
2. **During work**: Update progress and meaningful steps in MASTER_PLAN.md
3. **After completion**: Mark as ✅ DONE with strikethrough on ID

Never begin implementation until the task is documented in MASTER_PLAN.md.

---

## Project Overview

**Pomo-Flow** - Vue 3 productivity app combining Pomodoro timer with task management across Board, Calendar, and Canvas views. Uses PouchDB + CouchDB persistence with glass morphism design.

## Current Status

| Component | Status |
|-----------|--------|
| Canvas | ✅ Working |
| Calendar | ⚠️ Partial (resize issues) |
| CouchDB Sync | ✅ Working |
| Build/CI | ✅ Passing |

**Full Tracking**: `docs/MASTER_PLAN.md`

## Essential Commands

```bash
npm run dev          # Start dev server (port 5546)
npm run kill         # Kill all PomoFlow processes (CRITICAL - DO NOT REMOVE)
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
npm run storybook    # Component docs (port 6006)
```

## Tech Stack

- **Vue 3** + TypeScript + Vite + Pinia
- **Tailwind CSS** + Naive UI + Glass morphism
- **Vue Flow** for canvas, **Vuedraggable** for drag-drop
- **PouchDB** (local) + **CouchDB** (optional sync)

## Key Development Rules

1. **Test with Playwright First** - Visual confirmation mandatory before claiming features work
2. **Preserve npm kill script** - NEVER remove from package.json
3. **Use Design Tokens** - Never hardcode colors/spacing (see `docs/claude-md-extension/design-system.md`)
4. **Type Safety** - All new code must have proper TypeScript types
5. **Check Task Dependencies** - See Task Dependency Index in `docs/MASTER_PLAN.md`
6. **NEVER Create Demo Data** - First-time users MUST see empty app, not sample data

## Canvas Position Persistence (CRITICAL)

**DO NOT** add code that can cause canvas positions to reset. Known causes:

| Issue | Root Cause | Fix |
|-------|------------|-----|
| **TASK-131**: Positions reset during session | Competing `deep: true` watcher in `canvas.ts` | REMOVED - `useCanvasSync.ts` is single source of truth |
| **TASK-142**: Positions reset on refresh | Canvas store loaded before auth ready | Auth watcher reloads groups from Supabase |

**Architecture Rules:**
- `useCanvasSync.ts` is the SINGLE source of sync for canvas nodes
- NEVER add watchers in `canvas.ts` that call `syncTasksToCanvas()`
- Vue Flow positions are authoritative for existing nodes
- Position locks (7s timeout) must be respected during sync

**Before modifying canvas sync:**
1. Run `npm run test -- --grep "Position Persistence"`
2. Manual test: drag item, refresh, verify position persists

## MASTER_PLAN.md Task ID Format

| Prefix | Usage |
|--------|-------|
| `TASK-XXX` | Active work features/tasks |
| `BUG-XXX` | Bug fixes |
| `ROAD-XXX` | Roadmap items |
| `IDEA-XXX` | Ideas |
| `ISSUE-XXX` | Known issues |

**Rules:**
- IDs must be sequential (TASK-001, TASK-002...)
- Completed items: `~~TASK-001~~` with strikethrough
- Never reuse IDs

## Dev-Manager Kanban Compatibility

The dev-manager at `http://localhost:6010` parses MASTER_PLAN.md.

**Task Header Format:**
```markdown
### TASK-XXX: Task Title (STATUS)
### ~~TASK-XXX~~: Completed Task Title (✅ DONE)
```

**Status Keywords:**
| Status | Keywords |
|--------|----------|
| Done | `DONE`, `COMPLETE`, `✅`, `~~strikethrough~~` |
| In Progress | `IN PROGRESS`, `IN_PROGRESS`, `🔄` |
| Review | `REVIEW`, `MONITORING`, `👀` |

## UI Component Standards

| Component Type | Use This |
|----------------|----------|
| Dropdowns | `CustomSelect.vue` (NEVER native `<select>`) |
| Context Menus | `ContextMenu.vue` (NEVER browser menus) |
| Modals | `BaseModal.vue`, `BasePopover.vue` |

## Multi-Instance Task Locking

This project has automatic task locking via `task-lock-enforcer.sh` hook to prevent conflicts when multiple Claude Code instances edit the same files.

**Lock files**: `.claude/locks/TASK-XXX.lock`
**Lock expiry**: 4 hours (stale locks auto-cleaned)

## Extended Documentation

Detailed docs available in `docs/claude-md-extension/`:

| File | Contents |
|------|----------|
| `architecture.md` | Project structure, stores, composables, data models |
| `code-patterns.md` | Component/store patterns, naming conventions |
| `testing.md` | Playwright/Vitest examples, dev workflow |
| `database.md` | PouchDB/CouchDB architecture, sync config |
| `design-system.md` | Design tokens, Tailwind config, glass morphism |
| `troubleshooting.md` | Common issues, gotchas, SOPs |

---

**Last Updated**: January 8, 2026
**Stack**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3, Supabase
