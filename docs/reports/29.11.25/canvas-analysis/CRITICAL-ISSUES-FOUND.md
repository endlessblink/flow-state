# Canvas View - Critical Issues Found

**Date**: 2025-11-29 16:21
**Tester**: Playwright MCP Automation
**Test Method**: Real interactive browser testing

---

## Issue #1: Tasks Not Rendering on Canvas (CRITICAL)

### Status: CONFIRMED BUG

### Description
Tasks exist in the Vue Flow state (23 nodes reported) but are not visible on the canvas. The canvas area appears completely empty despite the status panel showing nodes exist.

### Evidence
- Vue Flow Status shows: "Nodes: 23"
- Canvas area: EMPTY (no visible task cards)
- Console logs show: "Removed 23 stale Vue Flow nodes"

### Root Cause
The `cleanupStaleNodes` function is incorrectly identifying valid task nodes as "stale" and removing them from the Vue Flow rendering.

### Console Log Pattern
```
🔍 [syncNodes] Task filtering: {taskId: TASK-15651...}
🔄 [SYNC] Updated nodes: 23 valid nodes
🧹 Cleaning up stale Vue Flow nodes...
Removing stale node: unknown
Removing stale node: unknown
... (23 times)
✅ Removed 23 stale Vue Flow nodes
```

### Impact
- Users cannot see tasks on the canvas
- Users cannot drag tasks or organize them visually
- Core canvas functionality is broken

### Screenshot
- `canvas-view-with-nodes.png` - Shows empty canvas with 23 nodes in status

---

## Issue #2: Context Menu Positioning Bug (HIGH)

### Status: CONFIRMED BUG

### Description
The right-click context menu appears when clicking on the canvas, but the "Create Task Here" button is positioned outside the viewport and cannot be clicked.

### Evidence
- Right-click triggers console: "📋 Context menu should be visible: true"
- Playwright error: "element is outside of the viewport"
- Button exists in DOM but positioned off-screen

### Root Cause
Context menu positioning calculation places menu outside visible area, especially when right-clicking on certain canvas regions.

### Impact
- Cannot create tasks directly on canvas via right-click
- Cannot use "Create Custom Group" or "Create Section (Smart)" options
- Workaround: Use inbox quick-add instead

### Screenshot
- `canvas-context-menu-position-bug.png` - Shows inbox expanded, context menu not visible

---

## Issue #3: Stale Node Cleanup Over-aggressive (HIGH)

### Status: CONFIRMED BUG

### Description
When navigating between views or on initial load, all Vue Flow nodes are incorrectly flagged as "stale" and removed.

### Evidence
Console repeatedly shows:
```
Removing stale node: unknown
Removing stale node: unknown
✅ Removed 23 stale Vue Flow nodes
```

### Root Cause
The stale node detection logic doesn't properly identify valid nodes, treating them all as "unknown".

### Impact
- Canvas loses all visual nodes on navigation
- Forces sync to recreate nodes every time
- Performance overhead from unnecessary cleanup/recreation

---

## Working Functionality (Verified)

| Feature | Status | Evidence |
|---------|--------|----------|
| Inbox Panel | ✅ WORKS | Shows 14 tasks correctly |
| Quick Add (Inbox) | ✅ WORKS | Created "NEW TEST TASK FROM CANVAS" successfully |
| Task Persistence | ✅ WORKS | Tasks saved to PouchDB |
| Vue Flow Status Panel | ✅ WORKS | Accurately reports node count |
| Context Menu Trigger | ⚠️ PARTIAL | Appears but positioning broken |

---

## Recommended Fixes

### Priority 1: Fix Stale Node Detection
Location: `src/views/CanvasView.vue` (cleanupStaleNodes function)
- Review logic that identifies nodes as "unknown"
- Add proper node ID validation before removal
- Consider removing aggressive cleanup entirely

### Priority 2: Fix Context Menu Positioning
Location: `src/components/canvas/CanvasContextMenu.vue`
- Calculate position relative to viewport bounds
- Clamp menu position to stay within visible area
- Account for inbox panel width when expanded

### Priority 3: Fix Node Rendering
After fixing #1, verify that:
- Nodes render correctly on initial load
- Nodes persist after navigation between views
- Node positions are preserved

---

## Test Evidence Files

1. `canvas-view-with-nodes.png` - Empty canvas despite 23 nodes in status
2. `canvas-context-menu-position-bug.png` - Inbox visible, context menu off-screen
3. `canvas-final-state.png` - Earlier test showing empty canvas
4. `playwright-test-results.txt` - Automated test results
