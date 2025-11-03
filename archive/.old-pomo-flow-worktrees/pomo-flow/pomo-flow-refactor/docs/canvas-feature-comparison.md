# Canvas Feature Comparison: Main vs Refactored

**Date**: 2025-10-27
**Purpose**: Comprehensive comparison of all functionality between main branch (4,240 lines) and refactored branch (2,053 lines)

---

## Overview

- **Main Branch**: 94 methods in single CanvasView.vue file
- **Refactored**: 23 methods in CanvasView.vue + functions across 6 composables
- **Reduction**: 51.6% file size decrease (4,240 → 2,053 lines)

---

## Composable Architecture

### 1. useCanvasNodes.ts (~221 lines)
**Exports**:
- `nodes` (state)
- `nodeTypes` (state)
- `getTasksForSection()`
- `getTaskCountForSection()`
- `syncNodes()`
- `restoreSelection()`
- `getSelectedNodes()`
- `updateNodeSelection()`

**Original Methods Covered**:
- ✅ `syncNodes`
- ✅ `getTaskCountForSection`
- ✅ `collectTasksForSection` (as `getTasksForSection`)

### 2. useCanvasEdges.ts (~230 lines)
**Exports**:
- `edges` (state)
- `syncEdges()`
- `selectedEdge` (state)
- `handleConnectStart()`
- `handleConnectEnd()`
- `handleConnect()`
- `handleEdgeContextMenu()`
- `closeEdgeContextMenu()`
- `disconnectEdge()`

**Original Methods Covered**:
- ✅ `syncEdges`
- ✅ `handleConnectStart`
- ✅ `handleConnectEnd`
- ✅ `handleConnect`
- ✅ `handleEdgeContextMenu`
- ✅ `closeEdgeContextMenu`
- ✅ `disconnectEdge`

### 3. useCanvasResize.ts
**Expected Exports** (needs verification):
- Section resize handlers
- Task resize handlers
- Resize state management

**Original Methods Expected**:
- ⚠️ `handleResizeStart`
- ⚠️ `handleResize`
- ⚠️ `handleResizeEnd`
- ⚠️ `handleSectionResizeStart`
- ⚠️ `handleSectionResize`
- ⚠️ `handleSectionResizeEnd`
- ⚠️ `getSectionResizeStyle`

### 4. useCanvasDragDrop.ts (~459 lines)
**Exports** (from previous docs):
- `handleDrop()`
- `handleNodeDragStart()`
- `handleNodeDragStop()`
- `handleNodeDrag()`

**Original Methods Covered**:
- ✅ `handleDrop`
- ✅ `handleNodeDragStart`
- ✅ `handleNodeDragStop`
- ✅ `handleNodeDrag`

### 5. useCanvasControls.ts (~475 lines)
**Expected Exports**:
- Zoom controls (in/out/reset/fit)
- Auto arrange
- Section toggles
- Alignment tools

**Original Methods Expected**:
- ⚠️ `fitView`
- ⚠️ `zoomIn`
- ⚠️ `zoomOut`
- ⚠️ `toggleZoomDropdown`
- ⚠️ `applyZoomPreset`
- ⚠️ `resetZoom`
- ⚠️ `fitToContent`
- ⚠️ `fitAllTasks`
- ⚠️ `centerOnSelectedTasks`
- ⚠️ `autoArrange`
- ⚠️ `alignLeft`
- ⚠️ `alignRight`
- ⚠️ `alignTop`
- ⚠️ `alignBottom`
- ⚠️ `alignCenterHorizontal`
- ⚠️ `alignCenterVertical`
- ⚠️ `distributeHorizontal`
- ⚠️ `distributeVertical`
- ⚠️ `arrangeInRow`
- ⚠️ `arrangeInColumn`
- ⚠️ `arrangeInGrid`

### 6. useCanvasContextMenus.ts
**Expected Exports**:
- Node context menu handlers
- Canvas context menu handlers
- Context menu state and positioning

**Original Methods Expected**:
- ⚠️ `handleNodeContextMenu`
- ⚠️ `closeNodeContextMenu`
- ⚠️ `handleCanvasRightClick`
- ⚠️ `closeCanvasContextMenu`
- ⚠️ `handlePaneContextMenu`

---

## Methods Remaining in Refactored CanvasView.vue (23 total)

1. `handleNodesChange` - Node selection management
2. `closeAllMenus` - Close all open menus
3. `handleConnectStart` - Start edge connection (from composable)
4. `handleConnect` - Complete edge connection (from composable)
5. `handleEdgeContextMenu` - Edge right-click (from composable)
6. `handlePaneClick` - Click on empty canvas
7. `handleEditTask` - Open task edit modal
8. `closeEditModal` - Close task edit
9. `closeQuickTaskCreate` - Close quick create
10. `handleQuickTaskCreate` - Create task at position
11. `closeBatchEditModal` - Close batch edit
12. `handleBatchEditApplied` - Apply batch changes
13. `collectTasksForSection` - Get tasks for section
14. `handleSectionTaskDrop` - Drop task on section
15. `handleSectionUpdate` - Section property update
16. `handleSectionActivate` - Activate section
17. `handleSectionContextMenu` - Section right-click
18. `handleSelectionChange` - Selection state change
19. `handleBulkAction` - Batch operations
20. `handleTaskSelect` - Task selection
21. `handleTaskContextMenu` - Task right-click
22. `handleClickOutside` - Close menus on outside click
23. `getNodeColor` - Node color calculation

---

## Main Branch Methods NOT YET VERIFIED in Refactored (71 methods)

