# Completed Fixes Archive - December 2025

**Archived**: December 5, 2025
**Purpose**: Historical record of completed bug fixes and features

---

## Canvas Auto-Update Fix (Dec 4, 2025)

### Problem (SOLVED)
Two canvas operations didn't update automatically - users had to refresh to see changes:
1. **Drag from inbox to canvas** - Tasks didn't appear immediately
2. **Task edits on canvas** - Editing title/status/priority didn't update node visuals

### Root Cause Analysis

| Issue | Root Cause | Location | Status |
|-------|------------|----------|--------|
| Inbox drag fails | Cache hash only used task IDs, not `isInInbox` | `CanvasView.vue` line ~664 | FIXED |
| Task edits don't update | No watcher for title/status/priority changes | `CanvasView.vue` lines ~2024-2039 | FIXED |

### Fixes Applied

**Fix 1: Cache Hash Includes Mutable Properties**
```typescript
// BEFORE (broken):
const currentHash = currentTasks.map(t => t.id).join('|')

// AFTER (fixed):
const currentHash = currentTasks.map(t => `${t.id}:${t.isInInbox}:${t.status}`).join('|')
```

**Fix 2: Hash-Based Task Property Watcher**
```typescript
resourceManager.addWatcher(
  watch(
    () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|'),
    () => batchedSyncNodes('normal'),
    { flush: 'post' }
  )
)
```

### Commits
- `d41c834` - Cache hash fix and property watcher

---

## Sidebar Filter System Fix (Dec 5, 2025)

### Problems Solved
1. **Canvas ignored sidebar filters** - Smart views (Today, Week) had no effect on Canvas
2. **dueDate changes didn't update filters** - Changing task date to tomorrow kept it in Today
3. **This Week count always 0** - When Today had 3 tasks, This Week showed 0

### Root Causes

| # | Issue | Root Cause | Location |
|---|-------|------------|----------|
| 1 | `isWeekTask` early return | `return instances.some(...)` instead of `if (some(...)) return true` | `useSmartViews.ts:108-117` |
| 2 | Canvas bypasses filters | Used raw `taskStore.tasks` instead of `filteredTasks` | `CanvasView.vue:605` |
| 3 | Canvas cache stale | Hash excluded `dueDate`, so date changes didn't invalidate cache | `CanvasView.vue:610` |
| 4 | Duplicate week logic | `useSidebarManagement.ts` had own week filter missing `createdAt` check | `useSidebarManagement.ts:153-198` |

### Files Modified
- `src/composables/useSmartViews.ts` - Fixed early return in `isWeekTask`
- `src/views/CanvasView.vue` - Uses `filteredTasks`, added `dueDate` to cache hash
- `src/composables/app/useSidebarManagement.ts` - Added `createdAt` check to match `isWeekTask`

---

## QA Issues Fix (Dec 4, 2025)

### Issues Fixed

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Canvas phantom click events | CRITICAL | `CanvasView.vue:3010` - event handler doesn't catch section headers |
| 2 | Canvas performance loop | CRITICAL | `CanvasView.vue:2006-2054` - 6 watchers with `deep:true` causing cascade |
| 3 | Quick Sort false completion | HIGH | `useQuickSort.ts:15-33` - mutates store state inside computed property |
| 4 | Inconsistent project naming | MEDIUM | `TaskList.vue:98` - hardcoded "Unknown Project" vs "Uncategorized" |
| 5 | Canvas shows 0 tasks after data reload | CRITICAL | `tasks.ts:381-389` - migration only ran for `isInInbox === undefined`, not `true` |

### Files Modified
- `src/views/CanvasView.vue` - Issues 1, 2
- `src/composables/useQuickSort.ts` - Issue 3
- `src/components/TaskList.vue` - Issue 4
- `src/stores/tasks.ts` - Issue 5 (migrateInboxFlag + importTasksFromJSON)

---

## Feature Restoration - 4 User-Reported Issues (Dec 4, 2025)

| Fix | Status | Description |
|-----|--------|-------------|
| 1. QuickSort | DONE | Was already fixed in previous session |
| 2. Sidebar Colors | DONE | Azure colors for Today/Week/Tasks filters in App.vue |
| 3. Canvas Context Menu | DONE | Fixed excessive height with CSS :not() selector |
| 4. Unified Inbox | DONE | Both CalendarView and CanvasView now use UnifiedInboxPanel |

