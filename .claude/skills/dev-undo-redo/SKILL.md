---
name: Fix Undo/Redo Conflicts
description: FIX conflicting undo/redo implementations that break state synchronization. Replace multiple systems with one VueUse + Pinia solution. Use when undo/redo doesn't work, state gets corrupted, or keyboard shortcuts fail.
---

# PomoFlow Undo/Redo Unification

## Instructions

### **MANDATORY: Use VueUse + Pinia System Only**

**ALWAYS** use this exact pattern for PomoFlow undo/redo:

```typescript
import { useManualRefHistory } from '@vueuse/core'

const {
  history,
  undo,
  redo,
  canUndo,
  canRedo,
  commit
} = useManualRefHistory(unifiedState, {
  capacity: 50,
  deep: true,
  clone: true
})

// Pattern: Save state before and after every change
const saveState = (description: string) => {
  commit() // VueUse handles everything
}
```

### **Implementation Rules**

1. **NEVER** create custom undo/redo implementations
2. **NEVER** use manual JSON serialization
3. **NEVER** create multiple history managers
4. **ALWAYS** call `saveState()` before and after state changes
5. **ALWAYS** use the unified composable `useUnifiedUndoRedo()`
6. **ALWAYS** handle both stores (tasks, canvas, timer) in one system

### **Store Action Pattern**

```typescript
actions: {
  createTask(taskData: Partial<Task>) {
    const undoRedo = useUnifiedUndoRedo()
    undoRedo.saveState('Before task creation')

    // Your logic here
    this.tasks.push(newTask)

    undoRedo.saveState('After task creation')
    return newTask
  }
}
```

### **Component Pattern**

```vue
<script setup>
const { canUndo, canRedo, undo, redo } = useUnifiedUndoRedo()

// Keyboard shortcuts handled automatically
// UI shows correct button states
</script>

<template>
  <button @click="undo" :disabled="!canUndo">↶ Undo</button>
  <button @click="redo" :disabled="!canRedo">↷ Redo</button>
</template>
```

This skill ensures ONE consistent undo/redo system across PomoFlow, eliminating all conflicts and providing reliable functionality.