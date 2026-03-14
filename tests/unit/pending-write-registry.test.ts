import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

describe('High Severity Issue #7: Pending-Write Registry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should track tasks that are pending write', () => {
    const taskStore = useTaskStore()
    const taskId = 'test-task-123'

    expect(taskStore.isPendingWrite(taskId)).toBe(false)

    taskStore.addPendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    taskStore.removePendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(false)
  })

  it('should auto-clear pending writes after 300 seconds safety fallback (BUG-1207)', async () => {
    const taskStore = useTaskStore()
    const taskId = 'test-task-456'

    // Use fake timers to control time
    vi.useFakeTimers()

    taskStore.addPendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    // Fast-forward 150 seconds (still pending - increased to 300s safety fallback)
    vi.advanceTimersByTime(150000)
    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    // Fast-forward 155 more seconds (total 305 seconds, should be cleared)
    vi.advanceTimersByTime(155000)
    expect(taskStore.isPendingWrite(taskId)).toBe(false)

    vi.useRealTimers()
  })

  it('should handle multiple tasks in pending-write registry', () => {
    const taskStore = useTaskStore()
    const task1 = 'task-1'
    const task2 = 'task-2'
    const task3 = 'task-3'

    taskStore.addPendingWrite(task1)
    taskStore.addPendingWrite(task2)
    taskStore.addPendingWrite(task3)

    expect(taskStore.isPendingWrite(task1)).toBe(true)
    expect(taskStore.isPendingWrite(task2)).toBe(true)
    expect(taskStore.isPendingWrite(task3)).toBe(true)

    taskStore.removePendingWrite(task2)

    expect(taskStore.isPendingWrite(task1)).toBe(true)
    expect(taskStore.isPendingWrite(task2)).toBe(false)
    expect(taskStore.isPendingWrite(task3)).toBe(true)
  })

  it('should safely handle removing a task that was never added', () => {
    const taskStore = useTaskStore()
    const taskId = 'non-existent-task'

    expect(taskStore.isPendingWrite(taskId)).toBe(false)

    // Should not throw
    taskStore.removePendingWrite(taskId)

    expect(taskStore.isPendingWrite(taskId)).toBe(false)
  })

  it('should handle adding the same task multiple times', () => {
    const taskStore = useTaskStore()
    const taskId = 'duplicate-task'

    taskStore.addPendingWrite(taskId)
    taskStore.addPendingWrite(taskId) // Add again

    expect(taskStore.isPendingWrite(taskId)).toBe(true)

    // Single remove should clear it (Set behavior)
    taskStore.removePendingWrite(taskId)
    expect(taskStore.isPendingWrite(taskId)).toBe(false)
  })
})
