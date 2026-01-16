# CLAUDE.md

# NEVER EVER CLAIM SUCCESS THAT SOMETHING IS READY, DONE, READY FOR PRODUCTION ETC UNTIL THE USER CONFIRMS IT by actually testing or using the feature!!!!

# MASTER_PLAN Workflow (MANDATORY)

**IMPORTANT: Follow this workflow for EVERY task:**

1. **Before starting**: Run `./scripts/utils/get-next-task-id.cjs` to get a unique ID, then add task to `docs/MASTER_PLAN.md` with proper ID format (TASK-XXX, BUG-XXX, etc.)
2. **During work**: Update progress and meaningful steps in MASTER_PLAN.md
3. **After completion**: Mark as ✅ DONE with strikethrough on ID

Never begin implementation until the task is documented in MASTER_PLAN.md.

---

## Project Overview

**Pomo-Flow** - Vue 3 productivity app combining Pomodoro timer with task management across Board, Calendar, and Canvas views. Uses Supabase for persistence/auth with glass morphism design.

## Current Status

| Component | Status |
|-----------|--------|
| Canvas | ✅ Working (groups, nesting, drag-drop) |
| Board | ✅ Working (Kanban swimlanes) |
| Calendar | ⚠️ Partial (resize issues) |
| Supabase Sync | ✅ Working (RLS enabled) |
| Backup System | ✅ Hardened (Smart Layers 1-3) |
| Build/CI | ✅ Passing |

**Full Tracking**: `docs/MASTER_PLAN.md`

## Essential Commands

```bash
npm run dev          # Start dev server (port 5546) - validates JWT keys first
npm run kill         # Kill all PomoFlow processes (CRITICAL - DO NOT REMOVE)
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
npm run storybook    # Component docs (port 6006)
npm run generate:keys  # Regenerate Supabase JWT keys if they drift
```

## Tech Stack

- **Vue 3** + TypeScript + Vite + Pinia
- **Tailwind CSS** + Naive UI + Glass morphism
- **Vue Flow** for canvas, **Vuedraggable** for drag-drop
- **Supabase** (Postgres + Auth + Realtime)
- **TipTap** for rich text editing

## Key Development Rules

1. **Test with Playwright First** - Visual confirmation mandatory before claiming features work
2. **Preserve npm kill script** - NEVER remove from package.json
3. **Use Design Tokens** - Never hardcode colors/spacing (see `docs/claude-md-extension/design-system.md`)
4. **Type Safety** - All new code must have proper TypeScript types
5. **Check Task Dependencies** - See Task Dependency Index in `docs/MASTER_PLAN.md`
6. **NEVER Create Demo Data** - First-time users MUST see empty app, not sample data
7. **Database Safety** - NEVER run destructive database commands without user approval (see below)
8. **Atomic Tasks** - ALWAYS break broad requests into single-action steps (see below)
9. **Canvas Geometry Invariants** - Only drag handlers may change positions/parents. Sync is read-only. (see below)

## Design Token Usage (MANDATORY)

**NEVER hardcode CSS values** (rgba, px, hex). ALWAYS use design tokens from `src/assets/design-tokens.css`.

**Full reference:** [`docs/claude-md-extension/design-system.md`](docs/claude-md-extension/design-system.md)

**Quick examples:**
```css
/* ❌ WRONG */                    /* ✅ CORRECT */
background: rgba(18,18,20,0.98);  background: var(--overlay-component-bg);
padding: 8px 12px;                padding: var(--space-2) var(--space-3);
border-radius: 12px;              border-radius: var(--radius-lg);
```

## Atomic Task Breakdown (CRITICAL)

**Problem:** Broad tasks like "test all features" or "fix everything" cause extended thinking loops (3+ minutes stuck).

**Solution:** ALWAYS break down broad requests automatically:

```
❌ BAD: "Test parent-child features"
✅ GOOD: Break into atomic steps:
   1. Check if groups show task count badges
   2. Verify dragging task into group works
   3. Confirm group drag moves children
```

**When user asks for multiple things at once:**
1. Use TodoWrite to create atomic task list
2. Work on ONE task at a time
3. Complete and mark done before starting next
4. NEVER try to solve "all three issues" simultaneously

**Atomic task criteria:**
- Can be completed in <2 minutes
- Has single, clear success condition
- Doesn't require analyzing multiple systems at once

**If you catch yourself thinking for >30 seconds:** STOP. Break the task down further.

**CRITICAL: When spawning Task agents:**
- NEVER use prompts like "test all", "verify everything", "fix all issues"
- ALWAYS spawn MULTIPLE agents in PARALLEL with ONE specific task each
- Each agent prompt must be completable in <2 minutes with Yes/No answer

