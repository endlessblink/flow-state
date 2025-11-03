# Pomo-Flow - Unified Undo/Redo System Architecture

## Overview

Pomo-Flow implements a sophisticated **unified undo/redo system** that replaces multiple conflicting implementations with a single, consistent solution. Built on VueUse's `useManualRefHistory` with deep cloning and JSON serialization, it provides reliable state tracking across all application operations.

## Architecture Overview

```
Unified Undo/Redo System
├── useUnifiedUndoRedo (Core Composable)
├── Store Integration (Task, Canvas, Timer Stores)
├── State Serialization (JSON-based)
├── History Management (50-entry capacity)
└── Persistence (Automatic saving)
```

## Core Technology Stack

### VueUse Integration
- **Library**: @vueuse/core
- **Function**: `useManualRefHistory`
- **Features**: Manual state tracking, deep cloning, capacity management
- **Customization**: Custom serialization, persistence integration

### State Management
- **Deep Cloning**: Complete state preservation
- **JSON Serialization**: Cross-session persistence
- **Circular Buffer**: 50-entry capacity with automatic cleanup
- **Memory Optimization**: Efficient state diffing

## System Architecture

### Core Composable Structure

```typescript
export function useUnifiedUndoRedo() {
  // History state
  const history = ref<{
    past: any[]
    present: any
    future: any[]
  }>({
    past: [],
    present: null,
    future: []
  })

  // Capacity management
  const capacity = 50
  const isPaused = ref(false)

  // State tracking
  const { pause, resume, commit } = useManualRefHistory(
    history,
    {
      capacity,
      deep: true,
      clone: deepClone
    }
  )

  // Manual save state
  const saveState = (label?: string) => {
    if (isPaused.value) return

    const currentState = getCurrentApplicationState()
    commit(currentState, label)
  }

  // Undo operation
  const undo = () => {
    if (canUndo.value) {
      restoreState(history.value.past[history.value.past.length - 1])
      return true
    }
    return false
  }

  // Redo operation
  const redo = () => {
    if (canRedo.value) {
      restoreState(history.value.future[0])
      return true
    }
    return false
  }

  // State validation
  const canUndo = computed(() => history.value.past.length > 0)
  const canRedo = computed(() => history.value.future.length > 0)

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    pause,
    resume,
    clearHistory,
    getHistory
  }
}
```

### State Serialization

```typescript
// Deep cloning with special handling for complex objects
const deepClone = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj)
  if (obj instanceof Map) return new Map(Array.from(obj.entries()))
  if (obj instanceof Set) return new Set(Array.from(obj.values()))
  if (typeof obj === 'function') return obj

  // Handle circular references
  const seen = new WeakSet()
  const clone = Array.isArray(obj) ? [] : {}

  seen.add(obj)

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      clone[key] = typeof value === 'object' && value !== null
        ? deepClone(value)
        : value
    }
  }

  return clone
}

// JSON serialization with metadata
const serializeState = (state: any, label?: string) => {
  return {
    state: state,
    label: label || 'Action',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checksum: generateChecksum(state)
  }
}
```

## Store Integration Patterns

### Task Store Integration

```typescript
// In tasks.ts
export const useTaskStore = defineStore('tasks', () => {
  const { saveState, undo, redo, canUndo, canRedo } = useUnifiedUndoRedo()

  // Task creation with undo
  const createTask = async (taskData: Partial<Task>) => {
    // Save state before mutation
    saveState(`Create task: ${taskData.title || 'Untitled'}`)

    const task: Task = {
      id: generateId(),
      title: taskData.title || '',
      description: taskData.description || '',
      status: 'planned',
      priority: null,
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: taskData.dueDate || '',
      instances: [],
      projectId: taskData.projectId || 'default',
      parentTaskId: taskData.parentTaskId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: taskData.canvasPosition,
      isInInbox: taskData.isInInbox || false,
      dependsOn: taskData.dependsOn || []
    }

    tasks.value.push(task)
    await saveToDatabase()

    return task
  }

  // Task update with undo
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const task = getTaskById(taskId)
    if (!task) return

    saveState(`Update task: ${task.title}`)

    Object.assign(task, updates, { updatedAt: new Date() })
    await saveToDatabase()
  }

  // Task deletion with undo
  const deleteTask = async (taskId: string) => {
    const task = getTaskById(taskId)
    if (!task) return

    saveState(`Delete task: ${task.title}`)

    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index > -1) {
      tasks.value.splice(index, 1)
    }

    await saveToDatabase()
  }

  return {
    createTask,
    updateTask,
    deleteTask,
    undo,
    redo,
    canUndo,
    canRedo
  }
})
```

