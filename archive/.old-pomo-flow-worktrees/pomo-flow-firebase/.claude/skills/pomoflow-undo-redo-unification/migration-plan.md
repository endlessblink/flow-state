# PomoFlow Undo/Redo Migration Plan

## Phase-by-Phase Implementation Strategy

### 🎯 Objective
Replace 7 conflicting undo/redo implementations with ONE unified VueUse + Pinia system.

## Current Systems to Replace

| Current File | Purpose | Replacement |
|-------------|---------|-------------|
| `useUndoRedo.ts` | Main manual system | `useUnifiedUndoRedo.ts` |
| `useUnifiedUndoRedo.ts` | Incomplete VueUse system | Enhanced version |
| `useCanvasUndoHistory.ts` | Canvas-specific | Integrated into unified system |
| `useSimpleCanvasUndo.ts` | Canvas variant | Removed |
| `useSimpleUndoRedo.ts` | Simplified version | Removed |
| `useVueUndoHistory.ts` | Vue history | Removed |
| All test variants | Testing implementations | New test suite |

## Phase 1: Preparation (Day 1)

### 1.1 Backup Current Implementation
```bash
# Create backup directory
mkdir -p backup/undo-redo-originals

# Backup all current undo/redo files
cp src/composables/*undo* backup/undo-redo-originals/
cp src/stores/undoRedo.ts backup/undo-redo-originals/ 2>/dev/null || true
find tests -name "*undo*" -exec cp {} backup/undo-redo-originals/ \;

# Create migration log
echo "Migration started: $(date)" > backup/migration-log.txt
```

### 1.2 Verify Dependencies
```bash
# Ensure VueUse is installed
npm list @vueuse/core

# If not installed:
npm install @vueuse/core
```

### 1.3 Create Migration Branch
```bash
git checkout -b feature/unified-undo-redo
git add .
git commit -m "Backup: Current undo/redo implementations before unification"
```

## Phase 2: Core Implementation (Day 2)

### 2.1 Create Unified Composable
**File**: `src/composables/useUnifiedUndoRedo.ts`

```typescript
import { computed, ref } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'

export const useUnifiedUndoRedo = () => {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const canvasStore = useCanvasStore()

  // Unified state combining all stores
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
      viewport: { ...canvasStore.viewport },
      isDragging: canvasStore.isDragging
    }
  }))

  // VueUse handles all complexity
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

  // Batch operations support
  const batchOperation = async (operations: Array<() => void>, description: string) => {
    saveState(`Before ${description}`)
    operations.forEach(op => op())
    saveState(`After ${description}`)
  }

  return {
    // VueUse core functionality
    history,
    canUndo,
    canRedo,
    undo,
    redo,
    clear,
    reset,

    // PomoFlow specific
    saveState,
    batchOperation,

    // Convenience getters
    historyCount: computed(() => history.value.length),
    canClearHistory: computed(() => history.value.length > 0),
    lastAction: computed(() => {
      const last = history.value[history.value.length - 1]
      return last?.snapshot?.description || 'No actions'
    })
  }
}
```

### 2.2 Update Task Store
**File**: `src/stores/tasks.ts`

```typescript
import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [] as Task[],
    projects: [] as Project[],
    selectedTaskId: null as string | null
  }),

  actions: {
    createTask(taskData: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()

      // Save state before change
      undoRedo.saveState('Before task creation')

      const task: Task = {
        id: generateId(),
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        status: taskData.status || 'active',
        priority: taskData.priority || 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...taskData
      }

      this.tasks.push(task)

      // Save state after change
      undoRedo.saveState('After task creation')

      return task
    },

    updateTask(taskId: string, updates: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before updating task ${taskId}`)

      const taskIndex = this.tasks.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        this.tasks[taskIndex] = {
          ...this.tasks[taskIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        }
      }

      undoRedo.saveState(`After updating task ${taskId}`)
    },

    deleteTask(taskId: string) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before deleting task ${taskId}`)

      const taskIndex = this.tasks.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        this.tasks.splice(taskIndex, 1)

        // Clear selection if deleted task was selected
        if (this.selectedTaskId === taskId) {
          this.selectedTaskId = null
        }
      }

      undoRedo.saveState(`After deleting task ${taskId}`)
    },

    // Bulk operations
    bulkUpdateTasks(taskIds: string[], updates: Partial<Task>) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.batchOperation(
        () => {
          taskIds.forEach(id => this.updateTask(id, updates))
        },
        `Bulk update of ${taskIds.length} tasks`
      )
    },

    bulkDeleteTasks(taskIds: string[]) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.batchOperation(
        () => {
          taskIds.forEach(id => this.deleteTask(id))
        },
        `Bulk delete of ${taskIds.length} tasks`
      )
    },

    selectTask(taskId: string | null) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before selecting task ${taskId}`)
      this.selectedTaskId = taskId
      undoRedo.saveState(`After selecting task ${taskId}`)
    }
  }
})
```

### 2.3 Update Timer Store
**File**: `src/stores/timer.ts`

```typescript
import { defineStore } from 'pinia'

