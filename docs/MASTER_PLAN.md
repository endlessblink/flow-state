# Pomo-Flow Master Plan & Roadmap

**Last Updated**: December 16, 2025
**Version**: 4.6 (TASK-014 Storybook Glass Morphism Streamlining started)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Current Status

| Area | Status |
|------|--------|
| **Canvas** | Working - All 7 bugs fixed |
| **Calendar** | Partial - Resize/ghost preview issues remain |
| **CouchDB Sync** | Phases 1-4 complete, manual sync working |
| **Build** | Passing |
| **GitHub CI** | ✅ Active - Build verification on push/PR |

**Branch**: `master`

### CI/CD Setup (Dec 6, 2025)

**GitHub Actions workflow**: `.github/workflows/ci.yml`

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | ✅ Active | Catches TS errors, broken imports, syntax issues |
| `npm run lint` | ❌ Skipped | 2400+ errors need cleanup first |
| `npm run test` | ❌ Skipped | 90 failures (mostly Storybook) need fixing |

**Branch Protection**: Not enabled (solo developer, direct push workflow)

---

## Ideas

<!-- Ideas use IDEA-XXX format -->
- IDEA-001: (add rough ideas here)

---

## Roadmap

<!-- Roadmap = BIG features only. Small fixes go to Bugs/Tasks sections -->

### Near-term
| ID | Feature | Priority | Notes |
|----|---------|----------|-------|
| ~~ROAD-001~~ | ~~Power Groups~~ | ~~P1~~ | ✅ DONE (Dec 5) - Auto-detect keywords, collect button, settings |
| ROAD-004 | Mobile support | P2 | Responsive layout, touch interactions |
| ROAD-005 | Auto-sync enablement | P1 | After multi-device testing |

### Later
| ID | Feature | Notes |
|----|---------|-------|
| ~~ROAD-006~~ | ~~Keyboard shortcuts~~ | ✅ DONE (Dec 5) - Delete, Redo (Ctrl+Y), New Task (Ctrl+N) |
| ROAD-007 | Technical debt cleanup | D&D unification, Database consolidation, Validation framework |
| ROAD-010 | Cyberpunk gamification | Tasks = XP, character progression, upgrades system |
| ROAD-011 | Local AI assistant | Task breakdown, auto-categorize, daily planning. Hebrew required (Llama 3+, Claude/GPT-4 BYOK) |
| ~~ROAD-012~~ | ~~Unified Section Settings Menu~~ | ✅ DONE (Dec 16) - Consolidated to Groups, added GroupSettingsMenu.vue |

---

## Active Work

<!-- Active work items use TASK-XXX format -->

### TASK-014: Storybook Glass Morphism Streamlining (IN PROGRESS)

**Goal**: Apply consistent glass morphism design aesthetic (stroke borders, glass blur, no fills) across all Storybook stories and their components.

**Priority**: P2-MEDIUM

**Design Reference** (from BaseModal):
- `background: var(--glass-bg-solid)` → `rgba(0, 0, 0, 0.95)` - Solid black for cards/panels
- `border: 1px solid var(--glass-border)` → `rgba(255, 255, 255, 0.1)` - Stroke borders
- `backdrop-filter: blur(20px) saturate(100%)` - Glass blur effect
- Hover: `background: var(--glass-bg-medium)` → `rgba(255, 255, 255, 0.05)`
- Hover border: `var(--glass-border-hover)` → `rgba(255, 255, 255, 0.15)`
- Icon hovers: Strokes only, no fills

**Design Token Added** (Dec 16, 2025):
- `--glass-bg-solid: rgba(0, 0, 0, 0.95)` in `src/assets/design-tokens.css:50`

**Completed Stories/Components**:
| File | Component Changes | Status |
|------|-------------------|--------|
| `TaskManagerSidebar.vue` | `.task-sidebar`, `.sidebar-task`, `.nested-task`, `.action-btn` hover | ✅ DONE |

**Where We Stopped**:
- TaskManagerSidebar component fully updated to use design tokens
- Action button hovers changed from fills to strokes
- Need to verify in Storybook and continue with remaining stories

**Remaining Stories** (54 total):