### Canvas Store Integration

```typescript
// In canvas.ts
export const useCanvasStore = defineStore('canvas', () => {
  const { saveState, undo, redo } = useUnifiedUndoRedo()

  // Position update with undo
  const updateTaskPosition = (taskId: string, position: Position) => {
    saveState(`Move task to (${position.x}, ${position.y})`)
    taskPositions.set(taskId, position)
    saveToDatabase()
  }

  // Section creation with undo
  const createSection = (sectionData: Partial<CanvasSection>) => {
    saveState(`Create section: ${sectionData.title}`)

    const section: CanvasSection = {
      id: generateId(),
      type: sectionData.type || 'custom',
      title: sectionData.title || 'New Section',
      position: sectionData.position || { x: 0, y: 0 },
      size: sectionData.size || { width: 300, height: 400 },
      collapsed: false,
      collapsedHeight: 40,
      filter: sectionData.filter,
      color: sectionData.color,
      icon: sectionData.icon
    }

    sections.push(section)
    saveToDatabase()

    return section
  }

  return {
    updateTaskPosition,
    createSection,
    undo,
    redo
  }
})
```

### Timer Store Integration

```typescript
// In timer.ts
export const useTimerStore = defineStore('timer', () => {
  const { saveState, undo, redo } = useUnifiedUndoRedo()

  // Session completion with undo
  const completeSession = () => {
    saveState('Complete timer session')

    const session: TimerSession = {
      id: generateId(),
      taskId: currentTaskId,
      type: sessionType,
      startTime: currentSessionStartTime!,
      endTime: new Date(),
      duration: calculateDuration(),
      completed: true
    }

    sessionHistory.push(session)
    updateStatistics()
    saveToDatabase()
  }

  return {
    completeSession,
    undo,
    redo
  }
})
```

## Operation Types and Labels

### Task Operations
```typescript
const TASK_OPERATIONS = {
  CREATE: (title: string) => `Create task: ${title}`,
  UPDATE: (title: string) => `Update task: ${title}`,
  DELETE: (title: string) => `Delete task: ${title}`,
  MOVE: (title: string, from: string, to: string) =>
    `Move "${title}" from ${from} to ${to}`,
  STATUS_CHANGE: (title: string, status: string) =>
    `Change "${title}" status to ${status}`,
  PRIORITY_CHANGE: (title: string, priority: string) =>
    `Change "${title}" priority to ${priority}`,
  ASSIGN_PROJECT: (title: string, project: string) =>
    `Assign "${title}" to ${project}`
}
```

### Canvas Operations
```typescript
const CANVAS_OPERATIONS = {
  MOVE_NODE: (taskId: string, position: Position) =>
    `Move task to (${position.x}, ${position.y})`,
  CREATE_SECTION: (title: string) => `Create section: ${title}`,
  DELETE_SECTION: (title: string) => `Delete section: ${title}`,
  COLLAPSE_SECTION: (title: string) => `Collapse section: ${title}`,
  EXPAND_SECTION: (title: string) => `Expand section: ${title}`,
  CREATE_CONNECTION: (from: string, to: string) =>
    `Connect ${from} to ${to}`,
  DELETE_CONNECTION: (from: string, to: string) =>
    `Remove connection between ${from} and ${to}`
}
```

