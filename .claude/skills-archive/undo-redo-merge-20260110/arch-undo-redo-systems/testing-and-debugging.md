# Testing Strategies and Debugging Tools

## Comprehensive Testing Framework

### Unit Testing Command Pattern

```typescript
// tests/unit/commands/CreateTaskCommand.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { CreateTaskCommand } from '@/commands/CreateTaskCommand'
import type { TaskStore } from '@/stores/tasks'

describe('CreateTaskCommand', () => {
  let mockTaskStore: TaskStore
  let mockTaskData: any

  beforeEach(() => {
    mockTaskStore = {
      tasks: [],
      createTask: vi.fn(),
      deleteTask: vi.fn(),
      updateTask: vi.fn()
    } as any

    mockTaskData = {
      title: 'Test Task',
      description: 'Test Description',
      status: 'active'
    }
  })

  test('should create task and generate ID on execute', async () => {
    const expectedId = 'task-123'
    mockTaskStore.createTask.mockResolvedValue(expectedId)

    const command = new CreateTaskCommand(mockTaskStore, mockTaskData)

    await command.execute()

    expect(mockTaskStore.createTask).toHaveBeenCalledWith(mockTaskData)
    expect(command.getDescription()).toBe('Create task: Test Task')
    expect(command.getTimestamp()).toBeTypeOf('number')
  })

  test('should undo task creation', async () => {
    const taskId = 'task-123'
    mockTaskStore.createTask.mockResolvedValue(taskId)

    const command = new CreateTaskCommand(mockTaskStore, mockTaskData)

    // Execute first to set the generated ID
    await command.execute()

    // Then undo
    await command.undo()

    expect(mockTaskStore.deleteTask).toHaveBeenCalledWith(taskId)
  })

  test('should handle create task failure', async () => {
    const error = new Error('Creation failed')
    mockTaskStore.createTask.mockRejectedValue(error)

    const command = new CreateTaskCommand(mockTaskStore, mockTaskData)

    await expect(command.execute()).rejects.toThrow('Creation failed')
    expect(mockTaskStore.tasks).toHaveLength(0)
  })

  test('should handle undo when no task was created', async () => {
    mockTaskStore.createTask.mockResolvedValue(null)

    const command = new CreateTaskCommand(mockTaskStore, mockTaskData)

    await command.execute()
    await command.undo()

    expect(mockTaskStore.deleteTask).not.toHaveBeenCalled()
  })

  test('should return correct command metadata', () => {
    const command = new CreateTaskCommand(mockTaskStore, mockTaskData)

    expect(command.canExecute()).toBe(true)
    expect(command.getDescription()).toContain('Test Task')
    expect(command.getTimestamp()).toBeGreaterThan(0)
  })
})

// tests/unit/commands/UpdateTaskCommand.test.ts
describe('UpdateTaskCommand', () => {
  let mockTaskStore: any
  const existingTask = {
    id: 'task-123',
    title: 'Original Title',
    description: 'Original Description',
    status: 'active'
  }

  beforeEach(() => {
    mockTaskStore = {
      tasks: [existingTask],
      updateTask: vi.fn(),
      findTask: vi.fn()
    }

    mockTaskStore.findTask.mockReturnValue(existingTask)
  })

  test('should capture previous state and update task', async () => {
    const updates = { title: 'Updated Title', status: 'completed' }
    const command = new UpdateTaskCommand(mockTaskStore, 'task-123', updates)

    await command.execute()

    expect(mockTaskStore.updateTask).toHaveBeenCalledWith('task-123', updates)
    expect(command.getDescription()).toContain('Update task')
  })

  test('should restore previous state on undo', async () => {
    const updates = { title: 'Updated Title' }
    const command = new UpdateTaskCommand(mockTaskStore, 'task-123', updates)

    await command.execute()
    await command.undo()

    expect(mockTaskStore.updateTask).toHaveBeenCalledWith('task-123', existingTask)
  })

  test('should handle non-existent task', async () => {
    mockTaskStore.findTask.mockReturnValue(null)

    const command = new UpdateTaskCommand(mockTaskStore, 'non-existent', { title: 'Updated' })

    await expect(command.execute()).rejects.toThrow()
  })
})
```