export const useTimerStore = defineStore('timer', {
  state: () => ({
    isActive: false,
    isPaused: false,
    isBreak: false,
    currentTaskId: null as string | null,
    timeRemaining: 25 * 60 * 1000, // 25 minutes default
    duration: 25 * 60 * 1000,
    startTime: null as number | null,
    sessions: [] as TimerSession[]
  }),

  actions: {
    startTimer(taskId?: string, duration?: number, isBreak?: boolean) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before timer start')

      this.isActive = true
      this.isPaused = false
      this.startTime = Date.now()

      if (taskId) this.currentTaskId = taskId
      if (duration) this.duration = duration
      if (isBreak !== undefined) this.isBreak = isBreak
      this.timeRemaining = this.duration

      undoRedo.saveState('After timer start')
    },

    pauseTimer() {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before timer pause')

      this.isActive = false
      this.isPaused = true
      this.startTime = null

      undoRedo.saveState('After timer pause')
    },

    resumeTimer() {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before timer resume')

      this.isActive = true
      this.isPaused = false
      this.startTime = Date.now()

      undoRedo.saveState('After timer resume')
    },

    stopTimer() {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before timer stop')

      if (this.isActive || this.isPaused) {
        // Save session
        this.sessions.push({
          id: generateId(),
          taskId: this.currentTaskId,
          duration: this.duration,
          completedAt: new Date().toISOString(),
          isBreak: this.isBreak
        })
      }

      this.isActive = false
      this.isPaused = false
      this.startTime = null
      this.currentTaskId = null

      undoRedo.saveState('After timer stop')
    },

    setTimeRemaining(time: number) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before time adjustment')
      this.timeRemaining = time
      undoRedo.saveState('After time adjustment')
    }
  }
})
```

### 2.4 Update Canvas Store
**File**: `src/stores/canvas.ts`

```typescript
import { defineStore } from 'pinia'

export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    sections: [] as CanvasSection[],
    selectedNodes: [] as string[],
    viewport: { x: 0, y: 0, zoom: 1 },
    isDragging: false,
    draggedNode: null as string | null,
    connectMode: false,
    connectionStart: null as string | null
  }),

  actions: {
    createSection(sectionData: Omit<CanvasSection, 'id'>) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before canvas section creation')

      const section: CanvasSection = {
        id: generateId(),
        ...sectionData,
        createdAt: new Date().toISOString()
      }

      this.sections.push(section)
      undoRedo.saveState('After canvas section creation')
      return section
    },

    updateSection(sectionId: string, updates: Partial<CanvasSection>) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before updating section ${sectionId}`)

      const sectionIndex = this.sections.findIndex(s => s.id === sectionId)
      if (sectionIndex !== -1) {
        this.sections[sectionIndex] = {
          ...this.sections[sectionIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        }
      }

      undoRedo.saveState(`After updating section ${sectionId}`)
    },

    deleteSection(sectionId: string) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before deleting section ${sectionId}`)

      const sectionIndex = this.sections.findIndex(s => s.id === sectionId)
      if (sectionIndex !== -1) {
        this.sections.splice(sectionIndex, 1)
      }

      // Remove from selection
      this.selectedNodes = this.selectedNodes.filter(id => id !== sectionId)

      undoRedo.saveState(`After deleting section ${sectionId}`)
    },

    updateTaskPosition(taskId: string, position: { x: number, y: number }) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before moving task ${taskId} to (${position.x}, ${position.y})`)

      // Update position in sections
      this.sections.forEach(section => {
        if (section.taskId === taskId) {
          section.position = position
          section.updatedAt = new Date().toISOString()
        }
      })

      undoRedo.saveState(`After moving task ${taskId}`)
    },

    setViewport(x: number, y: number, zoom: number) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before viewport change to (${x}, ${y}, ${zoom})`)

      this.viewport = { x, y, zoom }

      undoRedo.saveState(`After viewport change`)
    },

    selectNodes(nodeIds: string[]) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before selecting ${nodeIds.length} nodes`)
      this.selectedNodes = [...nodeIds]
      undoRedo.saveState(`After selecting ${nodeIds.length} nodes`)
    },

    clearSelection() {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState('Before clearing selection')
      this.selectedNodes = []
      undoRedo.saveState('After clearing selection')
    },

    toggleNodeSelection(nodeId: string) {
      const undoRedo = useUnifiedUndoRedo()

      undoRedo.saveState(`Before toggling selection of node ${nodeId}`)

      const index = this.selectedNodes.indexOf(nodeId)
      if (index === -1) {
        this.selectedNodes.push(nodeId)
      } else {
        this.selectedNodes.splice(index, 1)
      }

      undoRedo.saveState(`After toggling selection of node ${nodeId}`)
    }
  }
})
```