## Database Safety (CRITICAL)

**NEVER run these commands automatically:**
- `supabase db reset` - PERMANENTLY BLOCKED (wipes all data)
- `DROP DATABASE` / `DROP TABLE` / `TRUNCATE` - User must run manually
- `DELETE FROM` without WHERE clause - Blocked
- `supabase db push --force` - Blocked

**Before ANY migration:**
1. Create a backup first:
   ```bash
   mkdir -p supabase/backups
   supabase db dump > supabase/backups/backup-$(date +%Y%m%d-%H%M%S).sql
   ```
2. The `destructive-command-blocker.sh` hook will BLOCK migrations without recent backup

**Backup location:** `supabase/backups/` (not committed to git)

**Dual-Engine Backup System:** See [`docs/claude-md-extension/backup-system.md`](docs/claude-md-extension/backup-system.md) for full details.
- Auto-backup every 5 minutes via `npm run dev`
- Recovery UI: Settings > Storage tab

**Hook enforcement:** `.claude/hooks/destructive-command-blocker.sh`

**If you need to reset the database:**
- Tell the user to run the command MANUALLY in their terminal
- Claude Code cannot and will not run destructive commands

## Supabase Architecture

**Database Layer:** `useSupabaseDatabase.ts` (single source of truth)
- All CRUD operations go through this composable
- Type mappers in `src/utils/supabaseMappers.ts` convert between app/DB types
- Auth via `src/services/auth/supabase.ts` + `src/stores/auth.ts`

**Tables (with RLS enabled):**
- `tasks` - Task data with user isolation
- `groups` - Canvas groups/sections
- `projects` - Project organization
- `timer_sessions` - Pomodoro session history
- `notifications` - Scheduled notifications
- `user_settings` - User preferences
- `quick_sort_sessions` - QuickSort session data

**Key Files:**
```
src/composables/useSupabaseDatabase.ts   # Main database composable
src/utils/supabaseMappers.ts              # Type conversion
src/services/auth/supabase.ts             # Supabase client init
src/stores/auth.ts                        # Auth state management
```

## Supabase JWT Key Validation

**Problem:** JWT keys in `.env.local` can drift from local Supabase's JWT secret, causing WebSocket 403 errors.

**Prevention:** `npm run dev` automatically validates JWT signatures before starting.

**If validation fails:**
```
[Supabase] JWT signature mismatch!
To fix, run: npm run generate:keys
```

**Fix:** Run `npm run generate:keys` and copy output to `.env.local`.

**Scripts:**
- `scripts/validate-supabase-keys.cjs` - Validates JWT signature on startup
- `scripts/generate-supabase-keys.cjs` - Generates correctly signed keys

**Local JWT Secret:** `super-secret-jwt-token-with-at-least-32-characters-long` (default for local Supabase)

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

**Canvas Composables** (`src/composables/canvas/`):
| Composable | Purpose |
|------------|---------|
| `useCanvasSync.ts` | **CRITICAL** - Single source of truth for node sync |
| `useCanvasInteractions.ts` | Drag-drop, selection, and node interactions |
| `useCanvasParentChildHelpers.ts` | Parent-child relationship utilities |
| `useCanvasEvents.ts` | Vue Flow event handlers |
| `useCanvasActions.ts` | Task/group CRUD operations |

## Canvas Geometry Invariants (CRITICAL - TASK-255)

**Position drift and "jumping" tasks occur when multiple code paths mutate geometry.**

**Full SOP:** [`docs/sop/SOP-002-canvas-geometry-invariants.md`](docs/sop/SOP-002-canvas-geometry-invariants.md)

### Quick Rules
1. **Single Writer** - Only drag handlers may change `parentId`, `canvasPosition`, `position`
2. **Sync is Read-Only** - `useCanvasSync.ts` MUST NEVER call `updateTask()` or `updateGroup()`
3. **Metadata Only** - Smart-Groups update `dueDate`/`status`/`priority`, NEVER geometry

### Quarantined Features (DO NOT RE-ENABLE)
- `useMidnightTaskMover.ts` - Auto-moved tasks at midnight
- `useCanvasOverdueCollector.ts` - Auto-collected overdue tasks

These violated geometry invariants and caused position drift. See ADR comments in each file.

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
- **NEVER reuse IDs** - Always run `./scripts/utils/get-next-task-id.cjs` first

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
| Paused | `PAUSED`, `⏸️` |
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
| `backup-system.md` | Dual-engine backup system (Postgres + Shadow Mirror) |
| `design-system.md` | Design tokens, Tailwind config, glass morphism |
| `troubleshooting.md` | Common issues, gotchas, SOPs |

---

**Last Updated**: January 10, 2026
**Stack**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3, Supabase
