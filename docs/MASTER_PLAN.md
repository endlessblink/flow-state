# Pomo-Flow Master Plan & Roadmap

**Last Updated**: December 5, 2025
**Version**: 4.0 (Streamlined)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Current Status

| Area | Status |
|------|--------|
| **Canvas** | Working - All 7 bugs fixed |
| **Calendar** | Partial - Resize/ghost preview issues remain |
| **CouchDB Sync** | Phases 1-4 complete, manual sync working |
| **Build** | Passing |

**Branch**: `master`

---

## Ideas

- (add rough ideas here)

---

## Roadmap

### Near-term
| Feature | Priority | Notes |
|---------|----------|-------|
| Power Groups completion | P1 | Step 7 (testing) pending |
| Smart Group bug fixes | P1 | Bugs 3, 7/9 |
| Calendar resize fix | P2 | |
| Mobile support | P2 | Responsive layout, touch interactions |

### Later
| Feature | Notes |
|---------|-------|
| Auto-sync enablement | After multi-device testing |
| ~~Keyboard shortcuts~~ | ✅ DONE (Dec 5) - Delete, Redo (Ctrl+Y), New Task (Ctrl+N) |
| Technical debt Phase 3-5 | D&D, Database, Validation |
| Cyberpunk gamification | Tasks = XP, character progression, upgrades system |

---

## Active Work

### Power Groups Feature (COMPLETE)

**Goal**: Unify canvas groups into a single type where keywords trigger "power" behavior.

| Step | Description | Status | Rollback |
|------|-------------|--------|----------|
| 1 | Add `detectPowerKeyword()` to `useTaskSmartGroups.ts` | DONE | `git checkout HEAD -- src/composables/useTaskSmartGroups.ts` |
| 2 | Extend `CanvasSection` interface with power fields | DONE | `git checkout HEAD -- src/stores/canvas.ts` |
| 3 | Add power group functions to canvas store | DONE | Same as step 2 |
| 4 | Add `powerGroupOverrideMode` to UI store | DONE | `git checkout HEAD -- src/stores/ui.ts` |
| 5 | Update `CanvasSection.vue` with power mode UI | DONE | `git checkout HEAD -- src/components/canvas/CanvasSection.vue` |
| 6 | Add settings dropdown for override mode | DONE | `git checkout HEAD -- src/components/SettingsModal.vue` |
| 7 | Add power mode UI to `SectionNodeSimple.vue` | DONE | `git checkout HEAD -- src/components/canvas/SectionNodeSimple.vue` |
| 8 | Test with Playwright | DONE | N/A |

**Tested Dec 5, 2025**:
- Created "Today" group - power mode auto-detected
- Power indicator (lightning icon) visible in section header
- Collect button shows matching task count
- Dropdown menu with "Move tasks here" and "Highlight" options working
- Task successfully moved from inbox to power group
- Settings modal shows override mode dropdown

**Keywords Supported**:
- Date: `today`, `tomorrow`, `this week`, `this weekend`, `later`
- Priority: `high priority`, `urgent`, `medium priority`, `low priority`
- Status: `done`, `completed`, `in progress`, `backlog`

**Files Modified**:
- `src/composables/useTaskSmartGroups.ts` - Extended with power keywords
- `src/stores/canvas.ts` - Power group functions + interface changes
- `src/stores/ui.ts` - Override mode setting
- `src/components/canvas/CanvasSection.vue` - Power mode UI (not used in Vue Flow)
- `src/components/canvas/SectionNodeSimple.vue` - Power mode UI (actual component)
- `src/components/SettingsModal.vue` - Override mode dropdown in settings

---

### Smart Group Bugs (9 issues documented)