### Category: Section Operations
- ⚠️ `createSection` - Section wizard
- ⚠️ `closeSectionWizard`
- ⚠️ `handleSectionCreated`
- ⚠️ `toggleSections` - Show/hide sections
- ⚠️ `toggleSectionTypeDropdown`
- ⚠️ `createSmartSection` - Priority/status/project sections
- ⚠️ `addSection`
- ⚠️ `addHighPrioritySection`
- ⚠️ `addInProgressSection`
- ⚠️ `addPlannedSection`

### Category: Group/Section Management
- ⚠️ `createGroup`
- ⚠️ `closeGroupModal`
- ⚠️ `handleGroupCreated`
- ⚠️ `handleGroupUpdated`
- ⚠️ `editGroup`
- ⚠️ `deleteGroup`
- ⚠️ `closeGroupEditModal`
- ⚠️ `handleGroupEditSave`

### Category: Selection & Multi-Select
- ⚠️ `selectAllTasks`
- ⚠️ `clearSelection`
- ⚠️ `toggleMultiSelect`

### Category: Task Canvas Operations
- ⚠️ `createTaskHere` - Create task at canvas position
- ⚠️ `deleteNode` - Delete task from canvas
- ⚠️ `getContainingSection` - Check which section contains task
- ⚠️ `isTaskInSectionBounds` - Boundary checking
- ⚠️ `applySectionPropertiesToTask` - Auto-apply section props

### Category: Visual Utilities
- ⚠️ `handleToggleDoneTasks` - Show/hide completed
- ⚠️ `shouldCullNode` - Performance optimization

### Category: Resize (all need verification)
- ⚠️ `handleResizeStart`
- ⚠️ `handleResize`
- ⚠️ `handleResizeEnd`
- ⚠️ `handleSectionResizeStart`
- ⚠️ `handleSectionResize`
- ⚠️ `handleSectionResizeEnd`
- ⚠️ `getSectionResizeStyle`

### Category: Zoom & View Controls (all need verification)
- ⚠️ `fitView`
- ⚠️ `zoomIn`
- ⚠️ `zoomOut`
- ⚠️ `toggleZoomDropdown`
- ⚠️ `applyZoomPreset`
- ⚠️ `resetZoom`
- ⚠️ `fitToContent`
- ⚠️ `fitAllTasks`
- ⚠️ `centerOnSelectedTasks`

### Category: Auto-Layout (all need verification)
- ⚠️ `autoArrange`
- ⚠️ `alignLeft`
- ⚠️ `alignRight`
- ⚠️ `alignTop`
- ⚠️ `alignBottom`
- ⚠️ `alignCenterHorizontal`
- ⚠️ `alignCenterVertical`
- ⚠️ `distributeHorizontal`
- ⚠️ `distributeVertical`
- ⚠️ `arrangeInRow`
- ⚠️ `arrangeInColumn`
- ⚠️ `arrangeInGrid`

---

## CRITICAL: Untested Features

Our 12-test Playwright suite covered ONLY:
1. Canvas load
2. Inbox panel toggle
3. Display toggles (not found, gracefully skipped)
4. Zoom controls (keyboard shortcuts only)
5. Task creation (but didn't verify visibility)
6. Section operations (button not found, skipped)
7. Multi-select (button not found, skipped)
8. Auto arrange (button not found, skipped)
9. Keyboard shortcuts (basic F, +, -)
10. Context menu (no task on canvas, skipped)
11. Hide completed (button not found, skipped)
12. Console errors (0 errors found)

### NOT TESTED:
- ❌ Section resizing with NodeResizer
- ❌ Section collapse/expand with height restoration
- ❌ Smart section auto-collection
- ❌ Section property application to tasks
- ❌ Task editing (double-click)
- ❌ Task deletion
- ❌ Edge creation and editing
- ❌ Context menu operations (actual delete/edit/align)
- ❌ Alignment tools (all 10+ functions)
- ❌ Auto arrange algorithm
- ❌ Batch operations
- ❌ Group/section wizard
- ❌ Quick task create at position
- ❌ All zoom UI controls (only keyboard tested)
- ❌ Canvas state persistence
- ❌ Undo/redo for canvas operations

---

## Next Steps Required

### Phase 1 Completion
1. ✅ Extracted main branch methods (94 total)
2. ⏳ **IN PROGRESS**: Map methods to composables
   - ✅ useCanvasNodes exports verified
   - ✅ useCanvasEdges exports verified
   - ⚠️ Need to verify: useCanvasResize
   - ⚠️ Need to verify: useCanvasDragDrop (partially done)
   - ⚠️ Need to verify: useCanvasControls
   - ⚠️ Need to verify: useCanvasContextMenus
3. ⏳ **IN PROGRESS**: Create complete comparison matrix

### Phase 2: Comprehensive Testing
Create Playwright tests for:
- All 71 unverified methods
- All modal interactions
- All context menu operations
- All alignment tools
- Section resize operations
- Edge operations
- Batch operations

### Phase 3: Manual Side-by-Side Verification
- Port 5546 (main) vs Port 5550 (refactored)
- Test EVERY feature in both versions
- Document any differences or regressions

---

## Risk Assessment

**HIGH RISK** - Many features unverified:
- 71 of 94 methods not yet confirmed present in refactored version
- Critical features like section resizing, alignment tools, auto-arrange not tested
- Context menu operations not functionally verified
- Modal systems (group wizard, section wizard) not tested

**RECOMMENDATION**: **DO NOT MERGE** until comprehensive testing confirms zero regressions.

---

**Document Status**: IN PROGRESS
**Last Updated**: 2025-10-27
**Next Action**: Complete composable export verification, then create comprehensive Playwright test suite
