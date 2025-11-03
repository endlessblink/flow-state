---
id: mh24t2kn70yr95iqyii
timestamp: 2025-10-22T15:11:56.999Z
project: pomo-flow-undo-redo-fix
category: implementation
tags: []
priority: medium
---

## CanvasView.vue Updated - Critical Deletion Paths Fixed ✅

### Changes Made:
1. **Import updated**: `useSimpleUndoRedo` → `useUnifiedUndoRedo`
2. **Initialization updated**: Now using unified system with direct task store integration
3. **Critical deletion paths updated**:
   - **Shift+Delete** (permanent deletion): `undoHistory.deleteTaskWithUndo(node.id)`
   - **Delete** (move to inbox): `undoHistory.updateTaskWithUndo(node.id, {...})`
   - **Context menu delete**: `undoHistory.deleteTaskWithUndo(nodeId)`
4. **Logging fixed**: All `.value` properties correctly accessed for computed refs

### Status:
- ✅ **Keyboard deletions** (Delete, Shift+Delete, Backspace) now use unified system
- ✅ **Context menu deletions** now use unified system
- ⚠️ **Other task operations** still need updating (20+ updateTaskWithUndo calls)

### Key Benefits:
- **No more command pattern conflicts** in critical deletion paths
- **Proper state tracking** via VueUse useManualRefHistory
- **Correct computed property access** (.value for reactive refs)
- **Enhanced debugging** with detailed console logging

### Next Critical Step:
Update task store to remove command pattern dependencies and ensure direct task operations work properly with the new unified system.

The main deletion flows should now work correctly and register in undo history!