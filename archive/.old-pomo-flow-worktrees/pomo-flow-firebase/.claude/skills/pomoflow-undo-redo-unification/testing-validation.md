# Testing and Validation Plan

## Comprehensive Testing Strategy for Unified Undo/Redo System

## Testing Overview

This plan ensures the unified undo/redo system works reliably across all PomoFlow features and meets performance requirements.

## Test Environment Setup

### 1. Test Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/composables/useUnifiedUndoRedo.ts', 'src/stores/*.ts']
    }
  }
})

// tests/setup.ts
import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock VueUse for testing
vi.mock('@vueuse/core', () => ({
  useManualRefHistory: vi.fn(() => ({
    history: ref([]),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: ref(false),
    canRedo: ref(false),
    commit: vi.fn(),
    clear: vi.fn(),
    reset: vi.fn()
  }))
}))

// Mock stores
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn(() => ({
    tasks: [],
    projects: [],
    selectedTaskId: null,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn()
  }))
}))
```

### 2. Test Data Factory
```typescript
// tests/factories/taskFactory.ts
export class TaskFactory {
  static create(overrides: Partial<Task> = {}): Task {
    return {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Default Task',
      description: 'Default description',
      status: 'active',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  static createBatch(count: number, overrides: Partial<Task> = {}): Task[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({
        title: `Task ${i + 1}`,
        ...overrides
      })
    )
  }
}

// tests/factories/canvasFactory.ts
export class CanvasFactory {
  static createSection(overrides: Partial<CanvasSection> = {}): CanvasSection {
    return {
      id: `section-${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task-${Math.random().toString(36).substr(2, 9)}`,
      position: { x: 100, y: 100 },
      size: { width: 200, height: 100 },
      createdAt: new Date().toISOString(),
      ...overrides
    }
  }
}
```

## Unit Tests

### 1. Core Undo/Redo Functionality
```typescript
// tests/unit/useUnifiedUndoRedo.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'

describe('useUnifiedUndoRedo', () => {
  let pinia: any

  beforeEach(() => {
    pinia = setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  test('should initialize with correct defaults', () => {
    const { history, canUndo, canRedo, historyCount } = useUnifiedUndoRedo()

    expect(history.value).toEqual([])
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
    expect(historyCount.value).toBe(0)
  })

  test('should save state correctly', () => {
    const { saveState, historyCount } = useUnifiedUndoRedo()

    const result = saveState('Test operation')

    expect(result).toBe(true)
    expect(historyCount.value).toBe(1)
  })

  test('should handle state saving failure gracefully', () => {
    const mockCommit = vi.fn(() => {
      throw new Error('State save failed')
    })

    // Mock VueUse to throw error
    vi.doMock('@vueuse/core', () => ({
      useManualRefHistory: () => ({
        commit: mockCommit,
        history: ref([]),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: ref(false),
        canRedo: ref(false)
      })
    }))

    const { saveState } = useUnifiedUndoRedo()
    const result = saveState('Test operation')

    expect(result).toBe(false)
    expect(mockCommit).toHaveBeenCalled()
  })

  test('should provide correct history information', () => {
    const { lastAction, historyCount } = useUnifiedUndoRedo()

    expect(lastAction.value).toBe('No actions')
    expect(historyCount.value).toBe(0)
  })

  test('should handle batch operations', async () => {
    const { batchOperation, historyCount } = useUnifiedUndoRedo()
    const taskStore = useTaskStore()

    const operations = [
      () => taskStore.createTask({ title: 'Task 1' }),
      () => taskStore.createTask({ title: 'Task 2' }),
      () => taskStore.createTask({ title: 'Task 3' })
    ]

    await batchOperation(operations, 'Batch create tasks')

    expect(historyCount.value).toBeGreaterThan(0)
  })
})
```

### 2. Store Integration Tests
```typescript
// tests/unit/tasks-store-undo.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

describe('TaskStore with Undo/Redo', () => {
  let taskStore: ReturnType<typeof useTaskStore>
  let undoRedo: ReturnType<typeof useUnifiedUndoRedo>

  beforeEach(() => {
    setActivePinia(createPinia())
    taskStore = useTaskStore()
    undoRedo = useUnifiedUndoRedo()
  })

  test('should save state before and after task creation', () => {
    const taskData = { title: 'Test Task' }

    const saveStateSpy = vi.spyOn(undoRedo, 'saveState')

    const task = taskStore.createTask(taskData)

    expect(saveStateSpy).toHaveBeenCalledWith('Before task creation')
    expect(saveStateSpy).toHaveBeenCalledWith('After task creation')
    expect(saveStateSpy).toHaveBeenCalledTimes(2)
    expect(task).toBeDefined()
  })

  test('should handle task updates with undo/redo', () => {
    const task = taskStore.createTask({ title: 'Original Title' })

    const updates = { title: 'Updated Title' }
    taskStore.updateTask(task.id, updates)

    expect(taskStore.tasks[0].title).toBe('Updated Title')
  })

  test('should handle bulk operations with single history entry', () => {
    const tasks = TaskFactory.createBatch(3)
    const taskIds = tasks.map(() => taskStore.createTask({ title: 'Bulk Task' }).id)

    const saveStateSpy = vi.spyOn(undoRedo, 'saveState')

    taskStore.bulkUpdateTasks(taskIds, { status: 'completed' })

    expect(saveStateSpy).toHaveBeenCalledWith('Before bulk update of 3 tasks')
    expect(saveStateSpy).toHaveBeenCalledWith('After bulk update of 3 tasks')
  })

  test('should handle task deletion', () => {
    const task = taskStore.createTask({ title: 'To Delete' })
    const initialCount = taskStore.tasks.length

    taskStore.deleteTask(task.id)

    expect(taskStore.tasks.length).toBe(initialCount - 1)
  })

  test('should handle selection changes', () => {
    const task = taskStore.createTask({ title: 'Select Me' })

    taskStore.selectTask(task.id)
    expect(taskStore.selectedTaskId).toBe(task.id)

    taskStore.selectTask(null)
    expect(taskStore.selectedTaskId).toBeNull()
  })
})
```

### 3. Canvas Store Integration Tests
```typescript
// tests/unit/canvas-store-undo.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

describe('CanvasStore with Undo/Redo', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let undoRedo: ReturnType<typeof useUnifiedUndoRedo>

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    undoRedo = useUnifiedUndoRedo()
  })

  test('should handle section creation', () => {
    const sectionData = {
      taskId: 'task-123',
      position: { x: 100, y: 200 },
      size: { width: 200, height: 100 }
    }

    const saveStateSpy = vi.spyOn(undoRedo, 'saveState')

    const section = canvasStore.createSection(sectionData)

    expect(saveStateSpy).toHaveBeenCalledWith('Before canvas section creation')
    expect(saveStateSpy).toHaveBeenCalledWith('After canvas section creation')
    expect(section).toBeDefined()
    expect(section.id).toBeDefined()
  })

  test('should handle section updates', () => {
    const section = canvasStore.createSection({
      taskId: 'task-123',
      position: { x: 0, y: 0 }
    })

    canvasStore.updateSection(section.id, {
      position: { x: 150, y: 250 }
    })

    expect(canvasStore.sections[0].position).toEqual({ x: 150, y: 250 })
  })

  test('should handle task position updates', () => {
    const section = canvasStore.createSection({
      taskId: 'task-123',
      position: { x: 100, y: 100 }
    })

    const newPosition = { x: 300, y: 400 }
    canvasStore.updateTaskPosition('task-123', newPosition)

    expect(canvasStore.sections[0].position).toEqual(newPosition)
  })

  test('should handle viewport changes', () => {
    const saveStateSpy = vi.spyOn(undoRedo, 'saveState')

    canvasStore.setViewport(100, 200, 1.5)

    expect(saveStateSpy).toHaveBeenCalledWith('Before viewport change to (100, 200, 1.5)')
    expect(canvasStore.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 })
  })