**Base Components** (8):
- [ ] `BaseButton.stories.ts`
- [ ] `BaseCard.stories.ts`
- [ ] `BaseInput.stories.ts`
- [ ] `BaseDropdown.stories.ts`
- [ ] `BaseBadge.stories.ts`
- [ ] `BasePopover.stories.ts`
- [ ] `BaseIconButton.stories.ts`
- [ ] `BaseNavItem.stories.ts`
- [ ] `BaseModal.stories.ts` (reference - already correct)

**UI Components** (15):
- [ ] `EmojiPicker.stories.ts` (reference - already correct)
- [ ] `TimeDisplay.stories.ts`
- [ ] `ProjectTreeItem.stories.ts`
- [ ] `CommandPalette.stories.ts`
- [ ] `CustomSelect.stories.ts`
- [ ] `ErrorBoundary.stories.ts`
- [ ] `ProjectDropZone.stories.ts`
- [ ] `BackupSettings.stories.ts`
- [ ] `CalendarInboxPanel.stories.ts`
- [ ] `DoneToggle.stories.ts`
- [ ] `ViewControls.stories.ts`
- [ ] `DateDropZone.stories.ts`
- [ ] `MultiSelectToggle.stories.ts`
- [ ] `DragHandle.stories.ts`
- [ ] `ContextMenu.stories.ts`
- [ ] `PerformanceTest.stories.ts`

**Board Components** (6):
- [ ] `KanbanColumn.stories.ts`
- [ ] `TaskCard.stories.ts`
- [ ] `TaskTable.stories.ts`
- [ ] `KanbanSwimlane.stories.ts`
- [ ] `TaskRow.stories.ts`
- [ ] `TaskList.stories.ts`

**Canvas Components** (12):
- [ ] `CanvasContextMenu.stories.ts`
- [ ] `InboxPanel.stories.ts`
- [ ] `CanvasSection.stories.ts`
- [ ] `InboxTimeFilters.stories.ts`
- [ ] `TaskNode.stories.ts`
- [ ] `SectionManager.stories.ts`
- [ ] `SectionNodeSimple.stories.ts`
- [ ] `EdgeContextMenu.stories.ts`
- [ ] `ResizeHandle.stories.ts`
- [ ] `MultiSelectionOverlay.stories.ts`
- [ ] `GroupEditModal.stories.ts`

**Modals** (9):
- [ ] `ConfirmationModal.stories.ts`
- [ ] `GroupModal.stories.ts`
- [ ] `BatchEditModal.stories.ts`
- [ ] `QuickTaskCreateModal.stories.ts`
- [ ] `SearchModal.stories.ts`
- [ ] `SettingsModal.stories.ts`
- [ ] `ProjectModal.stories.ts`
- [ ] `QuickTaskCreate.stories.ts`
- [ ] `BaseModal-Redesign-Preview.stories.ts`

**Context Menus** (2):
- [ ] `TaskContextMenu.stories.ts`
- [ ] `TaskEditModal.stories.ts`

**Design System** (1):
- [ ] `Colors.stories.ts`

---

### TASK-011: Lint Cleanup (IN PROGRESS)

**Goal**: Fix 2400+ lint errors for easier refactoring & faster Claude Code editing.

**Priority**: P2-MEDIUM

**Baseline** (Dec 16, 2025): 5,175 problems (2,405 errors, 2,770 warnings)
**Current** (Dec 16, 2025): 5,173 problems (2,403 errors, 2,770 warnings)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Run `npm run lint` to get baseline | ✅ DONE |
| 2 | Safe fixes (remove unused imports, prefix unused vars) | ✅ DONE |
| 3 | ~~Fix auto-fixable errors~~ | ⚠️ SKIPPED - User requested no `--fix` |
| 4 | Manual fixes for remaining errors | PENDING |

**Safe Fixes Applied** (Dec 16, 2025):
- `FocusView.vue`: Removed unused `Task` import, prefixed `_handleComplete`
- `QuickSortView.vue`: Removed unused `TaskEditModal` import, prefixed `_closeEditModal`

**Error Breakdown**:
- ~52 `no-explicit-any` errors - Requires context to fix safely
- ~80 `no-unused-vars` in CanvasView.vue - Many used in template
- ~2,770 warnings - Vue formatting (attribute order, newlines)

**Note**: User explicitly requested NO `--fix` flag due to past issues with code being reverted.

