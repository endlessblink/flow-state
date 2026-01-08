# SOP: Undo/Redo System Architecture & Troubleshooting

**Date**: January 8, 2026
**Status**: Reference
**Category**: UNDO
**Priority**: P2-MEDIUM
**Related**: BUG-026, BUG-027, TASK-139, TASK-140

## Overview

The Pomo-Flow undo/redo system uses a singleton pattern with VueUse's `useManualRefHistory` to track task and group state changes. This SOP documents the architecture, common issues, and troubleshooting steps.

## System Architecture

### Core Components

| File | Purpose |
|------|---------|
| `src/composables/undoSingleton.ts` | Singleton undo system with `useManualRefHistory` |
| `src/composables/useGlobalKeyboardHandler.ts` | Global Ctrl+Z/Ctrl+Shift+Z keyboard handler |
| `src/composables/useUndoRedo.ts` | Bridge composable for components |
| `src/stores/tasks.ts` | Task operations that trigger undo commits |

### Singleton Pattern

```typescript
// undoSingleton.ts - Core singleton
let refHistoryInstance: ReturnType<typeof useManualRefHistory<UndoRedoState>> | null = null

export function getUndoSystem() {
  if (!refHistoryInstance) {
    refHistoryInstance = useManualRefHistory<UndoRedoState>(state, { capacity: 50 })
  }
  return refHistoryInstance
}
```

### State Structure

```typescript
interface UndoRedoState {
  tasks: Task[]
  groups: CanvasGroup[]
}
```

### Three Intentional Undo Systems

| System | Scope | Purpose |
|--------|-------|---------|
| Main Singleton | App-wide | Task/group state for Board and Canvas views |
| QuickSort Local | QuickSortView only | Local stack for quick sort operations |
| TiptapEditor Built-in | Editor only | Uses Tiptap's native undo/redo |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Y` | Redo (alternative) |

### Handler Priority

The global keyboard handler operates in **bubble phase** to avoid conflicts:

```typescript
// globalKeyboardHandlerSimple.ts
document.addEventListener('keydown', handler, false) // bubble phase
```

## Common Issues & Solutions

### Issue 1: Undo Not Working

**Symptoms**: Ctrl+Z has no effect

**Checklist**:
1. Check if focus is on an input/textarea (undo is blocked for editable elements)
2. Verify keyboard handler is initialized: look for `✅ Global keyboard handler initialized` in console
3. Check undo history count in console: `🔍 [UNDO-DEBUG] undoCount: X`

**Solution**: Ensure focus is not on an input element before pressing Ctrl+Z

### Issue 2: Excessive Console Logging

**Symptoms**: Console flooded with sync messages

**Root Cause**: Debug logging in sync functions

**Solution**: Comment out or wrap logs in DEV check:
```typescript
// Example fix from BUG-026
// BUG-026: Disabled excessive logging - fires hundreds of times per second
// console.log(`🔗 [SYNC-EDGES] Synced ${validEdges.length} edges`)
```

### Issue 3: Undo History Lost on Refresh

**Symptoms**: Can't undo actions from before page refresh

**Current Status**: Expected behavior (TASK-139 planned to fix)

**Workaround**: None currently - use undo before refreshing

## Verification Steps

### Testing Undo/Redo

1. Create a new task
2. Verify console shows: `✅ Task created: [name]` and `💾 [UNDO-DEBUG] Saving state`
3. Press Ctrl+Z
4. Verify console shows: `↩️ UNDO WORKING NOW` and `✅ Undo successful`
5. Task should disappear
6. Press Ctrl+Shift+Z
7. Verify console shows: `🔄 Redo shortcut detected` and `✅ Redo successful`
8. Task should reappear

### Expected Console Messages

**On task creation**:
```
➕ createTaskWithUndo called with: {title: ...}
💾 [UNDO-DEBUG] Saving state: X canvas tasks, Y groups
✅ Task created: [task name]
```

**On undo**:
```
↩️ UNDO WORKING NOW - Undo shortcut detected (Ctrl+Z)
🔄 [UNDO] Restoring: X tasks, Y groups
✅ Undo successful - task(s) should be restored
```

**On redo**:
```
🔄 Redo shortcut detected (Ctrl+Shift+Z)
🔄 [REDO] Restoring: X tasks, Y groups
✅ Redo successful - task(s) should be re-applied
```

## Related Files

- `src/composables/undoSingleton.ts` - Core undo system
- `src/composables/useGlobalKeyboardHandler.ts` - Keyboard shortcuts
- `src/composables/canvas/useCanvasSync.ts` - Canvas sync (BUG-026 fix location)
- `src/stores/tasks.ts` - Task operations with undo integration

## History

| Date | Change |
|------|--------|
| Jan 8, 2026 | BUG-026: Fixed excessive SYNC-EDGES logging |
| Jan 8, 2026 | BUG-027: Closed as NOT A BUG (was HMR behavior) |
| Jan 8, 2026 | Verified undo/redo working on Board and Canvas views |