## Phase 3: Component Integration (Day 3)

### 3.1 Update Keyboard Handler
**File**: `src/utils/globalKeyboardHandler.ts`

```typescript
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

export class GlobalKeyboardHandler {
  private undoRedo: ReturnType<typeof useUnifiedUndoRedo> | null = null

  async init(): Promise<void> {
    // Initialize the unified undo/redo system
    this.undoRedo = useUnifiedUndoRedo()

    console.log('✅ Global keyboard handler initialized with unified undo/redo')
  }

  handleKeydown = async (event: KeyboardEvent): Promise<void> => {
    if (!this.undoRedo) return

    const { ctrlKey, metaKey, shiftKey, key } = event
    const hasModifier = ctrlKey || metaKey

    try {
      if (hasModifier && key.toLowerCase() === 'z') {
        if (shiftKey) {
          // Ctrl+Shift+Z = Redo
          if (this.undoRedo.canRedo.value) {
            await this.undoRedo.redo()
            console.log('✅ Redo executed')
          }
        } else {
          // Ctrl+Z = Undo
          if (this.undoRedo.canUndo.value) {
            await this.undoRedo.undo()
            console.log('✅ Undo executed')
          }
        }
        event.preventDefault()
        event.stopPropagation()
      }

      // Ctrl+Y alternative for redo
      else if (hasModifier && key.toLowerCase() === 'y') {
        if (this.undoRedo.canRedo.value) {
          await this.undoRedo.redo()
          console.log('✅ Redo executed (Ctrl+Y)')
        }
        event.preventDefault()
        event.stopPropagation()
      }
    } catch (error) {
      console.error('❌ Keyboard operation failed:', error)
    }
  }
}
```

### 3.2 Update Canvas View Component
**File**: `src/views/CanvasView.vue`

```vue
<template>
  <div class="canvas-view">
    <!-- Toolbar with undo/redo controls -->
    <div class="canvas-toolbar">
      <div class="toolbar-section">
        <button
          @click="handleUndo"
          :disabled="!canUndo"
          class="toolbar-button"
          title="Undo (Ctrl+Z)"
        >
          <span class="icon">↶</span>
          <span class="label">Undo</span>
        </button>

        <button
          @click="handleRedo"
          :disabled="!canRedo"
          class="toolbar-button"
          title="Redo (Ctrl+Shift+Z)"
        >
          <span class="icon">↷</span>
          <span class="label">Redo</span>
        </button>

        <div class="history-info">
          <span class="history-count">{{ historyCount }} operations</span>
          <span class="last-action">{{ lastAction }}</span>
        </div>
      </div>
    </div>

    <!-- Canvas content -->
    <div class="canvas-container" ref="canvasRef">
      <!-- Vue Flow or other canvas implementation -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

// Unified undo/redo system
const { canUndo, canRedo, undo, redo, historyCount, lastAction } = useUnifiedUndoRedo()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Canvas reference
const canvasRef = ref<HTMLElement | null>(null)

// Event handlers
const handleUndo = async () => {
  if (canUndo.value) {
    await undo()
  }
}

const handleRedo = async () => {
  if (canRedo.value) {
    await redo()
  }
}

// Component lifecycle
onMounted(() => {
  console.log('CanvasView mounted with unified undo/redo system')
})
</script>

<style scoped>
.canvas-toolbar {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.toolbar-button:hover:not(:disabled) {
  opacity: 0.9;
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.canvas-container {
  height: calc(100vh - 80px);
  position: relative;
}
</style>
```