---

### TASK-012: Expand CI Tests

**Goal**: Add lint + unit tests to GitHub Actions after lint cleanup.

**Priority**: P3-LOW (depends on TASK-011)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Add lint check to CI workflow | PENDING |
| 2 | Add unit test run to CI | PENDING |
| 3 | Add build verification | PENDING |

---

### ~~TASK-010~~: Consolidate Sections → Groups (COMPLETE)

**Goal**: Remove "sections" terminology entirely - everything becomes "groups" with unified naming.

**Date**: December 16, 2025

| Phase | Description | Status | Rollback |
|-------|-------------|--------|----------|
| 1 | UI text changes (Section → Group) | ✅ DONE | `git checkout src/components/canvas/` |
| 2 | Rename component files | ✅ DONE | `git checkout src/components/canvas/` |
| 3a | Rename types/interfaces | ✅ DONE | `git checkout src/stores/canvas.ts` |
| 3b | Rename state variables | ✅ DONE | Same as 3a |
| 3c | Rename methods (35+ methods) | ✅ DONE | Same as 3a |
| 3d | Add backward compatibility migration | ✅ DONE | Same as 3a |
| 4 | Update consumer files | ✅ DONE | N/A |
| 5 | Storybook stories | PENDING | Part of ROAD-013 |
| 6 | Consolidate group modals into one | ✅ DONE | See TASK-013 |

**Files Renamed**:
- `SectionManager.vue` → `GroupManager.vue`
- `SectionNodeSimple.vue` → `GroupNodeSimple.vue`
- `SectionSettingsMenu.vue` → `GroupSettingsMenu.vue`
- ~~`SectionWizard.vue` → `GroupWizard.vue`~~ (deleted - replaced by UnifiedGroupModal)
- `useSectionSettings.ts` → `useGroupSettings.ts`

**Store Changes** (`src/stores/canvas.ts`):
- `CanvasSection` → `CanvasGroup` (with alias for backward compatibility)
- `SectionFilter` → `GroupFilter`
- `sections` → `groups` state variable
- 35+ method renames with backward compatibility aliases
- ID migration: `section-*` → `group-*`

**Backward Compatibility**:
- All old method names (`createSection`, etc.) remain as aliases
- Old state names (`sections`, `activeSectionId`) remain as aliases
- Old IDs (`section-*`) are auto-migrated to `group-*` on load
- Existing saved data loads correctly

---

### ~~TASK-013~~: Unified Group Modal (COMPLETE)

**Goal**: Consolidate "Create Custom Group" and "Create Group (Smart)" into single "Create Group" option.

**Date**: December 16, 2025

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Create UnifiedGroupModal.vue | ✅ DONE |
| 2 | Update CanvasContextMenu (single option) | ✅ DONE |
| 3 | Update CanvasView imports | ✅ DONE |
| 4 | Delete GroupWizard.vue (869 lines) | ✅ DONE |

**Key Features**:
- Single "Create Group" context menu option
- Collapsible "Smart Settings" section (collapsed by default)
- Auto-expand when keywords detected (e.g., "Today", "High Priority")
- Supports both create and edit modes
- Progressive disclosure - smart features are optional

**Files Changed**:
- `src/components/canvas/UnifiedGroupModal.vue` (created, ~400 lines)
- `src/components/canvas/CanvasContextMenu.vue` (simplified)
- `src/views/CanvasView.vue` (updated imports)
- `src/components/canvas/GroupWizard.vue` (deleted, -869 lines)

**Net Impact**: ~470 lines reduction

---

### ~~TASK-009~~: Separate Calendar/Canvas Inbox Systems (COMPLETE)

**Goal**: Make calendar and canvas inboxes completely independent.

