import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
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
    createGroup: vi.fn(async (groupData: Omit<CanvasGroup, 'id'> | CanvasGroup) => {
      const newGroup = {
        ...groupData,
        id: 'id' in groupData && groupData.id ? groupData.id : `group-${mockGroups.length + 1}`,
        isVisible: true,
        isCollapsed: false
      } as CanvasGroup
      mockGroups.push(newGroup)
      return newGroup
    }),
    updateGroup: vi.fn(async (groupId: string, updates: Partial<CanvasGroup>) => {
      const index = mockGroups.findIndex(group => group.id === groupId)
      if (index >= 0) {
        mockGroups[index] = { ...mockGroups[index], ...updates }
      }
    }),
    deleteGroup: vi.fn(async (groupId: string) => {
      mockGroups = mockGroups.filter(group => group.id !== groupId)
    })
  })
}))

vi.mock('@/stores/canvas/canvasUi', () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { useCanvasConnections } from '@/composables/canvas/useCanvasConnections'
import { createMockTask } from '../factories'

describe('canvas connection undo', () => {
  beforeEach(() => {
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
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  const makeConnectionState = () => ({
    isConnecting: ref(false),
    recentlyRemovedEdges: ref(new Set<string>()),
    showEdgeContextMenu: ref(false),
    edgeContextMenuX: ref(0),
    edgeContextMenuY: ref(0),
    selectedEdge: ref(null),
    pendingConnectionSource: ref(null),
    connectionWasSuccessful: ref(false)
  })

  const makeConnections = (syncEdges = vi.fn(), connectionState = makeConnectionState()) => useCanvasConnections(
    {
      syncEdges,
      closeCanvasContextMenu: vi.fn(),
      closeEdgeContextMenu: vi.fn(),
      closeNodeContextMenu: vi.fn(),
      withVueFlowErrorBoundary: (_name, fn) => fn
    },
    connectionState
  )

  it('links a task to a group without rewriting child task hierarchy', async () => {
    const taskStore = useTaskStore()
    const syncEdges = vi.fn()
    const connections = makeConnections(syncEdges)

    const parent = createMockTask({
      id: 'parent-task',
      title: 'Parent task',
      canvasPosition: { x: -240, y: 20 }
    })
    const child = createMockTask({
      id: 'child-task',
      title: 'Child task',
      parentId: 'group-1',
      parentTaskId: null,
      canvasPosition: { x: 40, y: 40 }
    })

    taskStore._rawTasks.push(parent, child)

    await connections.handleConnect({ source: 'parent-task', target: 'section-group-1' })

    expect(mockGroups[0].linkedParentTaskId).toBe('parent-task')
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentId).toBe('group-1')
    expect(syncEdges).toHaveBeenCalledWith({ force: true })
  })

  it('undoes and redoes a group-level connection three consecutive times without moving child tasks out of the group', async () => {
    const taskStore = useTaskStore()
    const connections = makeConnections()
    const undoSystem = getUndoSystem()

    const parent = createMockTask({
      id: 'parent-task',
      title: 'Parent task',
      canvasPosition: { x: -240, y: 20 }
    })
    const child = createMockTask({
      id: 'child-task',
      title: 'Child task',
      parentId: 'group-1',
      parentTaskId: null,
      canvasPosition: { x: 40, y: 40 }
    })

    taskStore._rawTasks.push(parent, child)

    await connections.handleConnect({ source: 'parent-task', target: 'section-group-1' })

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(mockGroups[0].linkedParentTaskId).toBeNull()
      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentId).toBe('group-1')
      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()

      await undoSystem.redo()

      expect(mockGroups[0].linkedParentTaskId).toBe('parent-task')
      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentId).toBe('group-1')
      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()
    }
  })

  it('undoes the canvas connection without touching a later incidental task update', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()

    const parent = createMockTask({ id: 'parent-task', title: 'Parent task' })
    const child = createMockTask({ id: 'child-task', title: 'Child task', parentId: 'group-1', parentTaskId: null })
    const incidental = createMockTask({ id: 'incidental-task', title: 'Incidental task' })

    taskStore._rawTasks.push(parent, child, incidental)

    await undoSystem.canvasConnectionWithUndo(
      'Connect task to group: Parent task -> Linked Group',
      ['group-1'],
      async () => {
        mockGroups[0] = { ...mockGroups[0], linkedParentTaskId: 'parent-task' }
      }
    )

    await undoSystem.updateTaskWithUndo('incidental-task', { title: 'Later incidental update' })

    expect(undoSystem.getOperationStack().at(-1)?.operation.type).toBe('task-update')

    await undoSystem.undo()

    expect(taskStore._rawTasks.find(task => task.id === 'incidental-task')?.title).toBe('Incidental task')

    await undoSystem.undo()

    expect(mockGroups[0].linkedParentTaskId).toBeNull()
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentId).toBe('group-1')
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()
  })

  it('undoes and redoes a task-to-task connection three consecutive times', async () => {
    const taskStore = useTaskStore()
    const connections = makeConnections()
    const undoSystem = getUndoSystem()

    const parent = createMockTask({
      id: 'parent-task',
      title: 'Parent task',
      canvasPosition: { x: 0, y: 0 }
    })
    const child = createMockTask({
      id: 'child-task',
      title: 'Child task',
      parentTaskId: null,
      canvasPosition: { x: 260, y: 0 }
    })

    taskStore._rawTasks.push(parent, child)

    await connections.handleConnect({ source: 'parent-task', target: 'child-task' })

    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBe('parent-task')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()

      await undoSystem.redo()

      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBe('parent-task')
    }
  })

  it('undoes and redoes a task-to-task disconnect three consecutive times', async () => {
    const taskStore = useTaskStore()
    const connectionState = makeConnectionState()
    const connections = makeConnections(vi.fn(), connectionState)
    const undoSystem = getUndoSystem()

    const parent = createMockTask({
      id: 'parent-task',
      title: 'Parent task',
      canvasPosition: { x: 0, y: 0 }
    })
    const child = createMockTask({
      id: 'child-task',
      title: 'Child task',
      parentTaskId: 'parent-task',
      canvasPosition: { x: 260, y: 0 }
    })

    taskStore._rawTasks.push(parent, child)
    connectionState.selectedEdge.value = {
      id: 'e-parent-task-child-task',
      source: 'parent-task',
      target: 'child-task'
    } as never

    await connections.disconnectEdge()

    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBe('parent-task')

      await undoSystem.redo()

      expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBeNull()
    }
  })

  it('does not create an undo entry for an already-existing task connection', async () => {
    const taskStore = useTaskStore()
    const connections = makeConnections()
    const undoSystem = getUndoSystem()

    taskStore._rawTasks.push(
      createMockTask({
        id: 'parent-task',
        title: 'Parent task',
        canvasPosition: { x: 0, y: 0 }
      }),
      createMockTask({
        id: 'child-task',
        title: 'Child task',
        parentTaskId: 'parent-task',
        canvasPosition: { x: 260, y: 0 }
      })
    )

    await connections.handleConnect({ source: 'parent-task', target: 'child-task' })

    expect(undoSystem.getOperationStack()).toHaveLength(0)
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBe('parent-task')
  })

  it('does not disconnect a task edge when the edge source is not the target parent', async () => {
    const taskStore = useTaskStore()
    const connectionState = makeConnectionState()
    const connections = makeConnections(vi.fn(), connectionState)
    const undoSystem = getUndoSystem()

    taskStore._rawTasks.push(
      createMockTask({
        id: 'actual-parent',
        title: 'Actual parent',
        canvasPosition: { x: 0, y: 0 }
      }),
      createMockTask({
        id: 'stale-parent',
        title: 'Stale parent',
        canvasPosition: { x: 0, y: 160 }
      }),
      createMockTask({
        id: 'child-task',
        title: 'Child task',
        parentTaskId: 'actual-parent',
        canvasPosition: { x: 260, y: 0 }
      })
    )
    connectionState.selectedEdge.value = {
      id: 'e-stale-parent-child-task',
      source: 'stale-parent',
      target: 'child-task'
    } as never

    await connections.disconnectEdge()

    expect(undoSystem.getOperationStack()).toHaveLength(0)
    expect(taskStore._rawTasks.find(task => task.id === 'child-task')?.parentTaskId).toBe('actual-parent')
  })

  it('undoes and redoes group creation three consecutive times without changing the created group id', async () => {
    const undoSystem = getUndoSystem()

    const createdGroup = await undoSystem.createGroupWithUndo({
      name: 'Created Group',
      type: 'custom',
      position: { x: 120, y: 140, width: 300, height: 240 },
      isVisible: true
    })

    expect(createdGroup?.id).toBe('group-2')
    expect(mockGroups.some(group => group.id === createdGroup?.id)).toBe(true)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(mockGroups.some(group => group.id === createdGroup?.id)).toBe(false)

      await undoSystem.redo()

      const restoredGroup = mockGroups.find(group => group.id === createdGroup?.id)
      expect(restoredGroup).toBeDefined()
      expect(restoredGroup?.name).toBe('Created Group')
      expect(restoredGroup?.position).toEqual({ x: 120, y: 140, width: 300, height: 240 })
    }
  })

  it('undoes and redoes group deletion three consecutive times using the original group id', async () => {
    const undoSystem = getUndoSystem()

    await undoSystem.deleteGroupWithUndo('group-1')

    expect(mockGroups.some(group => group.id === 'group-1')).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const restoredGroup = mockGroups.find(group => group.id === 'group-1')
      expect(restoredGroup).toBeDefined()
      expect(restoredGroup?.name).toBe('Linked Group')

      await undoSystem.redo()

      expect(mockGroups.some(group => group.id === 'group-1')).toBe(false)
    }
  })

  it('undoes and redoes group resize three consecutive times without changing group identity', async () => {
    const undoSystem = getUndoSystem()

    await undoSystem.updateGroupWithUndo('group-1', {
      position: { x: 0, y: 0, width: 520, height: 360 }
    })

    expect(mockGroups.find(group => group.id === 'group-1')?.position).toEqual({ x: 0, y: 0, width: 520, height: 360 })

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = mockGroups.find(group => group.id === 'group-1')
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.position).toEqual({ x: 0, y: 0, width: 400, height: 400 })

      await undoSystem.redo()

      const afterRedo = mockGroups.find(group => group.id === 'group-1')
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.position).toEqual({ x: 0, y: 0, width: 520, height: 360 })
    }
  })
})
