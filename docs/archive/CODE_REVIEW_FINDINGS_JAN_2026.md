# FlowState: Code Review Findings Archive - January 2026

> **Source**: Historical code review sections archived from `docs/MASTER_PLAN.md`
> **Purpose**: Preserve code review findings and health sprint documentation
> **Last Updated**: January 26, 2026

---

## Code Review Findings (January 9, 2026)

> Comprehensive multi-agent code review identified 7 new issues. Related todo files in `todos/019-025-*.md`.

### ~~TASK-164~~: Create Agent API Layer (WON'T DO)

**Priority**: P3-LOW
**Status**: WON'T DO
**Created**: January 9, 2026
**Removed**: January 14, 2026

**Problem**: No formal agent/tool API layer exists. Zoom controls require Vue context and aren't agent-accessible.

**Resolution**: Removed - the proposed `window.__flowstateAgent` pattern is too simple to be meaningful. Playwright already covers testing needs. If AI integration becomes a goal, MCP (Model Context Protocol) would be the proper foundation, not a thin CRUD wrapper.

---

### BUG-151: Tasks Render Empty on First Refresh (DONE)

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

### BUG-152: Group Task Count Requires Refresh After Drop (DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Fixed**: January 9, 2026
**Additional Fixes**: January 9, 2026

**Problem**: When tasks were dropped into a group, the task count badge didn't update until a page refresh. Tasks also couldn't be moved immediately after being dropped, and couldn't be dragged outside of groups.

**Root Causes**:

1. `updateSectionTaskCounts` used `filteredTasks.value` which hadn't updated yet (async timing)
2. Multi-drag path had early return that skipped `updateSectionTaskCounts` entirely
3. No `nextTick` to wait for Vue reactivity to propagate store updates
4. **BUG-152A**: `syncNodes()` didn't include `taskCount` in comparison for existing section nodes
5. **BUG-152C**: `handleDrop()` called `setNodes(getNodes.value)` before v-model synced, reading stale state
6. **BUG-152D**: `extent: 'parent'` CONSTRAINED tasks to group bounds, preventing drag-out
7. **BUG-152E**: `syncNodes()` REPLACED `target.data = node.data` which broke `useNode()` reference tracking

**Fix Applied**:

- Made `updateSectionTaskCounts` async with `await nextTick()` before reading `filteredTasks`
- Added task count updates to multi-drag path (was missing)
- Await the async function at call sites
- **BUG-152A**: Added `taskCount` to comparison in `syncNodes()` so group counts update
- **BUG-152C**: Added `await nextTick()` before `setNodes()` to allow v-model sync
- **BUG-152D**: Removed `extent: 'parent'` - `parentNode` alone handles child-moves-with-parent
- **BUG-152E**: Changed to MUTATE individual properties (`target.data.taskCount = x`) instead of replacing the whole data object. This maintains the reference that `useNode()` is tracking in GroupNodeSimple.

**Files Changed**:

- `src/composables/canvas/useCanvasDragDrop.ts`
- `src/composables/canvas/useCanvasSync.ts`
- `src/composables/canvas/useCanvasEvents.ts`

---

### TASK-179: Refactor TaskEditModal.vue (Planned)

**Priority**: P2-MEDIUM
**Status**: PLANNING
**Goal**: Reduce file size (currently ~1800 lines) by extracting sub-components and logic.

---

### TASK-065: GitHub Release (PAUSED)

**Priority**: P3-LOW
**Status**: Paused

- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop & Mobile (PAUSED)

**Priority**: P3-LOW
**Status**: Paused

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

### TASK-110: New Branding: "Cyber Tomato" (PAUSED)

**Priority**: P2-MEDIUM
**Status**: Paused

- Design and implement new clean, minimal, cyberpunky "Cyber Tomato" icon set.
- Includes: Main logo, Tauri app icon, and favicon.

### TASK-108: Tauri/Web Design Parity (DONE)

**Priority**: P1-HIGH
**Status**: DONE (2026-01-23)

