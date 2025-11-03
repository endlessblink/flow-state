---
id: mh24be2bawywzlyh8gc
timestamp: 2025-10-22T14:58:12.083Z
project: pomo-flow-undo-redo-fix
category: design
tags: []
priority: medium
---

## Phase 2: Unified VueUse-Based Undo System Design

### Design Principles:
1. **Single Source of Truth** - One composable for all undo operations
2. **VueUse useManualRefHistory** - Proven, reliable, official Vue ecosystem
3. **Manual commit() control** - Perfect for keyboard-triggered deletions
4. **Task-based state** - Track tasks array directly, not command objects
5. **Simple API** - Easy to use across all components

### Core Architecture:

```typescript
// src/composables/useUnifiedUndoRedo.ts
export const useUnifiedUndoRedo = () => {
  const taskStore = useTaskStore()
  
  // Track the actual tasks array from Pinia store
  const state = computed(() => taskStore.tasks)
  
  const {
    history,
    undo,
    redo,
    canUndo,
    canRedo,
    commit,
    clear
  } = useManualRefHistory(state, {
    capacity: 50,
    clone: true,
    deep: true,
    dump: JSON.stringify,
    parse: JSON.parse
  })
  
  // Wrapper methods for consistent API
  const saveState = () => {
    commit()
    console.log('💾 State saved to undo history')
  }
  
  const deleteTaskWithUndo = (taskId: string) => {
    saveState() // Save BEFORE deletion
    taskStore.deleteTask(taskId)
  }
  
  const updateTaskWithUndo = (taskId: string, updates: any) => {
    saveState() // Save BEFORE update
    taskStore.updateTask(taskId, updates)
  }
  
  return {
    // State
    history,
    canUndo,
    canRedo,
    undoCount: computed(() => history.value.length - 1),
    redoCount: computed(() => Math.max(0, 50 - history.value.length)),
    
    // Actions
    undo,
    redo,
    saveState,
    deleteTaskWithUndo,
    updateTaskWithUndo,
    clear
  }
}
```

### Migration Strategy:
1. **Replace all imports** of old undo composables with `useUnifiedUndoRedo`
2. **Update task store** to remove command pattern dependencies
3. **Fix keyboard handlers** to use new unified system
4. **Remove all old command pattern files**
5. **Test all deletion methods**: Delete, Shift+Delete, Backspace

### Key Benefits:
- ✅ **No more command pattern complexity**
- ✅ **Direct task array tracking** (what we actually care about)
- ✅ **Manual commit() control** (perfect for keyboard shortcuts)
- ✅ **Proven VueUse reliability** (8.8 trust score)
- ✅ **Simple, consistent API** across all components

### Files to Replace:
- `src/views/CanvasView.vue` - Update imports and method calls
- `src/stores/tasks.ts` - Remove command pattern, use direct store methods
- `src/utils/globalKeyboardHandler.ts` - Use unified undo system
- `src/App.vue` - Update undo/redo shortcut handling

This design eliminates ALL the complexity and uses the battle-tested VueUse approach!