## Phase 4: Testing & Validation (Day 4)

### 4.1 Create Test Suite
**File**: `tests/unit/undo-redo-unified.test.ts`

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useTaskStore } from '@/stores/tasks'

describe('Unified Undo/Redo System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('should initialize with empty history', () => {
    const { history, canUndo, canRedo, historyCount } = useUnifiedUndoRedo()

    expect(history.value).toHaveLength(0)
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
    expect(historyCount.value).toBe(0)
  })

  test('should handle task creation with undo/redo', async () => {
    const undoRedo = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    // Create task
    const task = taskStore.createTask({
      title: 'Test Task',
      description: 'Test Description'
    })

    expect(task).toBeDefined()
    expect(taskStore.tasks).toHaveLength(1)
    expect(undoRedo.canUndo.value).toBe(true)

    // Undo task creation
    await undoRedo.undo()
    expect(taskStore.tasks).toHaveLength(0)
    expect(undoRedo.canRedo.value).toBe(true)

    // Redo task creation
    await undoRedo.redo()
    expect(taskStore.tasks).toHaveLength(1)
    expect(undoRedo.canUndo.value).toBe(true)
  })

  test('should handle batch operations', async () => {
    const undoRedo = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    // Create multiple tasks
    const taskIds = []
    for (let i = 0; i < 3; i++) {
      const task = taskStore.createTask({
        title: `Task ${i}`,
        description: `Description ${i}`
      })
      taskIds.push(task.id)
    }

    expect(taskStore.tasks).toHaveLength(3)

    // Bulk update
    taskStore.bulkUpdateTasks(taskIds, { status: 'completed' })

    // Verify all tasks updated
    taskStore.tasks.forEach(task => {
      expect(task.status).toBe('completed')
    })

    // Undo bulk operation
    await undoRedo.undo()

    // Verify all tasks reverted
    taskStore.tasks.forEach(task => {
      expect(task.status).toBe('active')
    })
  })

  test('should handle memory limits', async () => {
    const undoRedo = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    // Create more tasks than history limit
    for (let i = 0; i < 60; i++) {
      taskStore.createTask({
        title: `Task ${i}`,
        description: `Description ${i}`
      })
    }

    // History should be limited to 50 entries
    expect(undoRedo.historyCount.value).toBeLessThanOrEqual(50)
  })
})
```

### 4.2 E2E Test
**File**: `tests/e2e/undo-redo-workflow.test.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Unified Undo/Redo E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')
  })

  test('complete undo/redo workflow', async ({ page }) => {
    // Create task
    await page.click('[data-testid="create-task-button"]')
    await page.fill('[data-testid="task-title"]', 'E2E Test Task')
    await page.click('[data-testid="save-task"]')

    // Verify task exists
    await expect(page.locator('[data-testid="task-card"]')).toContainText('E2E Test Task')

    // Update task
    await page.click('[data-testid="task-card"]')
    await page.click('[data-testid="edit-task"]')
    await page.fill('[data-testid="task-title"]', 'Updated E2E Test Task')
    await page.click('[data-testid="save-task"]')

    // Verify update
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Updated E2E Test Task')

    // Test keyboard undo
    await page.keyboard.press('Control+z')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('E2E Test Task')
    await expect(page.locator('[data-testid="task-card"]')).not.toContainText('Updated E2E Test Task')

    // Test keyboard redo
    await page.keyboard.press('Control+Shift+z')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Updated E2E Test Task')

    // Test toolbar buttons
    await page.click('[data-testid="undo-button"]')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('E2E Test Task')

    await page.click('[data-testid="redo-button"]')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Updated E2E Test Task')
  })

  test('canvas operations with undo/redo', async ({ page }) => {
    // Create task and add to canvas
    await page.click('[data-testid="create-task-button"]')
    await page.fill('[data-testid="task-title"]', 'Canvas Test Task')
    await page.click('[data-testid="save-task"]')

    // Drag to canvas
    await page.dragAndDrop(
      '[data-testid="task-card"]',
      '[data-testid="canvas-drop-zone"]'
    )

    // Verify node on canvas
    await expect(page.locator('[data-testid="canvas-node"]')).toBeVisible()

    // Get initial position
    const initialPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()

    // Move node
    await page.hover('[data-testid="canvas-node"]')
    await page.mouse.down()
    await page.mouse.move(initialPosition!.x + 100, initialPosition!.y + 50)
    await page.mouse.up()

    // Verify position changed
    const newPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(newPosition!.x).toBeGreaterThan(initialPosition!.x + 50)

    // Undo movement
    await page.keyboard.press('Control+z')

    // Verify position restored
    const restoredPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(restoredPosition!.x - initialPosition!.x)).toBeLessThan(10)

    // Redo movement
    await page.keyboard.press('Control+Shift+z')

    // Verify position changed again
    const redoPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(redoPosition!.x - newPosition!.x)).toBeLessThan(10)
  })
})
```

## Phase 5: Cleanup & Deployment (Day 5)

### 5.1 Remove Old Implementations
```bash
# Remove old undo/redo files
rm src/composables/useUndoRedo.ts
rm src/composables/useUnifiedUndoRedo.ts  # old version
rm src/composables/useCanvasUndoHistory.ts
rm src/composables/useSimpleCanvasUndo.ts
rm src/composables/useSimpleUndoRedo.ts
rm src/composables/useVueUndoHistory.ts