### Timer Operations
```typescript
const TIMER_OPERATIONS = {
  START_SESSION: (taskTitle: string) => `Start session: ${taskTitle}`,
  COMPLETE_SESSION: () => 'Complete timer session',
  PAUSE_SESSION: () => 'Pause timer session',
  RESET_TIMER: () => 'Reset timer',
  UPDATE_SETTINGS: () => 'Update timer settings'
}
```

## History Management

### History Entry Structure
```typescript
interface HistoryEntry {
  id: string                    // Unique entry identifier
  state: ApplicationState       // Complete application state
  label: string                 // Human-readable description
  timestamp: Date              // When the action occurred
  operation: OperationType     // Type of operation
  metadata: {
    affectedStores: string[]   // Stores that were modified
    affectedEntities: string[] // Entity IDs that were changed
    userAction: string         // Action that triggered the change
  }
}
```

### History Navigation
```typescript
// Navigate through history
const navigateHistory = (direction: 'back' | 'forward') => {
  if (direction === 'back' && canUndo.value) {
    const targetEntry = history.value.past[history.value.past.length - 1]
    restoreState(targetEntry.state)
    moveToHistoryPosition('back')
  } else if (direction === 'forward' && canRedo.value) {
    const targetEntry = history.value.future[0]
    restoreState(targetEntry.state)
    moveToHistoryPosition('forward')
  }
}

// Jump to specific history position
const jumpToHistory = (entryId: string) => {
  const entry = findHistoryEntry(entryId)
  if (entry) {
    restoreState(entry.state)
    // Reset future history from this point
    history.value.future = []
  }
}
```

### History Persistence
```typescript
// Save history to localStorage
const saveHistory = () => {
  const historyData = {
    entries: history.value.past.slice(-20), // Keep last 20 entries
    current: history.value.present,
    version: '1.0.0',
    savedAt: new Date().toISOString()
  }

  localStorage.setItem('undo-redo-history', JSON.stringify(historyData))
}

// Load history from localStorage
const loadHistory = () => {
  const saved = localStorage.getItem('undo-redo-history')
  if (saved) {
    try {
      const historyData = JSON.parse(saved)
      history.value.past = historyData.entries || []
      history.value.present = historyData.current || null
      history.value.future = []
    } catch (error) {
      console.error('Failed to load undo/redo history:', error)
    }
  }
}
```

## State Restoration Process

### Complete State Restoration
```typescript
const restoreState = (state: ApplicationState) => {
  // Pause undo tracking during restoration
  const { pause, resume } = useUnifiedUndoRedo()
  pause()

  try {
    // Restore each store
    restoreTaskStore(state.tasks)
    restoreCanvasStore(state.canvas)
    restoreTimerStore(state.timer)
    restoreUIStore(state.ui)

    // Trigger reactive updates
    nextTick(() => {
      // Notify components of state change
      eventBus.emit('state:restored', state)
    })
  } finally {
    resume()
  }
}

// Store-specific restoration
const restoreTaskStore = (taskState: any) => {
  const taskStore = useTaskStore()
  taskStore.$patch({
    tasks: taskState.tasks,
    projects: taskState.projects,
    activeStatusFilter: taskState.activeStatusFilter,
    hideDoneTasks: taskState.hideDoneTasks,
    selectedTaskIds: taskState.selectedTaskIds
  })
}
```

### Partial State Restoration
```typescript
// Restore only specific parts of state
const restorePartialState = (
  stores: string[],
  state: Partial<ApplicationState>
) => {
  const { pause, resume } = useUnifiedUndoRedo()
  pause()

  try {
    if (stores.includes('tasks')) {
      restoreTaskStore(state.tasks)
    }
    if (stores.includes('canvas')) {
      restoreCanvasStore(state.canvas)
    }
    if (stores.includes('timer')) {
      restoreTimerStore(state.timer)
    }
  } finally {
    resume()
  }
}
```

## Performance Optimization

### Efficient State Diffing
```typescript
// Only save state when significant changes occur
const shouldSaveState = (oldState: any, newState: any): boolean => {
  // Deep comparison with performance optimization
  return !isEqual(oldState, newState)
}

// Optimized state comparison
const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((val, i) => isEqual(val, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    return keysA.length === keysB.length &&
           keysA.every(key => isEqual(a[key], b[key]))
  }
  return false
}
```

