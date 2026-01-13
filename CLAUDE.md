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

**Problem:** Hardcoded CSS values (rgba, px, hex) cause visual inconsistency and make theming impossible. Currently 52+ files have this issue.

**Solution:** ALWAYS use design tokens from `src/assets/design-tokens.css`.

### Required Token Usage

| Property | Never Use | Always Use |
|----------|-----------|------------|
| **Background colors** | `rgba(18, 18, 20, 0.98)` | `var(--overlay-component-bg)` |
| **Glass effects** | `rgba(255, 255, 255, 0.06)` | `var(--glass-bg-heavy)` |
| **Borders** | `rgba(255, 255, 255, 0.12)` | `var(--glass-border)` |
| **Backdrop blur** | `blur(20px)` | `var(--overlay-component-backdrop)` |
| **Border radius** | `12px`, `8px` | `var(--radius-lg)`, `var(--radius-md)` |
| **Spacing** | `8px`, `12px`, `16px` | `var(--space-2)`, `var(--space-3)`, `var(--space-4)` |
| **Font sizes** | `10px`, `13px` | `var(--text-xs)`, `var(--text-sm)` |
| **Transitions** | `0.15s ease-out` | `var(--duration-fast) var(--ease-out)` |
| **Shadows** | `0 12px 40px rgba(...)` | `var(--overlay-component-shadow)` |

### Common Token Reference

```css
/* Overlay backgrounds */
--overlay-component-bg        /* Dark overlay panels */
--glass-bg-light             /* rgba(255,255,255,0.02) */
--glass-bg-medium            /* rgba(255,255,255,0.04) */
--glass-bg-heavy             /* rgba(255,255,255,0.06) */

/* Borders */
--glass-border               /* rgba(255,255,255,0.10) */
--glass-border-hover         /* rgba(255,255,255,0.15) */
--overlay-component-border   /* Full border declaration */

/* Spacing (8px grid) */
--space-1 (4px), --space-2 (8px), --space-3 (12px), --space-4 (16px)
--space-1_5 (6px), --space-2_5 (10px)

/* Typography */
--text-xs (12px), --text-sm (14px), --text-base (16px)

/* Border radius */
--radius-sm (6px), --radius-md (8px), --radius-lg (16px), --radius-xl (20px)

/* Animation */
--duration-fast (150ms), --duration-normal (200ms)
--ease-out, --spring-smooth
```

### Example: Correct vs Incorrect

```css
/* ❌ WRONG - Hardcoded values */
.menu {
  background: rgba(18, 18, 20, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.15s ease-out;
}

/* ✅ CORRECT - Design tokens */
.menu {
  background: var(--overlay-component-bg);
  border: var(--overlay-component-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-out);
}
```

**Full token reference:** `src/assets/design-tokens.css` (1,220 lines)

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

**Dual-Engine Backup System (Shadow Mirror):**
- **Engine A**: Standard Postgres Dump (`.sql`, 50-file rotation)
- **Engine B**: Shadow Mirror (`backups/shadow.db` - SQLite)
- **Engine C**: JSON Hub (`public/shadow-latest.json` - Frontend Bridge)
- **Interval**: Automatic every 5 minutes via `npm run dev`
- **Manual Trigger**: `npm run backup:watch` or `node scripts/shadow-mirror.cjs`
- **Verification**: `node scripts/verify-shadow-layer.cjs` (verifies fidelity)
- **Recovery UI**: Settings > Storage tab (System 2 Golden Restore & System 3 Shadow Hub)
- **Configuration**: Service Role Key in `.env.local` required for full Shadow access bypass RLS.

**Hook enforcement:** `.claude/hooks/destructive-command-blocker.sh`

**If you need to reset the database:**
- Tell the user to run the command MANUALLY in their terminal
- Claude Code cannot and will not run destructive commands

## Supabase Architecture

**Database Layer:** `useSupabaseDatabaseV2.ts` (single source of truth)
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
src/composables/useSupabaseDatabaseV2.ts  # Main database composable
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
| `useCanvasParentChild.ts` | Group nesting and parent-child relationships |
| `useCanvasDragDrop.ts` | Drag-drop handlers and position updates |
| `useCanvasEvents.ts` | Vue Flow event handlers |
| `useCanvasActions.ts` | Task/group CRUD operations |

## Canvas Geometry Invariants (CRITICAL - TASK-255)

**Position drift and "jumping" tasks occur when multiple code paths mutate geometry. Follow these invariants:**

### Core Rules

1. **Single Writer for Geometry** - Only drag handlers may change `parentId`, `canvasPosition`, `parentGroupId`, `position`
2. **Sync is Read-Only** - `useCanvasSync.ts` MUST NEVER write to stores (no `updateTask`, `updateGroup`)
3. **Metadata vs Layout** - Smart-Groups update `dueDate`/`status`/`priority` only, NEVER geometry

### Allowed Geometry Writers

| File | Function | OK to Change Geometry? |
|------|----------|------------------------|
| `useCanvasInteractions.ts` | `onMoveEnd()` | ✅ YES (drag handler) |
| `useCanvasTaskActions.ts` | `handleQuickTaskCreate()` | ✅ YES (task creation) |
| `useCanvasTaskActions.ts` | `moveSelectedTasksToInbox()` | ✅ YES (explicit move) |
| `spatialContainment.ts` | `reconcileTaskParentsByContainment()` | ⚠️ ONE-TIME on load only |
| Smart-Group logic | Any | ❌ NO - metadata only |
| Sync/orchestrator | Any | ❌ NO - read-only |

### Permanently Disabled Features (QUARANTINED)

These features are **permanently disabled** (code removed, stubs remain for API compatibility):
- `useMidnightTaskMover.ts` - Auto-moved tasks at midnight (violated geometry invariants)
- `useCanvasOverdueCollector.ts` - Auto-collected overdue tasks into groups (violated geometry invariants)

**Why quarantined**: These features mutated `canvasPosition` and `parentId` automatically,
which caused position drift and sync cascades. Only user-initiated drag operations may change geometry.

**DO NOT re-enable** without full sync architecture review. See ADR comments in each file.

### Drift Detection

When calling `updateTask()` with geometry changes, pass a source:
```typescript
taskStore.updateTask(taskId, updates, 'DRAG')        // ✅ Allowed
taskStore.updateTask(taskId, updates, 'SMART-GROUP') // ⚠️ Warning if geometry
taskStore.updateTask(taskId, updates, 'SYNC')        // ⚠️ Warning if geometry
```

Console will show: `📍 [GEOMETRY-DRAG]` or `⚠️ [GEOMETRY-DRIFT]` warnings.

**Full SOP**: `docs/sop/SOP-002-canvas-geometry-invariants.md`

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
| `database.md` | ⚠️ OUTDATED - references PouchDB (app now uses Supabase) |
| `design-system.md` | Design tokens, Tailwind config, glass morphism |
| `troubleshooting.md` | Common issues, gotchas, SOPs |
| `backup-system.md` | Dual-engine backup system documentation |

---

**Last Updated**: January 10, 2026
**Stack**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3, Supabase