- Ensure the Tauri app design mimics 1-to-1 the web app design.

### TASK-165: AI Text Generation in Markdown Editor (PAUSED)

**Priority**: P3-LOW
**Status**: Paused
**Related**: ROAD-011 (AI Assistant)

Add AI-powered text generation to the Tiptap markdown editor. Custom implementation (not using Tiptap Cloud Pro).

**Proposed Features**:

- Custom Tiptap extension that calls Claude/OpenAI API
- Commands: "Complete", "Rewrite", "Summarize", "Expand", "Fix grammar"
- Stream responses directly into the editor
- Keyboard shortcut (Ctrl+Space or similar) to trigger AI menu

### TASK-112: Admin/Developer Role & UI Restrictions (DONE)

**Priority**: P1-HIGH
**Completed**: January 7, 2026

- [x] Implement `isAdmin` / `isDev` flags in `useAuthStore` or user metadata.
- [x] Create an "Admin Class" logic for privileged dashboard access.
- [x] Restrict `/performance` and other debug views to Admin users only.
- [x] Add "Developer Settings" section in the main settings.

---

## Code Review Findings (January 7, 2026)

> These issues were identified during comprehensive code review of uncommitted changes.

### TASK-123: Fix Canvas Reactivity Issues (DONE)

**Priority**: P1-HIGH
**Status**: Resolved

- [x] Fix UI updates not reflecting immediately without manual refresh.
- [x] Ensure `useTaskStore` state changes propagate correctly.
- [x] Optimize `CanvasView` computed properties and watchers.

### BUG-020: Drag Drop Position Resets (DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026

- [x] Prevent tasks from resetting position after drag operations.
- [x] Fix multi-node drag position stability.
- [x] Ensure `isNodeDragging` and `isDragSettling` are correctly managed.

### BUG-021: Group Resize Limit (DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Users could not resize groups larger than 2000px, which was insufficient for large projects.
**Fix**: Increased maximum width/height limits to 50,000px in `GroupNodeSimple.vue`, `CanvasView.vue`, and `useCanvasResize.ts`.

### BUG-022: New Task Resets Existing Positions (DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Creating a new task caused existing tasks to jump or reset their positions due to strict sync logic.
**Fix**:

1. Added a tolerance check (2.0px) in `useCanvasSync.ts` to preserve existing visual positions if they are close.
2. **Crucial**: Updated `handleNodeDragStop` in `useCanvasDragDrop.ts` to update absolute positions of ALL child tasks when a section is dragged. This ensures the store stays in sync with visual relative movements.

### BUG-023: Editor UI Rendering Issues (DONE)

**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Problem**: Editor showed artifacts or black box due to excessive reactivity re-rendering the component while typing.

### BUG-024: Group Resize Task Stability (DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Resizing a group from the top/left edge caused child tasks to visually move or reset because the parent's origin shift wasn't correctly counteracted in the store.
**Fix**: Updated `handleSectionResizeEnd` in `CanvasView.vue` to explicitly calculate and persist the correct absolute position for all child tasks when the parent's origin changes, ensuring they remain stationary on the canvas.

### BUG-025: Unrelated Groups Move with Parent (Weekends)

**Priority**: P1-HIGH
**Status**: OPEN
**Problem**: Dragging a specific group (e.g., "Weekend") causes other unrelated groups to move as if they were children, despite not being visually inside it.
**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (Likely `parentGroupId` logic)
**Location**: `src/views/CanvasView.vue` line 1845

**Fix Applied**: Changed priority back to 'normal'. The 16ms batch delay (60fps) still feels instant but prevents performance issues when multiple tasks change rapidly.

**Subtasks**:

- [x] Changed priority from 'high' to 'normal'
- [x] Build verification passed

### TASK-125: Remove Debug Console.log Statements (REDUCED SCOPE)

**Priority**: P3-LOW
**Discovered**: January 7, 2026
**Updated**: January 15, 2026

**Problem**: Debug console.log statements in production code paths.