| Bug | Priority | Status |
|-----|----------|--------|
| Bug 1: Task disappears when set to yesterday | FIXED | `tasks.ts:1718-1729` |
| Bug 2: Canvas tasks disappear on new task creation | FIXED | `CanvasView.vue:589-618` |
| Bug 3: Today group shows wrong count | P1-HIGH | Pending fix in `canvas.ts:802-807` |
| Bug 7/9: Deleting group deletes tasks inside | P1-HIGH | Pending (1 hour) |
| Bug 4: Tasks in Today group don't drag | P2-MEDIUM | Needs investigation |
| Bug 5: Date not updating on group drop | P2-MEDIUM | Needs investigation |
| Bug 6: Week shows same count as Today | N/A | Not a bug - expected behavior |
| Bug 8: Ctrl+Z doesn't restore deleted groups | P3-LOW | Known limitation |

**Details**: See "Open Bug Analysis" section below.

### Calendar Issues (From Dec 1 checkpoint)

| Issue | Priority | Status |
|-------|----------|--------|
| Ghost preview wrong location | MEDIUM | TODO |
| Resize creates artifacts | HIGH | TODO |
| Resize broken (both sides) | HIGH | TODO |

**SOP**: `docs/debug/sop/calendar-drag-inside-calendar/`

---

## Known Issues

| Issue | Priority | Notes |
|-------|----------|-------|
| **Live sync lost on refresh** | P1-HIGH | See fix below |
| IndexedDB version mismatch errors | P2 | Needs proper DB migration |
| Safari ITP 7-day expiration | P2 | Detection exists, no mitigation |
| QuotaExceededError unhandled | P2 | Functions exist, not enforced |

### 🔴 NEXT SESSION: Live Sync Persistence Fix

**Problem**: Live sync is lost when page refreshes. User must manually re-enable it each time.

**Root Cause**: `liveSyncActive` state is not persisted to localStorage, and there's no auto-start on page load.

**Fix Required** (in `CloudSyncSettings.vue`):

1. **Save preference to localStorage** when toggling:
```typescript
// In toggleLiveSync()
localStorage.setItem('pomo-live-sync-enabled', liveSyncActive.value ? 'true' : 'false')
```

2. **Load and auto-start on mount**:
```typescript
// In loadSettings() or onMounted
const savedLiveSync = localStorage.getItem('pomo-live-sync-enabled')
if (savedLiveSync === 'true' && selectedProvider.value === 'couchdb') {
  // Auto-start live sync
  await reliableSyncManager.startLiveSync()
  liveSyncActive.value = true
}
```

**Files to modify**:
- `src/components/CloudSyncSettings.vue` - Add persistence
- Consider also auto-starting from `App.vue` for faster startup

---

## Dec 5, 2025 - Keyboard Shortcuts Implementation

### Completed Features

| Shortcut | Action | Location | Status |
|----------|--------|----------|--------|
| **Ctrl+N** | New Task (focus quick-add input) | Global | ✅ DONE |
| **Ctrl+Z** | Undo | Global | ✅ Already working |
| **Ctrl+Y** | Redo | Global | ✅ DONE |
| **Ctrl+Shift+Z** | Redo (alternative) | Global | ✅ Already working |
| **Delete** | Delete focused task | BoardView | ✅ DONE |
| **Delete** | Delete focused task | Inbox Panel | ✅ DONE |

### Files Modified

1. **`src/utils/globalKeyboardHandlerSimple.ts`**
   - Added Ctrl+N handler that dispatches `global-new-task` event
   - Ctrl+Y was already implemented

2. **`src/App.vue`**
   - Added `initGlobalKeyboardShortcuts()` call in onMounted
   - Added `global-new-task` event listener to focus quick task input
   - Added cleanup in onUnmounted

3. **`src/components/kanban/KanbanSwimlane.vue`**
   - Added `deleteTask` emit to propagate Delete key from TaskCard

4. **`src/views/BoardView.vue`**
   - Added `@deleteTask="handleDeleteTask"` handler
   - Shows confirmation dialog before deleting

5. **`src/components/base/UnifiedInboxPanel.vue`**
   - Added `tabindex="0"` to task cards for keyboard focus
   - Added `@keydown="handleTaskKeydown"` handler
   - Delete key deletes task directly with undo support