  test('should handle node selection', () => {
    const nodeIds = ['node-1', 'node-2', 'node-3']

    canvasStore.selectNodes(nodeIds)
    expect(canvasStore.selectedNodes).toEqual(nodeIds)

    canvasStore.clearSelection()
    expect(canvasStore.selectedNodes).toEqual([])

    canvasStore.toggleNodeSelection('node-1')
    expect(canvasStore.selectedNodes).toEqual(['node-1'])

    canvasStore.toggleNodeSelection('node-1')
    expect(canvasStore.selectedNodes).toEqual([])
  })
})
```

### 4. Integration Tests
```typescript
// tests/integration/undo-redo-integration.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTimerStore } from '@/stores/timer'

describe('Undo/Redo Integration', () => {
  let taskStore: ReturnType<typeof useTaskStore>
  let canvasStore: ReturnType<typeof useCanvasStore>
  let timerStore: ReturnType<typeof useTimerStore>
  let undoRedo: ReturnType<typeof useUnifiedUndoRedo>

  beforeEach(() => {
    setActivePinia(createPinia())
    taskStore = useTaskStore()
    canvasStore = useCanvasStore()
    timerStore = useTimerStore()
    undoRedo = useUnifiedUndoRedo()
  })

  test('should maintain state consistency across stores', async () => {
    // Create task
    const task = taskStore.createTask({
      title: 'Integration Test Task',
      description: 'Testing cross-store consistency'
    })

    // Add to canvas
    const section = canvasStore.createSection({
      taskId: task.id,
      position: { x: 100, y: 100 }
    })

    // Start timer
    timerStore.startTimer(task.id, 25 * 60 * 1000, false)

    // Verify all stores have the changes
    expect(taskStore.tasks).toHaveLength(1)
    expect(canvasStore.sections).toHaveLength(1)
    expect(timerStore.currentTaskId).toBe(task.id)
    expect(timerStore.isActive).toBe(true)

    // Undo all changes
    await undoRedo.undo() // Undo timer
    await undoRedo.undo() // Undo canvas
    await undoRedo.undo() // Undo task

    // Verify all changes reverted
    expect(taskStore.tasks).toHaveLength(0)
    expect(canvasStore.sections).toHaveLength(0)
    expect(timerStore.currentTaskId).toBeNull()
    expect(timerStore.isActive).toBe(false)
  })

  test('should handle complex workflow scenarios', async () => {
    // Create multiple tasks
    const tasks = []
    for (let i = 0; i < 3; i++) {
      tasks.push(taskStore.createTask({
        title: `Workflow Task ${i}`,
        description: `Description ${i}`
      }))
    }

    // Add all to canvas
    const sections = tasks.map(task =>
      canvasStore.createSection({
        taskId: task.id,
        position: { x: i * 250, y: 100 }
      })
    )

    // Update all tasks
    taskStore.bulkUpdateTasks(
      tasks.map(t => t.id),
      { status: 'completed' }
    )

    // Verify all operations completed
    expect(taskStore.tasks.every(t => t.status === 'completed')).toBe(true)
    expect(canvasStore.sections).toHaveLength(3)

    // Undo bulk update
    await undoRedo.undo()
    expect(taskStore.tasks.every(t => t.status === 'active')).toBe(true)

    // Undo canvas additions
    await undoRedo.undo()
    await undoRedo.undo()
    await undoRedo.undo()
    expect(canvasStore.sections).toHaveLength(0)

    // Undo task creations
    await undoRedo.undo()
    await undoRedo.undo()
    await undoRedo.undo()
    expect(taskStore.tasks).toHaveLength(0)
  })

  test('should maintain performance with large state', async () => {
    const startTime = performance.now()

    // Create large number of tasks
    for (let i = 0; i < 100; i++) {
      taskStore.createTask({
        title: `Performance Test Task ${i}`,
        description: `Performance testing task ${i} with additional data to simulate real-world complexity`
      })
    }

    const creationTime = performance.now() - startTime

    // Test undo performance
    const undoStartTime = performance.now()
    for (let i = 0; i < 10; i++) {
      await undoRedo.undo()
    }
    const undoTime = performance.now() - undoStartTime

    // Performance assertions
    expect(creationTime).toBeLessThan(1000) // 1 second for 100 tasks
    expect(undoTime).toBeLessThan(500) // 500ms for 10 undos
    expect(undoRedo.historyCount.value).toBeLessThanOrEqual(50) // Memory limit
  })
})
```

## End-to-End Tests

### 1. User Workflow Tests
```typescript
// tests/e2e/complete-workflow.test.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Undo/Redo Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
  })

  test('complete task management workflow', async ({ page }) => {
    // Navigate to board view
    await page.click('[data-testid="nav-board"]')
    await page.waitForSelector('[data-testid="board-view"]')

    // Create multiple tasks
    const tasks = ['Task 1', 'Task 2', 'Task 3']
    for (const title of tasks) {
      await page.click('[data-testid="create-task-button"]')
      await page.fill('[data-testid="task-title"]', title)
      await page.click('[data-testid="save-task"]')
      await page.waitForTimeout(500)
    }

    // Verify tasks created
    for (const title of tasks) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("${title}")`)).toBeVisible()
    }

    // Update tasks
    for (let i = 0; i < tasks.length; i++) {
      await page.click(`[data-testid="task-card"]:has-text("${tasks[i]}")`)
      await page.click('[data-testid="edit-task"]')
      await page.fill('[data-testid="task-title"]', `Updated ${tasks[i]}`)
      await page.click('[data-testid="save-task"]')
    }

    // Verify updates
    for (const title of tasks) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("Updated ${title}")`)).toBeVisible()
    }

    // Test undo chain
    for (let i = 0; i < 6; i++) { // 3 updates + 3 creations
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(200)
    }

    // Verify all tasks reverted to original
    for (const title of tasks) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("${title}")`)).toBeVisible()
      await expect(page.locator(`[data-testid="task-card"]:has-text("Updated ${title}")`)).not.toBeVisible()
    }

    // Test redo chain
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Control+Shift+z')
      await page.waitForTimeout(200)
    }

    // Verify all tasks updated again
    for (const title of tasks) {
      await expect(page.locator(`[data-testid="task-card"]:has-text("Updated ${title}")`)).toBeVisible()
    }
  })

  test('canvas operations with undo/redo', async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForSelector('[data-testid="canvas-view"]')

    // Create task and add to canvas
    await page.click('[data-testid="create-task-button"]')
    await page.fill('[data-testid="task-title"]', 'Canvas Test Task')
    await page.click('[data-testid="save-task"]')
    await page.waitForTimeout(500)

    // Drag to canvas
    await page.dragAndDrop(
      '[data-testid="task-card"]',
      '[data-testid="canvas-drop-zone"]'
    )
    await page.waitForSelector('[data-testid="canvas-node"]')

    // Get initial position
    const initialPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()

    // Move node
    await page.hover('[data-testid="canvas-node"]')
    await page.mouse.down()
    await page.mouse.move(initialPosition!.x + 200, initialPosition!.y + 150)
    await page.mouse.up()
    await page.waitForTimeout(500)

    // Verify position changed
    const newPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(newPosition!.x).toBeGreaterThan(initialPosition!.x + 150)

    // Test toolbar undo button
    await page.click('[data-testid="undo-button"]')
    await page.waitForTimeout(500)

    // Verify position restored
    const restoredPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(restoredPosition!.x - initialPosition!.x)).toBeLessThan(10)

    // Test toolbar redo button
    await page.click('[data-testid="redo-button"]')
    await page.waitForTimeout(500)

    // Verify position changed again
    const redoPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(redoPosition!.x - newPosition!.x)).toBeLessThan(10)

    // Test keyboard shortcuts for canvas
    await page.hover('[data-testid="canvas-node"]')
    await page.mouse.down()
    await page.mouse.move(redoPosition!.x - 100, redoPosition!.y + 50)
    await page.mouse.up()
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(500)

    // Verify keyboard shortcuts work
    const finalPosition = await page.locator('[data-testid="canvas-node"]').boundingBox()
    expect(Math.abs(finalPosition!.x - (redoPosition!.x - 100))).toBeLessThan(10)
  })

  test('timer operations with undo/redo', async ({ page }) => {
    // Create task first
    await page.click('[data-testid="create-task-button"]')
    await page.fill('[data-testid="task-title"]', 'Timer Test Task')
    await page.click('[data-testid="save-task"]')
    await page.waitForTimeout(500)

    // Start timer
    await page.click('[data-testid="task-card"]')
    await page.click('[data-testid="start-timer"]')
    await page.waitForSelector('[data-testid="timer-active"]')

    // Pause timer
    await page.click('[data-testid="pause-timer"]')
    await page.waitForSelector('[data-testid="timer-paused"]')

    // Test undo timer pause
    await page.keyboard.press('Control+z')
    await page.waitForSelector('[data-testid="timer-active"]')

    // Test redo timer pause
    await page.keyboard.press('Control+Shift+z')
    await page.waitForSelector('[data-testid="timer-paused"]')

    // Stop timer
    await page.click('[data-testid="stop-timer"]')
    await page.waitForSelector('[data-testid="timer-stopped"]')

    // Verify timer state is managed correctly
    expect(page.locator('[data-testid="timer-display"]')).toBeVisible()
  })
})
```

