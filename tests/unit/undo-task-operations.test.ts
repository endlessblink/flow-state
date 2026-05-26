import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockEnqueue = vi.fn()
const mockSaveTasks = vi.fn()
const mockDeleteTask = vi.fn()
const mockBulkDeleteTasks = vi.fn()
const mockPermanentDeleteTask = vi.fn()

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    status: { value: 'idle' },
    pendingCount: { value: 0 },
    failedCount: { value: 0 },
    lastSyncAt: { value: null },
    lastError: { value: null },
    isOnline: { value: true },
    isProcessing: { value: false },
    hasPendingChanges: { value: false },
    hasErrors: { value: false },
    retryFailed: vi.fn(),
    clearFailed: vi.fn(),
    getQueueStats: vi.fn(),
    forceSync: vi.fn()
  })
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null)
  }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' }
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: mockDeleteTask,
    bulkDeleteTasks: mockBulkDeleteTasks,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null)
  })
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true
  })
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null })
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    groups: [],
    sections: [],
    selectedNodeIds: [],
    setSelectedNodes: vi.fn(),
    setGroups: vi.fn()
  })
}))

vi.mock('@/stores/canvas/canvasUi', () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

vi.mock('@/services/trash/TrashService', () => ({
  trashService: {
    permanentlyDeleteTask: mockPermanentDeleteTask
  }
}))

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { createMockTask } from '../factories'

describe('task operation undo/redo three-cycle invariants', () => {
  beforeEach(() => {
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
    mockBulkDeleteTasks.mockResolvedValue(undefined)
    mockPermanentDeleteTask.mockResolvedValue(undefined)
  })

  afterEach(() => {
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  it('undoes and redoes task creation three consecutive times with the same task id', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()

    const createdTask = await undoSystem.createTaskWithUndo({
      title: 'Undo create coverage',
      status: 'todo',
      priority: 'medium'
    })

    expect(createdTask).toBeDefined()
    expect(taskStore._rawTasks.find(task => task.id === createdTask?.id)?.title).toBe('Undo create coverage')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.some(task => task.id === createdTask?.id)).toBe(false)

      await undoSystem.redo()

      const restored = taskStore._rawTasks.find(task => task.id === createdTask?.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Undo create coverage')
      expect(restored?.id).toBe(createdTask?.id)
    }
  })

  it('undoes and redoes task updates three consecutive times without touching task identity', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-update-cycle',
      title: 'Before update',
      priority: 'low',
      isInInbox: false
    })
    taskStore._rawTasks.push(task)

    await undoSystem.updateTaskWithUndo(task.id, {
      title: 'After update',
      priority: 'high'
    })

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.title).toBe('After update')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.title).toBe('Before update')
      expect(afterUndo?.priority).toBe('low')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.title).toBe('After update')
      expect(afterRedo?.priority).toBe('high')
    }
  })

  it('undoes and redoes the public moveTaskWithUndo status wrapper three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-status-move-cycle',
      title: 'Status move cycle',
      status: 'todo'
    })
    taskStore._rawTasks.push(task)

    await taskStore.moveTaskWithUndo(task.id, 'done')

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.status).toBe('done')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.status).toBe('todo')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.status).toBe('done')
    }
  })

  it('undoes and redoes the public moveTaskToProjectWithUndo wrapper three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const { moveTaskToProjectWithUndo } = useUnifiedUndoRedo()
    const task = createMockTask({
      id: 'task-project-move-cycle',
      title: 'Project move cycle',
      projectId: 'project-before'
    })
    taskStore._rawTasks.push(task)

    await moveTaskToProjectWithUndo(task.id, 'project-after')

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.projectId).toBe('project-after')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.projectId).toBe('project-before')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.projectId).toBe('project-after')
    }
  })

  it('undoes and redoes task deletion three consecutive times with the same restored task id', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-delete-cycle',
      title: 'Delete cycle task'
    })
    taskStore._rawTasks.push(task)

    await undoSystem.deleteTaskWithUndo(task.id)

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const restored = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Delete cycle task')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    }
  })

  it('undoes and redoes permanent task deletion three consecutive times locally', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-cycle',
      title: 'Permanent delete cycle task'
    })
    taskStore._rawTasks.push(task)

    await undoSystem.permanentlyDeleteTaskWithUndo(task.id)

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const restored = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Permanent delete cycle task')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    }
  })

  it('undoes and redoes bulk task deletion three consecutive times with all original ids', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'task-bulk-delete-a', title: 'Bulk delete A' })
    const taskB = createMockTask({ id: 'task-bulk-delete-b', title: 'Bulk delete B' })
    taskStore._rawTasks.push(taskA, taskB)

    await undoSystem.bulkDeleteTasksWithUndo([taskA.id, taskB.id])

    expect(taskStore._rawTasks.some(candidate => candidate.id === taskA.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === taskB.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === taskA.id)?.title).toBe('Bulk delete A')
      expect(taskStore._rawTasks.find(candidate => candidate.id === taskB.id)?.title).toBe('Bulk delete B')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === taskA.id)).toBe(false)
      expect(taskStore._rawTasks.some(candidate => candidate.id === taskB.id)).toBe(false)
    }
  })
})