6. **`src/components/canvas/InboxPanel.vue`**
   - Same keyboard support added for consistency

### Testing Results
All shortcuts tested with Playwright MCP - all passed.

---

## 🔴 NEXT SESSION: Continue Quick Wins

### Priority Tasks

1. **C1 - Canvas Section Selection Dialog** (2h)
   - Create `SectionSelectorDialog.vue` component
   - Wire to `handleBulkAction()` in CanvasView.vue:4708-4710
   - Allow moving selected tasks to different sections

2. **D2 - Re-enable Backup Settings UI** (2h)
   - Remove `disabled` attributes from buttons in `SimpleBackupSettings.vue`
   - Wire to `useBackupRestoration` composable
   - Test full backup/restore flow

### Reference: Plan File Location
Full implementation plan available at: `/home/noam/.claude/plans/encapsulated-drifting-cray.md`

---

## Dec 5, 2025 - Sidebar Smart View Count Fixes

### Problem Summary
Sidebar counts (Today, This Week, All Active) showed incorrect values because App.vue had **duplicated counting logic** that was inconsistent with the centralized `useSmartViews` composable.

### Root Cause
App.vue (lines 589-684) had its own `todayTaskCount`, `weekTaskCount`, `allActiveCount` computed properties with different logic than `taskStore.smartViewTaskCounts`:

1. **weekTaskCount BUG**: Only checked `instances` and `scheduledDate`, **never checked `task.dueDate`**
2. **todayTaskCount**: Had correct logic but was duplicated (violates DRY)
3. **allActiveCount**: Duplicated simple logic

### Solution Applied
Replaced all duplicated counts with centralized store counts (App.vue lines 601-603):

```typescript
const todayTaskCount = computed(() => taskStore.smartViewTaskCounts.today)
const weekTaskCount = computed(() => taskStore.smartViewTaskCounts.week)
const allActiveCount = computed(() => taskStore.smartViewTaskCounts.allActive)
```

### Benefits
1. **Single source of truth** - All counts use `useSmartViews` composable
2. **Consistent behavior** - Sidebar and board filters use identical logic
3. **Less code** - Removed ~70 lines of duplicated, buggy code
4. **Future-proof** - Changes to count logic only needed in one place

### Files Modified
- `src/App.vue` - Replaced duplicated count logic with store references

### Verification
Tested with Playwright: Today=15, This Week=15, All Active=15 ✓

---

## Technical Debt Initiative

**Status**: Phase 2 in progress
**Scope**: 1,200+ competing systems across 6 categories

| Category | Conflicts | Status |
|----------|-----------|--------|
| Error Handling | 249 remaining | Phase 1 done (45 migrated) |
| Calendar Systems | 180+ | In progress |
| Database/Persistence | 320+ | Planned |
| Drag-and-Drop | 150+ | Planned |
| State Management | 200+ | Planned |
| Validation | 100+ | Planned |

**Full details**: See "Technical Debt" section below.

---

## Keyboard Shortcuts Roadmap

### Missing Critical Shortcuts

| Shortcut | Views Missing | Action |
|----------|---------------|--------|
| Delete | Inbox, AllTasks, Board | Delete selected task(s) |
| Shift+Delete | All except Canvas | Permanent delete |
| Ctrl+Y | Global | Redo |
| Ctrl+N | Global | Quick create task |
| Space | Task lists | Toggle complete |

**Full roadmap**: See "Keyboard Shortcuts" section below.

---

## Architecture Reference

### Views (7 total)
1. AllTasksView.vue
2. BoardView.vue
3. CalendarView.vue
4. CalendarViewVueCal.vue
5. CanvasView.vue
6. FocusView.vue
7. QuickSortView.vue

### Key Stores
- `tasks.ts` - Task management with undo/redo
- `canvas.ts` - Vue Flow integration
- `timer.ts` - Pomodoro sessions
- `ui.ts` - UI state

### Commands
```bash
npm run dev          # Port 5546
npm run kill         # Kill all processes
npm run build        # Production build
npm run test         # Run tests
```