### 2. Performance Tests
```typescript
// tests/e2e/performance.test.ts
import { test, expect } from '@playwright/test'

test.describe('Undo/Redo Performance', () => {
  test('memory usage under heavy load', async ({ page }) => {
    await page.goto('http://localhost:5546/#/canvas')

    // Monitor memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Create large number of operations
    for (let i = 0; i < 200; i++) {
      await page.click('[data-testid="create-task-button"]')
      await page.fill('[data-testid="task-title"]', `Performance Task ${i}`)
      await page.click('[data-testid="save-task"]')
      await page.waitForTimeout(50) // Small delay to prevent overwhelming
    }

    // Check memory after operations
    const afterOperationsMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    const memoryIncrease = afterOperationsMemory - initialMemory
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024)

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncreaseMB).toBeLessThan(50)

    // Perform undo operations
    const undoStartTime = Date.now()
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(100)
    }
    const undoTime = Date.now() - undoStartTime

    // Undo operations should be fast (less than 10 seconds for 50 operations)
    expect(undoTime).toBeLessThan(10000)

    // Check memory after undo
    const afterUndoMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Memory should be reduced after undo
    expect(afterUndoMemory).toBeLessThan(afterOperationsMemory)
  })

  test('operation speed benchmarks', async ({ page }) => {
    await page.goto('http://localhost:5546/#/board')

    // Benchmark task creation
    const createTimes = []
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now()

      await page.click('[data-testid="create-task-button"]')
      await page.fill('[data-testid="task-title"]', `Benchmark Task ${i}`)
      await page.click('[data-testid="save-task"]')
      await page.waitForTimeout(100)

      const endTime = performance.now()
      createTimes.push(endTime - startTime)
    }

    const averageCreateTime = createTimes.reduce((a, b) => a + b, 0) / createTimes.length
    expect(averageCreateTime).toBeLessThan(1000) // 1 second per task

    // Benchmark undo operations
    const undoTimes = []
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now()

      await page.keyboard.press('Control+z')
      await page.waitForTimeout(100)

      const endTime = performance.now()
      undoTimes.push(endTime - startTime)
    }

    const averageUndoTime = undoTimes.reduce((a, b) => a + b, 0) / undoTimes.length
    expect(averageUndoTime).toBeLessThan(500) // 500ms per undo

    // Benchmark redo operations
    const redoTimes = []
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now()

      await page.keyboard.press('Control+Shift+z')
      await page.waitForTimeout(100)

      const endTime = performance.now()
      redoTimes.push(endTime - startTime)
    }

    const averageRedoTime = redoTimes.reduce((a, b) => a + b, 0) / redoTimes.length
    expect(averageRedoTime).toBeLessThan(500) // 500ms per redo
  })
})
```

