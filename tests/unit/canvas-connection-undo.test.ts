import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { CanvasGroup } from '@/types/canvas'

const mockEnqueue = vi.fn()
const mockSaveTasks = vi.fn()
let mockGroups: CanvasGroup[] = []

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
    deleteTask: vi.fn(),
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
    get groups() { return mockGroups },
    get sections() { return mockGroups },
    selectedNodeIds: [],
    setSelectedNodes: vi.fn(),
    setGroups: vi.fn((groups: CanvasGroup[]) => { mockGroups = groups }),
    updateGroup: vi.fn(async (groupId: string, updates: Partial<CanvasGroup>) => {
      const index = mockGroups.findIndex(group => group.id === groupId)
      if (index >= 0) {
        mockGroups[index] = { ...mockGroups[index], ...updates }
      }
    })
  })
}))

vi.mock('@/stores/canvas/canvasUi', () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { createMockTask } from '../factories'

describe('canvas connection undo ordering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockGroups = [{
      id: 'group-1',
      name: 'Linked Group',
      type: 'custom',
      position: { x: 0, y: 0, width: 400, height: 400 },
      isVisible: true,
      linkedParentTaskId: null
    } as CanvasGroup]
  })

  afterEach(() => {
    vi.useRealTimers()
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  it('undoes the canvas connection before a later incidental task update', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()

    const parent = createMockTask({ id: 'parent-task', title: 'Parent task' })
    const child = createMockTask({ id: 'child-task', title: 'Child task', parentTaskId: null })
    const incidental = createMockTask({ id: 'incidental-task', title: 'Incidental task' })

    taskStore._rawTasks.push(parent, child, incidental)

    await undoSystem.canvasConnectionWithUndo(
      'Connect task to group: Parent task -> Linked Group',
      ['group-1', 'child-task'],
      async () => {
        mockGroups[0] = { ...mockGroups[0], linkedParentTaskId: 'parent-task' }
        await taskStore.updateTask('child-task', { parentTaskId: 'parent-task' })
      }
    )

    await undoSystem.updateTaskWithUndo('incidental-task', { title: 'Later incidental update' })

    expect(undoSystem.getOperationStack().at(-1)?.operation.type).toBe('task-update')

    await vi.runAllTimersAsync()

    expect(undoSystem.getOperationStack().at(-1)?.operation.type).toBe('canvas-connection')

    await undoSystem.undo()

    expect(mockGroups[0].linkedParentTaskId).toBeNull()
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()
    expect(taskStore._rawTasks.find(task => task.id === 'incidental-task')?.title).toBe('Later incidental update')
  })
})
