# Archived Tasks - 2026-01

> **Source**: Archived from docs/MASTER_PLAN.md
> **Last Updated**: 16/01/2026

---


## January 16, 2026

### ~~TASK-301~~: Canvas Connection UX Improvements (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-16)

Enhanced canvas connection UX with visual feedback and drag-to-create workflow.

**Features Implemented**:

- [x] Connection handles visible on task nodes (top/bottom dots)
- [x] Handle glow on hover (blue for source, green for target)
- [x] Cable glow while dragging (pulsing blue animation)
- [x] Permanent edge glow (subtle blue glow on established connections)
- [x] Drag-to-create: drop connection on empty space → creates child task

**SOP**: [SOP-008-canvas-connection-ux.md](./sop/SOP-008-canvas-connection-ux.md)

---

---
### ~~TASK-297~~: Tomorrow Group Stale Due Date (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-16)

When a task is added to a "Tomorrow" smart group, the due date is set to tomorrow's date. If the task remains in the group for multiple days, the due date becomes stale.

**Resolution**: After discussion, determined that the existing **Overdue badge** (TASK-282) already handles this case sufficiently:

- When a task sits in Tomorrow group for 2+ days, it becomes overdue → red badge shows with reschedule options
- A separate "Due Today" badge was implemented but deemed unnecessary and visually noisy
- Tasks due TODAY are still on time - no special indicator needed

**Outcome**: No additional badge needed. The existing Overdue badge (red) covers the real problem case.

---

---
### ~~TASK-298~~: Documentation Phase 1 - Quick Fixes (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-15)

Quick fixes for documentation accuracy issues.

**Completed**:

- [x] Fixed CLAUDE.md (5 inaccuracies: composables, paths, line counts)
- [x] Fixed README.md (8 views, Vite 7.3.1)
- [x] Cleaned .env.example (removed Firebase config)
- [x] Deleted 11 obsolete files (\~6 MB freed)
- [x] Fixed SOP-005 naming collision → SOP-006

---

---
### ~~TASK-299~~: Canvas Auto-Center on Today Group (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-16)

On entering the canvas view, the viewport should automatically center on:

1. The "Today" smart group (if it exists and contains tasks)
2. Fallback: The last active area with tasks the user was working in

**Implementation Complete**:

- [x] Added `centerOnTodayGroup()` function to `useCanvasNavigation.ts`
- [x] Function detects Today group via power keyword detection (`detectPowerKeyword`)
- [x] Integrated into `useCanvasOrchestrator.ts` → `onMounted()` after sync completes
- [x] Fallback logic: First visit → busiest group; Return visit → Today or saved viewport
- [x] Build passes ✓

**Behavior**:

1. If user has a saved viewport (not first visit):
   - If Today group exists → center on Today group
   - Else → keep saved viewport position
2. If no saved viewport (first visit):
   - If Today group exists → center on Today group
   - Else → center on busiest group with tasks
   - Else → center on first task

**Files Modified**:

- `src/composables/canvas/useCanvasNavigation.ts` - Added `centerOnTodayGroup(forceFallback)` function
- `src/composables/canvas/useCanvasOrchestrator.ts` - Call `centerOnTodayGroup()` after initialization

---

---
### ~~TASK-295~~: Canvas Multi-Select with Shift+Drag (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ Done (2026-01-16)

Enable Shift + left click and drag inside groups to multi-select tasks on the canvas.

**SOP**: [SOP-006: Canvas Shift+Drag Selection Inside Groups](./sop/SOP-006-canvas-shift-drag-selection.md)

