---
name: VueUse Development
description: Specialized skill for VueUse composable integration and implementation in Vue 3 applications. Focuses on proper useManualRefHistory patterns, keyboard handling, and undo/redo systems.
---

# VueUse Development

**⚡ ACTIVATING VUEUSE SKILL**

Specialized skill for VueUse composable integration and implementation in Vue 3 applications. Focuses on proper useManualRefHistory patterns, keyboard handling, and undo/redo systems.

## When to Use
- Implementing VueUse composables (useManualRefHistory, useRefHistory, etc.)
- Building undo/redo functionality
- Creating keyboard shortcuts and event handling
- Integrating state management with VueUse patterns
- Optimizing reactive state and side effects
- Building persistent state with useLocalStorage/useSessionStorage

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
⚡ **VUEUSE SKILL ACTIVATED**
Implementing VueUse composable patterns with proper integration, testing, and optimization...
```

### Core VueUse Composables

#### useManualRefHistory (Undo/Redo System)
```typescript
import { useManualRefHistory } from '@vueuse/core'

const {
  history,
  undo,
  redo,
  canUndo,
  canRedo,
  commit,
  clear,
  reset
} = useManualRefHistory(source, {
  capacity: 50,
  clone: true,
  deep: true,
  dump: JSON.stringify,
  parse: JSON.parse
})

// Manual state saving
const saveState = () => {
  commit()
}

// State restoration with undo
const performUndo = () => {
  if (canUndo.value) {
    const result = undo()
    // Restore state from history
    return result
  }
}
```

#### useRefHistory (Automatic History)
```typescript
import { useRefHistory } from '@vueuse/core'

const { history, undo, redo, canUndo, canRedo } = useRefHistory(state, {
  capacity: 100,
  deep: true
})
```

#### useLocalStorage / useSessionStorage
```typescript
import { useLocalStorage, useSessionStorage } from '@vueuse/core'

// Persistent state
const storedTasks = useLocalStorage('pomo-tasks', [])
const userPreferences = useSessionStorage('user-prefs', { theme: 'dark' })
```

#### useClipboard
```typescript
import { useClipboard, isSupported } from '@vueuse/core'

const { copy, copied, text, isSupported } = useClipboard()

// Usage
await copy('Task content')
if (copied.value) {
  console.log('Copied to clipboard!')
}
```

### Task Store Integration with VueUse

#### Unified Undo/Redo System Pattern
```typescript
// src/composables/useUnifiedUndoRedo.ts
import { computed } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'

export const useUnifiedUndoRedo = () => {
  const taskStore = useTaskStore()

  // Track the actual tasks array from Pinia store
  const state = computed(() => [...taskStore.tasks])

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

  // Manual state saving - call BEFORE making changes
  const saveState = () => {
    try {
      state.value = [...taskStore.tasks]
      commit()
      return true
    } catch (error) {
      console.error('❌ Failed to save state to undo history:', error)
      return false
    }
  }

  // Task operations with undo support
  const deleteTaskWithUndo = (taskId: string) => {
    const saved = saveState()
    if (!saved) return

    taskStore.deleteTask(taskId)
  }

  const updateTaskWithUndo = (taskId: string, updates: any) => {
    const saved = saveState()
    if (!saved) return

    taskStore.updateTask(taskId, updates)
  }

  const createTaskWithUndo = (taskData: any) => {
    const saved = saveState()
    if (!saved) return null

    return taskStore.createTask(taskData)
  }

  return {
    history,
    canUndo,
    canRedo,
    undoCount: computed(() => Math.max(0, history.value.length - 1)),
    redoCount: computed(() => Math.max(0, 50 - history.value.length)),
    undo,
    redo,
    saveState,
    clear,
    deleteTaskWithUndo,
    updateTaskWithUndo,
    createTaskWithUndo
  }
}
```

### Keyboard Integration Pattern

#### Global Keyboard Handler with VueUse
```typescript
// src/utils/globalKeyboardHandlerSimple.ts
import { useEventListener } from '@vueuse/core'

export class SimpleGlobalKeyboardHandler {
  private undoRedo: any = null

  constructor() {
    // Use VueUse for keyboard event handling
    useEventListener('keydown', this.handleKeydown.bind(this))
  }

  async init(): Promise<void> {
    // Dynamic import of undo/redo system
    try {
      const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
      this.undoRedo = useUnifiedUndoRedo()
    } catch (error) {
      console.error('❌ Failed to load unified undo/redo system:', error)
    }
  }

  private handleKeydown = (event: KeyboardEvent) => {
    const { ctrlKey, metaKey, shiftKey, key } = event
    const hasModifier = ctrlKey || metaKey

    // Handle Ctrl+Z (Undo) and Ctrl+Shift+Z (Redo)
    if (hasModifier && key.toLowerCase() === 'z') {
      if (shiftKey) {
        // Ctrl+Shift+Z = Redo
        this.executeRedo()
      } else {
        // Ctrl+Z = Undo
        this.executeUndo()
      }
      event.preventDefault()
    }

    // Handle Ctrl+Y (Redo alternative)
    else if (hasModifier && key.toLowerCase() === 'y') {
      this.executeRedo()
      event.preventDefault()
    }
  }

