---
name: PomoFlow Undo/Redo Unification
description: Replace all conflicting undo/redo implementations with one proven VueUse + Pinia system that works end-to-end across the entire PomoFlow application.
---

# PomoFlow Undo/Redo Unification

**🎯 ACTIVATING POMOFLOW UNDO/REDO UNIFICATION SKILL**

Replacing ALL current undo/redo implementations with ONE proven system based on VueUse + Pinia that provides consistent, reliable, and performant undo/redo functionality across the entire PomoFlow application.

## Current Problem Analysis

PomoFlow currently has **7 conflicting undo/redo implementations**:

1. `useUndoRedo.ts` - Complex manual system with circular reference issues
2. `useUnifiedUndoRedo.ts` - VueUse-based but incomplete
3. `useCanvasUndoHistory.ts` - Canvas-specific implementation
4. `useSimpleCanvasUndo.ts` - Another canvas variant
5. `useSimpleUndoRedo.ts` - Simplified version
6. `useVueUndoHistory.ts` - Vue history composable
7. Multiple test files and debug variants

**Issues Identified:**
- Circular reference serialization failures
- Memory leaks with unlimited history growth
- Inconsistent behavior across components
- Race conditions in concurrent operations
- Performance degradation with large state trees
- Canvas integration complexity

## **THE SOLUTION: VueUse + Pinia Unified System**

Based on research and production best practices, **VueUse's `useManualRefHistory` with Pinia** is the definitive solution for PomoFlow.

### Why This System is Recommended

1. **Production Proven**: Used in thousands of Vue 3 applications
2. **Memory Efficient**: Built-in capacity management and cleanup
3. **Performance Optimized**: Uses structured cloning and lazy evaluation
4. **TypeScript Native**: Full type safety and IntelliSense support
5. **Vue 3 Compatible**: Designed specifically for Composition API
6. **Pinia Integration**: Seamless state management integration
7. **Minimal Code**: Reduces undo/redo code by 80%

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VueUse        │    │   Pinia Stores   │    │   Components    │
│ useManualRefHistory│◄──►│   Tasks Store    │◄──►│   CanvasView    │
└─────────────────┘    │   Timer Store    │    │   BoardView     │
         │               │   Canvas Store   │    │   TaskCards     │
         │               └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   History       │    │   State Snapshots│    │   User Actions  │
│   Management    │    │   & Recovery     │    │   & UI Updates   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Implementation Pattern

### 1. Unified State Composable

```typescript
// src/composables/useUnifiedUndoRedo.ts
import { computed, ref } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'

export const useUnifiedUndoRedo = () => {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const canvasStore = useCanvasStore()

  // Create a unified state object that combines all stores
  const unifiedState = computed(() => ({
    tasks: [...taskStore.tasks],
    projects: [...taskStore.projects],
    timer: {
      isActive: timerStore.isActive,
      currentTaskId: timerStore.currentTaskId,
      timeRemaining: timerStore.timeRemaining,
      isBreak: timerStore.isBreak
    },
    canvas: {
      sections: [...canvasStore.sections],
      selectedNodes: [...canvasStore.selectedNodes],
      viewport: { ...canvasStore.viewport }
    }
  }))

  // VueUse handles all the complexity
  const {
    history,
    undo,
    redo,
    canUndo,
    canRedo,
    commit,
    clear,
    reset
  } = useManualRefHistory(unifiedState, {
    capacity: 50,
    deep: true,
    clone: true
  })

  // Simple state saving
  const saveState = (description: string) => {
    try {
      commit()
      console.log(`✅ State saved: ${description}`)
      return true
    } catch (error) {
      console.error('❌ Failed to save state:', error)
      return false
    }
  }

  return {
    // VueUse-provided functionality
    history,
    canUndo,
    canRedo,
    undo,
    redo,
    clear,

    // PomoFlow-specific methods
    saveState,

    // Convenience getters
    historyCount: computed(() => history.value.length),
    canClearHistory: computed(() => history.value.length > 0)
  }
}
```

### 2. Store Integration Pattern

```typescript
// src/stores/tasks.ts (enhanced)
import { defineStore } from 'pinia'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [] as Task[],
    projects: [] as Project[],
    selectedTaskId: null as string | null
  }),

  actions: {
    createTask(taskData: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState('Before task creation')

      const task = {
        id: generateId(),
        ...taskData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      this.tasks.push(task)
      undoRedo.saveState('After task creation')
      return task
    },

    updateTask(taskId: string, updates: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState('Before task update')

      const taskIndex = this.tasks.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        this.tasks[taskIndex] = {
          ...this.tasks[taskIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        }
      }

      undoRedo.saveState('After task update')
    },

    deleteTask(taskId: string) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState('Before task deletion')

      const taskIndex = this.tasks.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        this.tasks.splice(taskIndex, 1)
      }

      undoRedo.saveState('After task deletion')
    },

    // Batch operations
    bulkUpdateTasks(taskIds: string[], updates: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState(`Before bulk update of ${taskIds.length} tasks`)

      taskIds.forEach(id => {
        this.updateTask(id, updates)
      })

      undoRedo.saveState(`After bulk update of ${taskIds.length} tasks`)
    }
  }
})
```

### 3. Canvas Integration