**Status Update (Jan 15, 2026)**:

- ~~`src/composables/canvas/useCanvasDragDrop.ts`~~ - File no longer exists (refactored)
- ~~`src/components/tasks/TaskEditModal.vue`~~ - Clean, no console.logs found
- `src/stores/tasks/taskOperations.ts` - 3 statements remain:
  - Lines 174, 184: `[GEOMETRY-*]` logs - **KEEP** (intentional drift detection per CLAUDE.md)
  - Line 672: Project move log - **Candidate for removal**

**Remaining Work**:

- [ ] Remove or wrap line 672 in `import.meta.env.DEV` check
- [ ] Verify no runtime issues

### BUG-022: Fix Zombie Edge UX

**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Problem**: Users cannot immediately re-create a connection they just deleted because `recentlyRemovedEdges` treats it as a "zombie" edge from a sync conflict and blocks it for 2 seconds.
**Solution**: Modify `handleConnect` to explicitly remove the edge ID from `recentlyRemovedEdges` when a user intentionally creates a connection, distinguishing it from an automated background sync.

### TASK-123: Consolidate Network Status Implementations (PLANNED)

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
  - [x] Analyze logs and source code
  - [x] Create implementation plan
  - [x] Make Realtime subscription more robust
  - [x] Verify fix
- [ ] Update all consumers to use consolidated version

### ~~BUG-027~~: Canvas View Frequent Remounting (NOT A BUG)

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

## Codebase Health Sprint (Jan 11, 2026)

Based on [Health Report 2026-01-11](../reports/health-report-2026-01-11.md).

---

### TASK-157: ADHD-Friendly View Redesign (PAUSED)

**Priority**: P3-LOW
**Started**: January 9, 2026
**Detailed Plan**: [docs/plans/adhd-redesign-task-157.md](../plans/adhd-redesign-task-157.md)

Redesign Board and Catalog views with Todoist-style compact design for ADHD-friendly UX.

**Problem**: Board (Kanban), List, and Table views are underused due to:

- Visual overload (TaskCard: 1,217 lines, 7-9 metadata badges)
- God components (HierarchicalTaskRow: 1,023 lines, 37+ event listeners)
- No external structure to guide focus (unlike Calendar/Canvas/Quick Sort)

**Solution**: Compact, Calm-by-default redesign with robust bulk operations.

**Phase 1: Foundation (Bulk Selection System)**

- [x] Implement `useBulkSelection.ts` (Selection Logic)
- [x] Implement `useBulkActions.ts` (Supabase Batch Updates)
- [x] Create `BulkActionBar.vue` (Floating UI)

**Phase 2: Compact Components**

- [ ] Create `TaskRowCompact.vue` (~150 lines, calm metadata)
- [ ] Create `KanbanCardCompact.vue` (~250 lines, no banners)

**Phase 3: Catalog View Redesign**

- [ ] Create `CatalogView.vue` (Unified List/Table)
- [ ] Create `CatalogHeader.vue` (Density/Sort controls)

**Phase 4: Polish & Integration**

