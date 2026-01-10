# VueUse Integration Examples

## Real-World Integration Scenarios

### 1. Enhanced Timer with VueUse
**File**: `src/composables/useEnhancedTimer.ts`

```typescript
import { useInterval, useTimeout, useNow, useTimestamp } from '@vueuse/core'
import { ref, computed, watch } from 'vue'
import { useTimerStore } from '@/stores/timer'

export const useEnhancedTimer = () => {
  const timerStore = useTimerStore()
  const isRunning = ref(false)
  const startTime = ref<number>(0)
  const duration = ref(25 * 60 * 1000) // 25 minutes default

  const now = useNow()
  const elapsed = computed(() => {
    if (!startTime.value) return 0
    return isRunning.value ? now.value.getTime() - startTime.value : 0
  })

  const remaining = computed(() => {
    return Math.max(0, duration.value - elapsed.value)
  })

  const progress = computed(() => {
    return Math.min(1, elapsed.value / duration.value)
  })

  // Enhanced interval with controls
  const { pause, resume } = useInterval(1000, {
    controls: true,
    immediate: false
  })

  // Timer controls
  const start = () => {
    startTime.value = Date.now()
    isRunning.value = true
    resume()
    timerStore.startTimer()
  }

  const pause = () => {
    isRunning.value = false
    pause()
    timerStore.pauseTimer()
  }

  const reset = () => {
    isRunning.value = false
    startTime.value = 0
    pause()
    timerStore.resetTimer()
  }

  // Auto-pause when tab becomes inactive
  const { isActive } = useDocumentVisibility()
  watch(isActive, (active) => {
    if (!active && isRunning.value) {
      pause()
    }
  })

  return {
    isRunning,
    elapsed,
    remaining,
    progress,
    start,
    pause,
    reset,
    setDuration: (newDuration: number) => {
      duration.value = newDuration
    }
  }
}
```

### 2. Canvas View with VueUse Enhancements
**File**: `src/views/CanvasView.vue` (Enhanced portions)

```vue
<script setup lang="ts">
import {
  useWindowSize,
  useBreakpoints,
  useMagicKeys,
  useEventListener,
  useThrottleFn,
  useRafFn
} from '@vueuse/core'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useEnhancedTimer } from '@/composables/useEnhancedTimer'

const taskStore = useTaskStore()
const { isRunning, remaining, progress, start, pause } = useEnhancedTimer()

// Canvas sizing with VueUse
const { width, height } = useWindowSize()
const canvasRef = ref<HTMLElement | null>(null)

const breakpoints = useBreakpoints({
  mobile: 640,
  tablet: 1024,
  desktop: 1280
})

const isMobile = breakpoints.smaller('tablet')

// Responsive canvas dimensions
const canvasSize = computed(() => ({
  width: width.value - (isMobile.value ? 0 : 320), // Account for sidebar
  height: height.value - 120 // Account for header
}))

// Enhanced keyboard shortcuts
const { space, escape, delete: del, ctrl, n } = useMagicKeys()

// Keyboard shortcuts with VueUse
watchEffect(() => {
  if (space.value) {
    isRunning.value ? pause() : start()
  }
})

watchEffect(() => {
  if (escape.value) {
    taskStore.clearSelection()
  }
})

watchEffect(() => {
  if (del.value && taskStore.selectedTaskId) {
    taskStore.deleteTask(taskStore.selectedTaskId)
  }
})

watchEffect(() => {
  if (ctrl.value && n.value) {
    taskStore.createQuickTask()
  }
})

// Throttled canvas updates
const updateCanvas = useThrottleFn(() => {
  if (canvasRef.value) {
    // Update canvas rendering
    renderCanvas()
  }
}, 16) // ~60fps

// Animation loop for smooth transitions
const { start: startAnimation, stop: stopAnimation } = useRafFn(() => {
  updateCanvas()
})

// Event listeners with automatic cleanup
useEventListener('resize', updateCanvas, { passive: true })
useEventListener('beforeunload', () => {
  taskStore.saveState()
})

// Enhanced drag handling
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const handleMouseDown = (event: MouseEvent) => {
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  startAnimation()
}

const handleMouseMove = useThrottleFn((event: MouseEvent) => {
  if (isDragging.value) {
    const deltaX = event.clientX - dragStart.value.x
    const deltaY = event.clientY - dragStart.value.y
    // Update task positions
    updateTaskPositions(deltaX, deltaY)
  }
}, 16)

const handleMouseUp = () => {
  isDragging.value = false
  stopAnimation()
}

// Global mouse events
useEventListener('mousemove', handleMouseMove)
useEventListener('mouseup', handleMouseUp)

// Cleanup
onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <div class="canvas-view">
    <div
      ref="canvasRef"
      class="canvas-container"
      :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
      @mousedown="handleMouseDown"
    >
      <!-- Canvas content -->
      <div class="timer-overlay" v-if="isRunning">
        <div class="progress-ring" :style="{ '--progress': progress }">
          {{ formatTime(remaining) }}
        </div>
      </div>
    </div>
  </div>
</template>
```

