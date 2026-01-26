import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'

/**
 * High Severity Issue #7: Realtime Sync Race Protection
 *
 * Tests that realtime sync updates are blocked when a task is in the pending-write registry.
 * This prevents the scenario where:
 * 1. User drags task to position A
 * 2. Drag handler starts saving position A
 * 3. Realtime sync receives old position B from another client
 * 4. Position B overwrites position A before drag save completes
 */
describe('Realtime Sync Race Protection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should block realtime sync for tasks in pending-write registry', () => {
    const taskStore = useTaskStore()

    // Create a task
    const taskId = 'task-123'
    const initialTask: Task = {
      id: taskId,
      title: 'Test Task',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: { x: 100, y: 100 },
      positionVersion: 1
    }

    // Add task to store
    taskStore._rawTasks.push(initialTask)

    // Simulate drag operation - mark as pending write
    taskStore.addPendingWrite(taskId)

    // Verify task is in pending-write registry
    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    // Simulate realtime sync trying to update the task
    // The realtime handler in useAppInitialization should check isPendingWrite
    // and skip the update if true
    const shouldSkipSync = taskStore.isPendingWrite(taskId)
    expect(shouldSkipSync).toBe(true)

    // After drag completes, clear pending write
    taskStore.removePendingWrite(taskId)

    // Now realtime sync should be allowed
    expect(taskStore.isPendingWrite(taskId)).toBe(false)
  })

  it('should prevent position overwrite race condition', async () => {
    const taskStore = useTaskStore()

    const taskId = 'race-task'
    const initialTask: Task = {
      id: taskId,
      title: 'Race Condition Test',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: { x: 0, y: 0 },
      positionVersion: 1
    }

    taskStore._rawTasks.push(initialTask)

    // User drags task to new position
    const draggedPosition = { x: 500, y: 500 }

    // Mark as pending write (simulating drag handler)
    taskStore.addPendingWrite(taskId)

    // Simulate realtime sync receiving stale position update
    const staleRealtimeUpdate: Task = {
      ...initialTask,
      canvasPosition: { x: 100, y: 100 }, // Old position
      positionVersion: 1,
      updatedAt: new Date(Date.now() - 1000) // Older timestamp
    }

    // Check if sync should be blocked
    if (!taskStore.isPendingWrite(taskId)) {
      // This should NOT execute during drag
      taskStore.updateTaskFromSync(taskId, staleRealtimeUpdate, false)
    }

    // Verify task still has original position (not overwritten by realtime)
    const task = taskStore.getTask(taskId)
    expect(task?.canvasPosition).toEqual({ x: 0, y: 0 })

    // Complete the drag save
    await taskStore.updateTask(taskId, {
      canvasPosition: draggedPosition,
      positionVersion: 2
    })

    taskStore.removePendingWrite(taskId)

    // Verify final position is the dragged position
    const finalTask = taskStore.getTask(taskId)
    expect(finalTask?.canvasPosition).toEqual(draggedPosition)
    expect(finalTask?.positionVersion).toBe(2)
  })

  it('should allow realtime sync after pending write is cleared', () => {
    const taskStore = useTaskStore()

    const taskId = 'sequential-task'
    const baseTime = new Date('2024-01-01T00:00:00Z')
    const task: Task = {
      id: taskId,
      title: 'Sequential Update Test',
      status: 'todo',
      createdAt: baseTime,
      updatedAt: baseTime,
      canvasPosition: { x: 200, y: 200 },
      positionVersion: 1
    }

    taskStore._rawTasks.push(task)

    // Phase 1: Drag operation (blocks realtime)
    taskStore.addPendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    // Phase 2: Drag completes
    taskStore.removePendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(false)

    // Phase 3: Verify realtime sync would not be blocked
    // The actual sync logic in useAppInitialization checks isPendingWrite
    // and skips the update if true. We just verify the flag is cleared.
    const shouldBlock = taskStore.isPendingWrite(taskId)
    expect(shouldBlock).toBe(false)
  })

  it('should handle multiple concurrent drag operations', () => {
    const taskStore = useTaskStore()

    const task1Id = 'concurrent-1'
    const task2Id = 'concurrent-2'

    const task1: Task = {
      id: task1Id,
      title: 'Concurrent Task 1',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: { x: 0, y: 0 }
    }

    const task2: Task = {
      id: task2Id,
      title: 'Concurrent Task 2',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: { x: 50, y: 50 }
    }

    taskStore._rawTasks.push(task1, task2)

    // Both tasks being dragged simultaneously
    taskStore.addPendingWrite(task1Id)
    taskStore.addPendingWrite(task2Id)

    // Both should block realtime sync
    expect(taskStore.isPendingWrite(task1Id)).toBe(true)
    expect(taskStore.isPendingWrite(task2Id)).toBe(true)

    // Task 1 completes first
    taskStore.removePendingWrite(task1Id)

    expect(taskStore.isPendingWrite(task1Id)).toBe(false)
    expect(taskStore.isPendingWrite(task2Id)).toBe(true) // Still blocking

    // Task 2 completes
    taskStore.removePendingWrite(task2Id)

    expect(taskStore.isPendingWrite(task1Id)).toBe(false)
    expect(taskStore.isPendingWrite(task2Id)).toBe(false)
  })
})
