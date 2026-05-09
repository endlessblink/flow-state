/**
 * Mini-canvas (Thinking Flow) user-drawn edges must survive modal close + re-open.
 *
 * Regression: edges used to live only in a component-local ref<Edge[]>([]),
 * destroyed on `v-if` unmount. Now they persist on task.miniCanvasEdges.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Module-level mocks (must run before importing the store) ──

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    onPermanentFailure: vi.fn(),
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
    forceSync: vi.fn(),
  }),
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({ save: vi.fn(), load: vi.fn().mockResolvedValue(null) }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' },
}))

const mockSaveTasks = vi.fn().mockResolvedValue(undefined)
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: vi.fn(),
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({ onTaskCompleted: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

import { useTaskStore } from '@/stores/tasks'
import { useMiniCanvasActions } from '@/composables/mini-canvas/useMiniCanvasActions'

describe('mini-canvas user-drawn edge persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSaveTasks.mockResolvedValue(undefined)
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
  })

  it('addMiniCanvasEdge persists the edge on task.miniCanvasEdges', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'parent' })

    const actions = useMiniCanvasActions(() => task.id)
    actions.addMiniCanvasEdge({
      id: 'user-a-b',
      source: 'a',
      target: 'b',
      sourceHandle: 'right',
      targetHandle: 'left',
    })

    // Wait for async updateTask to flush
    await new Promise(resolve => setTimeout(resolve, 0))

    const persisted = store.tasks.find(t => t.id === task.id)
    expect(persisted?.miniCanvasEdges).toEqual([
      { id: 'user-a-b', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
    ])
  })

  it('addMiniCanvasEdge is idempotent (no duplicate edge ids)', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'parent' })
    const actions = useMiniCanvasActions(() => task.id)

    const edge = { id: 'user-a-b', source: 'a', target: 'b' }
    actions.addMiniCanvasEdge(edge)
    await new Promise(resolve => setTimeout(resolve, 0))
    actions.addMiniCanvasEdge(edge)
    await new Promise(resolve => setTimeout(resolve, 0))

    const persisted = store.tasks.find(t => t.id === task.id)
    expect(persisted?.miniCanvasEdges?.length).toBe(1)
  })

  it('removeMiniCanvasEdgesForNode removes only edges touching that node', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'parent' })
    const actions = useMiniCanvasActions(() => task.id)

    actions.addMiniCanvasEdge({ id: 'user-a-b', source: 'a', target: 'b' })
    await new Promise(resolve => setTimeout(resolve, 0))
    actions.addMiniCanvasEdge({ id: 'user-b-c', source: 'b', target: 'c' })
    await new Promise(resolve => setTimeout(resolve, 0))
    actions.addMiniCanvasEdge({ id: 'user-x-y', source: 'x', target: 'y' })
    await new Promise(resolve => setTimeout(resolve, 0))

    actions.removeMiniCanvasEdgesForNode('b')
    await new Promise(resolve => setTimeout(resolve, 0))

    const persisted = store.tasks.find(t => t.id === task.id)
    expect(persisted?.miniCanvasEdges?.map(e => e.id).sort()).toEqual(['user-x-y'])
  })

  it('removeMiniCanvasEdge removes the matching edge by id', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'parent' })
    const actions = useMiniCanvasActions(() => task.id)

    actions.addMiniCanvasEdge({ id: 'user-a-b', source: 'a', target: 'b' })
    await new Promise(resolve => setTimeout(resolve, 0))
    actions.addMiniCanvasEdge({ id: 'user-c-d', source: 'c', target: 'd' })
    await new Promise(resolve => setTimeout(resolve, 0))

    actions.removeMiniCanvasEdge('user-a-b')
    await new Promise(resolve => setTimeout(resolve, 0))

    const persisted = store.tasks.find(t => t.id === task.id)
    expect(persisted?.miniCanvasEdges?.map(e => e.id)).toEqual(['user-c-d'])
  })
})
