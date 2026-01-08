# SOP: Recent Changes & Fixes (Jan 2026)

**Date**: January 6, 2026
**Purpose**: Documentation of recent critical bug fixes, feature completions, and stability improvements implemented to resolve user-reported issues.

---

## 1. Critical Stability Fixes

### Fix: App Crash on Startup (`notifications.ts`)
- **Issue**: `ReferenceError: scheduledNotifications is not defined` prevented app from loading.
- **Root Cause**: `watch(scheduledNotifications, ...)` was trying to access a variable not yet defined in the local scope.
- **Solution**: Changed watcher to use `activeNotifications` (the local computed name).
- **Files**: `src/stores/notifications.ts`

### Fix: Sync Error Loop in Guest Mode
- **Issue**: "Sync Error" notifications appeared repeatedly for guest users.
- **Root Cause**: Auto-save watchers attempted to write to Supabase without checking authentication status.
- **Solution**: Added `if (!authStore.isAuthenticated)` guards to:
  - `projectStore.saveProjectsToStorage`
  - `taskPersistence.saveTasksToStorage`
  - `canvasStore.saveGroupToStorage`
- **Effect**: Guest users no longer trigger cloud sync errors.

---

## 2. Canvas Improvements

### Feature: Overdue Smart Group
- **Logic**: Automatically collects tasks that are:
  - Overdue (`dueDate` < today)
  - Not Done
  - Not Recurring
  - Have a `canvasPosition` (not in Inboxbox)
- **Implementation**: `useCanvasSmartGroups.ts`
- **Behavior**: Runs on canvas load to gather scattered overdue tasks into the "Overdue" group.

### Fix: Shift+Drag Selection
- **Issue 1**: Selection box was "stuck" if mouse left canvas.
- **Issue 2**: Could not select tasks *inside* groups visually.
- **Issue 3**: Starting drag on a group moved the group instead of selecting.
- **Solutions**:
  - Moved **Selection Box DOM** outside `<VueFlow>` to fix coordinate transforms.
  - Used **Window Event Listeners** for robust drag tracking.
  - Used **`computedPosition`** for absolute coordinate hit-testing of child nodes.
  - Disabled **Node Dragging** when Shift is held to prioritize selection.

### Fix: Task Removal from Canvas
- **Issue**: Removing a task (clearing `canvasPosition`) immediately reverted due to "Position Lock".
- **Solution**: Explicitly called `clearTaskLock(taskId)` when position is set to null in `taskOperations.ts`.

---

## 3. General Cleanup

### Legacy Code Removal
- **Deleted**: `src/stores/canvas/canvasData.ts` (Redundant legacy store)
- **Consolidated**: All canvas group logic moved to `src/stores/canvas.ts`.

---

## 4. Pending / Next Steps

- **Monitor Sync**: Check if any other stores need auth guards.

---

## 5. Fixes - Jan 8, 2026

### Feature: Friday/Saturday Action Groups
- **Context**: Replaced legacy "Weekend" smart group.
- **Implementation**:
  - `ensureActionGroups` creates separate "Friday" and "Saturday" groups if missing.
  - **Logic**: Dropping a task into these groups updates its `dueDate` to the *next upcoming* Friday or Saturday.
  - **File**: `useCanvasSmartGroups.ts`

### Fix: `saveUserSettings` Sync Error
- **Issue**: `Sync Error: [object Object]` / `duplicate key value violates unique constraint`.
- **Root Cause**: `upsert` without `onConflict` was trying to insert duplicate `user_id` rows.
- **Solution**: Added `{ onConflict: 'user_id' }` to the Supabase call.
- **Bonus**: Improved `handleError` to properly parse non-Error objects from Supabase.

### UX: Catalog View Filters
- **Change**: Moved "Hide Done Tasks" (eye icon) from `AllTasksView` to `ViewControls` component.
- **Benefit**: Consistent UI with other view controls (Sort, Density).

---

## 6. System Consolidation Audit - Jan 8, 2026

### TASK-144: Eliminate Duplicate Systems
**Goal**: One lean system for every aspect - no competing implementations.

### Created: Centralized Utilities
| File | Purpose |
|------|---------|
| `src/utils/geometry.ts` | Single source for containment detection (`isPointInRect`, `findSmallestContainingRect`, etc.) |
| `src/utils/durationCategories.ts` | Single source for duration definitions (`DURATION_THRESHOLDS`, `matchesDurationCategory`, etc.) |
| `docs/architecture/system-guide.md` | Decision trees for choosing the right system |

### Renamed: Clarity Improvements
| Old Name | New Name | Reason |
|----------|----------|--------|
| `useTaskSmartGroups.ts` | `usePowerKeywords.ts` | Avoids SmartView/SmartGroup confusion |
| `useCanvasSmartGroups.ts` | `useCanvasOverdueCollector.ts` | Clarifies actual purpose |

**Note**: Old paths re-export from new locations for backwards compatibility.

### Deprecated: usePerformanceMonitor
- **Status**: Not imported anywhere (dead code)
- **Action**: Added `@deprecated` JSDoc + runtime warning
- **Migration**: Use `usePerformanceManager` instead

### Deleted: Unused/Redundant Files
| File | Size | Reason |
|------|------|--------|
| `useContextMenuEvents.ts` | ~2KB | Consolidated into `useContextMenu.ts` |
| `useContextMenuPositioning.ts` | ~3KB | Consolidated into `useContextMenu.ts` |
| `inputSanitizer.ts` | 12KB | Enterprise-grade overkill; `simpleSanitizer.ts` kept |

### Result
- Single source of truth for: geometry, duration categories, sanitization, performance, context menus
- Clear naming conventions (Power Keywords vs Smart Views)
- System selection guide for developers