### Integration Testing History Management

```typescript
// tests/integration/HistoryManager.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { OptimizedHistory } from '@/managers/OptimizedHistory'
import { CreateTaskCommand } from '@/commands/CreateTaskCommand'
import { DeleteTaskCommand } from '@/commands/DeleteTaskCommand'

describe('OptimizedHistory Integration', () => {
  let history: OptimizedHistory
  let mockTaskStore: any

  beforeEach(() => {
    history = new OptimizedHistory()
    mockTaskStore = {
      tasks: [],
      createTask: vi.fn(),
      deleteTask: vi.fn(),
      updateTask: vi.fn()
    }
  })

  test('should execute and undo commands correctly', async () => {
    const taskData = { title: 'Test Task' }
    const createCommand = new CreateTaskCommand(mockTaskStore, taskData)
    const taskId = 'task-123'

    mockTaskStore.createTask.mockResolvedValue(taskId)

    // Execute command
    await history.execute(createCommand)

    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
    expect(mockTaskStore.createTask).toHaveBeenCalledWith(taskData)

    // Undo command
    const undoResult = await history.undo()

    expect(undoResult).toBe(true)
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(true)
    expect(mockTaskStore.deleteTask).toHaveBeenCalledWith(taskId)
  })

  test('should handle command execution failure', async () => {
    const taskData = { title: 'Test Task' }
    const createCommand = new CreateTaskCommand(mockTaskStore, taskData)
    const error = new Error('Creation failed')

    mockTaskStore.createTask.mockRejectedValue(error)

    // Command execution should fail
    await expect(history.execute(createCommand)).rejects.toThrow('Creation failed')

    // History should not record failed command
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })

  test('should maintain undo/redo stack correctly', async () => {
    const commands = [
      new CreateTaskCommand(mockTaskStore, { title: 'Task 1' }),
      new CreateTaskCommand(mockTaskStore, { title: 'Task 2' }),
      new CreateTaskCommand(mockTaskStore, { title: 'Task 3' })
    ]

    mockTaskStore.createTask.mockResolvedValue('task-1')
    mockTaskStore.createTask.mockResolvedValue('task-2')
    mockTaskStore.createTask.mockResolvedValue('task-3')

    // Execute all commands
    for (const command of commands) {
      await history.execute(command)
    }

    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)

    // Undo one command
    await history.undo()
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(true)

    // Execute new command should clear redo stack
    const newCommand = new CreateTaskCommand(mockTaskStore, { title: 'Task 4' })
    await history.execute(newCommand)
    expect(history.canRedo()).toBe(false)
  })

  test('should handle batch operations', async () => {
    const batchCommand = new BatchCommand([
      new CreateTaskCommand(mockTaskStore, { title: 'Task 1' }),
      new CreateTaskCommand(mockTaskStore, { title: 'Task 2' })
    ])

    mockTaskStore.createTask.mockResolvedValue('task-1')
    mockTaskStore.createTask.mockResolvedValue('task-2')

    await history.execute(batchCommand)

    expect(history.canUndo()).toBe(true)
    expect(mockTaskStore.createTask).toHaveBeenCalledTimes(2)

    // Undo should revert both operations
    await history.undo()
    expect(mockTaskStore.deleteTask).toHaveBeenCalledTimes(2)
  })

  test('should optimize history size', async () => {
    // Create many commands to trigger optimization
    const commands = Array.from({ length: 100 }, (_, i) =>
      new CreateTaskCommand(mockTaskStore, { title: `Task ${i}` })
    )

    for (const command of commands) {
      mockTaskStore.createTask.mockResolvedValue(`task-${commands.indexOf(command)}`)
      await history.execute(command)
    }

    // History should have been optimized
    const historySize = history.getHistorySize()
    expect(historySize).toBeLessThanOrEqual(50) // maxHistorySize
  })
})
```

### End-to-End Testing with Real Components