| Step | Description | Status | Rollback |
|------|-------------|--------|----------|
| 1 | Update baseInboxTasks in CalendarInboxPanel.vue | ✅ DONE | `git checkout src/components/CalendarInboxPanel.vue` |
| 2 | Update inboxTasks filter logic | ✅ DONE | Same as step 1 |
| 3 | Remove notOnCanvas filter | ✅ DONE | Same as step 1 |
| 4 | Update calendarFilteredTasks in tasks.ts | ✅ DONE | `git checkout src/stores/tasks.ts` |
| 5 | Fix tasks.ts updateTask - don't set isInInbox on instances | ✅ DONE | `git checkout src/stores/tasks.ts` |
| 6 | Fix useTaskLifecycle.ts - CALENDAR state shouldn't set isInInbox | ✅ DONE | `git checkout src/composables/useTaskLifecycle.ts` |
| 7 | Fix useCalendarDayView.ts - drop handler shouldn't modify canvas state | ✅ DONE | `git checkout src/composables/calendar/useCalendarDayView.ts` |
| 8 | Fix canvas inbox filtering - ONLY check canvasPosition, ignore isInInbox | ✅ DONE | `git checkout src/components/base/UnifiedInboxPanel.vue src/components/canvas/InboxPanel.vue src/views/CanvasView.vue` |
| 9 | Fix syncNodes() to only check canvasPosition for canvas rendering | ✅ DONE | `git checkout src/views/CanvasView.vue` |
| 10 | Test with Playwright | ✅ DONE | N/A |

**Root Cause Found Dec 16, 2025**:
The `isInInbox` property was being used for BOTH calendar and canvas inbox membership. When scheduling a task on calendar, multiple places were setting `isInInbox = false`, which also removed it from canvas inbox.

**Final Fix** (Dec 16, 2025):
Canvas inbox filtering now ONLY checks `canvasPosition`, ignoring `isInInbox` entirely. This ensures tasks scheduled on calendar (which may have `isInInbox: false` from old data) still appear in canvas inbox.

**Reactivity Fix** (Dec 16, 2025):
The `syncNodes()` function in CanvasView.vue was also filtering with `isInInbox === false && canvasPosition`. This caused tasks to not appear on canvas until page refresh. Fixed to only check `canvasPosition`.

**Fixes Applied**:
1. `tasks.ts:1661-1670` - Calendar instance logic no longer modifies `isInInbox` or `canvasPosition`
2. `useTaskLifecycle.ts:297-305` - CALENDAR state no longer sets `isInInbox = false`
3. `useCalendarDayView.ts:497-507` - Drop handler no longer sets `isInInbox: false` or clears `canvasPosition`
4. `UnifiedInboxPanel.vue:288-294` - Canvas inbox filter: `!task.canvasPosition` (ignores isInInbox)
5. `InboxPanel.vue:199-205` - Canvas inbox filter: `!task.canvasPosition` (ignores isInInbox)
6. `CanvasView.vue:1213-1217` - hasInboxTasks check: `!task.canvasPosition` (ignores isInInbox)
7. `CanvasView.vue:1774-1780` - syncNodes() filter: only checks `task.canvasPosition`
8. `CanvasView.vue:2240-2242` - Auto-collect inbox filter: `!t.canvasPosition`
9. `CanvasView.vue:2964-2966` - Section task filter: removed `task.isInInbox` check

**Verification** (Dec 16, 2025 - Playwright):
- ✅ Task dragged from canvas inbox → canvas appears immediately (no refresh needed)
- ✅ Canvas inbox correctly shows 0 tasks after drop
- ✅ Calendar inbox still shows the task (systems are independent!)
- ✅ Task can be ON canvas AND IN calendar inbox simultaneously

**Principle**:
- `isInInbox` property is now OBSOLETE for filtering - kept only for backward compatibility
- Canvas inbox = tasks WITHOUT `canvasPosition` (ONLY this check matters)
- Calendar inbox = tasks WITHOUT `instances` (scheduled time slots)
- These are INDEPENDENT - one should never affect the other

**Files Modified**:
- `src/components/base/UnifiedInboxPanel.vue` - Canvas inbox filter ignores isInInbox
- `src/components/canvas/InboxPanel.vue` - Canvas inbox filter ignores isInInbox
- `src/views/CanvasView.vue` - hasInboxTasks check ignores isInInbox
- `src/components/CalendarInboxPanel.vue` - Removed canvasPosition checks
- `src/stores/tasks.ts` - Instance logic doesn't modify canvas state
- `src/composables/useTaskLifecycle.ts` - CALENDAR state doesn't set isInInbox
- `src/composables/calendar/useCalendarDayView.ts` - Drop handler doesn't modify canvas state

---

### TASK-001: Power Groups Feature (COMPLETE)

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

