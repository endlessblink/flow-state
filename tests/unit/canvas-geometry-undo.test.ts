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

describe('canvas geometry undo', () => {
  beforeEach(() => {
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockGroups = [{
      id: 'group-geometry',
      name: 'Geometry Group',
      type: 'custom',
      position: { x: 10, y: 20, width: 300, height: 200 },
      isVisible: true
    } as CanvasGroup]
  })

  afterEach(() => {
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  it('undoes and redoes a mixed task/group canvas move three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-geometry',
      title: 'Geometry task',
      parentId: 'group-geometry',
      canvasPosition: { x: 40, y: 50 },
      positionFormat: 'absolute'
    })
    taskStore._rawTasks.push(task)

    await undoSystem.canvasGeometryWithUndo(
      'Move canvas geometry',
      ['task-geometry', 'group-geometry'],
      async () => {
        await taskStore.updateTask('task-geometry', {
          parentId: undefined,
          canvasPosition: { x: 500, y: 600 },
          positionFormat: 'absolute'
        }, 'DRAG')
        mockGroups[0] = {
          ...mockGroups[0],
          position: { x: 120, y: 140, width: 360, height: 220 }
        }
      }
    )

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.canvasPosition).toEqual({ x: 500, y: 600 })
    expect(mockGroups[0].position).toEqual({ x: 120, y: 140, width: 360, height: 220 })

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo?.parentId).toBe('group-geometry')
      expect(afterUndo?.canvasPosition).toEqual({ x: 40, y: 50 })
      expect(mockGroups[0].position).toEqual({ x: 10, y: 20, width: 300, height: 200 })

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo?.parentId).toBeUndefined()
      expect(afterRedo?.canvasPosition).toEqual({ x: 500, y: 600 })
      expect(mockGroups[0].position).toEqual({ x: 120, y: 140, width: 360, height: 220 })
    }
  })

  it('undoes and redoes a synchronous layout snapshot three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-layout-snapshot',
      title: 'Layout snapshot task',
      parentId: 'group-geometry',
      canvasPosition: { x: 80, y: 90 },
      positionFormat: 'absolute'
    })
    taskStore._rawTasks.push(task)

    const snapshotBefore = JSON.parse(JSON.stringify({
      tasks: taskStore._rawTasks.filter(candidate => candidate.id === task.id),
      groups: mockGroups
    }))

    await taskStore.updateTask(task.id, {
      canvasPosition: { x: 240, y: 260 },
      positionFormat: 'absolute'
    }, 'DRAG')
    mockGroups[0] = {
      ...mockGroups[0],
      position: { x: 200, y: 220, width: 420, height: 300 }
    }

    const snapshotAfter = JSON.parse(JSON.stringify({
      tasks: taskStore._rawTasks.filter(candidate => candidate.id === task.id),
      groups: mockGroups
    }))

    undoSystem.pushCanvasGeometryUndoSnapshot(
      'Synchronous layout snapshot',
      [task.id, 'group-geometry'],
      snapshotBefore,
      snapshotAfter
    )

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo?.canvasPosition).toEqual({ x: 80, y: 90 })
      expect(mockGroups[0].position).toEqual({ x: 10, y: 20, width: 300, height: 200 })

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo?.canvasPosition).toEqual({ x: 240, y: 260 })
      expect(mockGroups[0].position).toEqual({ x: 200, y: 220, width: 420, height: 300 })
    }
  })
})
