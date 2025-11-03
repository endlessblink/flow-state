---
id: mh24axa2k3jtkbyz8yn
timestamp: 2025-10-22T14:57:50.330Z
project: pomo-flow-undo-redo-fix
category: analysis
tags: []
priority: medium
---

## Complete Dependency Mapping - Phase 1 DONE

### Files Using Undo/Redo Systems:
**Core Undo Composables (5 implementations):**
- `src/composables/useSimpleUndoRedo.ts` ✅ VueUse-based (already working)
- `src/composables/useVueUndoHistory.ts` - Alternative VueUse implementation
- `src/composables/useCanvasUndoHistory.ts` - Canvas-specific VueUse
- `src/composables/useSimpleCanvasUndo.ts` - Simplified canvas undo
- `src/composables/useUndoRedo/index.ts` - Main command pattern hub
- `src/composables/useUndoRedo.ts` - Legacy command pattern

**Command Pattern Files:**
- `src/composables/useUndoRedo/commands/base.ts` - Base command class
- `src/composables/useUndoRedo/commands/taskCommands.ts` - Task CRUD commands (causing errors)
- `src/composables/useUndoRedo/commands/canvasCommands.ts` - Canvas commands
- `src/composables/useUndoRedo/commands/timerCommands.ts` - Timer commands
- `src/stores/undoRedo.ts` - Command pattern store

**UI Components & Views:**
- `src/views/CanvasView.vue` - Main canvas (mixed implementation)
- `src/App.vue` - Global app undo
- `src/utils/globalKeyboardHandler.ts` - Keyboard shortcuts
- `src/utils/globalKeyboardHandlerSimple.ts` - Simplified handler

**Store Integration:**
- `src/stores/tasks.ts` - Task store with command pattern
- `src/stores/canvas.ts` - Canvas store 
- `src/stores/timer.ts` - Timer store

### Current Issues Confirmed:
1. **Mixed implementations**: VueUse in CanvasView + command pattern in stores
2. **TypeErrors**: `store.tasks.find is not a function` in command classes
3. **Console errors**: `[object Object]` instead of actual values
4. **Empty undo stack**: Despite deletions happening

### Keyboard/Deletion Files Found:
- 122 files contain delete/keydown handling
- Primary handlers: CanvasView.vue, globalKeyboardHandler.ts
- Multiple test files and debug scripts

### Root Cause Identified:
The app has **5 different undo systems** fighting each other. Need to consolidate to **1 VueUse system**.