## Stress Tests

### 1. Long-running Stability Test
```typescript
// tests/stress/long-running.test.ts
import { test, expect } from '@playwright/test'

test.describe('Long-running Stability', () => {
  test('extended usage stability', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Run operations for 5 minutes
    const endTime = Date.now() + (5 * 60 * 1000) // 5 minutes
    let operationCount = 0

    while (Date.now() < endTime) {
      // Create task
      await page.click('[data-testid="create-task-button"]')
      await page.fill('[data-testid="task-title"]', `Stress Test Task ${operationCount}`)
      await page.click('[data-testid="save-task"]')
      await page.waitForTimeout(200)

      operationCount++

      // Every 10 operations, test undo/redo
      if (operationCount % 10 === 0) {
        await page.keyboard.press('Control+z')
        await page.waitForTimeout(200)
        await page.keyboard.press('Control+Shift+z')
        await page.waitForTimeout(200)
      }

      // Check for memory leaks periodically
      if (operationCount % 50 === 0) {
        const memory = await page.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0
        })
        console.log(`Operation ${operationCount}: Memory usage: ${memory / 1024 / 1024} MB`)
      }
    }

    // Final validation
    expect(operationCount).toBeGreaterThan(100)

    // Test final undo/redo operations
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(500)

    // Verify application is still responsive
    await expect(page.locator('[data-testid="create-task-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="undo-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="redo-button"]')).toBeVisible()
  })
})
```