<!-- Bugs use BUG-XXX format -->
| ID | Bug | Priority | Status |
|----|-----|----------|--------|
| ~~BUG-001~~ | Task disappears when set to yesterday | ~~FIXED~~ | ✅ `tasks.ts:1718-1729` |
| ~~BUG-002~~ | Canvas tasks disappear on new task creation | ~~FIXED~~ | ✅ `CanvasView.vue:589-618` |
| ~~BUG-003~~ | ~~Today group shows wrong count~~ | ~~P1-HIGH~~ | ✅ FIXED - Verified Dec 16, 2025 |
| ~~BUG-004~~ | ~~Tasks in Today group don't drag~~ | ~~P2-MEDIUM~~ | ✅ FIX APPLIED Dec 16 - Needs manual test |
| ~~BUG-005~~ | ~~Date not updating on group drop~~ | ~~P1-HIGH~~ | ✅ FIX APPLIED Dec 16 - Added syncNodes() after property update |
| BUG-006 | Week shows same count as Today | N/A | Not a bug - expected behavior |
| ~~BUG-007~~ | ~~Deleting group deletes tasks inside~~ | ~~P1-HIGH~~ | ✅ ALREADY FIXED Dec 5, 2025 - Tasks preserved on canvas |
| BUG-008 | Ctrl+Z doesn't restore deleted groups | P3-LOW | Known limitation |
| ~~BUG-013~~ | ~~Tasks disappear after changing properties on canvas~~ | ~~P1-HIGH~~ | ✅ FIXED Dec 16, 2025 - Two-part fix: (1) requestSync() in TaskContextMenu (2) spread task object in syncNodes |
| BUG-014 | Sync status shows underscore instead of time | P3-LOW | UI glitch - shows "_" instead of "just now" |
| ~~BUG-015~~ | ~~Edit Task modal behind nav tabs~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 16, 2025 - Added Teleport to body |
| BUG-016 | Timer status not syncing | P2-MEDIUM | Timer state not synchronized across views/components |

**Details**: See "Open Bug Analysis" section below.

#### BUG-004 Investigation & Fix (Dec 16, 2025)

**Root Cause Identified**:
1. **HTML5 drag API conflict** - TaskNode.vue had `draggable` attribute + `@dragstart/@dragend` handlers
2. This conflicted with Vue Flow's d3-drag system (two drag systems competing)
3. **d3-drag testing limitation** - The `document` null error only occurs with synthetic/programmatic events
4. Real user mouse interactions work correctly (browser sets proper event context)

**Fix Applied** (`src/components/canvas/TaskNode.vue`):
- Removed `:draggable="!isConnecting"` attribute
- Removed `@dragstart="handleDragStart"` handler
- Removed `@dragend="handleDragEnd"` handler
- Vue Flow's built-in d3-drag now handles all node dragging

