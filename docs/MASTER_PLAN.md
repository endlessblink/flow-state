**Last Updated**: January 9, 2026 (BUG-061 OverdueCollector Auto-Creation Fix)
**Version**: 5.34 (Board + Catalog View Redesign)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Archive

- **January 2026 completed tasks**: [docs/archive/MASTER_PLAN_JAN_2026.md](./archive/MASTER_PLAN_JAN_2026.md)
- **Historical (2025) completed tasks**: [docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)

---

## Current Status

| **Canvas** | ✅ **WORKING** | **Calendar** | ✅ Verified |
| **Sync** | ✅ **WORKING** | **Build/Tests** | ✅ **PASSING** |

---

## Roadmap

| ID | Feature | Priority | Status | Dependencies |
|----|---------|----------|--------|--------------|
| ~~ROAD-001~~ | ✅ **DONE** | Power Groups | [Details](./archive/Done-Tasks-Master-Plan.md) | - |
| **ROAD-013** | **Sync Hardening** | **P0** | 🔄 [See Detailed Plan](#roadmaps) | - |
| ROAD-004 | Mobile support (PWA) | P2 | 🔄 **IN PROGRESS** [See Detailed Plan](#roadmaps) | ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All Done) |
| ROAD-011 | AI Assistant | P1 | [See Detailed Plan](#roadmaps) | - |
| ~~ROAD-022~~ | ✅ **DONE** | Auth (Supabase)| [Details](./archive/MASTER_PLAN_JAN_2026.md) | - |
| ~~TASK-132~~ | ✅ **DONE** | Fix Canvas & Auth | [Walkthrough](file:///home/endlessblink/.gemini/antigravity/brain/3f8d0816-9774-4fe5-aa58-d6f311bc2d36/walkthrough.md) | - |
| **BUG-144** | **Canvas Tasks Disappeared** | **P0** | 🔄 **DEBUGGING** | - |


---

## Active Work (Summary)

> [!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

### Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

```
┌─────────────────────────────────────────────────────────────────┐
│  ROAD-004: PWA Mobile Support (🔄 IN PROGRESS)                   │
│  Status: Phase 1 Implementation - PWA Plugin Configured          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ All Prerequisites Done
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ~~TASK-118~~     │ │ ~~TASK-119~~     │ │ ~~TASK-120~~     │
│ Remove PouchDB   │ │ Remove PowerSync │ │ Fix CSP          │
│ Status: ✅ DONE  │ │ Status: ✅ DONE  │ │ Status: ✅ DONE  │
└──────────────────┘ └──────────────────┘ └──────────────────┘

       ┌──────────────────┐        ┌──────────────────┐
       │ ~~TASK-122~~     │        │ ~~TASK-121~~     │
       │ Bundle 505KB     │        │ Remove IP        │
       │ Status: ✅ DONE  │        │ Status: ✅ DONE  │
       └──────────────────┘        └──────────────────┘
```

**Prerequisites Complete**: All blocking tasks done, PWA Phase 1 in progress

---

<details>
<summary><b>Formatting Guide (For AI/Automation)</b></summary>

### Tasks
- `### TASK-XXX: Title (STATUS)`
- Use `(🔄 IN PROGRESS)`, `(✅ DONE)`, `(📋 PLANNED)`.
- Progress: Checked boxes `- [x]` calculate % automatically.

### Priority
- `P1-HIGH`, `P2-MEDIUM`, `P3-LOW` in header or `**Priority**: Level`.
</details>

<details id="roadmaps">
<summary><b>Detailed Feature Roadmaps</b></summary>

### ROAD-013: Sync Hardening (🔄 IN PROGRESS)
1. Audit current sync issues.
2. Fix conflict resolution UI.
3. Test multi-device scenarios E2E.

### ROAD-010: Gamification - "Cyberflow"
- **XP Sources**: Task completion, Pomodoro sessions, Streaks.
- **Features**: Leveling, Badges, Character Avatar in Sidebar.

### ROAD-011: AI Assistant
- **Features**: Task Breakdown, Auto-Categorization, NL Input ("Add meeting tomorrow 3pm").
- **Stack**: Local (Ollama) + Cloud (Claude/GPT-4).

### ROAD-004: Mobile PWA (🔄 IN PROGRESS - Phase 1)
- **Plan**: [plans/pwa-mobile-support.md](../plans/pwa-mobile-support.md)
- **Status**: Phase 1 - PWA Foundation in progress
- **Dependencies**: ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All ✅ DONE)

**Phase 0: Prerequisites** ✅ COMPLETE:
1. ~~TASK-118~~: Remove PouchDB packages (✅ 71 packages removed)
2. ~~TASK-119~~: Remove PowerSync packages (✅ 19 packages removed)
3. ~~TASK-120~~: Fix CSP for service workers (✅ worker-src configured)
4. ~~TASK-121~~: Remove hardcoded IP from database.ts (✅ uses env vars)
5. ~~TASK-122~~: Bundle size optimization (✅ 505KB - close to 500KB target)

**Phase 1: PWA Foundation** (✅ COMPLETE - January 8, 2026):
- [x] Install vite-plugin-pwa
- [x] Configure Workbox caching (NetworkFirst for Supabase API, CacheFirst for assets)
- [x] Create icon set (64, 192, 512, maskable)
- [x] Add PWA meta tags (theme-color, apple-touch-icon, description)
- [x] Build verified with service worker generation
- [x] Tested: Service worker registered & activated, manifest linked

**Phase 2: VPS Deployment** (Pending):
- Setup Caddy with auto-SSL
- GitHub Actions CI/CD
- Monitoring (Sentry, UptimeRobot)
</details>

<details id="active-task-details">
<summary><b>Active Task Details</b></summary>

### ~~TASK-148~~: Supabase Debugger Skill (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026

Created comprehensive Supabase Debugger Skill for Claude Code to debug, monitor, and optimize Supabase applications.

**Skill Location**: `.claude/skills/supabase-debugger/`

**Contents**:
- [x] `SKILL.md` - Main skill file with 7 debugging workflows
- [x] `references/commands.md` - Complete command reference (60+ commands)
- [x] `references/workflows.md` - Extended debugging workflows for complex scenarios
- [x] `references/schema-validation.md` - Schema validation SQL queries
- [x] `scripts/check-connection.sh` - Connection diagnostic bash script
- [x] `scripts/analyze-queries.sql` - Query performance analysis queries

**Workflows Covered**:
1. Connection Diagnostics
2. Authentication Debugging
3. Query Optimization
4. Realtime Subscription Debugging
5. Memory Investigation
6. RLS Policy Validation
7. Production Readiness Check

---

### TASK-157: ADHD-Friendly View Redesign (🔄 IN PROGRESS)
**Priority**: P2-MEDIUM
**Started**: January 9, 2026

Redesign Board and Catalog views with Todoist-style compact design for ADHD-friendly UX.

**Problem**: Board (Kanban), List, and Table views are underused due to:
- Visual overload (TaskCard: 1,217 lines, 7-9 metadata badges)
- God components (HierarchicalTaskRow: 1,023 lines, 37+ event listeners)
- No external structure to guide focus (unlike Calendar/Canvas/Quick Sort)

**Solution**: Compact, Todoist-inspired redesign with full bulk operations.

**Phase 1: Foundation (Bulk Selection System)**
- [ ] Create `useBulkSelection.ts` composable (Ctrl+Click, Shift+Click, Ctrl+A)
- [ ] Create `useBulkActions.ts` composable (batch status/priority/project/delete)
- [ ] Create `BulkActionBar.vue` component (~100 lines)

**Phase 2: Catalog View Redesign**
- [ ] Create `TaskRowCompact.vue` (~150 lines, replaces 1,023-line HierarchicalTaskRow)
- [ ] Create `CatalogView.vue` (~400 lines, unified List/Table with density toggle)
- [ ] Create `CatalogHeader.vue` (~100 lines, density/sort controls)

**Phase 3: Board/Kanban Redesign**
- [ ] Create `KanbanCardCompact.vue` (~250 lines, replaces 1,217-line TaskCard)
- [ ] Simplify `BoardView.vue` (~400 lines from ~820)

**Phase 4: Polish**
- [ ] Add keyboard shortcuts (Ctrl+A, Escape, Delete, 1/2/3 for priority)
- [ ] Add animations (selection, removal, action bar)
- [ ] Add accessibility (ARIA, focus management)

**Target Metrics**:
- Tasks visible per screen: +40-50%
- TaskCard LOC: 1,217 → 250 (-79%)
- HierarchicalTaskRow LOC: 1,023 → 150 (-85%)
- Full bulk operations across all views

---

### TASK-160: Codebase Health Auditor Skill (🔄 IN PROGRESS)
**Priority**: P2-MEDIUM
**Started**: January 9, 2026

Unified skill merging Legacy Tech Remover + Comprehensive Auditor with dead code detection.

**Problem**: Multiple fragmented skills for code cleanup:
- 🧹 Legacy Tech Remover - only detects legacy patterns
- 📊 Comprehensive Auditor - only 3/12 dimensions implemented
- Missing: unused file/export detection, Vue-specific analysis

**Solution**: Single unified skill with:
- Knip integration (unused files/exports)
- depcheck integration (unused npm packages)
- TypeScript strict checking
- Vue-specific dead code detection
- Risk-based categorization (SAFE/CAUTION/RISKY)
- Safe auto-removal with git rollback

**Progress**:
- [ ] Create skill directory structure
- [ ] Write SKILL.md documentation
- [ ] Create package.json with dependencies
- [ ] Implement orchestrator.ts entry point
- [ ] Implement knip-detector.ts
- [ ] Implement depcheck-detector.ts
- [ ] Implement typescript-detector.ts
- [ ] Implement vue-detector.ts
- [ ] Implement risk-scorer.ts
- [ ] Implement reporters (JSON, Markdown)
- [ ] Register skill in skills.json

**Plan**: [.claude/plans/lexical-beaming-reddy.md](../../.claude/plans/lexical-beaming-reddy.md)

---

### ~~TASK-147~~: Guest Mode Fully Ephemeral (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026

Made guest mode (unauthenticated users) fully ephemeral - fresh empty app on every page refresh.

**Changes**:
- [x] Created `src/utils/guestModeStorage.ts` - utility to clear guest localStorage keys
- [x] Modified `src/composables/app/useAppInitialization.ts` - clear guest data on startup
- [x] Modified `src/stores/tasks/taskPersistence.ts` - skip Supabase fetch for guests
- [x] Modified `src/stores/canvas.ts` - skip Supabase fetch for guests
- [x] Modified `src/stores/projects.ts` - skip Supabase fetch for guests

**Behavior**:
- Guests see empty app on load (0 tasks, 0 groups, 0 projects)
- Data created during session exists only in memory
- Page refresh clears all data (fresh start)
- Allows people to test the app without leftover data

---

### ~~TASK-146~~: Container Consolidation (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**PR**: #33

Reduced CSS container class redundancy (~25%) through shared utilities and BEM renaming.

**Changes**:
- [x] Added `.scroll-container` utility (flexbox scroll pattern for nested layouts)
- [x] Added `.content-section` utility (bordered content sections)
- [x] Removed unnecessary `.canvas-container-wrapper` nesting in CanvasView.vue
- [x] Migrated 4 files to use `.scroll-container` (BoardView, CalendarView, BaseModal, UnifiedInboxPanel)
- [x] Renamed duplicate `.task-content` classes using BEM (--calendar, --inbox, --canvas-inbox, --calendar-inbox)
- [x] Renamed duplicate `.header-content` classes using BEM (--modal, --swimlane, --performance, --quicksort, --welcome)

**Files Modified**:
- `src/assets/styles.css` - Added utility classes
- `src/views/CanvasView.vue` - Simplified container nesting
- `src/views/BoardView.vue` - Added scroll-container class
- `src/views/CalendarView.vue` - Added scroll-container class
- `src/components/base/BaseModal.vue` - Added scroll-container + BEM rename
- `src/components/inbox/UnifiedInboxPanel.vue` - Added scroll-container + BEM rename
- `src/components/calendar/CalendarDayView.vue` - BEM rename
- `src/components/inbox/CalendarInboxPanel.vue` - BEM rename
- `src/components/canvas/InboxPanel.vue` - BEM rename
- `src/components/kanban/KanbanSwimlane.vue` - BEM rename
- `src/components/ui/WelcomeModal.vue` - BEM rename
- `src/views/PerformanceView.vue` - BEM rename
- `src/views/QuickSortView.vue` - BEM rename

---

### ~~TASK-099~~: Auth Store & Database Integration (✅ DONE)
- [x] Integration with Supabase.
- [x] Refactor `useAuthStore.ts` and `useDatabase.ts`.
- [x] Migrated from PouchDB/CouchDB to Supabase.

### TASK-017: KDE Plasma Widget (Plasmoid) (READY)
**Priority**: P3-LOW
- Create a KDE Plasma 6 taskbar widget.

### ~~TASK-039~~: Duplicate Systems Consolidation (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
- [x] Consolidate `ConflictResolver` and `conflict-resolution` service.
- [x] Create unified `integrity.ts` for hashing and checksums.
- [x] Refactor `useBackupSystem` and `ForensicLogger` to use `integrity.ts`.
- [x] Fixed all broken imports and MIME type errors following file deletions.

### TASK-041: Implement Custom Recurrence Patterns (📋 PLANNED)
**Priority**: P2-MEDIUM
- Define custom recurrence syntax and parsing logic.

### ~~TASK-046~~: Establish Canvas Performance Baselines (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

### TASK-095: TypeScript & Lint Cleanup (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
- [x] Detected and removed 7 dead files related to legacy PouchDB/Offline system.
- [x] Refactored `offlineQueue` types to `src/types/offline.ts`.
- [x] Reduced TypeScript errors from 71 to 14.

### BUG-144: Canvas Content Disappeared (🚨 CRITICAL)
**Priority**: P0-CRITICAL
**Problem**: All task content disappeared from the canvas after recent refactoring.
**Observations**:
- Tasks exist in DOM but at far-off coordinates.
- `canvasStore.nodes` is empty despite tasks being rendered.
- `GroupNodeSimple.vue` (the `sectionNode`) is missing `<slot />`, breaking Vue Flow parent-child rendering.
- `useCanvasSync.ts` may be incorrectly assigning `parentNode` without valid parent rendering.
**Action Plan**:
- [ ] Add `<slot />` to `GroupNodeSimple.vue`.
- [ ] Debug and fix coordinate calculation in `useCanvasSync.ts`.
- [ ] Reconcile `canvasStore.nodes` with `CanvasView.vue` node state.
- [ ] Verify fix and restore visual appearance.

### TASK-142: Zero Error Baseline Achievement
**Priority**: P1-HIGH
**Goal**: Resolve the remaining 14 TypeScript errors to reach 0 errors.
- [/] Fix `TiptapEditor.vue` missing `TaskItem` import.
- [/] Fix `TaskNode.vue` `useVueFlow` type mismatch.
- [/] Fix `CanvasGroup.vue` unsafe property access.
- [/] Fix `auth.ts` `onAuthStateChange` callback typing.
- [/] Remove unused and broken `MarkdownExportService.ts`.
- [/] Fix `markdown.ts` null safety in table conversion.
- [x] Run `vue-tsc` to confirm 0 errors.

### BUG-144: Canvas Content Disappeared (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Resolution**: Added missing `<slot />` to `GroupNodeSimple.vue` enabling Vue Flow to render nested specific nodes.

### TASK-145: CanvasView Decomposition (🚀 NEXT)
**Priority**: P2-MEDIUM
**Goal**: Reduce `CanvasView.vue` size (3400+ lines) by extracting UI components.
- [ ] Extract `CanvasControls` (Zoom/Pan UI)
- [ ] Extract `CanvasToolbar` (Primary Actions)
- [ ] Extract `CanvasMiniMap` usage (if complex)
- [ ] Refactor `useCanvasDragDrop` geometry logic to `utils/canvasGeometry.ts`

### ~~TASK-144~~: System Consolidation Audit (✅ DONE)
**Priority**: P2-MEDIUM
**Plan**: [plans/system-consolidation-audit.md](../plans/system-consolidation-audit.md)
**Goal**: Eliminate duplicate, redundant, and competing systems. One lean system for every aspect.
**Result**: Successfully consolidated to single sources of truth:
- [x] Phase 1: Context Menu Cleanup - Deleted `useContextMenuEvents.ts` and `useContextMenuPositioning.ts`
- [x] Phase 2: Utility Extraction - Created `geometry.ts` for containment detection
- [x] Phase 3: Duration Centralization - Created `durationCategories.ts`, updated 8 files
- [x] Phase 4: Naming Clarity - Renamed `useTaskSmartGroups` → `usePowerKeywords`, `useCanvasSmartGroups` → `useCanvasOverdueCollector`
- [x] Phase 5: Performance Deprecation - Added deprecation to `usePerformanceMonitor.ts`
- [x] Phase 6: Sanitization Cleanup - Deleted `inputSanitizer.ts` (12KB)
- [x] Phase 7: Documentation - Created `docs/architecture/system-guide.md`

### TASK-138: Refactor CanvasView Phase 2 (Store & UI)
**Priority**: P2-MEDIUM
**Goal**: Clean up the store layer and begin UI decomposition.
- [x] Delete dead code: `src/stores/taskCanvas.ts`.
- [x] Clean up `src/stores/canvas.ts` (remove stubs, consolidate).
- [ ] Extract UI components: `CanvasToolbar.vue`, `CanvasControls.vue`.
- [ ] Move any remaining valid logic from `taskCanvas.ts` to `canvas.ts` before deletion.

### TASK-137: Refactor CanvasView.vue Phase 1 (✅ DONE)
**Priority**: P1-HIGH
**Goal**: Reduce technical debt in the massive `CanvasView.vue` file by strictly extracting logic into composables without touching the critical Vue Flow template structure.
- [x] Extract filtering logic to `useCanvasFiltering.ts`.
- [x] Fix initialization order of `isInteracting`.
- [x] Extract event handlers to `useCanvasInteractionHandlers.ts`.
- [x] Verify no regressions in drag/drop or sync.

### ~~TASK-141~~: Canvas Group System Refactor (✅ DONE)
**Priority**: P0-CRITICAL
**Plan**: [plans/canvas-group-system-refactor.md](../plans/canvas-group-system-refactor.md)
**Goal**: Complete rewrite of canvas group system to fix all parent-child relationship bugs by embracing Vue Flow's native `parentNode` system.
**Problems Addressed**:
- Groups don't recognize each other (parent-child detection fails)
- Nested groups don't always move with parent group
- Z-depth issues (groups hidden under others)
- Containment detection failures
- Resize causes children to move incorrectly
**Phases**:
- [x] Phase 0: Consolidation (verified canvasPositionLock.ts deleted, NodeUpdateBatcher bypass removed)
- [x] Phase 1: Foundation - Created `useCanvasParentChild.ts` with:
  - Containment detection (smallest-container-wins algorithm)
  - Z-index calculation based on nesting depth
  - Circular reference prevention
  - Coordinate conversion (absolute ↔ relative)
  - Parent assignment utilities
- [x] Phase 2: Complete rewrite of `useCanvasDragDrop.ts` to use `useCanvasParentChild`
- [x] Phase 3: Verified `useCanvasResize.ts` uses PositionManager properly
- [x] Phase 4: Data migration (implicit in sync logic)
- [x] Phase 5: Manual testing & validation (See walkthrough.md)
**Progress**: Refactoring complete and verified via manual testing. logic centralized in useCanvasParentChild.ts.

### TASK-149: Canvas Group Stability Fixes (🔄 IN PROGRESS)
**Priority**: P0-CRITICAL
**Created**: January 9, 2026
**Related**: TASK-141 (Canvas Group System Refactor)

**Problems Addressed**:
1. **Position jump during resize** - Groups jump when resizing other groups (race condition)
2. **Zombie groups** - Deleted groups reappear after sync
3. **10px tolerance snapping** - Micro-jumps from position preservation logic
4. **Inconsistent containment** - Different algorithms in drag vs sync
5. **Permissive parent assignment** - 5% size difference too loose
6. **Z-index by area not depth** - Same-size siblings have same z-index

**Fixes Planned**:
- [ ] Fix 4: Set settling flag BEFORE async store updates in resize
- [ ] Fix 5: Remove 10px tolerance snapping in useCanvasSync.ts
- [ ] Fix 8: Strengthen recentlyDeletedGroups zombie prevention
- [ ] Fix 1: Atomic batch position updates in resize handler
- [ ] Fix 3: Standardize containment to 75% threshold everywhere
- [ ] Fix 6: Increase parent assignment ratio from 1.05x to 1.5x
- [ ] Fix 2: Add toRelativePosition helper to canvasGraph.ts
- [ ] Fix 7: Z-index based on nesting depth, not area

---

### ~~BUG-060~~: Auth Watcher Didn't Clear Deleted Groups (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Related**: TASK-150 (localStorage Fallback Fix)

**Problem**: Deleted canvas groups reappeared after page refresh. The auth watcher in `canvas.ts` only set groups if Supabase returned groups, but didn't clear localStorage-loaded groups if Supabase returned empty (all deleted).

**Root Cause**:
```typescript
// BEFORE (line 638) - Only set if groups exist
if (loadedGroups.length > 0) {
  _rawGroups.value = loadedGroups
}
// BUG: If Supabase returns empty, localStorage groups persisted!
```

**Fix Applied**:
```typescript
// AFTER - ALWAYS set from Supabase, even if empty
_rawGroups.value = loadedGroups // Respects deletions
```

**File Modified**: `src/stores/canvas.ts:636-648`

---

### ~~BUG-061~~: OverdueCollector Auto-Creating Deleted Groups (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Related**: BUG-060

**Problem**: Even after fixing BUG-060, deleted canvas groups (Friday, Saturday) kept reappearing after page refresh because the `ensureActionGroups()` function in `useCanvasOverdueCollector.ts` auto-created them on every app startup.

**Root Cause**: The `ensureActionGroups()` function checked if Friday/Saturday groups existed and created them if not. When groups were deleted from Supabase, they no longer existed, so the function recreated them.

**Fix Applied**: Disabled auto-creation in `ensureActionGroups()` - users should manually create groups via canvas context menu.

**File Modified**: `src/composables/canvas/useCanvasOverdueCollector.ts:187-242`

---

## Code Review Findings (January 9, 2026)

> Comprehensive multi-agent code review identified 7 new issues. Related todo files in `todos/019-025-*.md`.

### ~~TASK-158~~: Fix Zombie Group Race Condition (✅ DONE)
**Priority**: P1-CRITICAL
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/019-pending-p1-zombie-group-race-condition.md`

**Problem**: The `recentlyDeletedGroups` Set with 10-second timeout creates a dangerous race condition. If Supabase delete takes longer than 10 seconds (network issues), the timeout clears protection and sync could recreate deleted groups.

**Solution Applied**:
- [x] Created `src/utils/deletedGroupsTracker.ts` - localStorage-backed tracker with 60s TTL fallback
- [x] Updated `useCanvasActions.ts` - Uses `markGroupDeleted()` before delete, `confirmGroupDeleted()` after Supabase success
- [x] Updated `useCanvasSync.ts` - Checks both in-memory Set AND persistent localStorage tracker
- [x] Deleted groups now persist across page refresh until confirmed deleted

---

### ~~TASK-159~~: Add user_id Filter to Delete Operations (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/020-pending-p1-missing-user-id-delete-filter.md`

**Problem**: While `deleteGroup()` correctly implements user_id filter, 9 other delete operations rely solely on RLS without explicit user_id filtering - violating defense-in-depth.

**Solution Applied**:
- [x] Added `.eq('user_id', userId)` to all 9 delete/restore operations
- [x] Added row count verification to detect silent RLS blocks
- [x] Operations now throw errors if no rows affected
- [x] Also fixed `bulkDeleteTasks` to include `deleted_at` timestamp (missing before)

**Operations Updated**:
- `deleteProject`, `restoreProject`, `permanentlyDeleteProject`
- `deleteTask`, `restoreTask`, `permanentlyDeleteTask`, `bulkDeleteTasks`
- `deleteNotification`, `deleteTimerSession`

---

### ~~TASK-160~~: Fix Unbounded Map Memory Leak (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/021-complete-p2-unbounded-map-memory-leak.md`

**Problem**: `sectionPositionTracker` Map in CanvasView.vue never clears entries when sections are deleted, causing memory growth.

**Location**: `src/views/CanvasView.vue` (line 1766)

**Solution**: Added cleanup logic that removes stale entries when sections are deleted. The watcher now tracks current section IDs and removes any Map entries for sections that no longer exist.

---

### ~~TASK-161~~: Fix Sync Watcher Blocking Main Thread (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/022-complete-p2-sync-watcher-blocks-main-thread.md`

**Problem**: Watcher uses `flush: 'sync'` with expensive string operations, blocking main thread and causing jank with 50+ sections.

**Location**: `src/views/CanvasView.vue` (lines 1768-1802)

**Solution**: Changed `flush: 'sync'` to `flush: 'post'` to defer watcher execution until after Vue finishes DOM updates. This prevents the watcher from blocking the main thread during rapid position changes.

---

### TASK-162: Extract Magic Number Constants (📋 PLANNED)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Todo File**: `todos/023-pending-p2-magic-number-constants.md`

**Problem**: Timeout values (500ms, 1000ms, 10000ms) and dimensions (220, 100, 300, 200) scattered across 8+ files with no single source of truth.

**Proposed Fix**: Create `src/constants/canvas.ts` with `CANVAS_TIMING` and `TASK_DIMENSIONS` constants.

---

### TASK-163: DRY Day-of-Week Logic (📋 PLANNED)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Todo File**: `todos/024-pending-p2-day-of-week-logic-duplication.md`

**Problem**: 50+ lines of identical day-of-week processing logic duplicated in `getSectionProperties()` and `applySectionPropertiesToTask()`.

**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (lines 186-203, 309-336)

**Proposed Fix**: Extract to `calculateDayOfWeekDate()` helper function.

---

### TASK-164: Create Agent API Layer (📋 PLANNED)
**Priority**: P3-LOW
**Created**: January 9, 2026
**Todo File**: `todos/025-pending-p3-agent-native-api-layer.md`

**Problem**: No formal agent/tool API layer exists. Zoom controls require Vue context and aren't agent-accessible.

**Proposed Fix**: Create `src/api/agentApi.ts` exposing store actions via `window.__pomoflowAgent`.

---

### BUG-151: Tasks Render Empty on First Refresh (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Fixed**: January 9, 2026

**Problem**: Task nodes rendered as empty shells (no title, description, metadata) on the first page refresh, but appeared correctly after a second refresh.

**Root Cause**: In `TaskNode.vue`, the viewport zoom was copied once during setup instead of being tracked reactively:
```typescript
// BUG: One-time copy, not reactive
viewport.value = vf.viewport.value
```
When Vue Flow initialized with `zoom: 0` (before the canvas was ready), `isLOD3` became `true` (since `0 < 0.2`), hiding all content. Since the viewport wasn't tracked reactively, it never updated.

**Fix Applied**:
- Store Vue Flow context reference for reactive access
- Access `viewport.value.zoom` through computed with guards
- Default to `zoom: 1` if value is 0, undefined, or invalid

**File Changed**: `src/components/canvas/TaskNode.vue` (lines 161-180)

---

### BUG-152: Group Task Count Requires Refresh After Drop (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Fixed**: January 9, 2026

**Problem**: When tasks were dropped into a group, the task count badge didn't update until a page refresh. Tasks also couldn't be moved immediately after being dropped.

**Root Causes**:
1. `updateSectionTaskCounts` used `filteredTasks.value` which hadn't updated yet (async timing)
2. Multi-drag path had early return that skipped `updateSectionTaskCounts` entirely
3. No `nextTick` to wait for Vue reactivity to propagate store updates

**Fix Applied**:
- Made `updateSectionTaskCounts` async with `await nextTick()` before reading `filteredTasks`
- Added task count updates to multi-drag path (was missing)
- Await the async function at call sites

**File Changed**: `src/composables/canvas/useCanvasDragDrop.ts`

---

### ~~TASK-157~~: Consolidate Dual Backup Systems (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Two competing backup systems exist - `useBackupSystem.ts` and `usePersistentStorage.ts`. Both write backups independently, creating confusion about which is "correct" on restore.

**Files Modified**:
- `src/composables/usePersistentStorage.ts` - Added @deprecated notice

**Audit Findings**:
- [x] **Neither backup system is actively imported anywhere in the app**
- [x] Data persistence is handled directly by Pinia stores + Supabase
- [x] Backup composables exist for manual export/import, not auto-persistence
- [x] `useBackupSystem.ts` has been enhanced with golden backup, TTL, validation (TASK-153/156)
- [x] `usePersistentStorage.ts` is legacy code, never imported

**Decision**:
- **KEEP**: `useBackupSystem.ts` - Enhanced with BUG-059, TASK-153, TASK-156 improvements
- **DEPRECATED**: `usePersistentStorage.ts` - Marked with @deprecated JSDoc notice
- **Architecture**: Supabase is the source of truth for authenticated users; localStorage is cache only

**Backup Architecture Summary**:
```
Authenticated Users:
  Source of Truth: Supabase (tasks, projects, groups, user_settings)
  localStorage: Cache only, cleared on logout
  Golden Backup: Emergency restore with deleted-item filtering

Guest Mode:
  Source of Truth: None (ephemeral)
  localStorage: Cleared on page refresh (GUEST_EPHEMERAL_KEYS)
```

---

### ~~TASK-156~~: Add TTL to Backup History (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: `pomo-flow-backup-history` in `useBackupSystem.ts` persists old backups indefinitely with no expiration. Could consume significant localStorage space and restore stale data.

**Files Modified**:
- `src/composables/useBackupSystem.ts` - Added TTL constants and pruning logic

**Fix Applied**:
- [x] Add timestamp validation on backup load - `loadHistory()` checks backup age
- [x] Implement 30-day TTL for backup history - `BACKUP_HISTORY_TTL_MS` constant
- [x] Add schema version to backup format - `BACKUP_SCHEMA_VERSION = '3.1.0'`
- [x] Prune backups older than TTL on app startup - `loadHistory()` filters and saves

**New Constants**:
- `BACKUP_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000` (30 days)
- `BACKUP_SCHEMA_VERSION = '3.1.0'`

---

### ~~TASK-155~~: Defer Viewport Load Until Auth Ready (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: `canvas-viewport` is loaded synchronously in `canvas.ts:39` BEFORE Supabase/auth is ready. This can cause viewport to show stale position before Supabase data overwrites it.

**Files Modified**:
- `src/stores/canvas.ts` - Changed viewport initialization and loadSavedViewport

**Fix Applied**:
- [x] Initialize viewport with defaults (not localStorage) - `getDefaultViewport()`
- [x] Use Supabase user_settings as primary viewport source - `loadSavedViewport()` checks Supabase first
- [x] Fall back to localStorage only if Supabase returns null
- [x] Add viewport to GUEST_EPHEMERAL_KEYS cleanup - ALREADY EXISTS at line 12

**Changes**:
- `getSavedViewport()` → `getDefaultViewport()` (no longer reads localStorage synchronously)
- `loadSavedViewport()` now checks Supabase `fetchUserSettings().canvas_viewport` first

---

### ~~TASK-154~~: Add TTL to Offline Queue (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: `pomoflow-offline-queue` in `offlineQueue.ts` has no TTL. Failed operations retry indefinitely. Old operations from days ago could replay on reconnect.

**Files Modified**:
- `src/utils/offlineQueue.ts` - Added TTL constants and validation logic

**Fix Applied**:
- [x] Uses existing `timestamp` field as createdAt (already present in interface)
- [x] Add 24-hour TTL validation on queue load - `QUEUE_OPERATION_TTL_MS` constant
- [x] Discard operations older than TTL - `loadPersistedQueue()` filters stale ops
- [x] Add max retry count (10) before discarding - `QUEUE_MAX_RETRIES` constant
- [ ] Validate target entity still exists before replaying - DEFERRED (requires async Supabase calls)

**New Constants**:
- `QUEUE_OPERATION_TTL_MS = 24 * 60 * 60 * 1000` (24 hours)
- `QUEUE_MAX_RETRIES = 10`

---

### ~~TASK-153~~: Validate Golden Backup Before Restore (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: `pomo-flow-golden-backup` in `useBackupSystem.ts` NEVER expires. It can contain tasks/groups deleted weeks ago. Restoring it resurrects deleted data.

**Files Modified**:
- `src/composables/useBackupSystem.ts` - Added validation and filtering functions
- `src/composables/useSupabaseDatabaseV2.ts` - Added fetchDeletedTaskIds/ProjectIds/GroupIds

**Fix Applied**:
- [x] Add timestamp validation before restore (warn if >7 days old) - `GOLDEN_BACKUP_MAX_AGE_MS` constant
- [x] Cross-reference golden backup items with current Supabase data - `validateGoldenBackup()`
- [x] Filter out items that exist in Supabase with `is_deleted: true` - `filterGoldenBackupData()`
- [x] Show user what will be restored before proceeding - validation preview with counts
- [x] `restoreFromGoldenBackup()` now filters deleted items automatically

**New Functions**:
- `validateGoldenBackup()` - Returns age warning + preview of what will be restored
- `filterGoldenBackupData()` - Removes items deleted in Supabase before restore
- `fetchDeletedTaskIds/ProjectIds/GroupIds()` - Fetch deleted item IDs from Supabase

---

### ~~TASK-152~~: Update Supabase Debugger Skill (✅ DONE)
**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Supabase debugger skill lacked localStorage fallback debugging workflow.

**Fix Applied**:
- [x] Added Workflow 8: localStorage Fallback Audit to skill
- [x] Documented all 42 localStorage keys in Pomo-Flow
- [x] Added danger pattern examples and prevention patterns
- [x] Created SOP at `docs/sops/SOP-localStorage-fallback-fixes.md`

---

### ~~TASK-151~~: Resolve PGRST204 Error & Component Cache (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Group deletion failed with PGRST204 because code attempted to update non-existent 'deleted_at' column. Browser caching prevented previous fixes from taking effect.

**Fix Applied**:
- [x] Created useSupabaseDatabaseV2.ts to force cache busting
- [x] Removed deleted_at reference in deleteGroup and bulkDeleteTasks
- [x] Updated all imports to use V2 composable

### ~~TASK-150~~: Group Deletion Not Persisting on Refresh (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Deleted groups reappeared after page refresh. Root cause: When authenticated user deletes groups, `fetchGroups()` correctly returns empty (filtered by `is_deleted: false`), but `loadFromDatabase()` fell back to localStorage which had stale/deleted groups.

**Fix Applied**:
- [x] Removed localStorage fallback for authenticated users in `canvas.ts`
- [x] Supabase is now single source of truth - empty means empty, no resurrection from localStorage
- [x] Note: `groups` table doesn't have `deleted_at` column (unlike tasks/projects) - schema intentional difference

### ~~TASK-142~~: Canvas Position System Refactor (✅ DONE)
**Priority**: P1-HIGH
**Created**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: Positions reset on page refresh. Root cause: Canvas store loaded groups from localStorage (Guest Mode) before auth was ready, so Supabase data was never used.

**Root Cause Identified**:
1. Canvas store auto-initializes before auth store is ready
2. `authStore.isAuthenticated` returns `false` at init time
3. Groups load from localStorage instead of Supabase
4. Group position changes saved to Supabase are lost on refresh

**Fix Applied**:
- [x] Added auth state watcher in `canvas.ts` - reloads groups from Supabase when auth becomes ready
- [x] Added position integrity validation on load (both tasks and groups)
- [x] Added page refresh persistence tests (`tests/canvas-position-persistence.spec.ts`)
- [x] Added regression guard in `CLAUDE.md` documenting architecture rules

**Safeguards Added**:
1. **Automated Tests**: `npm run test -- --grep "Position Persistence"` (4 tests)
2. **Integrity Validation**: Console errors if positions have invalid values
3. **CLAUDE.md Documentation**: Architecture rules to prevent future regressions

### TASK-065: GitHub Release (📋 TODO)
**Priority**: P3-LOW
- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop & Mobile (📋 PLANNED)
**Priority**: P3-LOW
**Status**: Desktop basic functionality WORKING on Tuxedo OS

**Desktop (Working)**:
- [x] Basic Tauri v2 app runs on Linux (Tuxedo OS)
- [ ] System Tray (icon + menu)
- [ ] KDE Taskbar Progress (D-Bus)
- [ ] Fokus-style Break Splash Screen

**Mobile (Future - Tauri v2 supports Android/iOS)**:
- [ ] Android build configuration
- [ ] Foreground service for timer (prevents kill)
- [ ] Native notifications
- [ ] Home screen widget (optional)
- [ ] APK distribution (sideload or Play Store $25)

**Note**: PWA provides mobile access now (ROAD-004). Tauri Mobile adds native features like reliable background timer and widgets.

### ~~TASK-095~~: Complete TypeScript & Lint Cleaning (✅ DONE)
- [x] Address remaining TS/Lint errors system-wide (Zero errors baseline achieved).
- [x] Fix `ConflictResolutionDialog` and `SyncHealthDashboard` type mismatches.
- [x] Standardize auth store getters and component access.
- [x] Align Canvas store actions and exports.

### ~~TASK-100~~: Implement Overdue Smart Group in Canvas (✅ DONE)
- Create "Overdue" smart group logic.
- Implement auto-collection of overdue non-recurring tasks.

### TASK-096: System Refactor Analysis (📋 TODO)
**Priority**: P1-HIGH
- Analyze codebase for refactoring opportunities.

### ~~TASK-101~~: Store Safety Pattern (`_raw*` prefix) (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [TASKS-raw-safety-pattern.md](./sop/active/TASKS-raw-safety-pattern.md)

Implemented architectural safety pattern across all Pinia stores to prevent accidental display of soft-deleted or hidden items in UI components.

**Changes**:
- [x] `tasks.ts`: Renamed `tasks` → `_rawTasks`, created `filteredTasks` computed
- [x] `notifications.ts`: Renamed to `_rawNotifications`, created filtered `notifications`
- [x] `canvas.ts`: Renamed `groups` → `_rawGroups`, created `visibleGroups` (filters `isVisible !== false`)
- [x] `projects.ts`: Renamed to `_rawProjects`, created computed `projects` (future-proofed)
- [x] Deleted 6 dead code files (legacy sync/migration code)
- [x] All mutations updated to use `_rawX.value`
- [x] Build verified passing

**Stores analyzed but not needing pattern**:
- `taskCanvas.ts` - utility store, no soft-delete
- `quickSort.ts` - historical session data
- `timer.ts` - timer session history

### ~~TASK-102~~: Fix Shift+Drag Selection (✅ DONE)
- Fixed "stuck" rubber-band selection.
- Fixed selection inside groups (absolute positioning).
- Moved selection box outside VueFlow for visual stability.

### ~~TASK-103~~: Debug Sync Error (Auth Guard) (✅ DONE)
- Fixed "User not authenticated" sync errors in Guest Mode.
- Implemented Auth Guards in `projects`, `tasks`, and `canvas` stores.

### ~~TASK-106~~: Brain Dump RTL Support (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 6, 2026
- [x] Implement correct RTL and Hebrew/English mix support for Brain Dump section in canvas inbox.
- [x] Automatic text direction detection in `useBrainDump.ts`.
- [x] Bidirectional rendering support in Inbox components.

### TASK-110: New Branding: "Cyber Tomato" (📋 PLANNED)
**Priority**: P2-MEDIUM
- Design and implement new clean, minimal, cyberpunky "Cyber Tomato" icon set.
- Includes: Main logo, Tauri app icon, and favicon.

### ~~TASK-111~~: Landing Page for Early Access (✅ DONE)
**Priority**: P1-HIGH
**Plan**: [plans/pomo-flow-landing-page.md](../plans/pomo-flow-landing-page.md)
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Live URL**: https://endlessblink.github.io/pomo-flow-landing/
- [x] Create landing page hosted on GitHub Pages (free)
- [x] Showcase features: Board, Calendar, Canvas views, Pomodoro timer
- [x] Email signup for early access waitlist (Formspree integration - needs form ID)
- [x] Explain open-core business model:
  - Free (Self-Host): Deploy your own Supabase instance
  - Cloud ($7/mo): Our hosted Supabase + backups + support
  - Pro ($14/mo): AI features + gamification

### TASK-108: Tauri/Web Design Parity (📋 PLANNED)
**Priority**: P1-HIGH
- Ensure the Tauri app design mimics 1-to-1 the web app design.

### TASK-165: AI Text Generation in Markdown Editor (📋 PLANNED)
**Priority**: P2-MEDIUM
**Related**: ROAD-011 (AI Assistant)

Add AI-powered text generation to the Tiptap markdown editor. Custom implementation (not using Tiptap Cloud Pro).

**Proposed Features**:
- Custom Tiptap extension that calls Claude/OpenAI API
- Commands: "Complete", "Rewrite", "Summarize", "Expand", "Fix grammar"
- Stream responses directly into the editor
- Keyboard shortcut (Ctrl+Space or similar) to trigger AI menu

### TASK-166: Bi-directional Day Group Date Picker (📋 PLANNED)
**Priority**: P2-MEDIUM
**Related**: TASK-130 (Day Groups)

Add option to change the date of a smart group directly, which will update the day name accordingly (bi-directional binding).

**Requirements**:
- Clickable date suffix in Day Groups
- Date picker popup
- When date changes:
    - If new date is "today", rename group to "Today" or Day Name?
    - If new date matches a day name, rename group to that day (e.g., "Monday")
    - If date is next week, rename to "Next Monday"
- Update invalidation logic to handle manual overrides

**Proposed Implementation**:
- `GroupNodeSimple.vue`: Add date picker trigger
- `useGroupSettings.ts`: updateGroupDate() action

### TASK-167: Day Group Date Formatting & Verification (🔄 IN PROGRESS)
**Priority**: P1-HIGH
**Related**: TASK-130
**Started**: January 9, 2026

**Requirement**: Day Groups must show date in "Day / D.M.YY" format (e.g. "Monday / 12.1.26").
**Status**:
- [x] Update `GroupNodeSimple.vue` formatting
- [x] Debug Playwright test (Verified passing with robust selectors)

**Implementation Approach**:
- Create `/src/extensions/TiptapAI.ts` custom extension
- Add AI toolbar button with dropdown menu
- Use existing API key configuration (from settings)
- Stream tokens into editor at cursor position

**Dependencies**:
- Tiptap editor implementation (DONE - BUG-010)
- API key configuration in settings
- Rate limiting / usage tracking



### ~~TASK-109~~: Premium "Obsidian-Like" Markdown Editor (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026

Implemented a professional, seamless Live Preview (WYSIWYG) experience using the **Milkdown** editor core, delivering an Obsidian-like behavior for task descriptions.

**Features**:
- [x] **Live Preview (WYSIWYG)**: Content renders instantly as you type (headings, bold, lists), eliminating the need for a separate "Preview" tab for basic editing.
- [x] **Milkdown Core**: Sophisticated ProseMirror-based engine for high-performance editing and reliable GFM support.
- [x] **Stable Architecture**: Implemented a parent-child structure (`MarkdownEditor` shell + `MilkdownEditorSurface`) to ensure reliable context injection and application stability.
- [x] **Interactive Checkboxes**: Users can toggle task list checkboxes directly within the live editor surface.
- [x] **Full RTL & Mixed Content**: Deep integration with our Hebrew alignment logic, ensuring perfectly aligned right-to-left text flow with automatic detection.
- [x] **Premium UI**: Custom-styled glassmorphism surface with a floating toolbar (Bold, Italic, Lists, Links, Undo/Redo).

**Critical Bug Fixes (January 6, 2026)**:
- [x] Fixed `MilkdownError: Context "editorView" not found` on Enter key press
- [x] Removed incorrect `.create()` call from useEditor chain (Milkdown Vue handles creation internally)
- [x] Added `rows` prop to MarkdownEditor to prevent Vue attribute fallthrough to MilkdownProvider
- [x] Updated TaskEditModal keyboard handler to recognize ProseMirror contenteditable elements
- [x] Enter key now creates newlines in editor, Ctrl/Cmd+Enter saves the task

### ~~TASK-104~~: Fix Critical Notification Store Crash (✅ DONE)
- Fixed `ReferenceError: scheduledNotifications is not defined` in `notifications.ts`.

### ~~TASK-105~~: Supabase Migration & Sync Loop Fixes (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 6, 2026
**SOP**: [SYNC-supabase-circular-loop-fix.md](./sop/active/SYNC-supabase-circular-loop-fix.md)

Fixed critical bugs after Supabase migration causing app not to load and ghost projects.

**Root Causes Fixed**:
- [x] Supabase 400 errors from invalid UUID values (string 'undefined' sent to DB)
- [x] Circular sync loop: Realtime → store update → watcher → auto-save → realtime
- [x] Corrupted projects from `updateProjectFromSync` spreading incomplete data
- [x] Ghost/empty projects appearing in sidebar

**Changes**:
- [x] `supabaseMappers.ts`: Added UUID validation & sanitization helpers
- [x] `supabaseMappers.ts`: Sanitize `parent_id`, `project_id`, `parent_task_id` fields
- [x] `projects.ts`: Added `syncUpdateInProgress` flag to break circular loop
- [x] `projects.ts`: `updateProjectFromSync` now validates incoming data
- [x] `projects.ts`: `projects` computed filters out corrupted entries
- [x] `projects.ts`: Added `cleanupCorruptedProjects()` utility
- [x] `supabaseMigrationCleanup.ts`: Added `clearAllLocalData()` helper
- [x] Deleted 18+ legacy PouchDB/CouchDB files (~10,000 lines removed)
- [x] Build verified passing

### ~~BUG-009~~: Milkdown Editor Security & Stability Fixes (✅ DONE)
**Priority**: P0-CRITICAL (Security) / P1-HIGH (Stability)
**Completed**: January 7, 2026

Comprehensive security and stability fixes for the Milkdown markdown editor following TASK-109 implementation.

**Security Fixes**:
- [x] **CRITICAL**: Removed hardcoded CouchDB credentials from `database.ts` (admin/pomoflow-2024)
- [x] Added URL sanitization to markdown link renderer - blocks `javascript:`, `vbscript:`, `data:` protocols
- [x] Implemented protocol allowlist (http, https, mailto only)

**Stability Fixes (Vue Proxy + Private Fields)**:
- [x] Added `toRaw()` wrapper pattern to prevent "Cannot read private member" TypeError
- [x] Created `safeEditorAction()` function that unwraps Vue proxy before accessing Milkdown Editor
- [x] Added `isUnmounting` ref guard to prevent operations on destroyed editor instances
- [x] Added `view.isDestroyed` check before ProseMirror view operations

**TaskList Toolbar Button Fix**:
- [x] Fixed TaskList toolbar to create proper checkboxes instead of raw `[ ]` text
- [x] Uses `wrapInBulletListCommand` + `setNodeMarkup` with `checked: false` attribute
- [x] Checkboxes now render as `□` and toggle to `☑` on click
- [x] Compatible with `listItemBlockComponent` from `@milkdown/components`

**Race Condition Guards**:
- [x] Added `isSaving` ref to TaskEditModal to prevent double-save on rapid Ctrl+S
- [x] Guard in `handleKeyDown` to skip keystrokes while save in progress
- [x] try/finally pattern ensures `isSaving` resets even on error

**Performance Improvements**:
- [x] Changed RTL detection from computed to debounced ref (300ms)
- [x] Prevents expensive regex execution on every keystroke

**Type Safety**:
- [x] Added `ToolbarCommand` union type for toolbar actions
- [x] Implemented exhaustive switch with `never` type for compile-time safety

**Test Suite**:
- [x] Created `tests/markdown-editor.spec.ts` with 6 Playwright scenarios
- [x] Tests: Basic editing, Bold toolbar, TaskList, Race conditions, Large content, Clean unmount
- [x] Console error monitoring for private field and TypeError detection

**Files Changed**:
- `src/config/database.ts` - Security: removed credentials
- `src/components/common/MilkdownEditorSurface.vue` - toRaw wrapper, guards
- `src/components/common/MarkdownEditor.vue` - Debounced RTL
- `src/components/tasks/TaskEditModal.vue` - Save race guard
- `src/utils/markdown.ts` - URL sanitization
- `tests/markdown-editor.spec.ts` - New test suite

### ~~BUG-010~~: Milkdown Auto-Conversion Issue → Tiptap Migration (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7-8, 2026

Milkdown's aggressive input rules continued to auto-convert `-` to bullet lists before users could complete `- [ ]` task list syntax. After multiple fix attempts (disabling individual inputRules imports), the issue persisted.

**Solution**: Migrated from Milkdown to Tiptap
- Tiptap offers `enableInputRules: false` - single option to disable all auto-conversion
- Better Vue 3 integration with official `@tiptap/vue-3`
- Smaller bundle size (~100KB reduction)
- Cleaner API for toolbar commands

**Changes**:
- [x] Created `TiptapEditor.vue` with `enableInputRules: false`
- [x] Updated `MarkdownEditor.vue` to use TiptapEditor instead of MilkdownEditorSurface
- [x] Full toolbar retained: Bold, Italic, Lists, Task Lists, Links, Undo/Redo
- [x] Build passes, bundle 100KB smaller

**Extended Toolbar Features (Jan 8)**:
- [x] Strikethrough formatting (~~text~~)
- [x] Underline formatting (<u>text</u>)
- [x] Highlight/Mark (==text== ↔ `<mark>`)
- [x] Placeholder text when editor is empty
- [x] Numbered lists (ordered lists)
- [x] Blockquotes
- [x] Code blocks
- [x] Horizontal rules (---)
- [x] Fixed task list checkbox rendering (data-type attributes for Tiptap compatibility)
- [x] Bidirectional markdown conversion for all new formats

**Advanced Features (Jan 8 - Extended)**:
- [x] H1, H2, H3 heading buttons
- [x] Text Align (left, center, right)
- [x] Text Color with 8-color palette picker
- [x] Tables with full manipulation (insert, add/delete rows/columns)
- [x] Toolbar with 22+ buttons organized in sections
- [x] Dropdown menus for color picker and table operations
- [x] Markdown table conversion (HTML ↔ markdown)

**Packages Added**:
- `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`
- `@tiptap/extension-task-item`, `@tiptap/extension-link`, `@tiptap/pm`
- `@tiptap/extension-placeholder`, `@tiptap/extension-highlight`, `@tiptap/extension-underline`
- `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`
- `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`

**Skill Updates**:
- [x] Created `tiptap-vue3` skill with working patterns
- [x] Deprecated `milkdown-vue3` skill (kept for historical reference)
- [x] Updated `skills.json` registry

**Files**:
- `src/components/common/TiptapEditor.vue` - New, extended with 22+ toolbar buttons, dropdown menus
- `src/components/common/MarkdownEditor.vue` - Updated
- `src/utils/markdown.ts` - Updated for Tiptap compatibility, table/highlight/heading conversion
- `.claude/skills/tiptap-vue3/SKILL.md` - New skill
- `.claude/skills/milkdown-vue3/SKILL.md` - Deprecated
- `.claude/config/skills.json` - Updated

**Note**: Milkdown packages remain in `package.json` but are unused. Can be removed in future cleanup.

---

### ~~BUG-001~~: Fix Shift+Drag Selection Inside Groups (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [CANVAS-shift-drag-selection-fix.md](./sop/active/CANVAS-shift-drag-selection-fix.md)

Fixed rubber-band (shift+drag) selection failing inside groups while working outside groups.

**Root Causes Fixed**:
- [x] CSS `:deep()` selector not working in unscoped style block (only works in scoped styles)
- [x] `useVueFlow()` returning stale viewport `{x:0, y:0, zoom:1}` in event handlers
- [x] Groups selected instead of tasks (selection logic didn't filter properly)
- [x] Ctrl+click not working for multi-selection on tasks
- [x] Click on empty space not clearing selection

**Changes**:
- [x] `CanvasView.vue`: Removed `:deep()` from unscoped CSS selector
- [x] `CanvasView.vue`: Added `handleCanvasContainerClick` for clearing selection
- [x] `useCanvasSelection.ts`: Added `getViewportFromDOM()` helper to read viewport from CSS transform
- [x] `useCanvasSelection.ts`: Added recursive `getAbsolutePosition()` for nested nodes
- [x] `useCanvasEvents.ts`: Added Ctrl/Meta+click support for group selection toggle
- [x] `TaskNode.vue`: Fixed Ctrl/Cmd/Shift+click for multi-select

**Key Learnings**:
- Vue Flow uses flat DOM structure - child nodes are NOT DOM children of parent nodes
- CSS `:deep()` only works in `<style scoped>`, not unscoped styles
- Read viewport from `.vue-flow__transformationpane` CSS transform for reliable values in event handlers

### ~~BUG-002~~: Fix Timer Session UUID & Auth Errors (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [SYNC-timer-uuid-validation.md](./sop/active/SYNC-timer-uuid-validation.md)

Fixed PostgreSQL UUID type error and "User not authenticated" errors when saving timer sessions.

**Root Causes Fixed**:
- [x] Timer session ID was Unix timestamp instead of UUID (legacy code used `Date.now().toString()`)
- [x] `saveActiveTimerSession()` and `deleteTimerSession()` used `getUserId()` which throws when not authenticated
- [x] Timer failed in local-only mode (not logged into Supabase)

**Changes**:
- [x] `timer.ts`: Changed session ID generation to `crypto.randomUUID()`
- [x] `timer.ts`: Added UUID validation safeguard in `saveTimerSessionWithLeadership()` before every save
- [x] `useSupabaseDatabase.ts`: Changed `saveActiveTimerSession` to use `getUserIdSafe()` and skip sync when not authenticated
- [x] `useSupabaseDatabase.ts`: Changed `deleteTimerSession` to use `getUserIdSafe()` and skip sync when not authenticated
- [x] `supabaseMappers.ts`: Added UUID validation to `toSupabaseTimerSession()` (triple-layer protection)

**Key Pattern - Three Layer UUID Protection**:
```typescript
// Layer 1: Creation - timer.ts startTimer()
id: crypto.randomUUID()

// Layer 2: Pre-save validation - timer.ts saveTimerSessionWithLeadership()
if (!uuidRegex.test(session.id)) session.id = crypto.randomUUID()

// Layer 3: Mapper validation - supabaseMappers.ts toSupabaseTimerSession()
const validId = isValidUUID(session.id) ? session.id : crypto.randomUUID()
```

### ~~TASK-107~~: Shift+Enter for Newlines in Task Edit Modal (✅ DONE)
**Priority**: P3-LOW
**Completed**: January 6, 2026

Allow users to insert newlines in text fields (description, subtask descriptions) using Shift+Enter in the TaskEditModal.

**Problem**:
- Pressing Enter anywhere in the modal triggered save
- Users couldn't add line breaks to descriptions

**Solution**:
- [x] Modified `handleKeyDown` to check for Shift modifier and target element type
- [x] Enter in textareas naturally creates newlines (no save)
- [x] Ctrl/Cmd+Enter anywhere triggers save
- [x] Tested and verified with Playwright

**Changes**:
- `src/components/tasks/TaskEditModal.vue`: Updated `handleKeyDown` function (lines 338-358)

### ~~BUG-003~~: Task Jumps to Different Location After Edit (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**Plan**: [plans/fix-task-position-jump-after-edit.md](../plans/fix-task-position-jump-after-edit.md)

Fixed task position jumping after editing by preserving existing Vue Flow node positions when position is locked.

**Root Cause**:
When task position was locked (from drag or edit), syncNodes() still recalculated relative position from absolute coordinates. If section position had slightly changed, this caused position drift.

**Fix Applied** (`useCanvasSync.ts`):
- [x] Added `existingNodePositions` map to track current Vue Flow node positions
- [x] When position is locked AND task exists with parentNode, preserve existing node position
- [x] Skip absolute→relative conversion when position is locked to prevent drift
- [x] Build passes, no TypeScript errors

### ~~BUG-005~~: Milkdown Checkboxes & Task Lists Not Working (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Checkboxes in markdown editor weren't rendering or clickable due to plugin initialization order issues.

**Root Causes Fixed**:
- Listener context was accessed BEFORE `.use(listener)` registration
- Theme was applied via `.config(nord)` instead of `.use(nord)`

**Fixes Applied** (`MilkdownEditorSurface.vue`):
- [x] Reordered plugins: `.use(listener)` now comes before config that uses `listenerCtx`
- [x] Changed `.config(nord)` to `.use(nord)` for proper theme initialization
- [x] Verified checkbox rendering works when typing `- [ ]` at line start
- [x] Verified checkbox toggle (click) functionality works (□ ↔ ☑)

**Note**: TaskList toolbar button inserts raw `- [ ]` text which doesn't trigger input rules. This is expected behavior - users type the pattern manually for it to convert.

**Files**:
- `src/components/common/MilkdownEditorSurface.vue`

---

### ~~BUG-004~~: Multi-Drag Positions Reset After Click (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026

Fixed multi-selected tasks (Ctrl+click) losing their relative positions after drag and click-to-deselect.

**Root Causes**:
- `onNodeDragStop` handler only processed `event.node` (single node), ignoring other selected nodes in `event.nodes`
- `syncNodes()` recalculated section containment for each task individually, causing mixed coordinate systems
- Tasks near section boundaries got different parentNode assignments, breaking relative arrangement

**Fix Applied**:
- [x] `useCanvasDragDrop.ts`: Updated `handleNodeDragStart` to store positions for ALL nodes in `event.nodes`
- [x] `useCanvasDragDrop.ts`: Updated `handleNodeDragStop` to process ALL dragged nodes together
- [x] For multi-drag, save all positions without recalculating containment
- [x] `useCanvasSync.ts`: Preserve existing parentNode relationships using `.has()` check
- [x] `useCanvasSync.ts`: Preserve existing node positions when position is locked

**Key Insight** (from [Vue Flow TypeDocs](https://vueflow.dev/typedocs/interfaces/NodeDragEvent.html)):
`NodeDragEvent.nodes` contains ALL nodes being dragged, not just the primary `node`.

### ~~BUG-006~~: Ctrl+Click Toggle Deselect Not Working (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Fixed Ctrl+click not properly toggling off selected nodes during multi-select.

**Problem**:
- When selecting 3 tasks with Ctrl+click, then Ctrl+clicking the middle one to deselect
- Expected: Middle task deselected, others remain selected
- Actual: Only middle task selected, others cleared

**Root Cause**:
- Vue Flow's internal click handling was still processing clicks even after our custom handler
- Vue Flow uses `multi-selection-key-code="Shift"` (doesn't recognize Ctrl as multi-select key)
- Vue Flow treated Ctrl+click as regular click, setting ONLY clicked node as selected
- This overrode our store's selection state via `@selection-change` and `@nodes-change` events

**Fix Applied**:
- [x] `TaskNode.vue`: Added `event.stopPropagation()` in `handleClick()` for modifier key clicks
- [x] This prevents Vue Flow from processing the click and overriding our custom multi-select

**Key Insight**: When implementing custom selection behavior that differs from Vue Flow's defaults, prevent event propagation to stop Vue Flow's internal handlers from conflicting.

### ~~BUG-008~~: Shift+Click Incorrectly Triggers Multi-Select Toggle (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
**SOP**: [CANVAS-shift-ctrl-selection-separation.md](./sop/active/CANVAS-shift-ctrl-selection-separation.md)

Fixed Shift+click being treated the same as Ctrl+click for multi-select toggle.

**Problem**:
- Ctrl+click and Shift+click were treated identically (both toggled selection)
- Expected: Ctrl+click toggles individual selection, Shift is reserved for rubber-band drag
- Actual: Shift+click was intercepting clicks and toggling selection instead of allowing Vue Flow's native Shift behavior

**Root Cause**:
- `TaskNode.vue` line 306: `const isModifierClick = event.ctrlKey || event.metaKey || event.shiftKey` treated all modifiers the same
- `useCanvasEvents.ts` handlePaneClick also treated Shift as multi-select trigger
- This conflicted with Vue Flow's `multi-selection-key-code="Shift"` setting

**Fix Applied**:
- [x] `TaskNode.vue`: Changed to `const isMultiSelectClick = event.ctrlKey || event.metaKey` (removed shiftKey)
- [x] `useCanvasEvents.ts`: Same change in handlePaneClick
- [x] Click outside to deselect verified working (handled in handlePaneClick)

**Behavior After Fix**:
- Ctrl/Cmd+click: Toggle individual task selection (our custom behavior)
- Shift+click: Add to selection (Vue Flow's native behavior via multi-selection-key-code)
- Shift+drag: Rubber-band selection
- Click empty space: Clear all selections

### ~~TASK-111~~: Canvas Group Filter for Calendar Inbox (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 6, 2026

Reduced cognitive overload in calendar inbox by adding canvas group filtering.

**Problem**:
- Too many tasks even with "Today" filter active
- Current filter buttons (Priority, Project, Duration) were overwhelming
- User wanted to filter calendar inbox by canvas groups

**Solution**:
- [x] Add "Show from: [Canvas Group]" dropdown as primary filter
- [x] Collapse existing filters into "More filters" toggle (hidden by default)
- [x] Create `useCanvasGroupMembership.ts` composable for group membership helpers
- [x] Test with various group configurations

**Changes**:
- `src/composables/canvas/useCanvasGroupMembership.ts` (NEW) - Group membership helpers
- `src/components/inbox/UnifiedInboxPanel.vue` - Added dropdown + collapsible filters
- `src/components/inbox/CalendarInboxPanel.vue` - Storybook version updated for consistency

**Key Features**:
- Canvas group filter chips (replaced dropdown for better UX)
- **Ctrl+click multi-select**: Select multiple groups at once (OR logic)
- "More filters" button collapses advanced filters (hidden by default)
- Contextual empty state: "No tasks in this group. Drag tasks to this group on Canvas."
- Group membership computed dynamically from task.canvasPosition vs group.position bounds

**Enhancement (January 7, 2026)**: Added Ctrl+click multi-select support
- Changed `selectedCanvasGroup` (string) → `selectedCanvasGroups` (Set)
- Regular click: single-select toggle
- Ctrl/Cmd+click: multi-select toggle (add/remove groups)
- Filter shows tasks in ANY selected group (OR logic)

### ~~BUG-007~~: Sidebar Date Filters Not Matching Tasks (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Fixed "Today" and "This Week" sidebar filters not correctly showing tasks due to date format mismatch.

**Problem**:
- "Today" filter showed only 2 tasks when there were 6+ tasks due today
- Date comparison used direct string equality (e.g., `task.dueDate === todayStr`)
- Stored dates were in various malformed formats:
  - `07T00:00:00+00:00-01-2026` (malformed from database)
  - `07-01-2026` (DD-MM-YYYY)
  - Expected: `2026-01-07` (YYYY-MM-DD)

**Root Cause**:
The `isTodayTask()` and `isWeekTask()` functions in `useSmartViews.ts` assumed `dueDate` was already normalized to `YYYY-MM-DD` format, but database contained various date formats.

**Solution**:
- [x] Added `normalizeDateString()` helper function to handle all date formats
- [x] Updated `isTodayTask()` to normalize dates before comparison
- [x] Updated `isWeekTask()` to normalize dates before comparison
- [x] Handles ISO 8601, DD-MM-YYYY, and malformed legacy formats

**Changes**:
- `src/composables/useSmartViews.ts`: Added `normalizeDateString()` and updated both filter functions

**Verification**:
- Today filter: 2 → 6 tasks (correctly shows all tasks due today)
- All sidebar filters (Today, This Week, All Active, Inbox, Duration) working correctly
- Build passes

### TASK-112: Admin/Developer Role & UI Restrictions (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Implement `isAdmin` / `isDev` flags in `useAuthStore` or user metadata.
- [x] Create an "Admin Class" logic for privileged dashboard access.
- [x] Restrict `/performance` and other debug views to Admin users only.
- [x] Add "Developer Settings" section in the main settings.

### ~~TASK-113~~: Canvas Performance Optimization (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Implement Level-of-Detail (LOD) rendering for canvas nodes.
- [x] Replace `syncTasksToCanvas` with a more efficient incremental update logic.
- [x] Reduce reactive overhead in node data mapping (O(N) Optimization).
- [x] Verify drag performance (< 16ms/frame).

### ~~TASK-117~~: Fix Lint and TS Errors (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Analyzed and fixed 558 lint errors/warnings.
- [x] Fixed TypeScript module resolution errors (`TS2307`).
- [x] Implemented type safety in `SyncOrchestrator` and `useSupabaseDatabase`.
- [x] Verified application stability with clean production build.
- [x] Zero critical lint errors remaining (warnings reviewed).

### TASK-114: Virtual Scrolling Smoothness (📋 PLANNED)
**Priority**: P2-MEDIUM
- Profile and eliminate layout thrashing in list components.
- Implement optimized rendering strategy for large lists.
- Reduce computed property complexity in task items.

### TASK-115: Memory Efficiency & Leak Fixes (📋 PLANNED)
**Priority**: P2-MEDIUM
- Profile heap snapshots to identify node pooling leaks.
- Implement specialized cleanup for detached Vue Flow elements.
- Optimize task store internal representation for reduced memory footprint.

---

## Code Review Findings (January 7, 2026)

> These issues were identified during comprehensive code review of uncommitted changes.

### ~~BUG-011~~: Index-Based Node Access After Removal (✅ DONE)
**Priority**: P0-CRITICAL (Data Corruption Risk)
**Completed**: January 7, 2026

**Problem**: `useCanvasSync.ts` removes nodes BEFORE applying updates, but updates use stored array indices. After removal, indices shift causing updates to be applied to WRONG nodes.

**Location**: `src/composables/canvas/useCanvasSync.ts` lines 313-337

**Fix Applied**: Changed to ID-based `.find()` lookup instead of index-based access. Also removed duplicate node removal code.

**Subtasks**:
- [x] Change to ID-based lookup for node updates
- [x] Remove duplicate node removal code
- [x] Build verification passed

### ~~BUG-012~~: localStorage Dev-Mode Bypass in Production (✅ DONE)
**Priority**: P0-CRITICAL (Security)
**Completed**: January 7, 2026

**Problem**: Any user can grant themselves admin privileges in production by setting localStorage.

**Locations**:
- `src/stores/auth.ts:33`
- `src/stores/local-auth.ts:66-70`

**Fix Applied**: Changed `||` to `&&` - localStorage override now ONLY works in DEV builds.

**Subtasks**:
- [x] Fix auth.ts isAdmin and isDev computed properties
- [x] Fix local-auth.ts isAdmin and isDev computed properties
- [x] Build verification passed

### ~~BUG-013~~: TiptapEditor Emits HTML Instead of Markdown (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 7, 2026

**Problem**: The TiptapEditor component was emitting HTML content instead of markdown.

**Fix Applied**:
- Added `htmlToMarkdown()` function to `src/utils/markdown.ts`
- TiptapEditor now converts HTML to markdown on emit
- TiptapEditor converts incoming markdown to HTML for Tiptap display

**Subtasks**:
- [x] Added htmlToMarkdown conversion function
- [x] Updated TiptapEditor to use markdown I/O
- [x] Build verification passed

### ~~BUG-014~~: TiptapEditor Link Input Not Sanitized (✅ DONE)
**Priority**: P2-MEDIUM (Security)
**Completed**: January 7, 2026

**Problem**: User input from `window.prompt()` was passed directly to `setLink()` without URL sanitization.

**Location**: `src/components/common/TiptapEditor.vue`

**Fix Applied**:
- Exported `sanitizeUrl()` from `src/utils/markdown.ts`
- TiptapEditor now validates URLs and blocks unsafe protocols (javascript:, data:, etc.)
- Shows alert when unsafe URL is entered

**Subtasks**:
- [x] Export sanitizeUrl function from markdown.ts
- [x] Import and use in TiptapEditor setLink function
- [x] Build verification passed

### ~~BUG-015~~: Watch Priority 'high' Bypasses Batching (✅ DONE)
**Priority**: P2-MEDIUM (Performance)
**Completed**: January 7, 2026

**Problem**: CanvasView.vue was using 'high' priority which runs synchronously and bypasses the batching system entirely.

### TASK-123: Fix Canvas Reactivity Issues (✅ DONE)
**Priority**: P1-HIGH
**Status**: Resolved
- [x] Fix UI updates not reflecting immediately without manual refresh.
- [x] Ensure `useTaskStore` state changes propagate correctly.
- [x] Optimize `CanvasView` computed properties and watchers.

### BUG-020: Drag Drop Position Resets (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
- [x] Prevent tasks from resetting position after drag operations.
- [x] Fix multi-node drag position stability.
- [x] Ensure `isNodeDragging` and `isDragSettling` are correctly managed.

### BUG-021: Group Resize Limit (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Users could not resize groups larger than 2000px, which was insufficient for large projects.
**Fix**: Increased maximum width/height limits to 50,000px in `GroupNodeSimple.vue`, `CanvasView.vue`, and `useCanvasResize.ts`.

### BUG-022: New Task Resets Existing Positions (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Creating a new task caused existing tasks to jump or reset their positions due to strict sync logic.
**Fix**: 
1. Added a tolerance check (2.0px) in `useCanvasSync.ts` to preserve existing visual positions if they are close.
2. **Crucial**: Updated `handleNodeDragStop` in `useCanvasDragDrop.ts` to update absolute positions of ALL child tasks when a section is dragged. This ensures the store stays in sync with visual relative movements.

### BUG-023: Editor UI Rendering Issues (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Problem**: Editor showed artifacts or black box due to excessive reactivity re-rendering the component while typing.
### BUG-024: Group Resize Task Stability (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Resizing a group from the top/left edge caused child tasks to visually move or reset because the parent's origin shift wasn't correctly counteracted in the store.
**Fix**: Updated `handleSectionResizeEnd` in `CanvasView.vue` to explicitly calculate and persist the correct absolute position for all child tasks when the parent's origin changes, ensuring they remain stationary on the canvas.

### BUG-025: Unrelated Groups Move with Parent (Weekends)
**Priority**: P1-HIGH
**Status**: 🔴 OPEN
**Problem**: Dragging a specific group (e.g., "Weekend") causes other unrelated groups to move as if they were children, despite not being visually inside it.
**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (Likely `parentGroupId` logic)
**Location**: `src/views/CanvasView.vue` line 1845

**Fix Applied**: Changed priority back to 'normal'. The 16ms batch delay (60fps) still feels instant but prevents performance issues when multiple tasks change rapidly.

**Subtasks**:
- [x] Changed priority from 'high' to 'normal'
- [x] Build verification passed

### ~~BUG-016~~: moveTaskToSmartGroup Default Case Clears dueDate (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 7, 2026

**Problem**: Unknown smart group types were logging a warning but still calling `updateTask`, potentially clearing dueDate unintentionally.

**Location**: `src/stores/tasks/taskOperations.ts` line 437

**Fix Applied**: Added early `return` in default case to prevent unintended update when unknown type is passed.

**Subtasks**:
- [x] Added early return in default case
- [x] Build verification passed

### TASK-124: Remove Dead Milkdown Code (📋 PLANNED)
**Priority**: P2-MEDIUM
**Discovered**: January 7, 2026

**Problem**: `MilkdownEditorSurface.vue` is no longer imported (MarkdownEditor uses TiptapEditor), but received 120+ lines of changes and Milkdown packages remain in package.json.

**Impact**: Bundle bloat, maintenance confusion.

**Subtasks**:
- [ ] Confirm MilkdownEditorSurface.vue is not imported anywhere
- [ ] Delete MilkdownEditorSurface.vue
- [ ] Remove Milkdown packages from package.json
- [ ] Verify build passes
- [ ] Measure bundle size reduction

### TASK-125: Remove Debug Console.log Statements (📋 PLANNED)
**Priority**: P3-LOW
**Discovered**: January 7, 2026

**Problem**: 10+ debug console.log statements with emoji prefixes in production code paths.

**Locations**:
- `src/composables/canvas/useCanvasDragDrop.ts` (7 statements)
- `src/stores/tasks/taskOperations.ts` (3 statements)
- `src/components/tasks/TaskEditModal.vue` (1 statement)

**Subtasks**:
- [ ] Remove or wrap in `import.meta.env.DEV` check
- [ ] Verify no runtime issues

### ~~BUG-017~~: Fix Dropdown Cutoff (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "All Tasks" dropdown in calendar inbox (and potentially others) was cut off because it was constrained to the trigger button's width, causing wider options to be truncated.
**Fix**: Updated `CustomSelect.vue` to use `min-width` instead of fixed `width`, allowing the dropdown to expand to fit its content.

### ~~BUG-018~~: Dropdown Closes on Scroll (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: The custom dropdown closed immediately when users tried to scroll the list of options.
**Fix**: Updated `handleScroll` in `CustomSelect.vue` to ignore scroll events originating from within the dropdown itself.

### BUG-022: Fix Zombie Edge UX
**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Problem**: Users cannot immediately re-create a connection they just deleted because `recentlyRemovedEdges` treats it as a "zombie" edge from a sync conflict and blocks it for 2 seconds.
**Solution**: Modify `handleConnect` to explicitly remove the edge ID from `recentlyRemovedEdges` when a user intentionally creates a connection, distinguishing it from an automated background sync.

### ~~BOX-001~~: Fix `ensureActionGroups` Undefined Error (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Helper `ensureActionGroups` was not exported from `useCanvasSmartGroups.ts`, causing runtime error.
**Fix**: Rewrote `useCanvasSmartGroups.ts` to properly export the function and implemented new "Friday" and "Saturday" action group logic instead of legacy "Weekend" group.

### ~~BUG-019~~: Fix `saveUserSettings` Sync Error (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Sync Error `[object Object]` which turned out to be a duplicate key violation on `user_settings`.
**Fix**:
1. Improved error handling in `useSupabaseDatabase.ts` to parse object errors.
2. Added `{ onConflict: 'user_id' }` to `saveUserSettings` upsert call to handle existing records correctly.

### ~~TASK-126~~: Fix Catalog Filter Logic & Position (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "Hide Done Tasks" filter was misplaced in the view and logic needed verification.
**Fix**:
1. Moved toggle button to `ViewControls.vue` for consistent layout.
2. Verified `taskStore` logic correctly toggles visibility.

### ~~BUG-019~~: Fix ISO Date Display in Overdue Badge (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Overdue badge showed raw ISO timestamp (e.g., 2026-01-06T00:00:00+00:00).
**Fix**: Updated `formatDueDateLabel` in `CalendarInboxPanel.vue` to nice formatting (e.g., "Overdue Jan 6").

### ~~TASK-128~~: Friday & Saturday Action Groups (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Feature**: Replaced "Weekend" group with "Friday" and "Saturday" Action Groups.
**Logic**: Dropping a task into these groups automatically sets its due date to the closest upcoming Friday or Saturday.

### ~~TASK-126~~: Fix Dead Code - Redundant Ternary (✅ DONE)
**Priority**: P3-LOW
**Completed**: January 7, 2026

**Problem**: Useless ternary that always returns the same value.

**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (2 occurrences)

**Fix Applied**: Removed redundant ternary, now uses `height` directly.

**Subtasks**:
- [x] Removed the redundant ternary (2 occurrences)
- [x] Build verification passed

---

## Code Review Findings (January 8, 2026)

> These issues were identified during comprehensive multi-agent code review of uncommitted changes (PouchDB→Supabase migration + PWA setup).

### ~~BUG-021~~: CSP Connect-Src Uses Wildcards (✅ DONE)
**Priority**: P2-MEDIUM (Security)
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: CSP `connect-src` directive now allows connections to ANY HTTP/HTTPS endpoint using broad wildcards (`'http:'`, `'https:'`). This defeats CSP's purpose and enables potential data exfiltration.

**Locations**:
- `src/utils/cspManager.ts`
- `src/utils/securityHeaders.ts`

**Fix Applied**: Replaced wildcards with explicit allowlist:
- `https://*.supabase.co` - Supabase API
- `https://api.github.com` - GitHub API
- `https://raw.githubusercontent.com` - GitHub raw content
- Development: localhost and ws/wss preserved

**Subtasks**:
- [x] Replace wildcards with explicit allowlist (Supabase, GitHub API)
- [x] Verify build passes

### ~~BUG-022~~: Canvas Sync Has Incomplete Change Detection (✅ DONE)
**Priority**: P2-MEDIUM (Performance)
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `syncTasksToCanvas` only checks `position` and `updatedAt` to determine if a task node needs updating. Misses changes to status, priority, title, tags, causing stale data on canvas.

**Location**: `src/stores/canvas.ts` (lines 412-432)

**Fix Applied**: Added comprehensive field comparison matching `useCanvasSync.ts` pattern:
- status, priority, title, updatedAt, progress, dueDate, estimatedDuration

**Subtasks**:
- [x] Add comprehensive field comparison (status, priority, title, progress, dueDate, estimatedDuration)
- [x] Verify build passes

### ~~TASK-131~~: Remove Dead Code - useOptimizedTaskStore.ts (✅ DONE)
**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/composables/useOptimizedTaskStore.ts` (387 lines) is never imported anywhere. PouchDB-era batching layer that imports deprecated stubs.

**Resolution**: File not found during review - already deleted in previous cleanup.

**Subtasks**:
- [x] Delete `src/composables/useOptimizedTaskStore.ts` (already deleted)
- [x] Verify build passes

### ~~TASK-132~~: Remove Dead Code - SyncRetryService.ts (✅ DONE)
**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/services/sync/SyncRetryService.ts` (52 lines) is never imported or called.

**Resolution**: File not found during review - already deleted in previous cleanup.

**Subtasks**:
- [x] Delete `src/services/sync/SyncRetryService.ts` (already deleted)
- [x] Verify build passes

### ~~BUG-023~~: PWA Cache TTL Too Long for Supabase API (✅ DONE)
**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: PWA configuration caches Supabase REST API responses for 24 hours. May serve stale task data after Supabase Realtime pushes updates.

**Location**: `vite.config.ts`

**Fix Applied**:
- Added `FIVE_MINUTES` constant (300 seconds)
- Changed Supabase API cache `maxAgeSeconds` from `ONE_DAY` to `FIVE_MINUTES`

**Subtasks**:
- [x] Reduce API cache TTL to 5 minutes
- [x] Verify build passes

### ~~BUG-024~~: Timer Cross-Device Sync Completely Broken (✅ DONE)
**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/composables/useTimerChangesSync.ts` (249 lines) relies entirely on `window.pomoFlowDb` (PouchDB) which no longer exists. Timer sync is non-functional.

**Fix Applied**: Stubbed the composable to return no-op functions:
- `isConnected` always returns false
- `startListening`, `stopListening`, `reconnect` are no-ops
- DEV-only console.warn for debugging

**Subtasks**:
- [x] Stub composable with no-op functions
- [x] Verify build passes

### ~~TASK-133~~: Auth Store Uses catch (e: any) Pattern (✅ DONE)
**Priority**: P3-LOW
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/stores/auth.ts` uses `catch (e: any)` in 7 locations. Should use `catch (e: unknown)` with type narrowing.

**Fix Applied**:
- Changed all 7 `catch (e: any)` to `catch (e: unknown)`
- Cast to `AuthError` type with `e as AuthError`
- Fixed `_event: any, newSession: any` callback params
- Fixed `metadata?: any` to `metadata?: Record<string, unknown>`

**Subtasks**:
- [x] Migrate all catch blocks to `unknown`
- [x] Fix callback parameter types
- [x] Verify build passes

### ~~TASK-134~~: Stub Console Warnings in Production (✅ DONE)
**Priority**: P3-LOW
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: Legacy stub files emit `console.warn` in production, polluting user console.

**Resolution**:
- `useDatabase.ts` and `useReliableSyncManager.ts` were already deleted in previous cleanup
- The only remaining stub (`useTimerChangesSync.ts`) was fixed in BUG-024 with DEV check

**Subtasks**:
- [x] Wrap in `import.meta.env.DEV` check (done in BUG-024)

### ~~BUG-025~~: Bulk Delete Operations Not Atomic (✅ DONE)
**Priority**: P3-LOW
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `bulkDeleteTasks` deletes tasks sequentially. If loop fails partway, database is in inconsistent state.

**Fix Applied**:
- Added `bulkDeleteTasks` to `useSupabaseDatabase.ts` using `.in('id', taskIds)` for atomic operation
- Added `bulkDeleteTasksFromStorage` to `taskPersistence.ts`
- Updated `taskOperations.ts` to use atomic bulk delete instead of sequential loop

**Subtasks**:
- [x] Batch Supabase operations using `.in('id', taskIds)`
- [x] Verify build passes

### ~~TASK-135~~: Commented Code in canvas.ts (✅ DONE)
**Priority**: P3-LOW
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: Dead imports and commented variables in `src/stores/canvas.ts`.

**Fix Applied**: Removed 4 commented code blocks:
- Dead `errorHandler` import
- Commented `const groups = visibleGroups`
- Commented `collapsedTaskPositions` ref
- Commented `togglePowerMode` function

**Subtasks**:
- [x] Remove commented dead code
- [x] Verify build passes

### ~~TASK-136~~: Decommission CouchDB (✅ DONE)
**Priority**: P2-MEDIUM (Security)
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Decision**: User confirmed no data migration needed. CouchDB server to be shut down manually.

**Changes Made**:
- [x] Removed CouchDB credentials from `.env`
- [x] Updated `.env.example` to show Supabase config instead
- [x] Removed CouchDB remote config from `environments.ts`
- [x] Removed PouchDB types from `global.d.ts`
- [x] Removed PouchDB database verification from `useCanvasSync.ts`
- [x] Deleted `scripts/migrate-couchdb-to-supabase.cjs`
- [x] App now uses Supabase exclusively

**Manual Action Required**: Shut down CouchDB server at `84.46.253.137:5984`

---

### ~~TASK-127~~: Remove PouchDB-Era Task Disappearance Logger (✅ DONE)
**Priority**: P2-MEDIUM
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: None (cleanup)

**Problem**: The `taskDisappearanceLogger` utility was created to debug mysterious task disappearances caused by PouchDB sync race conditions and IndexedDB issues. Now that PouchDB has been removed (TASK-118), this 450+ line debugging tool serves no purpose.

**Files removed/cleaned**:
- `src/utils/taskDisappearanceLogger.ts` (DELETED - 457 lines)
- `src/main.ts` (removed import)
- `src/stores/tasks/taskOperations.ts` (removed usage)
- `src/stores/tasks/taskHistory.ts` (removed usage)
- `src/composables/useCrossTabSync.ts` (removed usage)

**Subtasks**:
- [x] Remove import and usage from main.ts
- [x] Remove import and usage from taskOperations.ts
- [x] Remove import and usage from taskHistory.ts
- [x] Remove import and usage from useCrossTabSync.ts
- [x] Delete taskDisappearanceLogger.ts
- [x] Build verification passed

### ~~TASK-129~~: Remove TransactionManager & Clean Database Config (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: None (cleanup)
**Related**: TASK-117 (originally tracked in stub file comment)

**Problem**: The `TransactionManager` was the PouchDB Write-Ahead Log (WAL) system. Now that PouchDB is removed, the TransactionManager is just a no-op stub that clutters the codebase. Also, `config/database.ts` is full of dead PouchDB/CouchDB configuration.

**Files removed/cleaned**:
- `src/services/sync/TransactionManager.ts` (DELETED - 35 lines)
- `src/stores/tasks/taskOperations.ts` (removed 9 transactionManager calls)
- `src/stores/tasks.ts` (removed crash recovery block ~40 lines)
- `src/services/trash/TrashService.ts` (removed 6 transactionManager calls)
- `src/wal_test_script.ts` (DELETED - unused test file)
- `src/config/database.ts` (added deprecation notice, kept for compatibility)

**Subtasks**:
- [x] Remove transactionManager calls from taskOperations.ts
- [x] Remove transactionManager calls from tasks.ts
- [x] Remove transactionManager calls from TrashService.ts
- [x] Delete TransactionManager.ts stub
- [x] Delete wal_test_script.ts
- [x] Add deprecation notice to config/database.ts
- [x] Build verification passed

---

## PWA Prerequisites (Phase 0) - Must Complete Before ROAD-004

### ~~TASK-118~~: Remove PouchDB Packages & Code (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 7, 2026
**Completed**: January 7, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

PouchDB packages and dead sync code removed from codebase.

**Results**:
- [x] Removed packages from `package.json`: `pouchdb`, `pouchdb-browser`, `@types/pouchdb`
- [x] Deleted 4 dead sync service files:
  - `src/services/sync/DatabaseService.ts`
  - `src/services/sync/SyncOrchestrator.ts`
  - `src/services/sync/SyncOperationService.ts`
  - `src/services/doctor/IntegrityDoctorService.ts`
- [x] `npm install` removed 71 packages (PouchDB dependency tree)
- [x] Build passes: 509 KB gzipped

**Note**: Bundle size did not decrease as expected (was 496 KB before). Further optimization needed in TASK-122.

**Kept as no-op stubs** (still imported by TrashService/task operations):
- `src/services/sync/TransactionManager.ts` - Returns stub transaction IDs

### ~~TASK-119~~: Remove PowerSync Packages (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

PowerSync packages removed. Never used - code was tree-shaken. Using Workbox BackgroundSync for PWA instead.

**Results**:
- [x] Removed packages: `@powersync/vue`, `@powersync/web`, `vite-plugin-wasm`, `vite-plugin-top-level-await`
- [x] Deleted `src/database/AppSchema.ts` (unused PowerSync schema)
- [x] Updated `vite.config.ts` to remove PowerSync-specific config
- [x] `npm install` removed 19 packages
- [x] Build passes: **505.45 KB** gzipped (down from 509 KB)
- [x] Build time improved: 13.62s (28% faster)

**Note**: Bundle size reduction modest (~3.6KB) because code was already tree-shaken (never imported). Main benefit is cleaner dependencies and faster builds.

### ~~TASK-120~~: Fix CSP for Service Workers (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

**Results**:
- [x] Updated `src/utils/cspManager.ts` production `worker-src` from `["'none'"]` to `["'self'", "blob:"]`
- [x] CSP now allows service workers for PWA

### ~~TASK-121~~: Remove Hardcoded IP from Database Config (✅ DONE)
**Priority**: P1-HIGH (Security)
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

**Results**:
- [x] Removed hardcoded IP `84.46.253.137` from all files:
  - `src/config/database.ts` - Now uses env var fallback
  - `src/components/sync/SyncErrorBoundary.vue` - Uses `getCouchDBConfig()`
  - `src/utils/cspManager.ts` - Removed from CSP directives
  - `src/utils/securityHeaders.ts` - Removed from CSP
- [x] Exported `getCouchDBConfig()` from database.ts for dynamic URL access

### ~~TASK-122~~: Bundle Size Optimization (<500KB) (✅ DONE - 505KB)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)
**Final**: 505.08 KB gzipped | **Target**: <500KB gzipped

**Results**:
- [x] Removed 9 Milkdown packages (unused - TipTap is used instead)
- [x] Removed unused backend packages: `pg`, `express`, `cors`, `jose`, `jsonwebtoken`, `chokidar`, `top-level-await`
- [x] Deleted unused `MilkdownEditorSurface.vue`
- [x] Total packages removed: 226 (71 + 19 + 72 + 154)
- [x] Build time improved: 13.04s

**Bundle size progression**:
| Phase | Size (gzipped) | Change |
|-------|----------------|--------|
| Baseline | 509.05 KB | - |
| After TASK-118 (PouchDB) | 509.05 KB | 0 |
| After TASK-119 (PowerSync) | 505.45 KB | -3.6 KB |
| After unused packages cleanup | 505.08 KB | -0.37 KB |

**Note**: Bundle at 505KB (5KB over target). Most removed packages were already tree-shaken. Further reduction would require code-splitting core features or removing used libraries.

### TASK-123: Consolidate Network Status Implementations (📋 PLANNED)
**Priority**: P2-MEDIUM
**Related**: ROAD-004 (PWA Mobile Support)

Codebase has 3 competing network status implementations. Adding PWA would create a 4th.

**Current Implementations**:
1. `src/services/sync/NetworkMonitorService.ts`
2. `src/composables/useNetworkOptimizer.ts` (line 108)
3. `src/composables/useOptimisticUI.ts` (line 44)

**Recommended**: Consolidate into single `useNetworkStatus.ts` or use VueUse's `useOnline()`.

**Subtasks**:
- [ ] Audit all 3 implementations for feature differences
- [ ] Create single source of truth composable
- [ ] Deprecate or delete redundant implementations
- [ ] Update all consumers to use consolidated version

### ~~TASK-130~~: Canvas Day-of-Week Groups & Z-Index Fixes (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 9, 2026

Multi-part fix for canvas group issues affecting day-of-week groups and z-index during drag.

**Problems**:
1. Groups reset locations on refresh (persistence issue) ✅ Fixed with localStorage fallback for Guest Mode
2. Friday/Saturday/all day-of-week groups don't update task due dates correctly when same-day ✅ Fixed
3. Day groups should show upcoming date in label (e.g., "Friday / Jan 10") ✅ Fixed
4. Groups appear under other groups when dragging (z-index issue) ✅ Fixed
5. Task positions AND viewport reset when deleting tasks ✅ Fixed (BUG-020)

**Subtasks**:
- [x] Fix day-of-week date calculation (handle same-day edge case → next week)
- [x] Add all days of week to power keyword detection (Monday-Sunday)
- [x] Add date suffix to day group labels in GroupNodeSimple.vue
- [x] Fix z-index elevation during group drag
- [x] Fix Guest Mode group position persistence with localStorage fallback
- [x] Fix task/viewport reset on deletion (BUG-020) - debounced sync watcher
- [ ] Test with Playwright

**Files modified**:
- `src/composables/canvas/useCanvasDragDrop.ts` - Day-of-week date logic + z-index elevation
- `src/composables/useTaskSmartGroups.ts` - Add day-of-week keywords (DAY_OF_WEEK_KEYWORDS)
- `src/components/canvas/GroupNodeSimple.vue` - Date labels (dayOfWeekDateSuffix computed)
- `src/stores/canvas.ts` - Guest Mode localStorage persistence

---

### ~~BUG-026~~: Canvas SYNC-EDGES Excessive Logging (✅ DONE)
**Priority**: P2-MEDIUM (Performance/DX)
**Discovered**: January 8, 2026
**Completed**: January 8, 2026
**Related**: Undo/Redo System Review

**Problem**: The `[SYNC-EDGES] Synced 0 edges` log fires hundreds of times per second on Canvas view, flooding the console and making debugging extremely difficult.

**Solution**: Commented out the excessive logging at `src/composables/canvas/useCanvasSync.ts:452` with a note explaining why.

**Subtasks**:
- [x] Identify the source of SYNC-EDGES logging
- [x] Remove log with explanatory comment
- [x] Verified fix in browser - no more SYNC-EDGES flooding

---

### ~~BUG-027~~: Canvas View Frequent Remounting (❌ NOT A BUG)
**Priority**: P1-HIGH (Usability)
**Discovered**: January 8, 2026
**Closed**: January 8, 2026
**Related**: Undo/Redo System Review

**Original Problem**: Canvas view appeared to repeatedly unmount and remount, observed via "Full Remount Detected" logs.

**Investigation Result**: This was NOT a bug. The frequent remounting observed was caused by **HMR (Hot Module Replacement)** during development when code files were edited. During normal navigation (e.g., Board -> Canvas), the component only mounts once as expected.

**Evidence**:
- Normal navigation shows single "CanvasView mounted" message
- Multiple mounts only occur when Vite HMR updates components
- Canvas view is stable during production-like usage

---

### TASK-139: Undo State Persistence to localStorage (📋 PLANNED)
**Priority**: P3-LOW (Enhancement)
**Discovered**: January 8, 2026
**Related**: Undo/Redo System Review

**Feature**: Persist undo/redo history to localStorage for session recovery.

**Current Behavior**: Undo history is lost on page refresh. Users lose ability to undo actions from before the refresh.

**Proposed**:
- [ ] Serialize undo stack to localStorage on state changes
- [ ] Restore undo stack from localStorage on app initialization
- [ ] Add TTL to prevent stale history from being restored
- [ ] Handle large state gracefully (truncate if over localStorage limits)

---

### TASK-140: Undo/Redo Visual Feedback (📋 PLANNED)
**Priority**: P3-LOW (UX Enhancement)
**Discovered**: January 8, 2026
**Related**: Undo/Redo System Review

**Feature**: Show toast/notification when undo or redo is performed.

**Current Behavior**: Undo/redo happens silently with no visual confirmation.

**Proposed**:
- [ ] Show brief toast: "Undone: [action description]"
- [ ] Show brief toast: "Redone: [action description]"
- [ ] Auto-dismiss after 2-3 seconds
- [ ] Option to disable in settings

---

### TASK-141: Canvas Position System Refactor (📋 PLANNED)
**Priority**: P1-HIGH
**Created**: January 8, 2026
**Plan**: [plans/canvas-position-system-refactor.md](../plans/canvas-position-system-refactor.md)
**SOP**: [docs/sop/active/canvas-position-debugging.md](./sop/active/canvas-position-debugging.md)

**Problem**: Constant position reset issues with tasks and groups on the canvas despite TASK-131 fixes. Root cause is fragmented architecture with 10+ position modification points, 5+ competing state flags, and duplicate implementations.

**Proposed Solution**: Centralized Position Manager service that:
- Acts as single source of truth for all position updates
- Manages event-driven locks (not time-based)
- Handles coordinate transformation consistently
- Provides conflict resolution between user actions and database sync

**Phases**:
- [ ] **Phase 1**: Create PositionManager service with lock persistence
- [ ] **Phase 2**: Consolidate all position modifications through PositionManager
- [ ] **Phase 3**: Implement event-driven lock lifecycle
- [ ] **Phase 4**: Standardize coordinate system (absolute vs. relative)
- [ ] **Phase 5**: Comprehensive Playwright tests and cleanup

**Files to Create**:
- `src/services/canvas/PositionManager.ts`
- `src/services/canvas/LockManager.ts`
- `src/services/canvas/types.ts`

**Files to Modify**:
- `src/utils/canvasStateLock.ts`
- `src/composables/canvas/useCanvasDragDrop.ts`
- `src/composables/canvas/useCanvasResize.ts`
- `src/composables/canvas/useCanvasSync.ts`
- `src/stores/tasks/taskOperations.ts`
- `src/stores/canvas.ts`
- `src/views/CanvasView.vue`

---

### ~~BUG-020~~: Task Positions and Viewport Reset on Task Deletion (✅ DONE)
**Priority**: P1-HIGH
**Reported**: January 8, 2026
**Fixed**: January 8, 2026
**Related**: TASK-130

**Problem**:
When deleting a task, other task positions on the canvas reset to unexpected locations, and the viewport also resets.

**Root Cause**:
- `watch(filteredTasks, ...)` with `{ deep: true, immediate: true }` combined with `batchedSyncEdges('high')`
- 'high' priority in NodeUpdateBatcher bypasses batching entirely and runs immediately
- This created an infinite reactivity loop with hundreds of sync calls per second

**Fix Applied**:
- Wrapped sync calls in `useDebounceFn()` with 100ms delay in `CanvasView.vue:874-881`
- Changed priority from 'high' to 'normal' so batching actually works
- Removed duplicate `loadFromDatabase()` call in canvas store initialize function
- Added retry logic to `ensureActionGroups()` to prevent duplicate group creation

---

### ~~TASK-131~~: Canvas View Stabilization - Eliminate All Resets (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Plan**: [plans/canvas-view-stabilization-eliminate-resets.md](../plans/canvas-view-stabilization-eliminate-resets.md)
**Related**: BUG-020

Comprehensive refactor to eliminate ALL canvas state resets:
- Task position resets
- Group position/size resets
- Viewport resets

**Root Cause Identified & Fixed**:
The position reset regression was caused by **competing sync systems** in `canvas.ts`:
- A `deep: true` watcher on `taskStore.tasks` was calling `syncTasksToCanvas()`
- This watcher fired on ANY task property change (not just position changes)
- `syncTasksToCanvas()` did NOT respect position locks from `canvasStateLock.ts`
- Result: User drags task → watcher fires → positions overwritten with stale values

**Fix Applied** (src/stores/canvas.ts lines 481-489):
```typescript
// TASK-131 FIX: DISABLED - This competing watcher caused position resets
// The deep:true watcher fired on ANY task property change and overwrote locked positions.
// useCanvasSync.ts in CanvasView.vue handles all sync with proper position locking.
import('./tasks').then(({ useTaskStore }) => {
  taskStore = useTaskStore()
  // REMOVED: watch(() => taskStore.tasks, ...) - competed with useCanvasSync.ts
})
```

**Architecture Decision**:
- `useCanvasSync.ts` in `CanvasView.vue` is the SINGLE source of truth for canvas synchronization
- It properly implements position locking via `getLockedTaskPosition()`
- All other sync mechanisms have been removed to prevent competition

**Phase 1 Completed** (Initial Fix):
- [x] Research phase completed (13 specialized agents)
- [x] Identified root cause: competing watcher in canvas.ts
- [x] Disabled competing `deep: true` watcher that ignored position locks
- [x] Build verified passing

**Phase 2 Completed** (Comprehensive Fixes - January 8, 2026):
- [x] Deleted `canvasPositionLock.ts` (131 lines - duplicate of canvasStateLock.ts)
- [x] Fixed NodeUpdateBatcher high-priority bypass (was skipping batching entirely)
- [x] Created `positionUtils.ts` - consolidated position validation utilities
- [x] Moved `hasInitialFit` to canvasUiStore with localStorage persistence (prevents viewport reset on navigation)
- [x] Implemented surgical deletion (`removeTaskNode`/`removeTaskNodes` in useCanvasSync.ts)
- [x] Added `patchGroups()` API to canvas store (respects position locks)
- [x] Removed redundant `deep: true` watcher in CanvasView.vue (hash-based watchers handle all cases)
- [x] Removed `triggerCanvasSync()` from delete operations (surgical watcher handles it)

**Files Changed**:
- `src/utils/canvasPositionLock.ts` - DELETED
- `src/utils/canvas/NodeUpdateBatcher.ts` - Fixed high-priority bypass
- `src/utils/canvas/positionUtils.ts` - NEW (position validation utilities)
- `src/stores/canvas/canvasUi.ts` - Added hasInitialFit state
- `src/stores/canvas.ts` - Added patchGroups() API
- `src/composables/canvas/useCanvasSync.ts` - Added surgical deletion functions
- `src/stores/tasks/taskOperations.ts` - Removed triggerCanvasSync from delete
- `src/views/CanvasView.vue` - Surgical deletion watcher, removed deep:true watcher

**Requires Manual Testing**:
- [ ] Task deletion does NOT reset other task positions
- [ ] Viewport persists when switching views (Canvas → Calendar → Canvas)
- [ ] Group drag/resize positions persist correctly

---

### ~~BUG-028~~: Guest Mode Task Deletion Fails with Auth Error (✅ DONE)
**Priority**: P1-HIGH
**Reported**: January 8, 2026
**Fixed**: January 8, 2026

**Problem**:
Deleting tasks in Guest Mode failed with "User not authenticated" Supabase error.

**Root Cause**:
`deleteTaskFromStorage()` in `taskPersistence.ts` tried to delete from Supabase even in Guest Mode where tasks only exist in memory.

**Fix Applied**:
Added authentication check at start of `deleteTaskFromStorage()` - if not authenticated, skip Supabase deletion and return success (task removal from memory happens in `taskOperations.ts`).

**File**: `src/stores/tasks/taskPersistence.ts`

---

### ~~BUG-029~~: Duplicate Canvas Groups Created on Load (✅ DONE)
**Priority**: P1-HIGH
**Reported**: January 8, 2026
**Fixed**: January 8, 2026

**Problem**:
Multiple "Friday" groups (and other smart groups) created each time canvas loaded, leading to 11+ groups when there should only be 8.

**Root Cause**:
Race condition in `ensureActionGroups()` - function ran before sections loaded from localStorage, so it didn't find existing groups and created new ones.

**Fixes Applied**:
1. Added retry loop (10x100ms) to wait for sections to load in `useCanvasSmartGroups.ts`
2. Added case-insensitive group name matching
3. Removed duplicate `loadFromDatabase()` call in `canvas.ts` initialize function
4. Cleaned up existing duplicate groups from localStorage

**Files**:
- `src/composables/canvas/useCanvasSmartGroups.ts`
- `src/stores/canvas.ts`

---

### ~~TASK-116~~: Smart Group Drop Should Update Task Due Date Instantly (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Moving a task to a smart group (Today, Tomorrow, This Week, etc.) now instantly updates the task's properties without requiring a page refresh.

**Problem Fixed**:
- User moved task to "Tomorrow" group but dueDate didn't update visually until refresh
- Hash-based watcher only watched `title:status:priority`, not `dueDate`
- NodeUpdateBatcher used 16ms delay for 'normal' priority updates

**Root Cause**:
The watcher in `CanvasView.vue` (line ~1835) only watched title, status, and priority changes. dueDate changes weren't triggering UI sync. Additionally, the batcher priority was 'normal' (16ms delay) instead of 'high' (instant).

**Fixes Applied**:
- [x] Added `dueDate` and `estimatedDuration` to hash-based watcher in CanvasView.vue
- [x] Changed batcher priority from 'normal' to 'high' for instant feedback
- [x] Added missing 'later' case to `moveTaskToSmartGroup` (clears dueDate)
- [x] Added 'duration' case to drag-drop handler for duration keywords (Quick, Short, Medium, Long)

**New Feature - Nested Group Inheritance**:
When dropping a task on a group that is inside another group, the task now receives properties from ALL containing groups.

Example: "High Priority" group inside "Today" group → task gets both `priority: high` AND `dueDate: today`

**Implementation**:
- [x] `getAllContainingSections()` - Finds all sections containing a point, sorted by size (largest first)
- [x] `getSectionProperties()` - Extracts properties from a single section (assignOnDrop, keyword detection, or legacy)
- [x] `applyAllNestedSectionProperties()` - Merges and applies properties from all containing sections
- [x] Console logs `🎯 [NESTED-GROUPS] Applying properties from X sections:` for debugging

**All Power Group Keywords Now Working**:
| Category | Keywords |
|----------|----------|
| Date | today, tomorrow, this weekend, this week, later |
| Priority | high, medium, low |
| Status | todo, active, done, paused |
| Duration | quick (15m), short (30m), medium (1h), long (2h), unestimated (0) |

**Files Changed**:
- `src/views/CanvasView.vue` - Watcher hash + priority
- `src/composables/canvas/useCanvasDragDrop.ts` - Nested groups + duration handler
- `src/stores/tasks/taskOperations.ts` - Added 'later' case

</details>

<details>
<summary><b>Rollback & Reference</b></summary>

**Stable Baseline**: `93d5105` (Dec 5, 2025)
**Tag**: `v2.2.0-pre-mytasks-removal`

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
</details>