### Memory Management
```typescript
// Cleanup old history entries
const cleanupHistory = () => {
  const maxEntries = 50
  if (history.value.past.length > maxEntries) {
    // Keep only the most recent entries
    history.value.past = history.value.past.slice(-maxEntries)
  }

  // Cleanup circular references
  cleanupCircularReferences(history.value)
}

// Garbage collection for history
const cleanupCircularReferences = (obj: any) => {
  const seen = new WeakSet()
  const clean = (o: any) => {
    if (typeof o !== 'object' || o === null) return
    if (seen.has(o)) return
    seen.add(o)

    for (const key in o) {
      if (typeof o[key] === 'object') {
        clean(o[key])
      }
    }
  }
  clean(obj)
}
```

### Debounced State Saving
```typescript
// Debounce rapid state changes
const debouncedSaveState = useDebounce((label?: string) => {
  const currentState = getCurrentApplicationState()
  commit(currentState, label)
}, 100) // 100ms debounce

// Use debounced save for frequent operations
const handleFrequentOperation = () => {
  debouncedSaveState('Frequent operation')
}
```

## User Interface Integration

### Keyboard Shortcuts
```typescript
// Global keyboard shortcuts
useKeyboardShortcuts([
  {
    keys: 'Ctrl+Z',
    action: () => {
      if (canUndo.value) {
        undo()
        showNotification('Undo successful', 'success')
      }
    },
    preventDefault: true
  },
  {
    keys: 'Ctrl+Y',
    action: () => {
      if (canRedo.value) {
        redo()
        showNotification('Redo successful', 'success')
      }
    },
    preventDefault: true
  },
  {
    keys: 'Ctrl+Shift+Z',
    action: () => {
      if (canRedo.value) {
        redo()
        showNotification('Redo successful', 'success')
      }
    },
    preventDefault: true
  }
])
```

### Undo/Redo UI Component
```vue
<template>
  <div class="undo-redo-controls">
    <button
      @click="undo"
      :disabled="!canUndo"
      class="undo-button"
      title="Undo (Ctrl+Z)"
    >
      <Icon name="undo" />
      <span class="tooltip">{{ undoLabel }}</span>
    </button>

    <button
      @click="redo"
      :disabled="!canRedo"
      class="redo-button"
      title="Redo (Ctrl+Y)"
    >
      <Icon name="redo" />
      <span class="tooltip">{{ redoLabel }}</span>
    </button>

    <!-- History dropdown -->
    <div class="history-dropdown" v-if="showHistory">
      <div class="history-list">
        <div
          v-for="entry in historyEntries"
          :key="entry.id"
          @click="jumpToHistory(entry.id)"
          class="history-entry"
          :class="{ active: entry.id === currentHistoryId }"
        >
          <span class="entry-label">{{ entry.label }}</span>
          <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { undo, redo, canUndo, canRedo, getHistory } = useUnifiedUndoRedo()

const undoLabel = computed(() => {
  const history = getHistory()
  return history.past[history.past.length - 1]?.label || 'Undo'
})

const redoLabel = computed(() => {
  const history = getHistory()
  return history.future[0]?.label || 'Redo'
})
</script>
```

## Error Handling and Recovery

### State Corruption Recovery
```typescript
// Detect and recover from corrupted state
const validateState = (state: any): boolean => {
  try {
    // Validate required fields
    if (!state.tasks || !Array.isArray(state.tasks)) return false
    if (!state.canvas || typeof state.canvas !== 'object') return false
    if (!state.timer || typeof state.timer !== 'object') return false

    // Validate data integrity
    return state.tasks.every(isValidTask) &&
           isValidCanvasState(state.canvas) &&
           isValidTimerState(state.timer)
  } catch (error) {
    console.error('State validation failed:', error)
    return false
  }
}

// Recovery from corrupted history
const recoverFromCorruption = () => {
  // Clear corrupted history
  history.value.past = []
  history.value.future = []
  history.value.present = null

  // Reset to known good state
  const goodState = getFallbackState()
  restoreState(goodState)

  showNotification(
    'History was corrupted and has been reset',
    'warning',
    { duration: 5000 }
  )
}
```