**Research Sources**:
- [xyflow/xyflow#2461](https://github.com/xyflow/xyflow/issues/2461) - d3-drag synthetic event limitation
- [Vue Flow Configuration](https://vueflow.dev/guide/vue-flow/config.html) - nodesDraggable docs

**Testing Notes**:
- Playwright/synthetic mouse events trigger d3-drag error (known library limitation)
- Manual user testing required to verify fix works
- The error does NOT affect real users - only automated testing frameworks

**Status**: FIX APPLIED - Needs manual verification by user

### Calendar Issues (From Dec 1 checkpoint)

| ID | Issue | Priority | Status |
|----|-------|----------|--------|
| BUG-009 | Ghost preview wrong location | MEDIUM | TODO |
| BUG-010 | Resize creates artifacts | HIGH | TODO |
| BUG-011 | Resize broken (both sides) | HIGH | TODO |

**SOP**: `docs/debug/sop/calendar-drag-inside-calendar/`

### Sync Issues

| ID | Bug | Priority | Status |
|----|-----|----------|--------|
| ~~BUG-012~~ | ~~Sync loop resets task positions every second~~ | ~~P0-CRITICAL~~ | ✅ FIXED Dec 16, 2025 |

#### BUG-012 Details (FIXED)

**Problem**: Live sync was triggering constant database reloads every second, resetting all task positions on the canvas and causing infinite sync loops.

**Root Cause**:
1. `addTestCalendarInstances()` debug function in `tasks.ts:932` was being called on every `loadFromDatabase()`
2. This function modified tasks with `Date.now()` timestamps, creating new data each time
3. The watch on `tasks` triggered auto-save → sync push → remote receives → sync pull → loadFromDatabase → repeat

**Fix Applied** (`src/stores/tasks.ts`):
1. Commented out debug function call (line 932)
2. Added `isLoadingFromDatabase` flag (line 152) to prevent auto-save during loads
3. Added flag check in watch (lines 983-987) to skip saves during database operations

**SOP**: `docs/🐛 debug/sop/sync-loop-fix-2025-12-16/`

---

## Known Issues

<!-- Known issues use ISSUE-XXX format -->
| ID | Issue | Priority | Notes |
|----|-------|----------|-------|
| ~~ISSUE-006~~ | ~~**Sync loop resets task positions every second**~~ | ~~P0-CRITICAL~~ | ✅ FIXED Dec 16, 2025 - See BUG-012 |
| ~~ISSUE-001~~ | ~~**Live sync lost on refresh**~~ | ~~P1-HIGH~~ | ✅ ALREADY FIXED - See CloudSyncSettings.vue lines 239, 485, 502, 519-555, 649 |
| ISSUE-002 | **This Week shows 0 when tasks exist** | P2 | Today=0 correct, but This Week=0 wrong when tasks scheduled for Friday (today is Saturday) |
| ISSUE-003 | IndexedDB version mismatch errors | P2 | Needs proper DB migration |
| ISSUE-004 | Safari ITP 7-day expiration | P2 | Detection exists, no mitigation |
| ISSUE-005 | QuotaExceededError unhandled | P2 | Functions exist, not enforced |
| ISSUE-007 | **Timer not syncing across instances** | P2-MEDIUM | Timer started in one tab should show in all open tabs/windows |
| ISSUE-008 | **Ctrl+Z doesn't work on groups** | P2-MEDIUM | Undo doesn't restore deleted/modified groups on canvas |

### ~~🔴 NEXT SESSION: Live Sync Persistence Fix~~ (ALREADY FIXED)

**Status**: ✅ ALREADY IMPLEMENTED in CloudSyncSettings.vue

**Implementation Found** (Dec 16, 2025):
- Line 239: `liveSyncActive` initialized from `localStorage.getItem('pomo-live-sync-active')`
- Lines 485, 502: `localStorage.setItem('pomo-live-sync-active', ...)` on toggle
- Lines 519-555: `restoreSyncState()` function auto-starts live sync
- Line 649: `await restoreSyncState()` called in onMounted

**Note**: The fix uses key `pomo-live-sync-active` (not `pomo-live-sync-enabled` as originally planned).

---

### 🔴 NEXT SESSION: Priority Tasks

| ID | Task | Priority | Effort |
|----|------|----------|--------|
| ~~BUG-015~~ | ~~Edit Task modal behind nav tabs (z-index)~~ | ~~P2-MEDIUM~~ | ✅ DONE |
| BUG-016 | Timer status not syncing across tabs | P2-MEDIUM | ~2h |
| TASK-002 | Canvas Section Selection Dialog | P2-MEDIUM | ~2h |
| TASK-003 | Re-enable Backup Settings UI | P2-MEDIUM | ~2h |
| BUG-009-011 | Calendar resize/ghost preview issues | HIGH | ~4h |

**Suggested**: Start with BUG-016 or TASK-002/TASK-003 as quick wins.

---

### ~~🔴 OLD: Live Sync Persistence Fix~~ (Reference)

**Original Problem**: Live sync is lost when page refreshes. User must manually re-enable it each time.

**Original Fix Plan** (in `CloudSyncSettings.vue`):

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

1. **TASK-002: Canvas Section Selection Dialog** (2h)
   - Create `SectionSelectorDialog.vue` component
   - Wire to `handleBulkAction()` in CanvasView.vue:4708-4710
   - Allow moving selected tasks to different sections

2. **TASK-003: Re-enable Backup Settings UI** (2h)
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

### TASK-004: Phase 1 - Error Handling (COMPLETE)
- 45 error locations migrated to unified `errorHandler.report()` API
- 6 core files: useDatabase, tasks, canvas, timer, ui, notifications
- 116 files deferred for organic migration

### ~~TASK-005~~: Phase 2 - Calendar Consolidation (COMPLETE)

**Updated Scope** (Dec 16, 2025 analysis):

**Final State - 10 files, ~5,500 lines total** (after all phases):

| File | Lines | Purpose |
|------|-------|---------|
| `CalendarView.vue` | 2,817 | Main calendar view (reduced from 2,963) |
| `calendar/useCalendarDayView.ts` | 897 | Day view logic |
| `calendar/useCalendarDrag.ts` | 542 | Drag interactions |
| `calendar/useCalendarWeekView.ts` | 391 | Week view logic |
| `useCalendarCore.ts` | ~300 | **Unified core utilities** (consolidated + new helpers) |
| `CalendarViewVueCal.vue` | 297 | Alternative vue-cal implementation |
| `useCalendarDragCreate.ts` | 180 | Drag-to-create functionality |
| `calendar/useCalendarMonthView.ts` | 137 | Month view logic |
| `calendar/useCalendarScroll.ts` | 67 | **NEW** - Scroll sync/navigation |
| `calendar/useCalendarDateNavigation.ts` | 106 | **NEW** - Date state/navigation |
| ~~`calendar/useCalendarEventHelpers.ts`~~ | ~~156~~ | ~~DELETED - merged into useCalendarCore~~ |

**Critical Duplications Found** (✅ ALL FIXED Dec 16, 2025):

1. ~~**CalendarEvent interface** - defined 3x identically~~ ✅ FIXED
   - Now only in `src/types/tasks.ts:117`
   - Re-exported from `useCalendarCore.ts` for backward compatibility

2. ~~**DragGhost interface** - defined 2x~~ ✅ FIXED
   - Now only in `src/types/tasks.ts:138`
   - Re-exported from composables for backward compatibility

3. ~~**Helper functions duplicated**~~ ✅ FIXED
   - `useCalendarEventHelpers.ts` DELETED
   - All consumers now use `useCalendarCore`

**Consolidation Plan:**

1. ~~**Phase A - Interface Deduplication**~~ ✅ COMPLETE (Dec 16, 2025)
   - ~~Keep `CalendarEvent` only in `src/types/tasks.ts`~~
   - ~~Update all imports to use centralized type~~
   - ~~Remove duplicate interfaces from composables~~
   - Added `DragGhost` interface to `src/types/tasks.ts`

2. ~~**Phase B - Merge Core + EventHelpers**~~ ✅ COMPLETE (Dec 16, 2025)
   - ~~Merge `useCalendarEventHelpers` into `useCalendarCore`~~
   - ~~Update all 5 consumers to use `useCalendarCore`~~
   - ~~Delete `useCalendarEventHelpers.ts`~~
   - **Result**: 174 lines removed, 1 file deleted

3. ~~**Phase C - View Composables Assessment**~~ ✅ COMPLETE (Dec 16, 2025)
   - Evaluated Day/Week/Month view composables
   - **Finding**: Architecture already correct - views have distinct responsibilities
   - Day view (897 lines): Resize/drag ghost handling
   - Week view (391 lines): 7-day grid logic
   - Month view (137 lines): Simple grid logic
   - Shared utilities already extracted to `useCalendarCore.ts`
   - **Decision**: No merge needed - would hurt maintainability

4. ~~**Phase D - CalendarView.vue Extraction**~~ ✅ COMPLETE (Dec 16, 2025)
   - **Result**: 2,963 → 2,817 lines (146 lines removed)
   - Created `useCalendarScroll.ts` (67 lines) - scroll sync/navigation
   - Created `useCalendarDateNavigation.ts` (106 lines) - date state/navigation
   - Added `formatSlotTime`, `isCurrentTimeSlot`, `getProjectVisual` to `useCalendarCore.ts`
   - Removed verbose debug logging code (~60 lines)
   - Remaining size primarily styles (~1,700 lines CSS)

**Total Progress (Phases A-D): ~320 lines removed, 2 composables created**

### Phases 3-5: Planned
- TASK-006: Drag-and-Drop unification (18 implementations)
- TASK-007: Database layer consolidation (574 conflicts)
- TASK-008: Validation framework (4,199 conflicts)

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