### 3. Task Management with VueUse Storage
**File**: `src/composables/usePersistentTasks.ts`

```typescript
import {
  useLocalStorage,
  useSessionStorage,
  useStorage,
  useDebounceFn
} from '@vueuse/core'
import { computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'

export const usePersistentTasks = () => {
  const taskStore = useTaskStore()

  // Persistent task data
  const tasks = useLocalStorage('pomo-tasks', [], {
    serializer: JSON,
    mergeDefaults: true
  })

  // Session-based UI state
  const uiState = useSessionStorage('pomo-ui-state', {
    selectedTaskId: null,
    activeView: 'canvas',
    sidebarCollapsed: false,
    lastPosition: { x: 0, y: 0 }
  })

  // Auto-save with debouncing
  const saveTasks = useDebounceFn(() => {
    tasks.value = taskStore.tasks
  }, 1000)

  // Watch for changes and auto-save
  watch(
    () => taskStore.tasks,
    () => saveTasks(),
    { deep: true }
  )

  // Load tasks on mount
  const loadTasks = () => {
    if (tasks.value.length > 0) {
      taskStore.loadTasks(tasks.value)
    }
  }

  // IndexedDB for large task history
  const taskHistory = useStorage('pomo-task-history', [], localStorage, {
    serializer: {
      read: (v: any) => v ? JSON.parse(v) : [],
      write: (v: any) => JSON.stringify(v)
    }
  })

  const addToHistory = (task: any) => {
    taskHistory.value.unshift({
      ...task,
      archivedAt: new Date().toISOString()
    })

    // Keep only last 100 archived tasks
    if (taskHistory.value.length > 100) {
      taskHistory.value = taskHistory.value.slice(0, 100)
    }
  }

  return {
    tasks,
    uiState,
    taskHistory,
    loadTasks,
    saveTasks,
    addToHistory,
    exportData: () => JSON.stringify({
      tasks: tasks.value,
      uiState: uiState.value,
      history: taskHistory.value
    }, null, 2),
    importData: (data: string) => {
      try {
        const parsed = JSON.parse(data)
        if (parsed.tasks) tasks.value = parsed.tasks
        if (parsed.uiState) uiState.value = { ...uiState.value, ...parsed.uiState }
        return true
      } catch (error) {
        console.error('Failed to import data:', error)
        return false
      }
    }
  }
}
```

### 4. Enhanced Keyboard Handler with VueUse
**File**: `src/composables/useVueUseKeyboard.ts`

```typescript
import {
  useMagicKeys,
  useKeyModifier,
  useEventListener,
  useDocumentVisibility
} from '@vueuse/core'
import { ref, computed, watchEffect } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

export const useVueUseKeyboard = () => {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()

  // Magic keys for complex shortcuts
  const {
    ctrl,
    shift,
    alt,
    space,
    enter,
    escape,
    delete: del,
    z,
    y,
    s,
    f,
    b,
    1, 2, 3, 4, 5
  } = useMagicKeys()

  const cmd = useKeyModifier('Meta')
  const { isActive } = useDocumentVisibility()

  // Track active shortcuts
  const activeShortcuts = ref<string[]>([])

  const addShortcut = (name: string) => {
    activeShortcuts.value.push(name)
    setTimeout(() => {
      activeShortcuts.value = activeShortcuts.value.filter(s => s !== name)
    }, 1000)
  }

  // Timer controls
  watchEffect(() => {
    if (space.value && isActive.value) {
      timerStore.toggleTimer()
      addShortcut('Timer Toggle')
    }
  })

  // Task creation
  watchEffect(() => {
    if ((ctrl.value || cmd.value) && shift.value && n.value) {
      taskStore.createTask({ title: 'New Task', priority: 'medium' })
      addShortcut('Quick Task')
    }
  })

  // Undo/Redo
  watchEffect(() => {
    if ((ctrl.value || cmd.value) && z.value && !shift.value) {
      taskStore.undo()
      addShortcut('Undo')
    }
  })

  watchEffect(() => {
    if ((ctrl.value || cmd.value) && (shift.value && z.value || y.value)) {
      taskStore.redo()
      addShortcut('Redo')
    }
  })

  // View switching
  watchEffect(() => {
    if (alt.value && 1.value) taskStore.switchView('canvas')
    if (alt.value && 2.value) taskStore.switchView('board')
    if (alt.value && 3.value) taskStore.switchView('focus')
    if (alt.value && 4.value) taskStore.switchView('calendar')
    if (alt.value && 5.value) taskStore.switchView('all-tasks')
  })

  // Search
  watchEffect(() => {
    if ((ctrl.value || cmd.value) && f.value) {
      taskStore.toggleSearch()
      addShortcut('Search')
    }
  })

  // Focus/Break mode
  watchEffect(() => {
    if (alt.value && b.value) {
      timerStore.startBreak()
      addShortcut('Break Mode')
    }
  })

  // Save
  watchEffect(() => {
    if ((ctrl.value || cmd.value) && s.value) {
      taskStore.saveState()
      addShortcut('Save')
    }
  })

  // Context shortcuts
  const shortcuts = computed(() => ({
    timer: {
      space: 'Toggle Timer'
    },
    tasks: {
      'Ctrl/Cmd + Shift + N': 'Quick Task',
      'Ctrl/Cmd + Z': 'Undo',
      'Ctrl/Cmd + Shift + Z': 'Redo',
      'Delete': 'Delete Selected'
    },
    views: {
      'Alt + 1': 'Canvas View',
      'Alt + 2': 'Board View',
      'Alt + 3': 'Focus View',
      'Alt + 4': 'Calendar View',
      'Alt + 5': 'All Tasks'
    },
    actions: {
      'Ctrl/Cmd + F': 'Search',
      'Alt + B': 'Start Break',
      'Ctrl/Cmd + S': 'Save State'
    }
  }))

  return {
    shortcuts,
    activeShortcuts,
    isTabActive: isActive
  }
}
```