# Remove old test files
find tests -name "*undo*" -not -path "tests/undo-redo-unified*" -delete

# Clean up any references
grep -r "useUndoRedo\|useCanvasUndoHistory\|useSimpleUndoRedo" src/ --exclude-dir=node_modules
```

### 5.2 Update Package.json Scripts
```json
{
  "scripts": {
    "test:undo-redo": "vitest run tests/unit/undo-redo-unified.test.ts",
    "test:e2e:undo-redo": "playwright test tests/e2e/undo-redo-workflow.test.ts",
    "validate:undo-redo": "npm run test:undo-redo && npm run test:e2e:undo-redo"
  }
}
```

### 5.3 Update ESLint Rules
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Disallow old undo/redo imports
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['useUndoRedo', 'useCanvasUndoHistory', 'useSimpleUndoRedo'],
            message: 'Use useUnifiedUndoRedo instead of legacy undo/redo systems'
          }
        ]
      }
    ]
  }
}
```

### 5.4 Documentation Updates
```markdown
# DEVELOPMENT.md

## Undo/Redo System

PomoFlow uses a unified undo/redo system based on VueUse's `useManualRefHistory`.

### Key Points:
- **Single System**: Only `useUnifiedUndoRedo()` is used throughout the app
- **Automatic**: State changes automatically create history entries
- **Memory Efficient**: Limited to 50 entries with automatic cleanup
- **Keyboard Shortcuts**: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+Y (redo)

### Adding New Undo/Redo Support:

1. **Store Actions**: Always call `saveState()` before and after changes
2. **Components**: Use `useUnifiedUndoRedo()` composable
3. **Batch Operations**: Use `batchOperation()` for multiple changes

### DO NOT:
- Create custom undo/redo implementations
- Use manual state serialization
- Import old undo/redo composables
```

## Validation Checklist

### ✅ Pre-Deployment Validation
- [ ] All old undo/redo files removed
- [ ] New unified system implemented in all stores
- [ ] Keyboard shortcuts working
- [ ] Canvas operations with undo/redo working
- [ ] Memory usage stable (monitor for 10 minutes)
- [ ] All tests passing
- [ ] Performance under 100ms for operations

### ✅ User Acceptance Testing
- [ ] Undo/redo works consistently across all views
- [ ] Keyboard shortcuts intuitive
- [ ] No unexpected behavior
- [ ] Memory usage acceptable
- [ ] Performance responsive

### ✅ Rollback Plan
If issues arise:
1. Restore from backup: `cp -r backup/undo-redo-originals/* src/composables/`
2. Revert migration branch: `git checkout main`
3. Test old functionality

## Success Metrics

### Technical Metrics
- [ ] 7 implementations → 1 implementation (100% reduction)
- [ ] Code complexity reduced by 80%
- [ ] Memory usage stable < 50MB
- [ ] Operation time < 100ms
- [ ] Zero memory leaks in 1-hour stress test

### User Experience Metrics
- [ ] Consistent undo/redo behavior across app
- [ ] Keyboard shortcuts work reliably
- [ ] Visual feedback for undo/redo availability
- [ ] No unexpected state corruption
- [ ] Smooth performance under heavy usage

This migration plan provides a structured, safe approach to unifying PomoFlow's undo/redo system with minimal risk and maximum benefit.