- [ ] Add View Switcher to Sidebar
- [ ] Add keyboard shortcuts (x, Shift+Arrow, #, e)
- [ ] Verify large dataset performance (Virtualization check)

---

### TASK-095: TypeScript & Lint Cleanup (DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026

- [x] Detected and removed 7 dead files related to legacy PouchDB/Offline system.
- [x] Refactored `offlineQueue` types to `src/types/offline.ts`.
- [x] Reduced TypeScript errors from 71 to 14.

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

### BUG-144: Canvas Content Disappeared (DONE)

**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Resolution**: Added missing `<slot />` to `GroupNodeSimple.vue` enabling Vue Flow to render nested specific nodes.

### BUG-170: Self-Healing Destroys Group Relationships (ALREADY FIXED)

**Priority**: P1-HIGH
**Discovered**: January 9, 2026
**Status**: Already fixed in commit `d4350e6` (TASK-141 Canvas Group System Refactor)
**Problem**: `useCanvasSync.ts` was auto-clearing `parentGroupId` when a section's center was outside its parent's bounds.
**Evidence**: Current code at `useCanvasSync.ts:142-143` only logs a warning, does NOT auto-modify data.
**No action required** - the destructive auto-healing was removed during TASK-141 refactor.

### BUG-171: RLS Partial Write Failures Silent (FIXED)

**Priority**: P1-HIGH
**Completed**: January 9, 2026
**Problem**: When upserting multiple rows, if RLS blocks some but not all, the code silently succeeded with incomplete data.
**Root Cause** (from TODO-012):

- `saveTasks` already had proper check
- `saveProjects` had NO verification - silent data loss possible
  **Resolution**:
- [x] Added `.select('id')` to `saveProjects` to get returned data
- [x] Added `data.length !== payload.length` check to detect partial writes
- [x] Added `throw e` to re-throw errors so callers know save failed
  **Files Modified**:
- `src/composables/useSupabaseDatabaseV2.ts` - `saveProjects` function

### ~~TASK-138~~: Refactor CanvasView Phase 2 (Store & UI) DONE

**Priority**: P3-LOW
**Goal**: Clean up the store layer and begin UI decomposition.

### TASK-137: Refactor CanvasView.vue Phase 1 (DONE)

**Priority**: P1-HIGH
**Goal**: Reduce technical debt in the massive `CanvasView.vue` file by strictly extracting logic into composables without touching the critical Vue Flow template structure.

- [x] Extract filtering logic to `useCanvasFiltering.ts`.
- [x] Fix initialization order of `isInteracting`.
- [x] Extract event handlers to `useCanvasInteractionHandlers.ts`.
- [x] Verify no regressions in drag/drop or sync.

---

## January 20, 2026: Data Crisis & System Stabilization

**Priority**: P0-CRITICAL
**Status**: COMPLETE
**Crisis Analysis**: [reports/2026-01-20-auth-data-loss-analysis.md](../reports/2026-01-20-auth-data-loss-analysis.md)

On Jan 20, 2026, a major data crisis occurred where `auth.users` were wiped and backup systems failed to recover the data due to root causes in persistence and automation.

| ID | Issue | Root Cause | Status | Deep Context |
|----|-------|------------|--------|--------------|
| 1 | Auth wiped | No DB volumes | **Fixed** | Supabase restart lost `auth.users`; recreated with original UUID. |
| 2 | Seed missing | Partial `seed.sql` | **Fixed** | Added `endlessblink@gmail.com` with UUID `717f5209-42d8-4bb9-8781-740107a384e5`. |
| 3 | Shadow-mirror | Automation gap | **Partial** | Script exists but wasn't auto-running; now manually verified. |
| 4 | LocalStorage | Tauri ID mismatch | **Fixed** | Pointed to `com.flowstate.app` instead of `com.pomoflow.desktop`. |
| 5 | Role detector | String check bug | **Fixed** | Corrected `shadow-mirror.cjs` to check decoded payload for service role. |
| 6 | Password lost | Reset required | **Resolved** | Used temporary password for recovery. |
| 7 | Download stuck | Tauri Webview bug | **Workaround** | Manual extraction; native dialog fix planned in TASK-332. |
| 8 | Schema error | PostgREST Cache | **Fixed** | Service restart cleared schema cache issues. |
| 9 | Golden Offline | Conn. required | **Expected** | Feature requires Supabase connectivity for validation. |
| 10| Data mismatch | Local > Cloud | **Active** | 53 local tasks vs 42 cloud; reconciliation required. |

#### Roadmap Updates (Crisis Stabilization)

##### TASK-329: Auth & Data Persistence Hardening (DONE)
- [x] Implement `post-start` hook to verify `endlessblink` user exists.
- [x] Configure PostgreSQL data persistence in Docker volume more robustly.
- [x] Update `useSupabaseDatabase.ts` to retry auth on 401/403 with exponential backoff.

##### TASK-330: Shadow-Mirror Reliability & Automation (DONE)
- [x] Implement automatic `supabase stop --backup` hook via `scripts/db-stop.sh`.
- [x] Add `npm run shadow` trigger to `npm run dev` startup (via `backup:watch`).
- [x] Add cron-like monitoring to ensure `shadow.db` is updating every 5 minutes.
- [x] Add `auth.users` export via `docker exec` to `shadow-mirror.cjs` (Done).

##### ~~TASK-331~~: Tauri Multi-App Migration (LocalStorage) (OBSOLETE)
- ~~Create migration script to copy data from `com.pomoflow.desktop` to `com.flowstate.app`.~~ N/A
- ~~Update all persistence layers to use the unified app name.~~ N/A
- **Closed 2026-01-23**: Single-user app, old `com.pomoflow.desktop` directory deleted manually. No migration needed.

##### ~~TASK-332~~: Backup Reliability & Verification (DONE)
- [x] Fix Tauri native file dialog for "Download Backup" button.
  - Added path separator fix
  - Added 30s timeout to prevent XDG portal hangs
  - Browser fallback when Tauri methods fail
- [x] Implement Golden Backup rotation (keep last 3 peak task counts).
  - New storage key: `flow-state-golden-backup-rotation`
  - Backups sorted by task count descending
  - Legacy single-backup migration supported
  - UI shows all peaks with restore option for each
- [x] Add Automated Backup Verification tests (22 comprehensive tests).
  - Checksum validation
  - Data completeness
  - Edge cases (empty, corrupted)
  - Golden backup rotation
  - Suspicious data loss detection (BUG-059)
  - Restore analysis (TASK-344 dry-run)
  - Export/import round-trip

##### TASK-333: Independent Audit of Crisis Analysis (IN PROGRESS)
- [ ] Spawn independent QA Supervisor via `dev-maestro`.
- [ ] Verify consistency between documented fixes and codebase state.
- [ ] Review crisis report for any missing deep context or technical inaccuracies.

---

#### Related
- [TASK-317: Shadow Backup Deletion-Aware Restore](#task-317-shadow-backup-deletion-aware-restore--supabase-data-persistence-done)
- [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md)

---

## Undo/Redo Visual Feedback

### ~~TASK-140~~: Undo/Redo Visual Feedback (DONE)

**Priority**: P3-LOW (UX Enhancement)
**Discovered**: January 8, 2026
**Completed**: January 23, 2026
**Related**: Undo/Redo System Review

**Feature**: Show toast/notification when undo or redo is performed.

**Implementation**:
- Toast notifications via `showUndoRedoToast()` in `undoSingleton.ts`
- Setting `showUndoRedoToasts` in settings store (default: true)
- Toggle in Settings > Workflow > Feedback

**Completed**:

- [x] Show brief toast: "Undone: [action description]"
- [x] Show brief toast: "Redone: [action description]"
- [x] Auto-dismiss after 2.5 seconds
- [x] Option to disable in settings

---

## Canvas Duplicate Detection

### TASK-260: Authoritative Duplicate Detection Diagnostics (DONE)

Tasks/groups sometimes appear duplicated on the canvas (two visually identical nodes with the same `task.id`). This is NOT about the intentional "Duplicate task" feature - it's about automatic/unintended duplication where only one node should exist.

**Definition of "duplicate bug"**: Two or more Vue Flow nodes representing the same underlying `task.id` or `group.id`, where only one should exist unless the user explicitly used a "duplicate" feature.

**Solution Implemented**: Centralized `assertNoDuplicateIds()` helper in `src/utils/canvas/invariants.ts` with detection at every layer (Supabase load, realtime sync, store watcher, canvas selector, node builder). Race condition fix in `tasks.ts:updateTaskFromSync` prevents duplicate push.

**Status**: DONE (2026-01-23) - Canvas task/group duplication logging tightened. Duplicates no longer appearing.

---

*End of Code Review Findings Archive - January 2026*