### 5. Clipboard Integration for Tasks
**File**: `src/composables/useTaskClipboard.ts`

```typescript
import {
  useClipboard,
  usePermission,
  useEventListener
} from '@vueuse/core'
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'

export const useTaskClipboard = () => {
  const taskStore = useTaskStore()

  const {
    text,
    copy,
    copied,
    isSupported
  } = useClipboard({
    legacy: true // Fallback for older browsers
  })

  const clipboardPermission = usePermission('clipboard-write')

  const canCopy = computed(() =>
    isSupported.value && clipboardPermission.value === 'granted'
  )

  const copyTask = async (taskId: string) => {
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (!task) return false

    const taskText = [
      `📝 ${task.title}`,
      task.description ? `\n${task.description}` : '',
      task.priority ? `\nPriority: ${task.priority}` : '',
      task.dueDate ? `\nDue: ${new Date(task.dueDate).toLocaleDateString()}` : '',
      `\n\nCopied from PomoFlow`
    ].filter(Boolean).join('\n')

    try {
      await copy(taskText)
      return true
    } catch (error) {
      console.error('Failed to copy task:', error)
      return false
    }
  }

  const copyTasks = async (taskIds: string[]) => {
    const tasks = taskIds.map(id =>
      taskStore.tasks.find(t => t.id === id)
    ).filter(Boolean)

    if (tasks.length === 0) return false

    const tasksText = tasks.map((task: any, index) => [
      `${index + 1}. ${task.title}`,
      task.description ? `   ${task.description}` : '',
      task.priority ? `   Priority: ${task.priority}` : ''
    ].filter(Boolean).join('\n')).join('\n\n')

    try {
      await copy(tasksText)
      return true
    } catch (error) {
      console.error('Failed to copy tasks:', error)
      return false
    }
  }

  const pasteTask = async () => {
    if (!text.value) return null

    const lines = text.value.split('\n').filter(line => line.trim())
    const title = lines[0]?.replace(/^[📝0-9.\s]+/, '').trim()
    const description = lines.slice(1).join('\n').trim()

    if (!title) return null

    return taskStore.createTask({
      title,
      description: description || undefined
    })
  }

  // Global paste handler
  const handlePaste = async (event: ClipboardEvent) => {
    const pastedText = event.clipboardData?.getData('text')
    if (pastedText && pastedText.includes('Copied from PomoFlow')) {
      event.preventDefault()
      await pasteTask()
    }
  }

  useEventListener('paste', handlePaste)

  return {
    copyTask,
    copyTasks,
    pasteTask,
    copied,
    canCopy,
    clipboardGranted: computed(() =>
      clipboardPermission.value === 'granted'
    ),
    requestPermission: async () => {
      if ('permissions' in navigator) {
        return await navigator.permissions.request({
          name: 'clipboard-write' as PermissionName
        })
      }
      return 'granted'
    }
  }
}
```

### 6. Network Awareness for Sync
**File**: `src/composables/useSyncManager.ts`