**Root Cause** (per [xyflow/xyflow#3041](https://github.com/xyflow/xyflow/issues/3041)):

- Vue Flow's `nodes-draggable` was `true` even when Shift held
- Task nodes blocked events with `pointer-events: auto`
- CanvasSelectionBox CSS used undefined variables

**Solution**:

- [x] `:nodes-draggable="!control && !meta && !shift"`
- [x] `:selection-on-drag="shift"`
- [x] CSS: ALL nodes have `pointer-events: none` when shift-selecting
- [x] Fixed `CanvasSelectionBox.vue` with rgba colors
- [x] Moved `CanvasSelectionBox` outside `<VueFlow>`

---

---
### ~~TASK-296~~: Remove Teal Selection Corner Indicators from Task Nodes (✅ DONE)

**Priority**: P3-LOW
**Status**: ✅ DONE (2026-01-16)
**SOP**: [`SOP-007-task-node-selection-indicators.md`](docs/sop/SOP-007-task-node-selection-indicators.md)

Teal corner squares were appearing on selected task nodes in the canvas. Users requested removal.

**Root Cause**:

- `TaskNodeSelection.vue` rendered 4 corner indicator divs with `--brand-primary` background
- Initially misidentified as Vue Flow Handle components

**Fix Applied**:

- [x] Removed selection corner elements from `TaskNodeSelection.vue`
- [x] Selection feedback now via `.selected` CSS class (border/glow) only
- [x] Bonus: Removed unused Handle components from `TaskNode.vue`
- [x] Bonus: Added defensive CSS rules to hide any Vue Flow handles on task nodes

**Files Modified**:

- `src/components/canvas/node/TaskNodeSelection.vue` - Removed corner indicators
- `src/components/canvas/TaskNode.vue` - Removed Handle components
- `src/assets/canvas-view-overrides.css` - Added handle hiding rules

**User Verified**: ✅ Confirmed working (2026-01-16)

---

---
### ~~TASK-287~~: Kanban Shadow Overflow Fix (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ Done (2026-01-15)

Fixed hover shadow/glow clipping on kanban task cards by using padding solution instead of overflow:visible.

**Problem**: The 20px hover glow (`--state-hover-glow`) was being clipped by `overflow-y: auto` on parent containers.

**Solution**:

- Set `padding: var(--space-6)` (24px) on `.tasks-container` to provide space for 20px shadow
- Updated `global-overrides.css` to apply same padding with `!important`
- Kept `overflow-y: auto` for scroll functionality

**Files Modified**:

- `src/components/kanban/KanbanColumn.css` - `.tasks-container` padding
- `src/assets/global-overrides.css` - override padding

**SOP**: [SOP-004: CSS Shadow/Glow Overflow Clipping Prevention](./sop/SOP-004-css-shadow-overflow-clipping.md)

---
### ~~TASK-283~~: Fix Drag-to-Group Date Assignment (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ Done (2026-01-14)

Dragging task to "Today" group should set dueDate even if group has other assignOnDrop settings.

**Solution**: Fixed `getSectionProperties()` in `useCanvasSectionProperties.ts` to ALWAYS detect power keywords from section name first, then let explicit assignOnDrop settings override. Previously it returned early if assignOnDrop existed, skipping date detection.

**Requirements**:

- [x] When task dropped on day-of-week group (Today, Monday, etc.), set task's dueDate
- [x] Should work regardless of group's other assignOnDrop settings
- [x] Preserve existing assignOnDrop behavior for non-date properties

---
### ~~BUG-286~~: Fix Kanban View Clipping (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ Done (2026-01-14)

Internal glows and outer shadows of task cards were being clipped by parent containers with `overflow-y: auto`.

**Solution**:

- Implemented "Negative Margin + Padding" trick in `global-overrides.css` on `.tasks-container`. This expands the internal horizontal boundary by 24px (`var(--space-6)`) for shadow bleed without shifting cards or increasing column widths.
- Elevated hovered cards with `z-index: 10` in `TaskCard.css` to prevent clipping by neighboring cards.
- Removed restrictive `overflow-x: auto` in `TaskCardBadges.vue` that clipped internal badge glows.

**Requirements**:

- [x] Prevent clipping of task card hover glows in Board View
- [x] Prevent clipping of metadata badge glows (project dots, etc.)
- [x] Ensure smooth visual transitions without layout shifts (Invisible fix)

---
### ~~TASK-282~~: Overdue Badge with Reschedule Popup (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ Done (2026-01-14)

Show "Overdue" badge on tasks; click opens date picker (Today/Tomorrow/Weekend/Custom).

**Implementation**:

- Created `OverdueBadge.vue` component with dropdown menu
- Added `isOverdue` computed in `useTaskNodeState.ts`
- Updated `TaskNodeMeta.vue` to show OverdueBadge when task is overdue
- Added `handleReschedule()` in `useTaskNodeActions.ts` for date updates

**Requirements**:

- [x] Add visual "Overdue" badge to tasks past due date
- [x] Click badge opens reschedule popup
- [x] Quick options: Today, Tomorrow, This Weekend, Next Week, Pick a date...

---

---
### ~~TASK-285~~: Multi-Device E2E Tests (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Completed**: January 14, 2026

- **Goal**: Verify race conditions across two simulated clients.
- **Outcome**: Tests implemented for Status Toggle and Drag & Drop. Skipped in CI due to environment limits, but logic verified manually.
- **Context**: Descoped from ROAD-013 to unblock release.

---
### ~~TASK-209~~: TypeScript & Test Suite Cleanup (✅ DONE)

**Priority**: P0-CRITICAL
**Started**: January 11, 2026
**Completed**: January 13, 2026
**Status**: ✅ DONE

**Problem Summary**: System analysis revealed 58 TypeScript errors, 63 failing tests, and 156 circular dependencies blocking clean builds and CI.

**Error Breakdown**:

| Category                        | Count      | Priority | Fix Prompt                                                                                                 |
| ------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Test Config (Vitest/Playwright) | 63 tests   | P0       | [01-FIX-TEST-CONFIGURATION.md](./prompts/architect-tasks-11.1.26-10-21/01-FIX-TEST-CONFIGURATION.md)       |
| Dead Imports                    | 7 errors   | P0       | [02-FIX-DEAD-IMPORTS.md](./prompts/architect-tasks-11.1.26-10-21/02-FIX-DEAD-IMPORTS.md)                   |
| Archive Exclusion               | 15 errors  | P1       | [03-FIX-ARCHIVE-EXCLUSION.md](./prompts/architect-tasks-11.1.26-10-21/03-FIX-ARCHIVE-EXCLUSION.md)         |
| Vue Flow Types                  | 6 errors   | P1       | [04-FIX-VUE-FLOW-TYPES.md](./prompts/architect-tasks-11.1.26-10-21/04-FIX-VUE-FLOW-TYPES.md)               |
| Calendar Components             | 8 errors   | P1       | [05-FIX-CALENDAR-COMPONENTS.md](./prompts/architect-tasks-11.1.26-10-21/05-FIX-CALENDAR-COMPONENTS.md)     |
| Inbox Components                | 4 errors   | P1       | [06-FIX-INBOX-COMPONENTS.md](./prompts/architect-tasks-11.1.26-10-21/06-FIX-INBOX-COMPONENTS.md)           |
| Task Components                 | 7 errors   | P1       | [07-FIX-TASK-COMPONENTS.md](./prompts/architect-tasks-11.1.26-10-21/07-FIX-TASK-COMPONENTS.md)             |
| Misc Components                 | 3 errors   | P2       | [08-FIX-MISC-COMPONENTS.md](./prompts/architect-tasks-11.1.26-10-21/08-FIX-MISC-COMPONENTS.md)             |
| Circular Dependencies           | 156 cycles | P2       | [09-FIX-CIRCULAR-DEPENDENCIES.md](./prompts/architect-tasks-11.1.26-10-21/09-FIX-CIRCULAR-DEPENDENCIES.md) |

**Execution Order**: [00-EXECUTION-ORDER.md](./prompts/architect-tasks-11.1.26-10-21/00-EXECUTION-ORDER.md)

**Phases**:

- [x] **Phase 1: Quick Wins** (20 min) - Fix test config, exclude archive
- [x] **Phase 2: Import Fixes** (30 min) - Remove dead imports
- [x] **Phase 3: Type Fixes** (2.5 hrs) - Vue Flow, Calendar, Inbox, Task components
- [x] **Phase 4: Structural** (2+ hrs) - Circular dependencies

**Sub-Tasks**:

- [x] Fix Vitest config to exclude `.spec.ts` files (Playwright)
- [x] Exclude `src/archive/**` from tsconfig
- [x] Fix Playwright config to exclude `.test.ts` files (Vitest)
- [x] Remove dead imports from `MarkdownExportService.ts` and `forensicBackupLogger.ts`
- [x] Fix Vue Flow type mismatches (`positionAbsolute`, `selected`)
- [x] Fix Calendar duplicate identifier errors
- [x] Fix Inbox priority type mismatches
- [x] Fix Task component prop errors
- [x] Reduce circular dependencies from 156 to 0

**Success Criteria**:

- [x] `npm run build` passes
- [x] `npx vue-tsc --noEmit` reports 0 errors
- [x] `npm test` passes all Vitest tests (Unit tests passing, safety tests passing)
- [ ] `npx playwright test` runs E2E tests separately

---

---
### ~~TASK-210~~: Documentation Consolidation & Cleanup (✅ DONE)

**Priority**: P2
**Started**: January 11, 2026
**Completed**: January 11, 2026
**Status**: ✅ DONE

**Summary**: Comprehensive documentation audit identified 2,493 files with outdated tech references (PouchDB instead of Supabase), duplicate content, and completed task documentation that should be archived.

**Actions Completed**:

- [x] Delete obsolete files (database.md, mapping-old/3.11.25/, PouchDB test)
- [x] Archive 19 completed SOPs to docs/sop/archived/
- [x] Archive 5 completed plans to plans/completed/
- [x] Update README.md, architecture.md, troubleshooting.md tech references
- [ ] Add "HISTORICAL" headers to outdated PRDs (deferred - low priority)

**Report**: `docs/DOCUMENTATION_CONSOLIDATION_REPORT.md`

---

---
### ~~TASK-184~~: Canvas System Rebuild (✅ DONE)

**Priority**: P0-CRITICAL
**Started**: January 10, 2026
**Status**: Phase 6 - Stabilization
**Updated**: January 10, 2026 - Deep Dive Assessment

**Original Problem**: Canvas system had \~22,500 lines of complex, over-engineered code.

**Current State (After Initial Refactor)**:

| Metric                | Before    | After       | Target      |
| --------------------- | --------- | ----------- | ----------- |
| CanvasView\.vue       | 2,098 LOC | 340 LOC ✅   | <400        |
| Composables           | 6,962 LOC | \~5,500 LOC | <4,000      |
| Console.log           | 133       | \~20        | 0           |
| `any` types           | 57        | \~10        | 0           |
| Position Lock Bandaid | 451 LOC   | 0 LOC ✅     | 0 (deleted) |

**Remaining Issues (Deep Dive Jan 10)**:

1. **Position Lock Bandaid** (451 LOC) - Masks sync race condition, NOT removed
2. **Empty Event Handlers** - `handleNodeDrag()`, `handleEdgeClick()` are no-ops
3. **Bug Workarounds** - 13 files with BUG-XXX/TASK-XXX comments still present
4. **Duplicated Logic** - Position calculation in 3 composables

**Implementation Prompt**: [docs/prompts/CANVAS-HARDENING-PROMPT.md](../prompts/CANVAS-HARDENING-PROMPT.md)

**Sub-Tasks**:

- [x] **TASK-198**: Implement Optimistic Sync (P0) - Replace position lock bandaid
- [x] **TASK-199**: Canvas Code Quality Pass (P1) - Remove console.log, fix remaining `any` types
- [x] **TASK-200**: Canvas Architecture Consolidation (P2) - Unify position/containment logic

---

---
### ~~TASK-198~~: Implement Optimistic Sync (✅ DONE)

**Priority**: P0-CRITICAL
**Depends On**: TASK-184
**Blocks**: TASK-199, Position stability
**Completed**: January 11, 2026

**Problem**: The 7-second position lock (`canvasStateLock.ts`, 451 LOC) was a bandaid masking sync race conditions.

**Solution**: Replaced lock with timestamp-based optimistic updates (`useCanvasOptimisticSync.ts`).

- **Mechanism**: Tracks local changes with timestamps. Discards remote updates if local change is newer.
- **Result**: Removed 451 LOC of complex locking logic.
- **Verification**: `vue-tsc` passing.

**Steps**:

- [x] Create `useCanvasOptimisticSync.ts`
- [x] Integrate with `useCanvasSync.ts`, `useCanvasTaskDrag.ts`
- [x] Test: drag → refresh → position persists (without 7s lock)
- [x] Delete `src/utils/canvasStateLock.ts` (-451 LOC)

**Files Modified**:

- `src/composables/canvas/useCanvasSync.ts`
- `src/composables/canvas/useCanvasNodeSync.ts`
- `src/composables/canvas/useCanvasTaskDrag.ts`
- `src/composables/canvas/useCanvasGroupDrag.ts`

**Files Deleted**:

- `src/utils/canvasStateLock.ts` (451 LOC)

---

---
### ~~TASK-199~~: Canvas Code Quality Pass (✅ DONE)

**Priority**: P1-HIGH
**Depends On**: TASK-198
**Blocks**: TASK-200
**Completed**: January 11, 2026

**Goal**: Clean up code quality issues identified in deep dive.

**Tasks**:

- [x] Fix compilation errors in `CanvasView.vue`, `useCanvasEvents.ts`
- [x] Remove remaining console.log statements (Removed 62 statements)
- [x] Fix remaining `any` type instances (Fixed 34 instances)
- [x] Clean 13 files with bug workaround comments (verify fixes, remove comments)

**Files with Most Issues**:

| File                          | Console.log | `any` Types |
| ----------------------------- | ----------- | ----------- |
| useCanvasSectionProperties.ts | 7           | 0           |
| useCanvasGroupActions.ts      | 7           | 0           |
| useCanvasTaskActions.ts       | 7           | 3           |
| useCanvasOrchestrator.ts      | 3           | 6           |
| useCanvasEvents.ts            | 0           | 5           |
| useCanvasSync.ts              | 2           | 5           |

---

---
### ~~TASK-200~~: Canvas Architecture Consolidation (✅ DONE)

**Priority**: P2-MEDIUM
**Depends On**: TASK-199
**Completed**: January 11, 2026

**Goal**: Eliminate duplicated logic and standardized patterns.

**Achievements**:

- Consolidated geometry logic into `src/utils/canvas/positionCalculator.ts`.
- Removed legacy `src/utils/geometry.ts` and `src/utils/canvasGraph.ts`.
- Updated all consumers (`useCanvasTaskDrag`, `useCanvasParentChild`, etc.) to use the central calculator.

**Tasks**:

- [x] Create `src/utils/canvas/positionCalculator.ts` - centralize coordinate transforms
- [x] Standardize containment: always use `isPointInRect` for tasks, `isNodeMoreThanHalfInside` for groups
- [x] Remove redundant helpers from individual composables
- [x] Updated all consumers to use centralized utilities

---

---
### ~~TASK-270~~: Manual ESLint Remediation (✅ DONE)

**Priority**: P1-HIGH
**Started**: January 13, 2026
**Status**: Done
**Completed**: January 13, 2026

**Goal**: Address `@typescript-eslint/no-unused-vars` and parsing errors across the codebase to improve code quality and maintainability.

**Progress**:

- [x] Batch 1: `src/utils` (Legacy & Core)
- [x] Batch 2: `src/composables`
- [x] Batch 3: `src/stores` & `src/views`
- [x] Batch 4: `src/components` (Completed)
- [x] Final Sweep: Layouts & Regressions (Fixed `any` types in `tasks.ts` and `canvas.ts`)

---

---
### ~~BUG-261~~: Group Modal Shows Blurry Background While Task Modal Doesn't (✅ DONE)

**Priority**: P2
**Status**: Done
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Bug**: When clicking "Create Group" from the empty canvas state, a blurry/visible background shows through the modal overlay. When clicking "Add Task", the background is properly obscured.

**Observed Behavior**:

- "Add Task" → Opens `QuickTaskCreateModal` (via `BaseModal`) → Background completely dark/blurred, no content visible
- "Create Group" → Opens `UnifiedGroupModal` (custom modal) → Background content (especially inbox panel on right side) still visible/blurry

**What's Been Tried**:

1. Removed `!modalsStore.isGroupModalOpen` condition from empty state visibility - No effect
2. Changed overlay opacity from `0.5` to `0.85` - Partial improvement
3. Added `backdrop-filter: blur(20px) saturate(100%)` matching BaseModal - Still not working

**Key Difference**:

- `QuickTaskCreateModal` uses `BaseModal.vue` wrapper component
- `UnifiedGroupModal` has its own custom modal implementation with Teleport

**Files Involved**:

- `src/components/canvas/UnifiedGroupModal.vue` - Custom modal with Teleport to body
- `src/components/tasks/QuickTaskCreateModal.vue` - Uses BaseModal wrapper
- `src/components/base/BaseModal.vue` - Standard modal with blur overlay
- `src/components/canvas/CanvasEmptyState.vue` - Empty state with both buttons
- `src/components/inbox/UnifiedInboxPanel.vue` - Has backdrop-filter blur(12px)

**Perplexity Debug Query**:

```
Vue 3 Teleport modal backdrop-filter blur not working compared to another modal in same app.

Context:
- Two modals in Vue 3 app, both should show dark blurred overlay
- Modal A (working): Uses BaseModal component wrapper, background fully obscured
- Modal B (broken): Uses Teleport to="body" directly, background content still visible through overlay
- Both have same CSS: background rgba(0,0,0,0.85) + backdrop-filter blur(20px)
- Modal B overlay covers viewport (position:fixed inset:0) but blur doesn't hide content

Questions:
1. Why would backdrop-filter blur work differently between two components with same CSS?
2. Does Vue Teleport affect backdrop-filter rendering or z-index stacking?
3. Could other elements with backdrop-filter (like an inbox panel) interfere?
4. Is there a CSS stacking context issue with Teleport vs normal component rendering?
5. Should Modal B use BaseModal wrapper instead of custom Teleport implementation?
```

**Research Findings** (from web search):

- `backdrop-filter` creates a new stacking context - elements inside can only blur within that context
- Parent elements with `transform`, `filter`, `will-change`, or `backdrop-filter` can interfere
- The inbox panel has `backdrop-filter: blur(12px)` which creates its own stacking context

**Root Cause Analysis**:

- `BaseModal` (task modal): **NO Teleport** - renders inside `#app`, backdrop-filter blurs everything in `#app` stacking context
- `UnifiedGroupModal`: **Uses Teleport to="body"** - renders OUTSIDE `#app`, different stacking context behavior
- The inbox panel's `backdrop-filter` may be creating interference

**Recommended Solution**: Refactor UnifiedGroupModal to use BaseModal wrapper (like QuickTaskCreateModal does) instead of custom Teleport implementation.

**Resolution**: Removed Teleport from UnifiedGroupModal - now renders as fixed-position overlay with z-index: 10000, avoiding stacking context issues. Both modals now have identical blur behavior.

**Sources**:

- [Why backdrop-filter Fails with Positioned Child Elements](https://medium.com/@aqib-2/why-backdrop-filter-fails-with-positioned-child-elements-0b82b504f440)
- [CSS stacking context issues with blur/transform](https://gist.github.com/vielhuber/e882f1f7c03f56d9bd70985fe4fe4a5d)
- [Vue Teleport documentation](https://vuejs.org/guide/built-ins/teleport.html)

---

---
### ~~TASK-288~~: Task Created at Right-Click Position on Canvas (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Created**: January 13, 2026

**Feature**: When creating a new task via right-click context menu on the canvas ("Create Task Here" or "Create Task in Group"), the task should appear exactly where the user clicked, not at the center of the canvas.

**Root Cause**:

- `handleCanvasRightClick` stored the click position in `canvasContextMenuX` and `canvasContextMenuY`
- But when the context menu emitted `createTaskHere`, no position was passed
- `createTaskHere` defaulted to center of canvas when no position provided

**Implementation (Phase 1 - createTaskHere)**:

- Created a wrapper function `createTaskHere` in `useCanvasOrchestrator.ts` that:
  1. Reads stored context menu position (`canvasContextMenuX`, `canvasContextMenuY`)
  2. Passes it to the underlying `actions.createTaskHere(screenPos)`
- Overrides the original `createTaskHere` in the return statement

**Regression Fix (2026-01-15 - createTaskInGroup)**:

- Original fix only addressed `createTaskHere`, not `createTaskInGroup`
- `createTaskInGroup` was ignoring the click position and always centering tasks in the group
- **Initial attempt** stored RELATIVE coordinates (position - groupX/Y), but this caused double-conversion
- **Root cause**: `canvasPosition` must store ABSOLUTE coordinates; node builder handles relative conversion for Vue Flow
- **Final fix**: Store ABSOLUTE flow coordinates in `canvasPosition`, clamp using absolute bounds

**Key Learning**: See `docs/sop/SOP-005-canvas-position-coordinates.md` for the coordinate system rules:

- `task.canvasPosition` = ABSOLUTE (stored in DB)
- Vue Flow node position with parent = RELATIVE (handled by node builder)
- Never manually convert to relative when setting `canvasPosition`

**Files Modified**:

- `src/composables/canvas/useCanvasOrchestrator.ts` - Added wrappers for both `createTaskHere` and `createTaskInGroup`
- `src/composables/canvas/useCanvasTaskActions.ts` - Fixed `createTaskInGroup` to store ABSOLUTE coordinates
- `src/utils/consoleFilter.ts` - Added `[TASK-288-DEBUG]` to whitelist for debugging

---

---
### ~~TASK-262~~: Click Empty Canvas Space to Deselect All (✅ DONE)

**Priority**: P2
**Status**: Done
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Feature**: When several tasks and groups are highlighted/selected on the canvas, clicking anywhere on empty canvas space should deselect (uncheck) all of them.

**Implementation**:

- `useCanvasEvents.ts`: `handlePaneClick` detects clicks on empty space (not nodes).
- Handles `ctrl/cmd` modifier to preserve selection.
- Sets `allowBulkDeselect` flag to permit Vue Flow's selection change event to proceed.
- `CanvasView.vue`: `handleSelectionChange` respects the `allowBulkDeselect` flag.

**Files to Modify**:

- `src/composables/canvas/useCanvasInteractions.ts` - Add pane click handler
- `src/views/CanvasView.vue` - Wire up the pane click event if not already

---

---
### ~~TASK-279~~: Double-Click Task on Canvas Opens Edit Modal (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Created**: January 13, 2026

**Feature**: Double-clicking a task on the canvas should open the task edit modal.

**Implementation**:

- Added `@node-double-click="handleNodeDoubleClick"` to VueFlow component in CanvasView\.vue
- `handleNodeDoubleClick` checks if the node is a taskNode and opens the edit modal via `handleEditTask()`
- Uses Vue Flow's native `NodeMouseEvent` type for proper typing

**Files Modified**:

- `src/views/CanvasView.vue` - Added `@node-double-click` handler and `handleNodeDoubleClick` function

---

---
### ~~TASK-275~~: Dev-Manager Complexity Pill (✅ DONE)

**Priority**: P2-MEDIUM
**Complexity**: Simple
**Status**: ✅ DONE
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Goal**: Add a complexity indicator badge to dev-manager kanban cards, similar to status/priority badges.

**Features**:

- Parse `**Complexity**:` line from MASTER\_PLAN.md
- Display complexity badge on kanban cards (Simple/Medium/Complex/Unknown)
- Allow inline editing via dropdown (like status/priority)
- Color coding: 🟢 Simple, 🟡 Medium, 🔴 Complex, ⚪ Unknown

**Implementation**:

- [x] Add complexity parsing to `parseMasterPlan()` in kanban/index.html
- [x] Add complexity badge display in card rendering (all views)
- [x] Add complexity dropdown for inline editing
- [x] Add API endpoint support for complexity updates
- [x] Add complexity to task modal editing
- [x] Fix dropdown positioning to prevent clipping

---

---
### ~~BUG-276~~: TipTap Editor Inline Formatting Inserts Markdown Syntax (✅ DONE)

**Priority**: P2-MEDIUM
**Complexity**: Medium
**Status**: ✅ DONE
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Root Causes Found & Fixed**:

1. **Bold/Italic race condition**: No debounce on `onUpdate` caused rapid HTML→Markdown→HTML conversions during typing
2. **Task List `[ ]` explosion**: Generic checkbox regex replaced ALL `<input type="checkbox">` elements before task items were properly processed

**Solution Implemented**:

- `TiptapEditor.vue`: Added 150ms debounce via `useDebounceFn`, added `isInternalUpdate` skip flag
- `markdown.ts`: Process TipTap TaskItem elements with `data-type="taskItem"` FIRST, then remove remaining checkbox inputs

**Verified Working** (Playwright tested):

- ✅ Bold - Creates proper `<strong>` elements
- ✅ Italic - Creates proper `<em>` elements
- ✅ Task Lists - Creates proper checkboxes (no `[ ]` explosion)
- ✅ Strikethrough - Creates proper `<s>` elements
- ✅ Formatting persists after save/reopen
- ✅ Formatting persists after save/reopen

---

---
### ~~BUG-281~~: Canvas Edge Missing Error (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: DONE
**Created**: January 14, 2026
**Completed**: January 14, 2026

**Problem**: Vue Flow threw "Edge source or target is missing" errors.
**Cause**: `syncEdges` was generating edges for all tasks in the store, including those hidden by filters (e.g., "Hide Done Tasks"). `syncNodes` was correctly filtering them out. This mismatch caused edges to point to non-existent nodes.
**Fix**: Updated `useCanvasEdgeSync.ts` to accept a filtered list of tasks and validated that both source and target exist in that list before creating an edge. Updated `useCanvasOrchestrator.ts` to pass `tasksWithCanvasPosition` to `syncEdges`.

---

---
### ~~BUG-278~~: Multi-Select Regression (TASK-262) (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: DONE
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Problem**: Ctrl+Click multi-selection stopped working visually. The logic was running but the visual state wasn't updating.
**Cause**: Regression from strict dependency cleanup. `applyNodeChanges` was missing from `useCanvasInteractions` initialization. Also, previous TASK-262 logic aggressively added to selection on single-click, causing confusion.
**Fix**: Injected `applyNodeChanges` from `useCanvasOrchestrator` into `useCanvasInteractions`. Reverted single-click behavior to standard "Replace Selection" to fix "multi-select without Ctrl" issue.

---

---
### ~~TASK-272~~: Debug App Flickering - Repeated HMR Cycles (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: DONE
**Created**: January 13, 2026
**Completed**: January 13, 2026

**Problem**: App is flickering randomly due to repeated Vite HMR (Hot Module Replacement) cycles. Console logs show constant re-initialization:

```
[vite] hot updated: /src/assets/styles.css
[vite] hot updated: /src/views/CanvasView.vue
🚀 [ORCHESTRATOR] onMounted starting...
```

This repeats every few seconds causing visual flickering and unnecessary re-renders.

**Suspected Causes**:

1. **syncTrigger reactive loop**: The cross-browser sync fix (`syncTrigger++`) may be creating a reactive cascade
2. **styles.css modification**: Something may be modifying styles.css which triggers cascading HMR
3. **Tab visibility changes**: Auth state changes on tab visibility triggering reloads

**Key Log Patterns**:

- `Tab visibility changed: visible → hidden → visible` triggers `Auth state changed: SIGNED_IN`
- Multiple `🔔 [ORCHESTRATOR] canvasStore.syncTrigger changed - forcing sync` in sequence
- `✨ [SMART-GROUP] Applying properties` happening repeatedly for same task

**Investigation Steps**:

- [x] Check if syncTrigger bump in `updateTaskFromSync` is causing sync loops → **FIXED**
- [x] Verify tab visibility handler isn't triggering unnecessary reloads → **FIXED** (logging gated to dev mode only)
- [x] Check if Smart-Group logic is constantly re-applying same properties → **FIXED**
- [x] Verify no file watcher is modifying styles.css → **PWA dev mode was causing extra HMR, disabled**

**Fixes Applied (2026-01-13)**:

1. `src/stores/tasks.ts` - Only bump `syncTrigger` if task actually changed (title, status, priority, dueDate, parentId, canvasPosition)
2. `src/composables/canvas/useCanvasInteractions.ts` - Smart-Group now checks if task already has the value before applying
3. `vite.config.ts` - Disabled PWA in dev mode (`devOptions.enabled: false`) to reduce HMR noise
4. `src/composables/useTabVisibility.ts` - Reduced console logging, gated to dev mode only

**Files to Investigate**:

- `src/stores/tasks.ts` - `updateTaskFromSync` syncTrigger bump
- `src/composables/canvas/useCanvasOrchestrator.ts` - syncTrigger watcher
- `src/composables/app/useAppInitialization.ts` - Tab visibility handling
- `src/composables/canvas/useCanvasSync.ts` - Smart group property application

---

---
### ~~TASK-258~~: Multi-Select Task Alignment Context Menu (✅ DONE)

**Priority**: P2
**Status**: DONE
**Created**: January 13, 2026
**Completed**: January 14, 2026

**Feature**: When right-clicking multiple selected tasks on the canvas, display a context menu with alignment options.

**Resolution**:

- Implemented `useCanvasAlignment.ts` with geometry invariant protection.
- Fixed visual sync issue by injecting manual `requestSync` trigger, bypassing orchestrator optimization (BUG-278 follow-up).

**Progress (2026-01-14)**:

**Progress (2026-01-13)**:

- [x] UI already implemented in `CanvasContextMenu.vue` with Layout submenu
- [x] Fixed `useCanvasAlignment.ts` to use ABSOLUTE positions (via `computedPosition`) for correct nested task alignment
- [x] Fixed to use `updateTask()` with `'DRAG'` source to respect geometry invariants (TASK-255)
- [x] Added batch undo support via `getUndoSystem().saveState()`
- [x] Build verified ✅
- [ ] Manual testing needed

**Best Practices Research (Figma/Sketch/Design Tools)**:

| Alignment Option            | Icon                         | Description                                         |
| --------------------------- | ---------------------------- | --------------------------------------------------- |
| **Align Left**              | `AlignLeft`                  | Align all items to the leftmost item's X position   |
| **Align Center (H)**        | `AlignCenterHorizontal`      | Align all items horizontally to the center          |
| **Align Right**             | `AlignRight`                 | Align all items to the rightmost item's X position  |
| **Align Top**               | `AlignStartVertical`         | Align all items to the topmost item's Y position    |
| **Align Middle (V)**        | `AlignCenterVertical`        | Align all items vertically to the middle            |
| **Align Bottom**            | `AlignEndVertical`           | Align all items to the bottommost item's Y position |
| **Distribute Horizontally** | `AlignHorizontalSpaceAround` | Equal horizontal spacing between items              |
| **Distribute Vertically**   | `AlignVerticalSpaceAround`   | Equal vertical spacing between items                |

**Implementation Notes**:

1. **Trigger**: Right-click when 2+ tasks are selected (Ctrl+Click multi-select)
2. **Context Menu**: Use existing `ContextMenu.vue` component pattern
3. **Alignment Calculation**:
   - Find bounding box of all selected items
   - Calculate target positions based on alignment type
   - Use `updateTask()` with `'DRAG'` source to respect geometry invariants
4. **Undo Support**: Batch all position changes into single undo action
5. **UI**: Use lucide icons (`AlignLeft`, `AlignCenterHorizontal`, `AlignRight`, etc.)

**Files Modified**:

- `src/composables/canvas/useCanvasAlignment.ts` - Fixed alignment to use absolute positions + DRAG source + batch undo
- `src/components/canvas/CanvasContextMenu.vue` - Already had Layout submenu (no changes needed)
- `src/views/CanvasView.vue` - Already wired up (no changes needed)

---

---
### ~~TASK-208~~: App-Wide Code Quality Refactoring (✅ DONE)

**Priority**: P3-LOW
**Status**: ✅ DONE (2026-01-15)
**Created**: January 11, 2026

**Goal**: Comprehensive application-wide code quality improvements identified during the canvas deep dive audit.

**Scope Summary**:

| Category                        | Current | Target   |
| ------------------------------- | ------- | -------- |
| Console statements (non-canvas) | 964     | <100     |
| `any` types (non-canvas)        | 255     | <200     |
| `@ts-ignore` (non-canvas)       | 7       | 0        |
| Components >500 LOC             | 25      | <10      |
| Largest store                   | 814 LOC | <300 LOC |
| Archive dead code               | 268KB   | 0        |

**Implementation Prompts**:
All detailed prompts are in `docs/prompts/refactoring-code_11.126-10-21/`:

| #  | Prompt                                                                                         | Priority | Effort  |
| -- | ---------------------------------------------------------------------------------------------- | -------- | ------- |
| 01 | [Archive Cleanup](./prompts/refactoring-code_11.126-10-21/01-ARCHIVE-CLEANUP.md)               | P0       | 5 min   |
| 02 | [Console.log Cleanup](./prompts/refactoring-code_11.126-10-21/02-CONSOLE-LOG-CLEANUP.md)       | P1       | 1-2 hrs |
| 03 | [Any Types Cleanup](./prompts/refactoring-code_11.126-10-21/03-ANY-TYPES-CLEANUP.md)           | P1       | 2-3 hrs |
| 04 | [Large Components Split](./prompts/refactoring-code_11.126-10-21/04-LARGE-COMPONENTS-SPLIT.md) | P2       | 4-6 hrs |
| 05 | [Store Refactoring](./prompts/refactoring-code_11.126-10-21/05-STORE-REFACTORING.md)           | P2       | 2-3 hrs |
| 06 | [@ts-ignore Fixes](./prompts/refactoring-code_11.126-10-21/06-TS-IGNORE-FIXES.md)              | P2       | 1 hr    |

**Master Index**: [00-INDEX.md](./prompts/refactoring-code_11.126-10-21/00-INDEX.md)

**High-Priority Files**:

- `undoSingleton.ts` - 48 console.log
- `supabaseMappers.ts` - 19 `any` types
- `useSupabaseDatabaseV2.ts` - 32 console.log + 19 `any` types
- `TaskContextMenu.vue` - 1,128 LOC (needs splitting)
- `canvas.ts` store - 814 LOC (needs modularization)

**Execution Phases**:

- [x] **Phase 1: Quick Wins** (1-2 hrs) - Console cleanup, @ts-ignore fixes <!-- id: 7 -->
- [x] **Phase 2: Code Quality** (3-5 hrs) - Type refinement, replace `any` (✅ DONE) <!-- id: 8 -->
- [ ] **Phase 3: Architecture** (6-8 hrs) - Component splitting, store modularization <!-- id: 9 -->

**Related Work**:

- TASK-189: System Tech Debt Audit (completed - identified these issues)
- TASK-199: Canvas Code Quality Pass (completed - canvas-specific cleanup)

---

---
### ~~TASK-182~~: Refactor useCanvasSync.ts (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>900 lines) and split synchronization logic into focused composables.
**Completed**: January 10, 2026
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)

**Solution**:

1. Extracted `useCanvasNodeSync.ts` (ViewModel Mapper).
2. Extracted `useCanvasEdgeSync.ts` (Edge Sync).
3. Simplified `useCanvasSync.ts` (Orchestrator).

---
### ~~TASK-185~~: Refactor UnifiedInboxPanel.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>1500 lines) and match the component structure of CalendarInboxPanel.
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)
**Completion Date**: 2026-01-10
**Solution**:

- Extracted `useUnifiedInboxState` and `useUnifiedInboxActions` composables.
- Created `UnifiedInboxHeader`, `UnifiedInboxInput`, `UnifiedInboxTaskCard`, `UnifiedInboxList` components.
- Reduced main component to <150 lines.

---
### ~~TASK-186~~: Refactor DragHandle.vue (✅ DONE)

**Priority**: P3-LOW
**Status**: DONE
**Goal**: Reduce file size (>1300 lines) and extract visual logic.
**Completion Date**: 2026-01-10
**Solution**:

- Extracted `DragHandleVisuals`, `DragHandleGhost`, `DragHandleHints`.
- Extracted `useDragHandleInteraction` and `useDragHandleState`.
- Reduced main component to <150 lines.

---
### ~~TASK-189~~: Refactor CanvasView\.vue (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Goal**: Consolidate 3.4k lines of logic into `useCanvasOrchestrator.ts`.
**Completed**: January 10, 2026
**Verification**: `tests/repro_zombie_movement.spec.ts` passing.

---
### ~~TASK-195~~: Timer System Refactor (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Fix performance issues, split monolithic sync composable, and remove console pollution.

- [x] Phase 1: Console removal (38 statements)
- [x] Phase 2: Fix store-in-computed anti-pattern
- [x] Phase 3: Extract time formatting utility
- [x] Phase 4: Split `useCrossTabSync.ts` into focused composables
- [x] Phase 5: Use VueUse `useIntervalFn`
- [x] Phase 6: Final integration and verification

---
### ~~TASK-193~~: Skill Consolidation (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Completion Date**: 2026-01-10
**Goal**: Reduce Claude Code skills from 78 to \~57 to fix skill matching issues caused by token truncation.
**Report**: [docs/process-docs/skill-consolidation\_10.1.26/skill-consolidation\_10.1.26.md](./process-docs/skill-consolidation_10.1.26/skill-consolidation_10.1.26.md)

**Problem**: Claude Code truncates skill list at \~56 skills due to token limits. With 78 skills, many specialized skills (like `vue-flow-debug`) are hidden and can't be automatically matched.

**Actions Completed**:

- [x] Merge `skills-manager` into `skill-creator-doctor`
- [x] Archive 10 duplicate skills (emoji vs non-emoji)
- [x] Archive 2 obsolete tech skills (PouchDB/IndexedDB focused)
- [x] Delete backup file and stray .md file
- [x] Merge Storybook skills (3→1)
- [x] Merge Auditor skills (3→1)
- [x] Merge Calendar skills (3→1)
- [x] Merge Cleanup skills (3→1)

**Results**: 78 → 57 skills (27% reduction, 21 skills archived)

**Archives**:

- `.claude/skills-archive/duplicates-20260110/` (10 skills)
- `.claude/skills-archive/obsolete-tech-20260110/` (2 skills)
- `.claude/skills-archive/storybook-merge-20260110/` (2 skills)
- `.claude/skills-archive/auditor-merge-20260110/` (2 skills)
- `.claude/skills-archive/calendar-merge-20260110/` (2 skills)
- `.claude/skills-archive/cleanup-merge-20260110/` (2 skills)
- `.claude/skills-archive/skills-manager-merged-20260110/` (1 skill)

---
### ~~TASK-188~~: Refactor DoneToggle.vue (✅ DONE)

**Priority**: P3-LOW
**Status**: DONE
**Goal**: Reduce file size (>1200 lines) by extracting visual logic (CSS/Animations) from interaction logic.
**Completion Date**: 2026-01-10
**Solution**:

- Extracted `DoneToggleVisuals`, `DoneToggleGhost`, `DoneToggleHints`.
- Extracted `useDoneToggleInteraction` and `useDoneToggleState`.
- Reduced main component to <150 lines.

---
### ~~TASK-187~~: Refactor HierarchicalTaskRow\.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Complex component with recursive logic.
**Completed**: January 13, 2026

**Solution**:

1. Extracted `HierarchicalTaskRow.css` for better style isolation.
2. Extracted `HierarchicalTaskRowContent.vue` to handle individual row rendering and interactions.
3. Simplified `HierarchicalTaskRow.vue` to act as a recursive orchestrator using `HierarchicalTaskRowContent`.
4. Ensured all event bindings (`updateTask`, `moveTask`, `duplicate`, etc.) are correctly bubbled up in recursive calls.

---
### ~~TASK-184~~: Refactor TaskNode.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>1100 lines) and match the component structure of TaskCard/TaskRow.
**Completed**: January 10, 2026
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)

**Solution**:

1. Extracted `useTaskNodeState.ts` (LOD/Visuals) and `useTaskNodeActions.ts` (Interactions).
2. Extracted Components:
   - `TaskNodeHeader.vue`
   - `TaskNodeDescription.vue`
   - `TaskNodeMeta.vue`
   - `TaskNodePriority.vue`
   - `TaskNodeSelection.vue`
3. Simplified `TaskNode.vue` (Orchestrator).

---
### ~~TASK-183~~: Refactor CalendarInboxPanel.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>900 lines) and extract sub-components.
**Completed**: January 10, 2026
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)

**Solution**:

1. Extracted `useCalendarInboxState.ts` (Filtering/Sort Logic).
2. Extracted Components:
   - `CalendarInboxHeader.vue`
   - `CalendarInboxInput.vue`
   - `CalendarInboxList.vue`
   - `CalendarTaskCard.vue`
3. Simplified `CalendarInboxPanel.vue` (Orchestrator).

---
### ~~TASK-181~~: Refactor HierarchicalTaskRow\.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>1000 lines) and extract logic/components to support TASK-157.
**Completed**: January 10, 2026
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)

