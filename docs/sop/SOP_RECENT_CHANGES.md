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

- **Verify Mobile Layout** (drag handles might need touch adjustments).
- **Monitor Sync**: Check if any other stores need auth guards.