### Files Modified
- `src/assets/design-tokens.css` - Filter color tokens
- `src/components/DateDropZone.vue` - filterColor prop
- `src/App.vue` - Filter color props
- `src/views/CanvasView.vue` - Fixed context menu CSS, swapped to UnifiedInboxPanel
- `src/views/CalendarView.vue` - Swapped to UnifiedInboxPanel

---

## Canvas Task Visibility Bugs (Dec 4, 2025)

### Bugs Fixed

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Tasks created on canvas disappear immediately | CRITICAL | Changed canvas to use raw tasks, not filtered |
| 2 | Tasks from other views don't appear in canvas inbox | HIGH | Orphaned task repair |
| 3 | Sidebar counters don't match displayed tasks | MEDIUM | Expected behavior (completed tasks filtered) |
| 4 | Canvas uses separate InboxPanel instead of UnifiedInboxPanel | MEDIUM | Consolidated |
| 5 | Task disappears when moved from yesterday to Today group | CRITICAL | Reordered operations in handleSectionTaskDrop |
| 6 | Canvas VueFlow rendered off-screen after UnifiedInboxPanel | CRITICAL | CSS selector mismatch |
| 7 | Orphaned tasks invisible everywhere | CRITICAL | migrateInboxFlag repair + prevention |

### New Feature: Batch Selection & Delete
- **Ctrl+click** to select/deselect multiple tasks
- **Selection bar** with Delete and Clear buttons
- **Batch delete** with undo support
- **Location**: `src/components/base/UnifiedInboxPanel.vue`

---

## Canvas Recovery & Calendar Rebuild (Dec 4, 2025)

### What Happened (Dec 2-4)
After Dec 1 checkpoint, multiple commits broke canvas drag-drop functionality:
- Commit `55fb45d` (Dec 2): Bundled 557 lines of CanvasView.vue changes with calendar fixes
- Commit `2513465`: "fix: Add watchEffect for canvas initial task loading" - introduced issues

### Recovery Action
Restored to checkpoint `9bf480c` (Dec 1, 2025) which had verified working canvas.

### Key Learnings
- Commit `55fb45d` bundled calendar + canvas + cleanup = BAD PRACTICE
- Made rollback/cherry-pick impossible without breaking things
- Future: Separate concerns, test between commits

---

## Sidebar Filters Fix (Dec 1, 2025)

### Problem
1. Sidebar filter buttons did not clear project filter when clicked
2. "All Active" / "Uncategorized Tasks" should disable project filtering when clicked

### Fix Applied
Modified `src/App.vue` line 1046-1053:
```typescript
const selectSmartView = (view: 'today' | 'week' | 'uncategorized' | 'all_active') => {
  if (view === 'all_active' || view === 'uncategorized') {
    taskStore.setActiveProject(null)
  }
  taskStore.setSmartView(view)
}
```

---

## Canvas View Deep Debug (Dec 1, 2025)

### Issues Identified and Fixed

1. **Tasks Appearing in BOTH Canvas AND Inbox**
   - Root Cause: `CalendarInboxPanel.vue` line 228 redefined `isInInbox` to mean "any non-done task"
   - Fix: Respect actual `task.isInInbox` property

2. **Tasks Auto-Appearing on Canvas**
   - Root Cause: Wrong default in `taskCore.ts` line 40 (`isInInbox: false` instead of `true`)
   - Fix: Changed to `isInInbox !== false`

3. **Can't Delete Tasks from Canvas**
   - Root Cause: Context menu lacked delete for task nodes
   - Fix: Added delete action to context menu

### Files Modified
- `src/stores/taskCore.ts` - Fixed `isInInbox` default
- `src/components/CalendarInboxPanel.vue` - Respect actual `task.isInInbox` property
- `src/stores/canvas.ts` - Added explicit `isInInbox === false` checks
- `src/components/canvas/CanvasContextMenu.vue` - Added delete options

---

## Fix Test Infrastructure (Dec 1, 2025)