```typescript
import {
  useOnline,
  useNetwork,
  useInterval,
  useStorage
} from '@vueuse/core'
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'

export const useSyncManager = () => {
  const taskStore = useTaskStore()

  const isOnline = useOnline()
  const network = useNetwork()

  const lastSyncTime = ref<Date | null>(null)
  const syncInProgress = ref(false)
  const pendingSync = ref(false)
  const syncErrors = ref<string[]>([])

  // Local storage for sync state
  const syncState = useStorage('pomo-sync-state', {
    lastSyncTime: null,
    pendingChanges: [],
    syncErrors: []
  }, localStorage)

  // Load sync state
  if (syncState.value.lastSyncTime) {
    lastSyncTime.value = new Date(syncState.value.lastSyncTime)
  }
  syncErrors.value = syncState.value.syncErrors || []

  const connectionType = computed(() => network.value.effectiveType)
  const isSlowConnection = computed(() =>
    ['slow-2g', '2g', '3g'].includes(connectionType.value)
  )

  // Watch for online status changes
  watch(isOnline, (online) => {
    if (online && pendingSync.value) {
      scheduleSync()
    }
  })

  // Watch for task changes
  watch(
    () => taskStore.tasks,
    () => {
      pendingSync.value = true
      if (isOnline.value) {
        scheduleSync()
      }
    },
    { deep: true }
  )

  const scheduleSync = useDebounceFn(async () => {
    if (!isOnline.value || syncInProgress.value || isSlowConnection.value) {
      return
    }

    await performSync()
  }, 5000) // 5 second debounce

  const performSync = async () => {
    if (!isOnline.value) return false

    syncInProgress.value = true
    syncErrors.value = []

    try {
      // Simulate sync operation
      await new Promise(resolve => setTimeout(resolve, 1000))

      lastSyncTime.value = new Date()
      pendingSync.value = false

      // Update persistent state
      syncState.value.lastSyncTime = lastSyncTime.value.toISOString()
      syncState.value.syncErrors = []

      return true
    } catch (error) {
      console.error('Sync failed:', error)
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      syncErrors.value.push(errorMsg)
      syncState.value.syncErrors = syncErrors.value
      return false
    } finally {
      syncInProgress.value = false
    }
  }

  const forceSync = async () => {
    if (isOnline.value) {
      return await performSync()
    }
    return false
  }

  // Periodic sync check
  const { pause: pauseSyncCheck, resume: resumeSyncCheck } = useInterval(
    () => {
      if (isOnline.value && pendingSync.value && !syncInProgress.value) {
        scheduleSync()
      }
    },
    30000 // Check every 30 seconds
  )

  return {
    isOnline,
    connectionType,
    isSlowConnection,
    lastSyncTime,
    syncInProgress,
    pendingSync,
    syncErrors,
    forceSync,
    scheduleSync
  }
}
```

## Usage Examples in Components

### Enhanced Task Card
```vue
<template>
  <div
    class="task-card"
    :class="{
      'is-selected': isSelected,
      'is-dragging': isDragging,
      'has-focus': hasFocus
    }"
    draggable="true"
    @click="selectTask"
    @keydown.enter="editTask"
    @keydown.delete="deleteTask"
    tabindex="0"
  >
    <div class="task-header">
      <h3>{{ task.title }}</h3>
      <div class="task-actions">
        <button
          @click.stop="copyTask"
          :disabled="!canCopy"
          title="Copy task"
        >
          📋
        </button>
        <button
          @click.stop="deleteTask"
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>

    <p v-if="task.description" class="task-description">
      {{ task.description }}
    </p>

    <div class="task-meta">
      <span v-if="task.priority" class="priority">
        {{ task.priority }}
      </span>
      <span v-if="task.dueDate" class="due-date">
        {{ formatDueDate(task.dueDate) }}
      </span>
    </div>

    <div class="sync-status" v-if="!isOnline">
      ⚠️ Offline - Changes will sync when online
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useTaskClipboard } from '@/composables/useTaskClipboard'
import { useSyncManager } from '@/composables/useSyncManager'

interface Props {
  task: Task
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false
})

const emit = defineEmits<{
  select: [taskId: string]
  edit: [taskId: string]
  delete: [taskId: string]
}>()

const { copyTask: copyTaskToClipboard, canCopy, copied } = useTaskClipboard()
const { isOnline } = useSyncManager()

const isDragging = ref(false)
const hasFocus = ref(false)

const copyTask = async () => {
  const success = await copyTaskToClipboard(props.task.id)
  if (success) {
    // Show feedback
    console.log('Task copied to clipboard')
  }
}

const selectTask = () => {
  emit('select', props.task.id)
}

const editTask = () => {
  emit('edit', props.task.id)
}

const deleteTask = () => {
  emit('delete', props.task.id)
}

const handleDragStart = (event: DragEvent) => {
  isDragging.value = true
  event.dataTransfer?.setData('text/plain', props.task.id)
}

const handleDragEnd = () => {
  isDragging.value = false
}

const formatDueDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}
</script>
```

These integration examples demonstrate how VueUse composables can be seamlessly integrated into existing project features to enhance functionality while maintaining clean, maintainable code patterns.