---

## Archive

Completed fixes moved to: `docs/archive/completed-fixes-dec-2025.md`

---

## Open Bug Analysis: Canvas Smart Group Issues

### Bug 3: Today Group Shows Wrong Count

**Symptom**: "Today" shows task count badge but no tasks visible inside.

**Root Cause**: `canvas.ts` line 802-807 counts tasks by `dueDate` match but doesn't check for `canvasPosition`.

**Fix**:
```typescript
// canvas.ts lines 802-807
if (section.type === 'custom' && isSmartGroup(section.name)) {
  return allTasks.filter(task =>
    isTaskLogicallyInSection(task, section) &&
    task.isInInbox === false &&
    task.canvasPosition !== undefined  // ADD THIS
  )
}
```

**Risk**: LOW

---

### Bug 7/9: Deleting Group Deletes Tasks Inside

**Symptom**: Deleting a canvas group also deletes the tasks inside it.

**Root Cause**: Vue Flow auto-deletes child nodes when parent is deleted.

**Fix**: In `CanvasView.vue` `deleteGroup()`:
1. Save task nodes before deletion
2. Remove section node only
3. Clear parent relationship on tasks
4. Re-sync nodes

**Risk**: MEDIUM

---

### Bug 4 & 5: Investigation Needed

- Bug 4 (drag in groups): Check `node.parentNode` setup for smart groups
- Bug 5 (date not updating): Verify `getSmartGroupType()` returns correctly

---

## Technical Debt: Detailed Plan

### Phase 1: Error Handling (COMPLETE)
- 45 error locations migrated to unified `errorHandler.report()` API
- 6 core files: useDatabase, tasks, canvas, timer, ui, notifications
- 116 files deferred for organic migration

### Phase 2: Calendar Consolidation (IN PROGRESS)
- Unify 6 calendar files into single `useCalendar()` composable
- Target: ~1,000+ lines consolidated
- Files: useCalendarDayView, useCalendarMonthView, useCalendarWeekView, useCalendarEventHelpers, useCalendarDragCreate

### Phase 3-5: Planned
- Drag-and-Drop unification (18 implementations)
- Database layer consolidation (574 conflicts)
- Validation framework (4,199 conflicts)

---

## Sync Safety Architecture

### Current State

| System | Status |
|--------|--------|
| CouchDB Remote Sync | Pending (manual works) |
| Cross-Tab Sync | 100ms debounce active |
| Timer Sync | Leader election active |
| Deep Watchers | Optimized (hash-based) |
| Circuit Breaker | Ready |

### To Enable Auto-Sync
Prerequisites:
1. Manual sync works on both devices
2. Test from Linux AND Windows/Zen browser
3. Run 5-10 successful manual syncs

Then modify `src/config/database.ts`:
```typescript
sync: {
  live: true,
  retry: true,
  timeout: 30000,
  heartBeat: 10000,
}
```

---

## Keyboard Shortcuts: Gap Analysis

| View | Delete | Redo | Navigate | Complete | Edit | Timer |
|------|--------|------|----------|----------|------|-------|
| Canvas | Yes | No | Yes | No | Yes | Yes |
| Inbox Panel | No | No | No | No | No | Yes |
| AllTasks | No | No | No | No | No | No |
| Board | No | No | No | No | Yes | Yes |
| Calendar | No | No | No | No | No | No |
| QuickSort | No | Yes | No | No | No | No |

### Implementation Phases
1. **Delete Key Support** - All views
2. **Global Shortcuts** - Ctrl+Y, Ctrl+N
3. **Task Actions** - Space, E, T
4. **Navigation & Help** - Arrow keys, ? for help modal

---

## Rollback Reference

**Stable Baseline**: `93d5105` (Dec 5, 2025)

```bash
# Emergency rollback
git checkout 93d5105
npm run kill
npm run dev
```

**Tag**: `v2.2.0-pre-mytasks-removal` for My Tasks removal rollback

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