### Issues Fixed
1. **Syntax errors in phase2/*.spec.ts files**:
   - `comparison-tests.spec.ts:262` - Fixed unterminated string
   - `edge-cases.spec.ts:422` - Fixed unterminated string
   - `migration-validation.spec.ts:575` - Fixed missing parenthesis

2. **Calendar E2E selector mismatch**:
   - `e2e-comprehensive-functionality.spec.ts` - Updated to match actual DOM

### Results
- All syntax errors fixed
- `npx playwright test` runs without parse errors
- **18/18 core E2E tests pass**

---

## Remove "My Tasks" Permanent Filter (Dec 1, 2025)

**Commit**: `fc7dde1`

### Problem
The "My Tasks" permanent filter created unnecessary complexity by forcing a synthetic project (ID: '1', name: "My Tasks", emoji: '🪣') as a fallback.

### Outcomes
- Clean, intuitive project management without forced filters
- Users have full control over project structure
- Natural uncategorized task behavior (projectId: null)
- Simplified codebase with reduced complexity

---

## CouchDB Sync Re-enablement (Dec 4-5, 2025)

### Phases Completed

**Phase 1: Vue Watcher Fixes**
- Removed safeSync() from deep watchers in `tasks.ts`
- Fixed Pinia auto-unwrap bug in `canvas.ts`
- Added 500ms debounce to broadcasts in `useCrossTabSyncIntegration.ts`
- Consolidated watchers in `useBackupManager.ts`

**Phase 2: Hard-Disable Removal**
- Removed hard-disable blocks in `useReliableSyncManager.ts`
- Added 5s throttle between syncs

**Phase 3: CouchDB UI Integration**
- Added CouchDB option in Settings > Cloud Sync
- Configuration fields for Server URL, Username, Password
- Connection test with visual feedback

**Phase 4: Production Debugging**
- Fixed "Local database not initialized" error
- Fixed "cyclic object value" error
- Made validation non-blocking
- Configured CORS on remote server
- Split into separate push/pull with 15s timeouts

**Status**: Manual sync working, auto-sync pending multi-device testing

---

## Sync Data Reverts Fix (Dec 5, 2025)

### Root Cause
Push-Before-Pull was overwriting remote data:
1. PUSH local → remote (sends OLD local data)
2. PULL remote → local (gets back stale data)

### Fix Applied
Changed sync order to PULL FIRST, then PUSH:
1. PULL remote → local (get authoritative remote data FIRST)
2. PUSH local → remote (send any local changes)

### Additional Fixes
- Removed stale fallback files (`public/tasks.json`, `public/user-backup.json`)
- Reset remote CouchDB to clear corrupted data

---

## Error Handling Consolidation - Phase 1 (Dec 1, 2025)

### Infrastructure Created
- Enhanced `errorHandler.ts` with severity/category enums (~150 lines)
- Created `useErrorHandler.ts` composable (~100 lines)

### Files Migrated
| File | Error Locations |
|------|-----------------|
| `useDatabase.ts` | 13 |
| `tasks.ts` store | 10 |
| `canvas.ts` store | 6 |
| `timer.ts` store | 7 |
| `ui.ts` store | 1 |
| `notifications.ts` store | 8 |

**Total**: 6 core files, ~45 error locations migrated

### Deferred
- 116 remaining files for organic migration when touched
- High-priority: CanvasView.vue (171), useReliableSyncManager.ts (67)

---

## Sync Safety Architecture Phases (Dec 4, 2025)

| Phase | Name | Status | Commit |
|-------|------|--------|--------|
| 1 | Cross-Tab Batching | COMPLETE | `6266272` |
| 2 | Timer Leader Election | COMPLETE | `d8d8ab4` |
| 3 | Remove Deep Watchers | COMPLETE | `d8d8ab4` |
| 4 | Unified Sync Queue | COMPLETE | `c9bb70a` |
| 5 | Re-enable Live Sync | PENDING | - |
| 6 | Canvas Layout Fix | COMPLETE | `1f2f103` |

### Deep Watchers Fixed
| File | Before | After |
|------|--------|-------|
| `useCrossTabSyncIntegration.ts` | 3 deep | Hash-based |
| `stores/tasks.ts` | 3 deep | Action-based sync |
| `stores/timer.ts` | 3 deep | Leader sync |
| `CanvasView.vue` watchers | 6 deep | Hash-based |

---

*End of archive*