```typescript
// tests/e2e/UndoRedoWorkflow.test.ts
import { test, expect } from '@playwright/test'
import { gotoApp, createTestTask, waitForUndoRedoReady } from './utils/test-helpers'

test.describe('Undo/Redo Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await waitForUndoRedoReady(page)
  })

  test('should create, update, and undo task operations', async ({ page }) => {
    // Start on canvas view
    await page.goto('http://localhost:5546/#/canvas')

    // Create a task via UI
    await page.click('[data-testid="create-task-button"]')
    await page.fill('[data-testid="task-title-input"]', 'E2E Test Task')
    await page.fill('[data-testid="task-description-input"]', 'Created during E2E test')
    await page.click('[data-testid="save-task-button"]')

    // Verify task exists
    await expect(page.locator('[data-testid="task-card"]')).toContainText('E2E Test Task')

    // Update the task
    await page.click('[data-testid="task-card"]')
    await page.click('[data-testid="edit-task-button"]')
    await page.fill('[data-testid="task-title-input"]', 'Updated E2E Test Task')
    await page.click('[data-testid="save-task-button"]')

    // Verify task updated
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Updated E2E Test Task')

    // Test keyboard undo
    await page.keyboard.press('Control+z')

    // Verify task title reverted
    await expect(page.locator('[data-testid="task-card"]')).toContainText('E2E Test Task')
    await expect(page.locator('[data-testid="task-card"]')).not.toContainText('Updated E2E Test Task')

    // Test keyboard redo
    await page.keyboard.press('Control+Shift+z')

    // Verify task title restored
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Updated E2E Test Task')
  })

  test('should handle canvas node operations with undo/redo', async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')

    // Create task and drag to canvas
    await createTestTask(page, 'Canvas Test Task')
    await page.dragAndDrop(
      '[data-testid="task-card"]',
      '[data-testid="canvas-drop-zone"]'
    )

    // Verify node appears on canvas
    await expect(page.locator('[data-testid="canvas-node"]')).toBeVisible()

    // Record initial position
    const initialPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()

    // Drag node to new position
    await page.hover('[data-testid="canvas-node"]')
    await page.mouse.down()
    await page.mouse.move(initialPosition!.x + 200, initialPosition!.y + 100)
    await page.mouse.up()

    // Verify position changed
    const newPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(newPosition!.x).toBeGreaterThan(initialPosition!.x + 150)

    // Undo the move
    await page.keyboard.press('Control+z')

    // Verify position restored
    const restoredPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(restoredPosition!.x - initialPosition!.x)).toBeLessThan(10)
  })

  test('should maintain state consistency across multiple stores', async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')

    // Create task in canvas
    await createTestTask(page, 'Multi-Store Test Task')
    await page.dragAndDrop(
      '[data-testid="task-card"]',
      '[data-testid="canvas-drop-zone"]'
    )

    // Navigate to board view
    await page.click('[data-testid="nav-board"]')

    // Verify task exists in board view
    await expect(page.locator('[data-testid="board-task"]')).toContainText('Multi-Store Test Task')

    // Update task in board view
    await page.click('[data-testid="board-task"]')
    await page.click('[data-testid="task-status-dropdown"]')
    await page.click('[data-testid="status-completed"]')

    // Verify status updated
    await expect(page.locator('[data-testid="board-task"]')).toHaveClass(/completed/)

    // Go back to canvas
    await page.click('[data-testid="nav-canvas"]')

    // Verify status reflected in canvas
    await expect(page.locator('[data-testid="canvas-node"]')).toHaveClass(/completed/)

    // Undo status change
    await page.keyboard.press('Control+z')

    // Verify status reverted in both views
    await expect(page.locator('[data-testid="canvas-node"]')).not.toHaveClass(/completed/)

    // Check board view to ensure consistency
    await page.click('[data-testid="nav-board"]')
    await expect(page.locator('[data-testid="board-task"]')).not.toHaveClass(/completed/)
  })

  test('should handle complex batch operations', async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')

    // Create multiple tasks
    const taskTitles = ['Batch Task 1', 'Batch Task 2', 'Batch Task 3']

    for (const title of taskTitles) {
      await createTestTask(page, title)
    }

    // Select multiple tasks
    await page.click('[data-testid="task-card"]:has-text("Batch Task 1")')
    await page.keyboard.down('Control')
    await page.click('[data-testid="task-card"]:has-text("Batch Task 2")')
    await page.click('[data-testid="task-card"]:has-text("Batch Task 3")')
    await page.keyboard.up('Control')

    // Batch update status
    await page.click('[data-testid="batch-update-button"]')
    await page.click('[data-testid="status-completed"]')

    // Verify all tasks updated
    for (const title of taskTitles) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("${title}")`)).toHaveClass(/completed/)
    }

    // Undo batch operation
    await page.keyboard.press('Control+z')

    // Verify all tasks reverted
    for (const title of taskTitles) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("${title}")`)).not.toHaveClass(/completed/)
    }

    // Redo batch operation
    await page.keyboard.press('Control+Shift+z')

    // Verify all tasks updated again
    for (const title of taskTitles) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("${title}")`)).toHaveClass(/completed/)
    }
  })
})
```

## Debugging Tools

### Development Debug Panel

```typescript
// src/components/debug/UndoRedoDebugPanel.vue
<template>
  <div class="undo-redo-debug-panel" v-if="isVisible">
    <div class="panel-header">
      <h3>Undo/Redo Debug Panel</h3>
      <button @click="toggleVisibility" class="close-button">×</button>
    </div>

    <div class="panel-content">
      <!-- Status Overview -->
      <div class="status-section">
        <h4>Status</h4>
        <div class="status-grid">
          <div class="status-item">
            <label>Can Undo:</label>
            <span :class="{ active: canUndo, inactive: !canUndo }">
              {{ canUndo ? '✅' : '❌' }}
            </span>
          </div>
          <div class="status-item">
            <label>Can Redo:</label>
            <span :class="{ active: canRedo, inactive: !canRedo }">
              {{ canRedo ? '✅' : '❌' }}
            </span>
          </div>
          <div class="status-item">
            <label>History Size:</label>
            <span>{{ historySize }}</span>
          </div>
          <div class="status-item">
            <label>Memory Usage:</label>
            <span>{{ formatBytes(memoryUsage) }}</span>
          </div>
        </div>
      </div>

      <!-- History List -->
      <div class="history-section">
        <h4>History Stack</h4>
        <div class="history-controls">
          <button @click="refreshHistory">🔄 Refresh</button>
          <button @click="exportHistory">📤 Export</button>
          <button @click="clearHistory" class="danger">🗑️ Clear</button>
        </div>

        <div class="history-list">
          <div
            v-for="(entry, index) in historyEntries"
            :key="entry.id"
            :class="['history-entry', {
              'current': index === currentIndex,
              'undoable': index <= currentIndex,
              'redoable': index > currentIndex
            }]"
            @click="navigateToHistoryEntry(index)"
          >
            <div class="entry-index">{{ index }}</div>
            <div class="entry-description">{{ entry.description }}</div>
            <div class="entry-timestamp">{{ formatTime(entry.timestamp) }}</div>
            <div class="entry-actions">
              <button @click.stop="executeUndo(entry)" :disabled="!canUndoAt(index)" title="Undo from here">
                ↶
              </button>
              <button @click.stop="executeRedo(entry)" :disabled="!canRedoAt(index)" title="Redo from here">
                ↷
              </button>
              <button @click.stop="inspectEntry(entry)" title="Inspect">
                🔍
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- State Inspector -->
      <div class="inspector-section" v-if="inspectedEntry">
        <h4>State Inspector</h4>
        <div class="inspector-content">
          <div class="inspector-entry">
            <strong>Command:</strong> {{ inspectedEntry.command.constructor.name }}
          </div>
          <div class="inspector-entry">
            <strong>Description:</strong> {{ inspectedEntry.description }}
          </div>
          <div class="inspector-entry">
            <strong>Timestamp:</strong> {{ formatTime(inspectedEntry.timestamp) }}
          </div>

          <div class="inspector-state" v-if="inspectedState">
            <h5>State Data:</h5>
            <pre class="state-json">{{ JSON.stringify(inspectedState, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="performance-section">
        <h4>Performance</h4>
        <div class="metrics-grid">
          <div class="metric-item">
            <label>Avg Undo Time:</label>
            <span>{{ performanceMetrics.averageUndoTime.toFixed(2) }}ms</span>
          </div>
          <div class="metric-item">
            <label>Avg Redo Time:</label>
            <span>{{ performanceMetrics.averageRedoTime.toFixed(2) }}ms</span>
          </div>
          <div class="metric-item">
            <label>Total Operations:</label>
            <span>{{ performanceMetrics.totalOperations }}</span>
          </div>
          <div class="metric-item">
            <label>Success Rate:</label>
            <span>{{ (performanceMetrics.successRate * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions-section">
        <button @click="runDiagnostics" class="diagnostic-button">
          🔧 Run Diagnostics
        </button>
        <button @click="generateReport" class="report-button">
          📊 Generate Report
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUndoRedoSystem } from '@/composables/useUndoRedoSystem'
import { usePerformanceMonitor } from '@/composables/usePerformanceMonitor'

const { canUndo, canRedo, undo, redo, getHistory, clearHistory } = useUndoRedoSystem()
const performanceMonitor = usePerformanceMonitor()

const isVisible = ref(true)
const historyEntries = ref([])
const currentIndex = ref(-1)
const inspectedEntry = ref(null)
const inspectedState = ref(null)

const historySize = computed(() => historyEntries.value.length)
const memoryUsage = ref(0)

const performanceMetrics = computed(() => performanceMonitor.getMetrics())

const toggleVisibility = () => {
  isVisible.value = !isVisible.value
}

const refreshHistory = () => {
  historyEntries.value = getHistory()
  updateMemoryUsage()
}

const updateMemoryUsage = () => {
  if ('memory' in performance) {
    memoryUsage.value = (performance as any).memory.usedJSHeapSize
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatBytes = (bytes: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'unit',
    unit: 'byte',
    unitDisplay: 'short',
    notation: 'compact'
  }).format(bytes)
}

const navigateToHistoryEntry = async (index: number) => {
  if (index < currentIndex.value) {
    // Undo to this point
    const stepsToUndo = currentIndex.value - index
    for (let i = 0; i < stepsToUndo; i++) {
      await undo()
    }
  } else if (index > currentIndex.value) {
    // Redo to this point
    const stepsToRedo = index - currentIndex.value
    for (let i = 0; i < stepsToRedo; i++) {
      await redo()
    }
  }
  currentIndex.value = index
}

const canUndoAt = (index: number) => {
  return index <= currentIndex.value
}

const canRedoAt = (index: number) => {
  return index > currentIndex.value
}

const executeUndo = async (entry: any) => {
  const index = historyEntries.value.indexOf(entry)
  await navigateToHistoryEntry(index - 1)
}

const executeRedo = async (entry: any) => {
  const index = historyEntries.value.indexOf(entry)
  await navigateToHistoryEntry(index)
}

const inspectEntry = async (entry: any) => {
  inspectedEntry.value = entry

  // Try to capture state at this point
  try {
    inspectedState.value = await captureStateAtEntry(entry)
  } catch (error) {
    console.error('Failed to capture state:', error)
    inspectedState.value = null
  }
}

const captureStateAtEntry = async (entry: any) => {
  // This would need to be implemented based on your state structure
  return {
    timestamp: entry.timestamp,
    command: entry.command.constructor.name,
    // ... other state data
  }
}

const exportHistory = () => {
  const historyData = {
    entries: historyEntries.value,
    currentIndex: currentIndex.value,
    timestamp: Date.now()
  }

  const blob = new Blob([JSON.stringify(historyData, null, 2)], {
    type: 'application/json'
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `undo-redo-history-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const runDiagnostics = async () => {
  console.log('🔧 Running undo/redo diagnostics...')

  const diagnostics = {
    historySize: historySize.value,
    memoryUsage: memoryUsage.value,
    canUndo: canUndo.value,
    canRedo: canRedo.value,
    performanceMetrics: performanceMetrics.value,
    timestamp: Date.now()
  }

  console.table(diagnostics)

  // Test undo/redo operations
  try {
    if (canUndo.value) {
      const startTime = performance.now()
      await undo()
      const undoTime = performance.now() - startTime
      console.log(`✅ Undo operation completed in ${undoTime.toFixed(2)}ms`)
    }

    if (canRedo.value) {
      const startTime = performance.now()
      await redo()
      const redoTime = performance.now() - startTime
      console.log(`✅ Redo operation completed in ${redoTime.toFixed(2)}ms`)
    }
  } catch (error) {
    console.error('❌ Diagnostic operation failed:', error)
  }
}

const generateReport = () => {
  const report = {
    summary: {
      totalHistoryEntries: historySize.value,
      currentPosition: currentIndex.value,
      memoryUsage: memoryUsage.value,
      canUndo: canUndo.value,
      canRedo: canRedo.value
    },
    performance: performanceMetrics.value,
    history: historyEntries.value.slice(-10).map(entry => ({
      description: entry.description,
      timestamp: entry.timestamp,
      command: entry.command.constructor.name
    })),
    timestamp: Date.now()
  }

  console.group('📊 Undo/Redo System Report')
  console.table(report.summary)
  console.table(report.performance)
  console.log('Recent History:', report.history)
  console.groupEnd()
}

// Keyboard shortcut to toggle debug panel
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.shiftKey && event.key === 'D') {
    toggleVisibility()
  }
}

onMounted(() => {
  refreshHistory()
  window.addEventListener('keydown', handleKeyDown)

  // Auto-refresh every 5 seconds
  const interval = setInterval(() => {
    if (isVisible.value) {
      refreshHistory()
    }
  }, 5000)

  onUnmounted(() => {
    clearInterval(interval)
    window.removeEventListener('keydown', handleKeyDown)
  })
})
</script>

<style scoped>
.undo-redo-debug-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 500px;
  max-height: 80vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--color-surface-hover);
  border-bottom: 1px solid var(--color-border);
}

.panel-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 1rem;
}

.status-grid,
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.status-item,
.metric-item {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.active {
  color: var(--color-success);
}

.inactive {
  color: var(--color-text-secondary);
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.history-entry {
  display: grid;
  grid-template-columns: 30px 1fr 80px 80px;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}

.history-entry:hover {
  background: var(--color-surface-hover);
}

.history-entry.current {
  background: var(--color-primary);
  color: white;
}

.entry-actions {
  display: flex;
  gap: 0.25rem;
}

.entry-actions button {
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  cursor: pointer;
}

.entry-actions button:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.entry-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.state-json {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.diagnostic-button,
.report-button {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
}

.danger {
  background: var(--color-error);
  color: white;
}
</style>
```

### Error Tracking and Recovery

```typescript
// src/utils/undoRedoErrorTracker.ts
export class UndoRedoErrorTracker {
  private errors: UndoRedoError[] = []
  private maxErrors = 100
  private recoveryStrategies = new Map<string, RecoveryStrategy>()

  constructor() {
    this.setupRecoveryStrategies()
  }

  trackError(error: Error, context: UndoRedoContext): void {
    const trackedError: UndoRedoError = {
      id: generateId(),
      timestamp: Date.now(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      severity: this.determineSeverity(error, context),
      resolved: false
    }

    this.errors.unshift(trackedError)

    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }

    // Attempt automatic recovery
    this.attemptRecovery(trackedError)

    // Log error
    console.error('🔍 Undo/Redo Error Tracked:', trackedError)
  }

  private determineSeverity(error: Error, context: UndoRedoContext): 'low' | 'medium' | 'high' | 'critical' {
    if (error.name === 'QuotaExceededError') return 'critical'
    if (error.name === 'TypeError' && error.message.includes('circular')) return 'high'
    if (context.operation === 'execute' && error.name === 'Error') return 'medium'
    return 'low'
  }

  private setupRecoveryStrategies(): void {
    this.recoveryStrategies.set('QuotaExceededError', {
      name: 'Memory Recovery',
      action: async () => {
        // Clear history and reduce size
        await this.clearOldHistory()
        return 'Cleared old history entries to free memory'
      }
    })

    this.recoveryStrategies.set('TypeError', {
      name: 'Serialization Recovery',
      action: async () => {
        // Switch to simplified serialization
        await this.enableSimpleSerialization()
        return 'Switched to simplified state serialization'
      }
    })

    this.recoveryStrategies.set('NetworkError', {
      name: 'Offline Recovery',
      action: async () => {
        // Enable offline mode
        await this.enableOfflineMode()
        return 'Enabled offline mode for local operations'
      }
    })
  }

  private async attemptRecovery(error: UndoRedoError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.error.name)

    if (strategy) {
      try {
        const result = await strategy.action()
        error.recoveryResult = result
        error.resolved = true

        console.log(`✅ Recovery successful for ${error.id}:`, result)
      } catch (recoveryError) {
        error.recoveryResult = `Recovery failed: ${recoveryError.message}`
        console.error(`❌ Recovery failed for ${error.id}:`, recoveryError)
      }
    }
  }

  private async clearOldHistory(): Promise<void> {
    // Implementation would clear old history entries
    console.log('Clearing old history entries...')
  }

  private async enableSimpleSerialization(): Promise<void> {
    // Implementation would switch to simplified serialization
    console.log('Enabling simplified serialization...')
  }

  private async enableOfflineMode(): Promise<void> {
    // Implementation would enable offline mode
    console.log('Enabling offline mode...')
  }

  getErrors(severity?: 'low' | 'medium' | 'high' | 'critical'): UndoRedoError[] {
    if (severity) {
      return this.errors.filter(error => error.severity === severity)
    }
    return this.errors
  }

  getErrorStatistics(): ErrorStatistics {
    const total = this.errors.length
    const resolved = this.errors.filter(e => e.resolved).length
    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total,
      resolved,
      unresolved: total - resolved,
      resolutionRate: total > 0 ? resolved / total : 0,
      bySeverity
    }
  }

  generateReport(): ErrorReport {
    return {
      timestamp: Date.now(),
      statistics: this.getErrorStatistics(),
      recentErrors: this.errors.slice(0, 10),
      patterns: this.analyzePatterns(),
      recommendations: this.generateRecommendations()
    }
  }

  private analyzePatterns(): ErrorPattern[] {
    const patterns: ErrorPattern[] = []

    // Analyze frequency by operation
    const operationFrequency = this.errors.reduce((acc, error) => {
      acc[error.context.operation] = (acc[error.context.operation] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    for (const [operation, count] of Object.entries(operationFrequency)) {
      if (count > 1) {
        patterns.push({
          type: 'frequency',
          description: `High error frequency in ${operation} operations (${count} times)`,
          count
        })
      }
    }

    // Analyze time patterns
    const recentErrors = this.errors.filter(e =>
      Date.now() - e.timestamp < 300000 // Last 5 minutes
    )

    if (recentErrors.length > 5) {
      patterns.push({
        type: 'time',
        description: `Error burst detected: ${recentErrors.length} errors in last 5 minutes`,
        count: recentErrors.length
      })
    }

    return patterns
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const stats = this.getErrorStatistics()

    if (stats.resolutionRate < 0.8) {
      recommendations.push('Low recovery success rate - review error handling strategies')
    }

    if (stats.bySeverity.critical > 0) {
      recommendations.push('Critical errors detected - immediate investigation required')
    }

    const patterns = this.analyzePatterns()
    patterns.forEach(pattern => {
      if (pattern.type === 'frequency') {
        recommendations.push(`Investigate ${pattern.description.toLowerCase()}`)
      }
    })

    return recommendations
  }
}

interface UndoRedoError {
  id: string
  timestamp: number
  error: {
    name: string
    message: string
    stack?: string
  }
  context: UndoRedoContext
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
  recoveryResult?: string
}

interface UndoRedoContext {
  operation: 'execute' | 'undo' | 'redo'
  commandName: string
  stateSnapshot?: any
  additionalInfo?: Record<string, any>
}

interface RecoveryStrategy {
  name: string
  action: () => Promise<string>
}

interface ErrorStatistics {
  total: number
  resolved: number
  unresolved: number
  resolutionRate: number
  bySeverity: Record<string, number>
}

interface ErrorPattern {
  type: 'frequency' | 'time' | 'operation'
  description: string
  count: number
}

interface ErrorReport {
  timestamp: number
  statistics: ErrorStatistics
  recentErrors: UndoRedoError[]
  patterns: ErrorPattern[]
  recommendations: string[]
}
```

This comprehensive testing and debugging documentation provides the tools and strategies needed to ensure reliable undo/redo systems that can handle complex scenarios while maintaining excellent user experience.