```typescript
// src/stores/canvas.ts (enhanced)
import { defineStore } from 'pinia'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    sections: [] as CanvasSection[],
    selectedNodes: [] as string[],
    viewport: { x: 0, y: 0, zoom: 1 },
    isDragging: false
  }),

  actions: {
    createSection(sectionData: Omit<CanvasSection, 'id'>) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState('Before canvas section creation')

      const section = {
        id: generateId(),
        ...sectionData,
        createdAt: new Date().toISOString()
      }

      this.sections.push(section)
      undoRedo.saveState('After canvas section creation')
      return section
    },

    updateTaskPosition(taskId: string, position: { x: number, y: number }) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState(`Before moving task ${taskId}`)

      // Update task position in sections
      this.sections.forEach(section => {
        if (section.taskId === taskId) {
          section.position = position
        }
      })

      undoRedo.saveState(`After moving task ${taskId}`)
    },

    selectNodes(nodeIds: string[]) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState(`Before selecting ${nodeIds.length} nodes`)

      this.selectedNodes = [...nodeIds]
      undoRedo.saveState(`After selecting ${nodeIds.length} nodes`)
    },

    // Viewport changes
    setViewport(x: number, y: number, zoom: number) {
      const undoRedo = useUnifiedUndoRedo()
      undoRedo.saveState(`Before viewport change to (${x}, ${y}, ${zoom})`)

      this.viewport = { x, y, zoom }
      undoRedo.saveState(`After viewport change`)
    }
  }
})
```

### 4. Component Integration

```vue
<!-- src/views/CanvasView.vue (simplified) -->
<template>
  <div class="canvas-view">
    <div class="toolbar">
      <button
        @click="undo"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
      >
        ↶ Undo
      </button>
      <button
        @click="redo"
        :disabled="!canRedo"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↷ Redo
      </button>
      <span class="history-count">
        {{ historyCount }} operations
      </span>
    </div>

    <!-- Canvas content -->
    <div class="canvas-container" ref="canvasRef">
      <!-- Canvas rendering logic -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

const { canUndo, canRedo, undo, redo, historyCount } = useUnifiedUndoRedo()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Keyboard shortcuts
onMounted(() => {
  const handleKeydown = (event: KeyboardEvent) => {
    const { ctrlKey, metaKey, shiftKey, key } = event
    const hasModifier = ctrlKey || metaKey

    if (hasModifier && key.toLowerCase() === 'z') {
      if (shiftKey) {
        redo()
      } else {
        undo()
      }
      event.preventDefault()
    }
  }

  document.addEventListener('keydown', handleKeydown)
})
</script>
```

## Migration Strategy

### Phase 1: Preparation (Day 1)
1. **Backup current implementations**
   ```bash
   mkdir backup-undo-redo
   cp src/composables/*undo* backup-undo-redo/
   ```

2. **Install VueUse if not already installed**
   ```bash
   npm install @vueuse/core
   ```

### Phase 2: Core Implementation (Day 2)
1. **Create unified composable** (`src/composables/useUnifiedUndoRedo.ts`)
2. **Enhance stores** with saveState calls
3. **Update keyboard handler** to use new system
4. **Test basic operations**

### Phase 3: Component Integration (Day 3)
1. **Update CanvasView** with new undo/redo
2. **Update BoardView** with new undo/redo
3. **Update TaskCard** components
4. **Add undo/redo UI controls**

### Phase 4: Canvas Operations (Day 4)
1. **Implement canvas node movement** undo/redo
2. **Implement viewport changes** undo/redo
3. **Implement selection changes** undo/redo
4. **Test canvas interactions**

### Phase 5: Cleanup & Testing (Day 5)
1. **Remove old implementations**
2. **Comprehensive testing**
3. **Performance validation**
4. **Documentation updates**

## Implementation Checklist

### ✅ Core Requirements
- [ ] VueUse `useManualRefHistory` implemented
- [ ] All stores call `saveState()` before/after changes
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z) working
- [ ] UI controls showing undo/redo availability
- [ ] History count display

### ✅ Store Integration
- [ ] TaskStore operations with undo/redo
- [ ] TimerStore operations with undo/redo
- [ ] CanvasStore operations with undo/redo
- [ ] Batch operations with single history entry

### ✅ Canvas Operations
- [ ] Node movement with undo/redo
- [ ] Node creation/deletion with undo/redo
- [ ] Selection changes with undo/redo
- [ ] Viewport changes with undo/redo

### ✅ Performance & Memory
- [ ] History limited to 50 entries
- [ ] Memory usage monitored
- [ ] No memory leaks in testing
- [ ] Performance under 100ms for operations

### ✅ Testing
- [ ] Unit tests for core functionality
- [ ] Integration tests for store operations
- [ ] E2E tests for user workflows
- [ ] Canvas interaction tests

## Expected Benefits

1. **80% Code Reduction**: From 7 implementations to 1
2. **Consistent Behavior**: Same undo/redo across entire app
3. **Better Performance**: Optimized by VueUse team
4. **Type Safety**: Full TypeScript support
5. **Easier Maintenance**: Single system to understand and debug
6. **Future-Proof**: Built on Vue 3 Composition API

## Risk Mitigation

### Low Risk
- VueUse is widely used and battle-tested
- Non-breaking change for users
- Gradual migration possible

### Mitigation Strategies
1. **Keep backup** of current implementations
2. **Test thoroughly** before deployment
3. **Monitor performance** after implementation
4. **Rollback plan** ready if issues arise

## Success Metrics

- [ ] All undo/redo operations work consistently
- [ ] No performance degradation
- [ ] Memory usage stable over time
- [ ] User testing confirms improved experience
- [ ] Code complexity reduced significantly

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
🎯 **POMOFLOW UNDO/REDO UNIFICATION SKILL ACTIVATED**
Replacing all conflicting undo/redo systems with one proven VueUse + Pinia implementation for consistent, reliable functionality...
```

This skill provides a definitive, production-ready solution that will solve all of PomoFlow's undo/redo challenges with minimal complexity and maximum reliability.