## Validation Checklist

### ✅ Functional Validation
- [ ] All store operations work with undo/redo
- [ ] Canvas operations maintain position state
- [ ] Timer operations maintain state correctly
- [ ] Keyboard shortcuts work consistently
- [ ] UI controls show correct enable/disable states
- [ ] Batch operations create single history entries
- [ ] Memory limits enforced (50 entries max)

### ✅ Performance Validation
- [ ] Task creation < 1 second
- [ ] Undo operation < 500ms
- [ ] Redo operation < 500ms
- [ ] Memory usage < 50MB for 1000 operations
- [ ] No memory leaks in 5-minute stress test
- [ ] UI remains responsive during heavy operations

### ✅ Usability Validation
- [ ] Undo/redo behavior is intuitive
- [ ] Keyboard shortcuts follow standard conventions
- [ ] Visual feedback for available operations
- [ ] Error handling prevents corruption
- [ ] History information is informative
- [ ] Cross-application consistency maintained

### ✅ Edge Case Validation
- [ ] Empty history handled gracefully
- [ ] Large state changes handled efficiently
- [ ] Concurrent operations handled correctly
- [ ] Network issues don't corrupt state
- [ ] Browser refresh doesn't break functionality
- [ ] Rapid operations don't cause crashes

## Automation and CI/CD

### GitHub Actions Workflow
```yaml
# .github/workflows/undo-redo-validation.yml
name: Undo/Redo Validation

on:
  push:
    branches: [main, 'feature/*']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:undo-redo

      - name: Run E2E tests
        run: npm run test:e2e:undo-redo

      - name: Performance validation
        run: npm run test:performance:undo-redo

      - name: Generate test report
        run: npm run test:report:undo-redo

  performance:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Run performance benchmarks
        run: npm run test:performance:benchmarks

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: performance-results.json
```

## Success Criteria

### ✅ Definition of Success

The unified undo/redo system is considered successful when:

1. **Functionality**: All PomoFlow features work with consistent undo/redo
2. **Performance**: Operations complete within specified time limits
3. **Stability**: No crashes or memory leaks in extended testing
4. **Usability**: User experience is intuitive and reliable
5. **Maintainability**: Code is significantly simplified and documented

### ✅ Rollback Criteria

Rollback to previous system if:

1. Critical functionality is broken
2. Performance degrades significantly (>2x slower)
3. Memory usage exceeds 100MB in normal usage
4. User testing shows major usability issues
5. Testing suite has >50% failures

This comprehensive testing plan ensures the unified undo/redo system meets all requirements for reliability, performance, and user experience before deployment.