  private async executeUndo(): Promise<void> {
    if (!this.undoRedo || !this.undoRedo.canUndo.value) return

    try {
      const result = await this.undoRedo.undo()
      console.log('✅ Undo operation completed:', result)
    } catch (error) {
      console.error('❌ Undo operation failed:', error)
    }
  }

  private async executeRedo(): Promise<void> {
    if (!this.undoRedo || !this.undoRedo.canRedo.value) return

    try {
      const result = await this.undoRedo.redo()
      console.log('✅ Redo operation completed:', result)
    } catch (error) {
      console.error('❌ Redo operation failed:', error)
    }
  }
}
```

### Canvas Integration Pattern

#### Canvas View with VueUse Undo/Redo
```typescript
// src/views/CanvasView.vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

const undoHistory = useUnifiedUndoRedo()

// Keyboard handling with VueUse
const handleKeyDown = async (event: KeyboardEvent) => {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

  if (!isDeleteKey) return

  const selectedNodes = getSelectedNodes.value
  if (!selectedNodes || selectedNodes.length === 0) return

  const permanentDelete = event.shiftKey

  for (const node of selectedNodes) {
    if (permanentDelete) {
      // Shift+Delete: Remove task from system entirely
      console.log('🗑️ CanvasView: Shift+Delete detected for task:', node.id)
      undoHistory.deleteTaskWithUndo(node.id)
    } else {
      // Delete: Remove from canvas only, move back to inbox
      console.log('📤 CanvasView: Delete detected for task:', node.id)
      undoHistory.updateTaskWithUndo(node.id, {
        canvasPosition: undefined,
        isInInbox: true,
        instances: [],
        scheduledDate: undefined,
        scheduledTime: undefined
      })
    }
  }
}

// Use VueUse for keyboard event handling
useEventListener('keydown', handleKeyDown)
</script>
```

### Testing Pattern with VueUse

#### Comprehensive Test Component
```vue
<template>
  <div class="keyboard-deletion-test-container">
    <h2>VueUse Undo/Redo System Test</h2>

    <div class="test-controls">
      <button @click="runComprehensiveTest" :disabled="isTestRunning">
        {{ isTestRunning ? '⏳ Running...' : '🚀 Run Comprehensive Test' }}
      </button>

      <div class="status-display">
        <div>Can Undo: {{ undoHistory.canUndo ? '✅' : '❌' }}</div>
        <div>Can Redo: {{ undoHistory.canRedo ? '✅' : '❌' }}</div>
        <div>Undo Count: {{ undoHistory.undoCount }}</div>
        <div>Redo Count: {{ undoHistory.redoCount }}</div>
      </div>
    </div>

    <div class="test-results">
      <div v-for="result in testResults" :key="result.id" :class="['result-item', result.status]">
        <span>{{ result.status === 'passed' ? '✅' : '❌' }}</span>
        <span>{{ result.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

const undoHistory = useUnifiedUndoRedo()
const isTestRunning = ref(false)
const testResults = ref<Array<{id: string, status: 'passed' | 'failed', message: string}>>([])

const runComprehensiveTest = async () => {
  if (isTestRunning.value) return

  isTestRunning.value = true
  testResults.value = []

  try {
    // Test 1: Create task with undo
    const testTask = {
      title: `Test Task ${Date.now()}`,
      description: 'Created for VueUse testing',
      status: 'active' as const,
      canvasPosition: { x: 100, y: 100 }
    }

    const createdTask = undoHistory.createTaskWithUndo(testTask)
    testResults.value.push({
      id: '1',
      status: 'passed',
      message: `Created task: ${createdTask?.title}`
    })

    // Test 2: Undo task creation
    if (undoHistory.canUndo.value) {
      await undoHistory.undo()
      testResults.value.push({
        id: '2',
        status: 'passed',
        message: 'Successfully undone task creation'
      })
    }

    // Test 3: Redo task creation
    if (undoHistory.canRedo.value) {
      await undoHistory.redo()
      testResults.value.push({
        id: '3',
        status: 'passed',
        message: 'Successfully redone task creation'
      })
    }

    // Test 4: Update task with undo
    if (createdTask) {
      undoHistory.updateTaskWithUndo(createdTask.id, {
        description: 'Updated for testing'
      })
      testResults.value.push({
        id: '4',
        status: 'passed',
        message: 'Updated task with undo support'
      })
    }

    // Test 5: Delete task with undo
    if (createdTask) {
      undoHistory.deleteTaskWithUndo(createdTask.id)
      testResults.value.push({
        id: '5',
        status: 'passed',
        message: 'Deleted task with undo support'
      })
    }

  } catch (error) {
    testResults.value.push({
      id: 'error',
      status: 'failed',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  } finally {
    isTestRunning.value = false
  }
}
</script>
```

### Key Requirements
- Always use VueUse composables for reactive state management
- Implement proper cleanup and error handling
- Use computed properties for derived state
- Test undo/redo functionality with real data
- Ensure no memory leaks with proper component cleanup

This skill ensures proper VueUse integration patterns and comprehensive testing of VueUse-based functionality.