**Solution**:

1. Extracted state to `useTaskRowState.ts`
2. Extracted actions to `useTaskRowActions.ts`
3. Created sub-components: `TaskRowTitle`, `TaskRowProject`, `TaskRowPriority`, `TaskRowActions`
4. Simplified `HierarchicalTaskRow.vue` layout.

---
### ~~TASK-180~~: Refactor TaskCard.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (>1200 lines) and extract logic/components to support TASK-157.
**Completed**: January 10, 2026
**Links**: Part of [ADHD View Redesign](#task-157-adhd-friendly-view-redesign-in-progress)

**Solution**:

1. Extracted state to `useTaskCardState.ts`
2. Extracted actions to `useTaskCardActions.ts`
3. Created sub-components: `TaskCardStatus`, `TaskCardMeta`, `TaskCardActions`
4. Simplified `TaskCard.vue` orchestrator.

---
### ~~TASK-179~~: Refactor TaskEditModal.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Goal**: Reduce file size (currently \~1800 lines) by extracting sub-components and logic.
**Completed**: January 10, 2026

**Solution**:

1. Extracted state management to `useTaskEditState.ts`
2. Extracted actions/saving logic to `useTaskEditActions.ts`
3. Created focused sub-components: `TaskEditHeader`, `TaskEditMetadata`, `TaskEditSubtasks`, `TaskEditDependencies`
4. Reduced `TaskEditModal.vue` to a clean orchestrator.

---
### ~~TASK-178~~: Refactor CanvasView\.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 10, 2026
**Completed**: January 10, 2026

**Problem**: `CanvasView.vue` was 3400+ lines (112KB), acting as a "God Component" managing too much state.

**Solution**:

1. Extracted `useCanvasModals` and `useCanvasContextMenus` for global UI state.
2. Refactored `CanvasModals.vue` and `CanvasContextMenus.vue` to use these composables directly.
3. Updated `useCanvasActions` to use global state, removing prop drilling.
4. Preserved all core Vue Flow integration logic.

---

---
### ~~TASK-189~~: System Tech Debt Audit (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 10, 2026
**Plan**: [plans/system-tech-debt-audit-2026-01-10.md](../plans/system-tech-debt-audit-2026-01-10.md)

Comprehensive tech debt audit of all major systems to identify problems before they become critical like the Canvas system.

**Systems Audited (7 total)**:

| System             | Score                   | LOC                  | Recommendation         |
| ------------------ | ----------------------- | -------------------- | ---------------------- |
| **Canvas**         | 3.0/10                  | 5,151                | REBUILD (in progress)  |
| ~~**Board View**~~ | ~~4.5/10~~ → **8.0/10** | ~~3,500+~~ → **732** | ✅ **DONE**             |
| **Calendar View**  | 5.5/10                  | 4,200+               | REFACTOR               |
| **Settings**       | 5.8/10                  | 1,883                | REFACTOR               |
| **Timer**          | 6.5/10                  | 2,503                | REFACTOR (focused)     |
| **Authentication** | 6.5/10                  | 2,363                | REFACTOR (UserProfile) |
| **Supabase Sync**  | 7.2/10                  | 1,800+               | MAINTAIN               |
| **Projects**       | 7.2/10                  | 1,800+               | MAINTAIN               |

**Key Findings**:

- Board View and Calendar View show same patterns as Canvas (god objects, deep watchers)
- 150+ console.log statements across codebase
- 16+ `as any` type casts (type safety violations)
- 6 deep watchers causing performance issues (timer fires 60x/min)
- 3 circular dependency risks
- Memory leaks in Calendar View (event listeners)
- Broken i18n in Settings system

**Implementation Roadmap**:

| Phase                        | Tasks                                                   | Effort     | Status                             |
| ---------------------------- | ------------------------------------------------------- | ---------- | ---------------------------------- |
| ~~**TASK-190: Quick Wins**~~ | Remove 150+ console.log, fix watchers, fix memory leaks | 8-12h      | ✅ **DONE** (2026-01-13)            |
| ~~**TASK-191: Board View**~~ | ~~Extract composables, reduce 835→200 LOC~~             | ~~24-32h~~ | ✅ **DONE** (732 LOC, 8.0/10)       |
| **TASK-192: Calendar View**  | Fix memory leaks, consolidate overlap calc              | 16-24h     | ✅ **DONE** (Refactored & Verified) |
| **Week 4: Type Safety**      | Store interfaces, remove `as any`, fix Settings         | 12-16h     | 📋 PLANNED                         |

---

---
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

---
### ~~BUG-208~~: Fix Canvas Group Deletion (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE
**Started**: January 11, 2026
**Completed**: January 13, 2026

**Root Cause**: State mismatch between local refs and Pinia store:

- `handleSectionContextMenu` and `handleNodeContextMenu` wrote to local refs in `useCanvasActions.ts`
- `CanvasContextMenus.vue` read from `useCanvasContextMenuStore` (Pinia store)
- These were never synced, so the context menu never appeared

**Fix Applied**:

- [x] `CanvasView.vue`: Now imports `useCanvasContextMenuStore` and uses `openCanvasContextMenu()`
- [x] `useCanvasActions.ts`: `handleNodeContextMenu` now calls the store instead of local refs
- [x] Removed unused local refs that caused confusion

**Verified**: Context menu opens correctly, "Delete Group" option works end-to-end (modal + deletion)

**Note**: Right-click event propagation through Vue Flow layers is a separate issue tracked in BUG-251.

---

---
### ~~BUG-251~~: Right-Click on Canvas Groups Not Triggering Context Menu (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Created**: January 13, 2026
**Completed**: January 13, 2026

Right-clicking directly on a group node in the Vue Flow canvas did not reliably trigger the context menu handler.

**Root Cause**: Vue Flow sets `visibility: hidden` inline on node elements until they are properly dimensioned by the resize observer. For section nodes with explicit width/height, this prevented mouse events from firing even though the dimensions were known.

**Fix Applied** (`src/assets/canvas-view-overrides.css`):

```css
.vue-flow__node-sectionNode {
    visibility: visible !important;
}
```

**Investigation**:

- [x] Check Vue Flow `@node-context-menu` event vs custom `@contextmenu` handlers
- [x] Verify event propagation path from group node to handler
- [x] Check for `stopPropagation` or `preventDefault` blocking the event
- [x] Found node had `visibility: hidden` inline style preventing all mouse interaction
- [x] CSS `!important` override forces visibility regardless of Vue Flow's inline style

**Verified**: Context menu appears with correct options (Add Task to Group, Edit Group, Group Settings, Delete Group, Create Task Here)

---

---
### ~~TASK-211~~: Prevent Task ID Reuse in Dev Manager (✅ DONE)

**Priority**: P1-HIGH
**Status**: Done
**Created**: January 11, 2026
**Completed**: January 13, 2026

Ensure unique IDs are always generated and never reused for tasks, bugs, or issues. Duplicate IDs confuse the system and the user.

**Implementation**:

- Added `scanExistingIds` logic to `dev-manager/server.js`
- Implemented `GET /api/next-id` endpoint
- Logic correctly identifies gaps and next available IDs (e.g. `TASK-271`, `BUG-262`)

---

---
### ~~BUG-214~~: Fix Blurry Text in Empty Canvas State (✅ DONE)

**Priority**: P3-LOW
**Status**: Done
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Problem**: The "Your canvas is empty" placeholder text appears blurry.
**Likely Cause**: Sub-pixel rendering issues often caused by `transform: translate(-50%, -50%)` or non-integer pixel positioning in the empty state container.

**Resolution**: Switched from `absolute` + `translate` to `absolute` + `inset: 0` + `flexbox` centering. This avoids fractional pixels and sub-pixel interpolation, resulting in crisp text rendering.

**Investigation**:

- [x] Check `CanvasEmptyState.vue` (or similar component) CSS.
- [x] Verify if `backdrop-filter: blur` is interfering with text sharpness.
- [x] Ensure centering uses flexbox/grid instead of transform where possible.

---

---
### ~~BUG-219~~: Add Task to Group Button Not Working (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 11, 2026

**Problem**: The "Add Task to Group" button in the group context menu does nothing when clicked.
**Investigation**:

- [ ] Check `CanvasContextMenus.vue` or `GroupContext.vue` (if exists).
- [ ] Verify event emission and handling in `useCanvasActions.ts` or `CanvasView.vue`.

---

\| ~~**BUG-220**~~ | ✅ **DONE** **Group Counter Accuracy** | **P0** | ✅ **RECOVERY FIXED** (TASK-232) | - |

---

---
### ~~TASK-215~~: Global Group Creation & Canvas Navigation (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Goal**: Provide a quick way to create groups and enter the canvas from anywhere, similar to task creation.
**Requirements**:

- [x] Add "Create Group" option next to "Add Task" buttons (Sidebar, Quick Actions).
- [x] Ensure "Create Group" redirects to Canvas if not already there.
- [x] Enhance the "Empty Canvas" experience to show both options clearly.
- [x] Fix visual hierarchy (sharp text).

---

---
### ~~TASK-216~~: Implement Paused Status Support (✅ DONE)

**Priority**: P3-LOW
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 11, 2026

**Goal**: Support "Paused" status for tasks that have progress but are halted.
**Changes**:

- Updated `CLAUDE.md` to include `PAUSED` and `⏸️` keywords.
- Enables "Fourth Column" in Dev Manager (via consistent status parsing).

---

- [x] ~~TASK-217: Modal Enter Key Support (Enter moves focus/submits, Shift+Enter for newlines)~~ ✅ DONE <!-- id: 217 -->
  **Priority**: P1-HIGH
  **Status**: ✅ DONE (January 13, 2026)
  **Created**: January 11, 2026

**Goal**: Allow users to confirm modal actions by pressing the Enter key.
**Scope**:

- All input-focused modals (Task Edit, Create Group, etc.).
- Ensure `Shift+Enter` still allows newlines in textareas.
- Prevent accidental submission if validation fails.

---

---
### ~~BUG-225~~: Group Color Update Reactivity (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Problem**: Changing group color in the modal does not update the visual color immediately. It requires a page refresh.
**Root Cause**: The canvas orchestrator only watches `groups.length`, not individual group property changes. When color changes, sync isn't triggered and Vue Flow nodes keep stale data.
**Fix**: Created `groupColor` computed in `GroupNodeSimple.vue` that looks up color directly from `canvasStore.groups` instead of relying on static `props.data.color`.
**Verification**: Playwright test confirmed color updates from #6366f1 → #22c55e appear immediately without page refresh.

---
### ~~BUG-226~~: Nested Group Z-Index Layering (✅ DONE)

**Priority**: P1-HIGH
**Status**: Done
**Created**: January 11, 2026
**Completed**: January 12, 2026

**Problem**: Nested groups appear *behind* or *under* their parent group container, limiting interaction and visibility.
**Cause**: Z-index calculation currently relies on Area (smaller = higher), but this might be insufficient or overridden by stacking contexts.
**Fix**: Introduce explicit "depth" or "hierarchy" bonus to Z-index calculation. Child Z must be > Parent Z.
**Implementation**: Added depth-based Z-index bonus in `useCanvasSync.ts` and refactored `sortGroupsByHierarchy` to preserve depth information. Removed hardcoded Z-index conflict in `canvas-view-overrides.css`.

---

---
### ~~TASK-232~~: Canvas System Stability Solution (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE
**Started**: January 11, 2026
**Completed**: January 13, 2026
**Goal**: 100% stable and reliable canvas position sync, group counting, and parent-child management.
**Architecture Changes**:

- **Single Authority**: Vue Flow is the ONLY position authority during editing. ✅ DONE
- **Versioned Sync**: Simple version numbers instead of timestamps/locks. ✅ DONE
- **Relative Only**: Eliminate absolute<->relative conversion logic. ✅ DONE
- **Consolidated Composables**: Reduce 30+ files to 5 core composables. ⏸️ DEFERRED (optimization, not stability-critical)
- **Logic Simplification**: Counting based purely on `parentId`, no spatial fallbacks. ✅ DONE

---

---
### ~~TASK-240~~: Canvas Architecture Redesign (SSOT/Relative/Normalized) (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ **DONE** (January 13, 2026)
**Started**: January 12, 2026
**Goal**: Replace patchy fixes with a stable, maintainable architecture based on SSOT, relative coordinates, and normalized IDs.

**Completed**:

- [x] **Phase 1: Foundation (Non-Breaking)**: Create `CanvasIds` utility and `useCanvasOperationState` machine. ✅ DONE (TASK-241)
- [x] Session reconciliation guard (one-time per session via `hasReconciledThisSession`)
- [x] Removed `taskCountByGroupId` sync loop (prevented drift)
- [x] Debug instrumentation (`[PARENT-WRITE]`, `[POSITION-WRITE]`, `[SYNC-PARENT-CHANGE]` logs)
- [x] Smart group reparenting disabled (`ENABLE_SMART_GROUP_REPARENTING = false`)
- [x] CanvasView right-click drift fix
- [x] Cycle detection invariants (`breakGroupCycles()`)
- [x] **Phase 2.5: Geometry Write Policy** - Added policy comments, `requestSync()` filtering, contract tests

**Closure Note**: Phase 2.5 Complete. Geometry write policy enforced, sync read-only verified with tests, rollback point created. Phases 3–4 deferred until stability is confirmed in production use.

---
### ~~TASK-221~~: Fix Security Vulnerabilities (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Goal**: resolve 8 reported vulnerabilities (2 High, 6 Low).

- [x] Run `npm audit fix`
- [x] Updated `vite-plugin-node-polyfills` to fix High-severity issues
- [x] Remaining 6 low-severity issues audited

---
### ~~TASK-222~~: Fix TypeScript Errors (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Goal**: Fix all compilation errors across the codebase.

- [x] Component prop mismatch in `HierarchicalTaskRowContent.vue`
- [x] Vue Flow event mismatch in `CanvasView.vue`
- [x] Native event types in `TaskNode.vue`
- [x] Type inference in `useCanvasInteractions.ts`
- [x] Verified with `npm run type-check` (0 errors)

**Goal**: Fix 53 compilation errors across 18 files.

- [x] Component prop mismatches (SignupForm, Calendar components)
- [x] Duplicate identifiers (Calendar views)
- [x] Type narrowing issues (Inbox components)
- [x] `useCanvasDragDrop` number/undefined issues
- [x] Verified with `npm run type-check` (0 errors)

---
### ~~TASK-223~~: Remove Dead Code (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Created**: January 11, 2026
**Completed**: January 13, 2026

**Goal**: Remove verified dead code files with zero imports.
**Result**: Deleted 31 verified-safe files (\~8,500 lines of dead code).

**Files Removed:**

- 8 utility files (logger, retryManager, animationBatcher, etc.)
- 19 composables (useCanvasVirtualization, useVueFlowStability, useBrowserTab, etc.)
- 4 store files (taskScheduler, canvas substores)

**Verification**: Build passes, type-check passes, no regressions.

**Note**: Initial report claimed 115-129 unused files, but thorough investigation revealed most were false positives (files used via npm scripts, CSS imports in Vue SFCs, or indirect dependencies). Only files with zero verified imports were deleted.

---
### ~~TASK-212~~: Codebase Health Auditor Skill (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Started**: January 9, 2026
**Completed**: January 11, 2026

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

- [x] Create skill directory structure
- [x] Write SKILL.md documentation
- [x] Create package.json with dependencies
- [x] Implement orchestrator.ts entry point
- [x] Implement knip-detector.ts
- [x] Implement depcheck-detector.ts
- [x] Implement typescript-detector.ts
- [x] Implement vue-detector.ts
- [x] Implement risk-scorer.ts
- [x] Implement reporters (JSON, Markdown)
- [x] Register skill in skills.json

**Note**: Skill was restored from archive (`.claude/skills-archive/auditor-merge-20260110`) and verified working.

---

---
### ~~TASK-169~~: Codebase Cleanup Phase 1 (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: Done
**Started**: January 9, 2026
**Related**: TASK-212 (Codebase Health Auditor Skill)

Address findings from the newly implemented Codebase Health Auditor.

**Scope**:

- [x] Cleanup SAFE items (unused files/exports)
- [x] Cleanup Vue-specific items (unused props/emits/computed)
- [x] Verify build and tests pass

---

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

---
### ~~TASK-146~~: Container Consolidation (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**PR**: #33

Reduced CSS container class redundancy (\~25%) through shared utilities and BEM renaming.

**Changes**:

- [x] Added `.scroll-container` utility (flexbox scroll pattern for nested layouts)
- [x] Added `.content-section` utility (bordered content sections)
- [x] Removed unnecessary `.canvas-container-wrapper` nesting in CanvasView\.vue
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

---
### ~~TASK-099~~: Auth Store & Database Integration (✅ DONE)

- [x] Integration with Supabase.
- [x] Refactor `useAuthStore.ts` and `useDatabase.ts`.
- [x] Migrated from PouchDB/CouchDB to Supabase.

---
### ~~TASK-039~~: Duplicate Systems Consolidation (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 6, 2026

- [x] Consolidate `ConflictResolver` and `conflict-resolution` service.
- [x] Create unified `integrity.ts` for hashing and checksums.
- [x] Refactor `useBackupSystem` and `ForensicLogger` to use `integrity.ts`.
- [x] Fixed all broken imports and MIME type errors following file deletions.

---
### ~~TASK-041~~: Implement Custom Recurrence Patterns (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Completed**: January 14, 2026

- [x] Defined custom recurrence syntax and parsing logic.
- [x] Implemented UI for custom recurrence rules with live preview.

---
### ~~TASK-046~~: Establish Canvas Performance Baselines (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 7, 2026

---
### ~~BUG-169~~: Tasks Auto-Removed on Login (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: Done
**Completed**: January 9, 2026
**Problem**: Tasks appeared briefly then disappeared automatically when signed in. Canvas kept reinitializing.
**Root Cause Analysis**:

1. Realtime subscription handler used truthy check for `is_deleted` (would match `undefined`)
2. No safety guards during auth state transitions / session startup
3. Empty array overwrites could wipe local data during race conditions
   **Resolution**:

- [x] Changed `is_deleted` check from truthy to explicit `=== true`
- [x] Added 5-second "stabilization window" blocking deletions on session start
- [x] Added 10-second safety guard preventing empty array overwrites
- [x] Enhanced logging to diagnose realtime events (`is_deleted_type`, timestamps)
  **Files Modified**:
- `src/composables/app/useAppInitialization.ts` - Realtime handler safety guards
- `src/stores/tasks/taskPersistence.ts` - Empty overwrite protection
- `src/stores/canvas.ts` - Empty overwrite protection in loadFromDatabase and auth watcher

---
### ~~TASK-145~~: CanvasView Decomposition (✅ DONE)

**Priority**: P3-LOW
**Status**: 📋 PLANNED
**Goal**: Reduce `CanvasView.vue` size (3400+ lines) by extracting UI components.

- [ ] Extract `CanvasControls` (Zoom/Pan UI)
- [ ] Extract `CanvasToolbar` (Primary Actions)
- [ ] Extract `CanvasMiniMap` usage (if complex)
- [ ] Refactor `useCanvasDragDrop` geometry logic to `utils/canvasGeometry.ts`

---
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

---
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

---
### ~~TASK-196~~: Vue Flow Documentation Scraping (✅ DONE)

**Priority**: P2-MEDIUM
**Started**: January 10, 2026
**Goal**: Scrape comprehensive Vue Flow API references and examples into `docs/documentation/vue` for local reference and AI context.

**Status**:

- [x] Map URLs to file structure
- [x] Scrape API references (Node, FlowProps, FlowEvents, Actions)
- [x] Scrape guides and composables documentation
- [x] Scrape examples (DnD, Nesting, Interaction)
- [x] Organize and format for local documentation system

---

---
### ~~TASK-161~~: Enable RLS Security on All Supabase Tables (✅ DONE)

**Priority**: P0-CRITICAL (Security)
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Supabase linter detected that RLS (Row Level Security) policies were defined but RLS was NOT enabled on the tables. This meant any authenticated user could potentially read/modify ALL users' data.

**Affected Tables**: groups, tasks, projects, notifications, timer\_sessions, user\_settings, quick\_sort\_sessions, pomodoro\_history, deleted\_tasks\_log, tasks\_backup

**Fix Applied**: Created migration `20260109000000_enable_rls_security.sql` to:

1. Enable RLS on all tables with existing policies
2. Enable RLS with no policies on internal tables (deleted\_tasks\_log, tasks\_backup) - restricting to service role only

**Verification**: `npx supabase db lint` now shows "No schema errors found"

**Migration File**: `supabase/migrations/20260109000000_enable_rls_security.sql`

---

---
### ~~TASK-168~~: Database Safety Hooks - Prevent Destructive Commands (✅ DONE)

**Priority**: P0-CRITICAL (Safety)
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Claude Code ran `supabase db reset` without user confirmation, wiping ALL user data. Need automated safeguards to prevent destructive commands.

**Solution Applied**:

- [x] Created `.claude/hooks/destructive-command-blocker.sh` - PreToolUse hook that intercepts Bash commands
- [x] **Permanently Blocked**: `supabase db reset`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` without WHERE, `--force` flags
- [x] **Backup Required**: Migrations (`supabase db push`) now require recent backup (within 1 hour) in `supabase/backups/`
- [x] **Warnings**: DELETE with WHERE, DROP TABLE warn but allow with backup
- [x] Updated `.claude/settings.json` to register hook
- [x] Updated `CLAUDE.md` with Database Safety section
- [x] Created `supabase/backups/` directory for backup storage

**Hook Behavior**:

| Command                    | Result                    |
| -------------------------- | ------------------------- |
| `supabase db reset`        | 🚫 PERMANENTLY BLOCKED    |
| `supabase db push`         | 🛑 BLOCKED without backup |
| `DROP DATABASE`            | 🚫 PERMANENTLY BLOCKED    |
| `DELETE FROM x` (no WHERE) | 🚫 BLOCKED                |
| `DELETE FROM x WHERE ...`  | ⚠️ WARNING (allowed)      |

**Automatic Backup System**:

- Automatic backup before any migration (hook auto-creates if none exists)
- VPS cron job support (every 6 hours + daily full backup)
- Backup rotation (configurable, default 10)
- Works with both local Supabase CLI and direct PostgreSQL connection

**npm Scripts**:

- `npm run db:backup` - Full backup
- `npm run db:backup:data` - Data only
- `npm run db:backup:tasks` - Tasks and groups only

**Files Created/Modified**:

- `.claude/hooks/destructive-command-blocker.sh` (safety hook with auto-backup)
- `.claude/settings.json` (hook registration)
- `scripts/backup-db.sh` (main backup script)
- `scripts/deploy/setup-backup-cron.sh` (VPS cron setup)
- `docs/claude-md-extension/backup-system.md` (documentation)
- `CLAUDE.md` (added Database Safety section)
- `.gitignore` (ignore backup files)
- `package.json` (added db:backup scripts)

---

---
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

---
### ~~TASK-159~~: Add user\_id Filter to Delete Operations (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/020-pending-p1-missing-user-id-delete-filter.md`

**Problem**: While `deleteGroup()` correctly implements user\_id filter, 9 other delete operations rely solely on RLS without explicit user\_id filtering - violating defense-in-depth.

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

---
### ~~TASK-160~~: Fix Unbounded Map Memory Leak (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026
**Todo File**: `todos/021-complete-p2-unbounded-map-memory-leak.md`

**Problem**: `sectionPositionTracker` Map in CanvasView\.vue never clears entries when sections are deleted, causing memory growth.

**Location**: `src/views/CanvasView.vue` (line 1766)

**Solution**: Added cleanup logic that removes stale entries when sections are deleted. The watcher now tracks current section IDs and removes any Map entries for sections that no longer exist.

---

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

---
### ~~TASK-162~~: Extract Magic Number Constants (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 13, 2026

**Problem**: Timeout values and dimensions (220, 100, 300, 200) scattered across 8+ files with no single source of truth.

**Solution**: Updated 9 files to import from centralized `src/constants/canvas.ts`:

- `useCanvasGroups.ts` - group/task dimension defaults
- `useCanvasSync.ts` - group dimension defaults
- `useCanvasActions.ts` - ghost group defaults
- `useCanvasTaskActions.ts` - group/task centering calculations
- `useNodeSync.ts` - group dimension persistence
- `useCanvasZoom.ts` - task viewport bounds
- `stores/canvas.ts` - bounds calculations
- `spatialContainment.ts` - re-exports from constants
- `positionCalculator.ts` - task center calculations

---

---
### ~~TASK-163~~: DRY Day-of-Week Logic (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Created**: January 9, 2026
**Completed**: January 13, 2026

**Problem**: 50+ lines of identical day-of-week processing logic duplicated in `getSectionProperties()` and `applySectionPropertiesToTask()`.

**Resolution**: Fixed during canvas architecture refactoring. `useCanvasDragDrop.ts` was eliminated. Logic consolidated into `useCanvasSectionProperties.ts` where `applySectionPropertiesToTask()` now calls `getSectionProperties()` - no duplication.

---

---
### ~~BUG-153~~: Nested Groups and Parent-Child Relationships Broken (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 11, 2026 (TASK-184/199/200 Rebuild)
**Status**: ✅ DONE - Resolved via native Vue Flow parentNode system.

**Problem Summary**: Multiple issues with nested groups (Group 2 inside Group 1):

| # | Issue                                  | Observed Behavior                                                   | Expected Behavior                       |
| - | -------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| 1 | **Group 1 works correctly**            | Task counts and dragging work fine                                  | ✅ (baseline)                            |
| 2 | **Group 2 intermittent task count**    | Sometimes counts tasks correctly, sometimes not                     | Should always count correctly           |
| 3 | **Can't drag tasks inside Group 2**    | Tasks in nested group cannot be dragged                             | Should be draggable                     |
| 4 | **Group 2 doesn't move with Group 1**  | When dragging Group 1, Group 2 stays in place                       | Nested group should move with parent    |
| 5 | **Task parent not updated when moved** | Task moved from Group 1 to Group 2 is still "controlled" by Group 1 | Task should be controlled by Group 2    |
| 6 | **Group positions reset on refresh**   | Groups jump back to old positions on page reload                    | Should persist positions across refresh |

**Detailed Analysis**:

**Issue 2 & 5: Task parent/containment issues**

- When task is dragged from Group 1 to Group 2:
  - Task COUNT updates correctly (based on position containment check)
  - BUT task's Vue Flow `parentNode` still points to Group 1 (`section-{group1-id}`)
  - Result: Task is visually in Group 2 but Vue Flow thinks it belongs to Group 1

**Issue 3: Can't drag nested tasks**

- Tasks inside Group 2 (nested) cannot be dragged
- Likely because Vue Flow parent-child relationship is broken
- May be related to removed `extent: 'parent'` or broken `parentNode` assignment

**Issue 4: Nested group doesn't move with parent**

- When creating Group 2 inside Group 1:
  - `UnifiedGroupModal.vue:saveGroup()` doesn't detect/set `parentGroupId`
  - Without `parentGroupId` in store, `syncNodes()` doesn't set Vue Flow `parentNode`
  - Result: Group 2 is NOT a child of Group 1 in Vue Flow, doesn't move together

**Root Causes Identified**:

1. `UnifiedGroupModal.vue:saveGroup()` - No parent detection when creating group inside another
2. `useCanvasDragDrop.ts` - Task `parentNode` not updated when moving between nested groups
3. `useCanvasSync.ts` - Relies on `parentGroupId` from store; if not set, nesting broken
4. Removed `extent: 'parent'` may have affected nested task dragging
5. **Issue 6 Root Cause**: `useCanvasDragDrop.ts` was saving **Absolute** positions for nested groups, but `useCanvasSync.ts` interprets stored positions as **Relative** when `parentGroupId` is set. This caused groups to "jump" by the parent's offset on reload.

**Files to Fix**:

- `src/components/canvas/UnifiedGroupModal.vue` - Add parent detection on creation
- `src/composables/canvas/useCanvasDragDrop.ts` - Fix task parent change between nested groups
- `src/composables/canvas/useCanvasSync.ts` - Verify parent assignment logic for tasks in nested groups
- `src/stores/canvas.ts` - Verify position persistence to Supabase

**Fixes Applied**:

1. ✅ **Issue 1** (UnifiedGroupModal.vue): Added parent group detection when creating nested groups - now sets `parentGroupId` and converts position to relative coordinates
2. ✅ **Issue 2 & 5** (useCanvasDragDrop.ts): Fixed task parent change using `getSectionAbsolutePosition()` to properly handle deep nesting
3. ✅ **Issue 3 & 4**: Resolved by fixes 1 & 2 - nested groups now have proper parentGroupId and tasks use correct absolute positions
4. ✅ **Issue 6** (useCanvasDragDrop.ts): Refactored `handleNodeDragStop` to calculate and save **Relative Positions** for nested groups, and removed the destructive loop that forced absolute updates on child groups.
5. ✅ **Task-to-Group attachment bug** (useCanvasDragDrop.ts): Fixed `attachNodeToParent` call passing incorrect ID format - was passing `containingSection.id` (e.g., `group-xxx`) but Vue Flow expects `section-${containingSection.id}` (e.g., `section-group-xxx`). This caused `getNode.value()` to return undefined, breaking parent-child relationship setup.
6. ✅ **Async timing bug** (useCanvasDragDrop.ts): Changed from `.then()` to `await` for `attachNodeToParent` and `detachNodeFromParent` calls. Without `await`, `setNodes([...nodes.value])` was copying nodes BEFORE `parentNode` was set, breaking the relationship.
7. ✅ **Undefined variable bug** (useCanvasDragDrop.ts): Added `oldSectionId` and `newSectionId` extraction from `currentParentNode` and `containingSection.id` for task count updates.
8. ✅ **data.parentId sync bug** (useNodeAttachment.ts): Added `childNode.data.parentId = groupId` during attachment. `useCanvasSync.ts` uses this property to detect existing parent relationships.
9. ✅ **Database persistence bug** (useCanvasDragDrop.ts): Added `taskStore.updateTask()` calls to persist `parentId` to database for both attachment (setting it) and detachment (clearing it with `null`).

**Status**: 🔄 REFACTORING (Jan 9) - Previous fixes were band-aids. Now simplifying to trust Vue Flow.

**Root Cause Analysis (Jan 9)**:
Despite 9 separate fixes, the issue persists because we built \~1200 lines of custom coordinate logic in `useCanvasDragDrop.ts` that **fights with Vue Flow's native parent-child handling**.

**The Real Problem**:

- Vue Flow's `parentNode` property already handles relative positioning automatically
- Our custom code constantly recalculates and overwrites positions
- Each bug fix added more complexity instead of addressing root cause
- Technical debt accumulated from layered fixes: BUG-002, BUG-047, BUG-152, TASK-072, TASK-089, TASK-131, TASK-142

**New Approach - Trust Vue Flow**:

1. Delete custom coordinate conversion logic
2. Use Vue Flow's native `parentNode` - just set it on drop
3. Let Vue Flow handle relative/absolute position automatically
4. Persist only `parentId` to database, let sync restore relationship

**SOP**: See `docs/sop/active/SOP-VUE-FLOW-PARENT-CHILD.md`

---

---
### ~~TASK-178~~: Refactor CanvasView\.vue (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 10, 2026
**Completed**: January 10, 2026

**Problem**: `CanvasView.vue` was 3400+ lines (112KB), acting as a "God Component" managing too much state.

**Solution**:

1. Extracted `useCanvasModals` and `useCanvasContextMenus` for global UI state.
2. Refactored `CanvasModals.vue` and `CanvasContextMenus.vue` to use these composables directly.
3. Updated `useCanvasActions` to use global state, removing prop drilling.
4. Preserved all core Vue Flow integration logic.

---

---
### ~~TASK-156~~: Add TTL to Backup History (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: `flow-state-backup-history` in `useBackupSystem.ts` persists old backups indefinitely with no expiration. Could consume significant localStorage space and restore stale data.

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
- [x] Use Supabase user\_settings as primary viewport source - `loadSavedViewport()` checks Supabase first
- [x] Fall back to localStorage only if Supabase returns null
- [x] Add viewport to GUEST\_EPHEMERAL\_KEYS cleanup - ALREADY EXISTS at line 12

**Changes**:

- `getSavedViewport()` → `getDefaultViewport()` (no longer reads localStorage synchronously)
- `loadSavedViewport()` now checks Supabase `fetchUserSettings().canvas_viewport` first

---

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

---
### ~~TASK-153~~: Validate Golden Backup Before Restore (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 11, 2026
**Status**: ✅ DONE - Golden Validation UI & Smart filtering implemented.

**Problem**: `flow-state-golden-backup` in `useBackupSystem.ts` NEVER expires. It can contain tasks/groups deleted weeks ago. Restoring it resurrects deleted data.

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

**Outstanding Issues (Reopened Jan 9)**:

- [ ] **CRITICAL FIX**: Create missing `src/utils/integrity.ts` dependency (causing build/test failures)
- [ ] **UI Implementation**: Add "Restore from Golden Backup" button in `SettingsModal.vue`
- [ ] **Verification**: Run `tests/unit/backup-validation.spec.ts` successfully
- `validateGoldenBackup()` - Returns age warning + preview of what will be restored
- `filterGoldenBackupData()` - Removes items deleted in Supabase before restore
- `fetchDeletedTaskIds/ProjectIds/GroupIds()` - Fetch deleted item IDs from Supabase

---

---
### ~~TASK-154~~: Shadow Recovery Bridge (✅ DONE)

**Priority**: P0-CRITICAL
**Created**: January 11, 2026
**Completed**: January 11, 2026
**Status**: ✅ DONE - Implemented JSON bridge & one-click cloud restore UI.

**Objective**: Provide a "Seamless" recovery path for the always-on Shadow Mirror (System 3).

**Components**:

- [ ] **Backend API**: Add endpoint or script to expose latest `backups/shadow.db` snapshot via JSON.
- [ ] **Composable Integration**: Update `useBackupSystem.ts` to poll/fetch shadow status.
- [ ] **Security**: Ensure Shadow data is filtered and validated for the current user.
- [ ] **UI Implementation**: One-click restore button in `StorageSettingsTab.vue`.

**Success Criteria**: User can restore from the last cloud snapshot with < 5min data loss.

---

---
### ~~TASK-155~~: Verify Layer 3 Reliability (✅ DONE)

**Priority**: P0-CRITICAL
**Created**: January 11, 2026
**Completed**: January 11, 2026
**Status**: ✅ DONE - Verified data fidelity between Supabase -> SQLite -> JSON Snapshot.

**Objective**: Prove the end-to-end reliability of the Shadow Mirror system (Backup -> Snapshot -> JSON -> Frontend).

**Components**:

- [ ] **Data Injection**: Verify tasks flow from Supabase to SQLite.
- [ ] **Integrity Check**: Verify JSON snapshots are identical to SQLite source.
- [ ] **Recovery Path**: Verify the frontend can successfully parse and "sim-restore" the snapshot.

**Success Criteria**: 100% data fidelity between Supabase and the final restore-ready JSON.

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

---
### ~~TASK-151~~: Resolve PGRST204 Error & Component Cache (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Group deletion failed with PGRST204 because code attempted to update non-existent 'deleted\_at' column. Browser caching prevented previous fixes from taking effect.

**Fix Applied**:

- [x] Created useSupabaseDatabaseV2.ts to force cache busting
- [x] Removed deleted\_at reference in deleteGroup and bulkDeleteTasks
- [x] Updated all imports to use V2 composable

---
### ~~TASK-150~~: Group Deletion Not Persisting on Refresh (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Deleted groups reappeared after page refresh. Root cause: When authenticated user deletes groups, `fetchGroups()` correctly returns empty (filtered by `is_deleted: false`), but `loadFromDatabase()` fell back to localStorage which had stale/deleted groups.

**Fix Applied**:

- [x] Removed localStorage fallback for authenticated users in `canvas.ts`
- [x] Supabase is now single source of truth - empty means empty, no resurrection from localStorage
- [x] Note: `groups` table doesn't have `deleted_at` column (unlike tasks/projects) - schema intentional difference

---
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

---
### ~~TASK-095~~: Complete TypeScript & Lint Cleaning (✅ DONE)

- [x] Address remaining TS/Lint errors system-wide (Zero errors baseline achieved).
- [x] Fix `ConflictResolutionDialog` and `SyncHealthDashboard` type mismatches.
- [x] Standardize auth store getters and component access.
- [x] Align Canvas store actions and exports.

---
### ~~TASK-100~~: Implement Overdue Smart Group in Canvas (✅ DONE)

- Create "Overdue" smart group logic.
- Implement auto-collection of overdue non-recurring tasks.

---
### ~~TASK-096~~: System Refactor Analysis (✅ DONE)

**Priority**: P3-LOW
**Completed**: January 15, 2026
**Outcome**: Analysis complete. Created refactoring report and identified new tasks (TASK-198, TASK-199, TASK-200).

- [x] Analyze codebase for refactoring opportunities.

---
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

---
### ~~TASK-102~~: Fix Shift+Drag Selection (✅ DONE)

- Fixed "stuck" rubber-band selection.
- Fixed selection inside groups (absolute positioning).
- Moved selection box outside VueFlow for visual stability.

---
### ~~TASK-103~~: Debug Sync Error (Auth Guard) (✅ DONE)

- Fixed "User not authenticated" sync errors in Guest Mode.
- Implemented Auth Guards in `projects`, `tasks`, and `canvas` stores.

---
### ~~TASK-106~~: Brain Dump RTL Support (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 6, 2026

- [x] Implement correct RTL and Hebrew/English mix support for Brain Dump section in canvas inbox.
- [x] Automatic text direction detection in `useBrainDump.ts`.
- [x] Bidirectional rendering support in Inbox components.

---
### ~~TASK-111~~: Landing Page for Early Access (✅ DONE)

**Priority**: P1-HIGH
**Plan**: [plans/flow-state-landing-page.md](../plans/flow-state-landing-page.md)
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Live URL**: <https://endlessblink.github.io/flow-state-landing/>

- [x] Create landing page hosted on GitHub Pages (free)
- [x] Showcase features: Board, Calendar, Canvas views, Pomodoro timer
- [x] Email signup for early access waitlist (Formspree integration - needs form ID)
- [x] Explain open-core business model:
  - Free (Self-Host): Deploy your own Supabase instance
  - Cloud ($7/mo): Our hosted Supabase + backups + support
  - Pro ($14/mo): AI features + gamification

---
### ~~TASK-166~~: Bi-directional Day Group Date Picker (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Completed**: January 13, 2026
**Related**: TASK-130 (Day Groups)

Added option to change the date of a smart group directly by clicking the date suffix, which updates the day name accordingly.

**Implementation**:

- [x] Clickable date suffix in Day Groups (hover highlights)
- [x] NDatePicker popup via NPopover
- [x] Date-to-day-name conversion (selected date → correct day of week)
- [x] Group name auto-updates and date suffix refreshes

**Files Modified**:

- `src/components/canvas/GroupNodeSimple.vue`: Added NPopover + NDatePicker, click handler, day conversion logic

---
### ~~TASK-167~~: Day Group Date Formatting & Verification (✅ DONE)

**Priority**: P1-HIGH
**Status**: DONE
**Completed**: January 11, 2026
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

---
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

---
### ~~TASK-104~~: Fix Critical Notification Store Crash (✅ DONE)

- Fixed `ReferenceError: scheduledNotifications is not defined` in `notifications.ts`.

---
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
- [x] `projects.ts`: `cleanupCorruptedProjects()` utility
- [x] `supabaseMigrationCleanup.ts`: Added `clearAllLocalData()` helper
- [x] Deleted 18+ legacy PouchDB/CouchDB files (\~10,000 lines removed)
- [x] Build verified passing

---
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

---
### ~~BUG-010~~: Milkdown Auto-Conversion Issue → Tiptap Migration (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 7-8, 2026

Milkdown's aggressive input rules continued to auto-convert `-` to bullet lists before users could complete `- [ ]` task list syntax. After multiple fix attempts (disabling individual inputRules imports), the issue persisted.

**Solution**: Migrated from Milkdown to Tiptap

- Tiptap offers `enableInputRules: false` - single option to disable all auto-conversion
- Better Vue 3 integration with official `@tiptap/vue-3`
- Smaller bundle size (\~100KB reduction)
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

---
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

---
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

---
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

---
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

---
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

---
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

---
### ~~TASK-111~~: Canvas Group Filter for Calendar Inbox (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 6, 2026

Reduced cognitive overload in calendar inbox by adding canvas group filtering.

**Problem**:

- Too many tasks even with "Today" filter active
- Current filter buttons (Priority, Project, Duration) were overwhelming
- User wanted to filter calendar inbox by canvas groups

**Solution**:

- [x] Add "Show from: \[Canvas Group]" dropdown as primary filter
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

---
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

---
### ~~TASK-113~~: Canvas Performance Optimization (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 7, 2026

- [x] Implement Level-of-Detail (LOD) rendering for canvas nodes.
- [x] Replace `syncTasksToCanvas` with a more efficient incremental update logic.
- [x] Reduce reactive overhead in node data mapping (O(N) Optimization).
- [x] Verify drag performance (< 16ms/frame).

---
### ~~TASK-117~~: Fix Lint and TS Errors (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 7, 2026

- [x] Analyzed and fixed 558 lint errors/warnings.
- [x] Fixed TypeScript module resolution errors (`TS2307`).
- [x] Implemented type safety in `SyncOrchestrator` and `useSupabaseDatabase`.
- [x] Verified application stability with clean production build.
- [x] Zero critical lint errors remaining (warnings reviewed).

---
### ~~TASK-114~~: Virtual Scrolling Smoothness (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: DONE
**Started**: January 14, 2026
**Completed**: January 14, 2026

**Goal**: Implement virtual scrolling for large lists to improve performance with 50+ items.

**Implemented**:

- [x] UnifiedInboxList - Virtual scrolling with VueUse (threshold: 50 items)
- [x] TaskTable - Virtual scrolling with fixed header, density-aware row heights

**Technical Details**:

- Uses VueUse's `useVirtualList` for efficient DOM recycling
- Auto-disables for lists <50 items (no behavior change for small lists)
- TaskTable adapts row height based on density setting (40/48/56px)

**Out of scope** (deferred - too complex):

- TaskList (recursive structure needs complex height calculation)
- KanbanColumn (drag-drop conflicts with vuedraggable)

---
### ~~TASK-115~~: Memory Efficiency & Leak Fixes (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Completed**: January 14, 2026

**Investigation Findings**:

- Identified 2 uncleaned `setInterval` calls causing memory leaks
- Both were in module-level singletons that ran intervals without cleanup

**Fixes Applied**:

- [x] `usePerformanceManager.ts`: Added `cleanupCacheInterval` tracking + `destroy()` method
- [x] `useStaticResourceCache.ts`: Added `cleanupIntervalId` tracking + `destroy()` method
- [x] Both now properly clear intervals and expose cleanup for app shutdown

**Files Modified**:

- `src/composables/usePerformanceManager.ts`
- `src/composables/useStaticResourceCache.ts`

---

---
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

---
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

---
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

---
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

---
### ~~BUG-015~~: Watch Priority 'high' Bypasses Batching (✅ DONE)

**Priority**: P2-MEDIUM (Performance)
**Completed**: January 7, 2026

**Problem**: CanvasView\.vue was using 'high' priority which runs synchronously and bypasses the batching system entirely.

---
### ~~BUG-016~~: moveTaskToSmartGroup Default Case Clears dueDate (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 7, 2026

**Problem**: Unknown smart group types were logging a warning but still calling `updateTask`, potentially clearing dueDate unintentionally.

**Location**: `src/stores/tasks/taskOperations.ts` line 437

**Fix Applied**: Added early `return` in default case to prevent unintended update when unknown type is passed.

**Subtasks**:

- [x] Added early return in default case
- [x] Build verification passed

---
### ~~TASK-124~~: Remove Dead Milkdown Code (✅ DONE)

**Priority**: P2-MEDIUM
**Discovered**: January 7, 2026
**Completed**: January 2026 (during codebase cleanup)

**Problem**: `MilkdownEditorSurface.vue` is no longer imported (MarkdownEditor uses TiptapEditor), but received 120+ lines of changes and Milkdown packages remain in package.json.

**Impact**: Bundle bloat, maintenance confusion.

**Subtasks**:

- [x] Confirm MilkdownEditorSurface.vue is not imported anywhere
- [x] Delete MilkdownEditorSurface.vue
- [x] Remove Milkdown packages from package.json
- [x] Verify build passes
- [x] Measure bundle size reduction

---
### ~~BUG-017~~: Fix Dropdown Cutoff (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "All Tasks" dropdown in calendar inbox (and potentially others) was cut off because it was constrained to the trigger button's width, causing wider options to be truncated.
**Fix**: Updated `CustomSelect.vue` to use `min-width` instead of fixed `width`, allowing the dropdown to expand to fit its content.

---
### ~~BUG-018~~: Dropdown Closes on Scroll (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: The custom dropdown closed immediately when users tried to scroll the list of options.
**Fix**: Updated `handleScroll` in `CustomSelect.vue` to ignore scroll events originating from within the dropdown itself.

---
### ~~BUG-019~~: Fix `saveUserSettings` Sync Error (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Sync Error `[object Object]` which turned out to be a duplicate key violation on `user_settings`.
**Fix**:

1. Improved error handling in `useSupabaseDatabase.ts` to parse object errors.
2. Added `{ onConflict: 'user_id' }` to `saveUserSettings` upsert call to handle existing records correctly.

---
### ~~TASK-126~~: Fix Catalog Filter Logic & Position (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "Hide Done Tasks" filter was misplaced in the view and logic needed verification.
**Fix**:

1. Moved toggle button to `ViewControls.vue` for consistent layout.
2. Verified `taskStore` logic correctly toggles visibility.

---
### ~~BUG-019~~: Fix ISO Date Display in Overdue Badge (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Overdue badge showed raw ISO timestamp (e.g., 2026-01-06T00:00:00+00:00).
**Fix**: Updated `formatDueDateLabel` in `CalendarInboxPanel.vue` to nice formatting (e.g., "Overdue Jan 6").

---
### ~~TASK-128~~: Friday & Saturday Action Groups (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Feature**: Replaced "Weekend" group with "Friday" and "Saturday" Action Groups.
**Logic**: Dropping a task into these groups automatically sets its due date to the closest upcoming Friday or Saturday.

---
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

---
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

---
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

---
### ~~TASK-131~~: Remove Dead Code - useOptimizedTaskStore.ts (✅ DONE)

**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/composables/useOptimizedTaskStore.ts` (387 lines) is never imported anywhere. PouchDB-era batching layer that imports deprecated stubs.

**Resolution**: File not found during review - already deleted in previous cleanup.

**Subtasks**:

- [x] Delete `src/composables/useOptimizedTaskStore.ts` (already deleted)
- [x] Verify build passes

---
### ~~TASK-132~~: Remove Dead Code - SyncRetryService.ts (✅ DONE)

**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Completed**: January 8, 2026

**Problem**: `src/services/sync/SyncRetryService.ts` (52 lines) is never imported or called.

**Resolution**: File not found during review - already deleted in previous cleanup.

**Subtasks**:

- [x] Delete `src/services/sync/SyncRetryService.ts` (already deleted)
- [x] Verify build passes

---
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

---
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

---
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

---
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

---
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

---
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

---
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

---
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
- `src/stores/tasks.ts` (removed crash recovery block \~40 lines)
- `src/services/trash/TrashService.ts` (removed 6 transactionManager calls)
- `src/wal_test_script.ts` (DELETED - unused test file)
- `src/config/database.ts` (added deprecation notice, kept for compatibility)

**Subtasks**:

- [x] Remove transactionManager calls from taskOperations.ts
- [x] Remove transactionManager calls from tasks.ts
- [x] Remove transactionManager calls from TrashService.ts
- [x] Delete TransactionManager.ts stub
- [x] Delete wal\_test\_script.ts
- [x] Add deprecation notice to config/database.ts
- [x] Build verification passed

---

---
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

---
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

**Note**: Bundle size reduction modest (\~3.6KB) because code was already tree-shaken (never imported). Main benefit is cleaner dependencies and faster builds.

---
### ~~TASK-120~~: Fix CSP for Service Workers (✅ DONE)

**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

**Results**:

- [x] Updated `src/utils/cspManager.ts` production `worker-src` from `["'none'"]` to `["'self'", "blob:"]`
- [x] CSP now allows service workers for PWA

---
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

---
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
- `src/composables/useTaskSmartGroups.ts` - Add day-of-week keywords (DAY\_OF\_WEEK\_KEYWORDS)
- `src/components/canvas/GroupNodeSimple.vue` - Date labels (dayOfWeekDateSuffix computed)
- `src/stores/canvas.ts` - Guest Mode localStorage persistence

---

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

---
### ~~TASK-213~~: Canvas Position System Refactor (✅ DONE)

**Priority**: P3-LOW
**Created**: January 8, 2026
**Started**: January 15, 2026
**Completed**: January 15, 2026
**Plan**: [plans/canvas-position-system-refactor.md](../plans/canvas-position-system-refactor.md)
**SOP**: [docs/sop/active/canvas-position-debugging.md](./sop/active/canvas-position-debugging.md)
**SOP**: [docs/sop/active/canvas-position-debugging.md](./sop/active/canvas-position-debugging.md)

**Problem**: Constant position reset issues with tasks and groups on the canvas despite TASK-131 fixes. Root cause is fragmented architecture with 10+ position modification points, 5+ competing state flags, and duplicate implementations.

**Proposed Solution**: Centralized Position Manager service that:

- Acts as single source of truth for all position updates
- Manages event-driven locks (not time-based)
- Handles coordinate transformation consistently
- Provides conflict resolution between user actions and database sync

**Phases**:

- [x] **Phase 1**: Create PositionManager service with lock persistence
- [x] **Phase 2**: Consolidate all position modifications through PositionManager (Interactions & Sync)
- [x] **Phase 3**: Cleanup unused state and optimize batch updates
- [x] **Phase 4**: Standardize coordinate system (absolute vs. relative)
- [ ] **Phase 5**: Comprehensive Playwright tests and cleanup

**Files to Create**:

- `src/services/canvas/PositionManager.ts`
- `src/services/canvas/LockManager.ts`
- `src/services/canvas/types.ts`

**Files to Modify**:

- `src/utils/canvasStateLock.ts`
- `src/composables/canvas/useCanvasInteractions.ts`
- `src/composables/canvas/useCanvasOperationState.ts`
- `src/composables/canvas/useCanvasResizeState.ts`
- `src/composables/canvas/useCanvasSync.ts`
- `src/stores/tasks/taskOperations.ts`
- `src/stores/canvas.ts`
- `src/views/CanvasView.vue`

---

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
- [x] Removed redundant `deep: true` watcher in CanvasView\.vue (hash-based watchers handle all cases)
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

\--- \[ ] BUG-250: Status change via context menu doesn't update immediately ✅ (Added)

- [x] ~~TASK-245: Fix Smart Group Dates~~ ✅

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
The watcher in `CanvasView.vue` (line \~1835) only watched title, status, and priority changes. dueDate changes weren't triggering UI sync. Additionally, the batcher priority was 'normal' (16ms delay) instead of 'high' (instant).

**Fixes Applied**:

- [x] Added `dueDate` and `estimatedDuration` to hash-based watcher in CanvasView\.vue
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

| Category | Keywords                                                          |
| -------- | ----------------------------------------------------------------- |
| Date     | today, tomorrow, this weekend, this week, later                   |
| Priority | high, medium, low                                                 |
| Status   | todo, active, done, paused                                        |
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

---


## January 16, 2026

### ~~TASK-305~~: Automated Master Plan Archival (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-16)

Implemented automated system to archive completed tasks from `MASTER_PLAN.md` to `docs/archive/`.

**Features**:

- Automated detection of completed tasks
- Atomic file operations with backups
- Integration with Claude Code "Update Master Plan" workflow

**Implementation Plan**: [docs/plans/automated-archival-system.md](./plans/automated-archival-system.md)

---

---
### ~~TASK-017~~: KDE Plasma Widget (Plasmoid) (✅ DONE)

**Priority**: P3-LOW
**Status**: ✅ DONE
**Started**: January 15, 2026
**Completed**: January 16, 2026
**Location**: `kde-widget/`

**Goal**: Create a KDE Plasma 6 taskbar widget that displays Pomodoro timer status and task list, communicating directly with Supabase.

**Technology**:

- QML (Qt Meta Language) for UI
- XMLHttpRequest for Supabase REST API calls
- Plasma 6 PlasmoidItem as root element
- Kirigami.Icon for system icons (emoji doesn't render in Plasma)

**Implementation Phases**:

- [x] Phase 1: Basic timer display widget (timer countdown, start/pause)
- [x] Phase 2: Supabase integration (auth, fetch tasks, sync sessions)
- [x] Phase 3: Config UI (API key entry, project URL, login form in popup)
- [x] Phase 4: Polish (colors match app, bidirectional sync, drift correction)

**Progress (January 15-16, 2026)**:

- Created full widget structure at `kde-widget/package/`
- Implemented email/password authentication via Supabase Auth REST API
- Added bidirectional timer sync with `timer_sessions` table
- Fixed emoji rendering issue: **Must use `Kirigami.Icon` instead of emoji text**
- Created login form directly in popup (user sees login on first open)
- Created `kde-plasma-widget-dev` skill for future iteration
- Compact view shows: icon + timer (e.g., "⏱ 25:00" or "🍅 24:35")
- Full popup has: circular progress, skip/start/pause/stop buttons, task list

**January 16, 2026 - Timer Sync Architecture**:

- Fixed timer persistence after hard refresh (race condition: timer init before auth ready)
- Implemented fluid device leadership (whoever interacts last becomes leader)
- Added drift correction on page load (calculates elapsed time since last heartbeat)
- Widget syncs within 2 seconds via REST API polling
- App uses Supabase Realtime WebSocket for instant updates
- Colors match main app: teal `#4ECDC4` (work), orange `#F59E0B` (break)
- See: `docs/sop/active/TIMER-sync-architecture.md`

**Key Discovery**: Emoji characters (🍅, ⏱️, etc.) do NOT render in KDE Plasma widgets. Must use system icons via `Kirigami.Icon` with names like `chronometer`, `appointment-soon`, `media-playback-start`.

**Security Approach**:

- Email/password auth via Supabase (not service role key)
- Tokens stored in Plasma config, password never stored
- Auto token refresh before expiry

**Testing**:

```bash
cd kde-widget && plasmoidviewer -a package
# Or install: cp -r package ~/.local/share/plasma/plasmoids/com.pomoflow.widget
```

**References**:

- [KDE Plasma Widget Tutorial](https://develop.kde.org/docs/plasma/widget/)
- [Plasma 6 Setup Guide](https://develop.kde.org/docs/plasma/widget/setup/)
- [Plasma 6 Porting Guide](https://develop.kde.org/docs/plasma/widget/porting_kf6/)

---