### Undo Operation Failures
```typescript
const safeUndo = (): boolean => {
  try {
    if (!canUndo.value) return false

    const previousState = history.value.past[history.value.past.length - 1]

    // Validate state before restoration
    if (!validateState(previousState.state)) {
      console.error('Cannot undo: previous state is corrupted')
      // Remove corrupted entry
      history.value.past.pop()
      return false
    }

    return undo()
  } catch (error) {
    console.error('Undo operation failed:', error)
    showNotification('Undo failed: ' + error.message, 'error')
    return false
  }
}
```

## Testing Strategy

### Unit Testing
```typescript
describe('Unified Undo/Redo System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should save state before mutation', () => {
    const { saveState, getHistory } = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    const initialCount = taskStore.tasks.length
    saveState('Test action')

    taskStore.createTask({ title: 'Test Task' })

    const history = getHistory()
    expect(history.past).toHaveLength(1)
    expect(history.past[0].label).toBe('Test action')
  })

  it('should undo task creation', () => {
    const { saveState, undo, canUndo } = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    const initialCount = taskStore.tasks.length
    saveState('Create task')

    const task = taskStore.createTask({ title: 'Test Task' })
    expect(taskStore.tasks.length).toBe(initialCount + 1)

    const undoSuccess = undo()
    expect(undoSuccess).toBe(true)
    expect(taskStore.tasks.length).toBe(initialCount)
  })

  it('should redo undone action', () => {
    const { saveState, undo, redo, canRedo } = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    saveState('Create task')
    const task = taskStore.createTask({ title: 'Test Task' })

    undo()
    expect(taskStore.tasks.length).toBe(0)

    const redoSuccess = redo()
    expect(redoSuccess).toBe(true)
    expect(taskStore.tasks.length).toBe(1)
  })
})
```

### Integration Testing
```typescript
describe('Undo/Redo Integration', () => {
  it('should handle complex multi-store operations', async () => {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    // Create task and assign to canvas position
    const task = taskStore.createTask({ title: 'Test Task' })
    canvasStore.updateTaskPosition(task.id, { x: 100, y: 200 })

    const initialTaskCount = taskStore.tasks.length
    const initialPosition = canvasStore.taskPositions.get(task.id)

    // Undo both operations
    undo() // Undo position update
    undo() // Undo task creation

    expect(taskStore.tasks.length).toBe(initialTaskCount - 1)
    expect(canvasStore.taskPositions.has(task.id)).toBe(false)

    // Redo both operations
    redo() // Redo task creation
    redo() // Redo position update

    expect(taskStore.tasks.length).toBe(initialTaskCount)
    expect(canvasStore.taskPositions.get(task.id)).toEqual(initialPosition)
  })
})
```

## Architecture Benefits

### 1. Consistency
- **Single Implementation**: One undo/redo system for all operations
- **Consistent Behavior**: Same undo/redo experience across all features
- **Unified Interface**: Single API for all undo/redo operations

### 2. Reliability
- **Deep Cloning**: Complete state preservation
- **State Validation**: Detect and recover from corruption
- **Error Recovery**: Graceful handling of failures

### 3. Performance
- **Efficient Storage**: Circular buffer with capacity limits
- **Memory Management**: Automatic cleanup of old entries
- **Debounced Operations**: Optimized for frequent changes

### 4. User Experience
- **Visual Feedback**: Clear indication of undo/redo availability
- **Keyboard Shortcuts**: Standard undo/redo key combinations
- **History Navigation**: View and jump to specific history points

The Unified Undo/Redo System represents a sophisticated approach to state management in complex Vue.js applications, providing users with reliable, consistent, and intuitive undo/redo functionality across all application features.

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, VueUse, Composition API