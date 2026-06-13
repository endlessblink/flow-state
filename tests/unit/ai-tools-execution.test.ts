import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)

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
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null),
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas',
  },
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: vi.fn().mockResolvedValue(undefined),
    saveTasks: vi.fn().mockResolvedValue(undefined),
    deleteTask: mockDeleteTask,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
    fetchProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: null,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: null,
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    groups: [],
    _rawGroups: [],
    createGroup: vi.fn(),
    getAggregatedTaskCountForGroup: vi.fn(() => 0),
  }),
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    currentTaskName: '',
    isTimerActive: false,
    currentSession: null,
    completedSessions: [],
    startTimer: vi.fn().mockResolvedValue(undefined),
    stopTimer: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({
    projects: [],
  }),
}))

vi.mock('@/composables/useMoveToCanvasGroup', () => ({
  useMoveToCanvasGroup: () => ({
    moveTaskToGroup: vi.fn().mockResolvedValue(false),
  }),
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn().mockResolvedValue(undefined),
  cacheProjects: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/demoContentGuard', () => ({
  guardTaskCreation: vi.fn(),
}))

import { executeTool } from '@/services/ai/tools'
import { useTaskStore } from '@/stores/tasks'

describe('AI tool execution regressions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockDeleteTask.mockResolvedValue(undefined)
  })

  it('creates a real task with supplied fields and rejects invalid due dates', async () => {
    const taskStore = useTaskStore()

    const invalid = await executeTool({
      tool: 'create_task',
      parameters: { title: 'Impossible date task', dueDate: 'tomorrow' },
    })
    expect(invalid.success).toBe(false)
    expect(taskStore._rawTasks).toHaveLength(0)

    const created = await executeTool({
      tool: 'create_task',
      parameters: {
        title: 'Call the bank',
        priority: 'high',
        description: 'Ask about transfer limits',
        dueDate: '2026-06-15',
      },
    })

    expect(created.success).toBe(true)
    expect(created.message).toContain('Created task "Call the bank"')
    expect(taskStore._rawTasks).toHaveLength(1)
    expect(taskStore._rawTasks[0]).toMatchObject({
      title: 'Call the bank',
      priority: 'high',
      description: 'Ask about transfer limits',
      dueDate: '2026-06-15',
      status: 'todo',
    })
  })

  it('marks a task done by title fragment and hides it from default task listings', async () => {
    const taskStore = useTaskStore()
    await taskStore.createTask({ title: 'Review Work bucket priorities', priority: 'high' })
    await taskStore.createTask({ title: 'Buy printer paper', priority: 'medium' })

    const done = await executeTool({
      tool: 'mark_task_done',
      parameters: { task: 'Work bucket' },
    })
    expect(done.success).toBe(true)
    expect(done.message).toContain('Marked "Review Work bucket priorities" as done')
    expect(taskStore._rawTasks.find(task => task.title === 'Review Work bucket priorities')?.status).toBe('done')

    const activeList = await executeTool({ tool: 'list_tasks', parameters: {} })
    expect(activeList.success).toBe(true)
    expect(JSON.stringify(activeList.data)).not.toContain('Review Work bucket priorities')
    expect(JSON.stringify(activeList.data)).toContain('Buy printer paper')

    const doneList = await executeTool({ tool: 'list_tasks', parameters: { status: 'done' } })
    expect(JSON.stringify(doneList.data)).toContain('Review Work bucket priorities')
  })

  it('creates subtasks under an existing parent and rejects empty subtask payloads', async () => {
    const taskStore = useTaskStore()
    const parent = await taskStore.createTask({ title: 'Draft feature proposal' })

    const empty = await executeTool({
      tool: 'create_subtasks',
      parameters: { parentTaskId: parent.id, subtasks: [] },
    })
    expect(empty.success).toBe(false)
    expect(taskStore._rawTasks.find(task => task.id === parent.id)?.subtasks).toHaveLength(0)

    const created = await executeTool({
      tool: 'create_subtasks',
      parameters: {
        parentTaskId: parent.id,
        subtasks: [
          { title: 'Outline scope' },
          { title: 'List regression tests' },
        ],
      },
    })
    expect(created.success).toBe(true)
    expect(created.message).toContain('Created 2 subtasks')
    expect(taskStore._rawTasks.find(task => task.id === parent.id)?.subtasks.map(subtask => subtask.title)).toEqual([
      'Outline scope',
      'List regression tests',
    ])
  })

  it('requires explicit confirmation before destructive task deletion', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({ title: 'Delete only after confirmation' })

    const unconfirmed = await executeTool({
      tool: 'delete_task',
      parameters: { taskId: task.id, confirmed: false },
    })
    expect(unconfirmed.success).toBe(false)
    expect(unconfirmed.message).toContain('requires confirmation')
    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)).toBeDefined()

    const confirmed = await executeTool({
      tool: 'delete_task',
      parameters: { taskId: task.id, confirmed: true },
    })
    expect(confirmed.success).toBe(true)
    expect(confirmed.message).toContain('Deleted task "Delete only after confirmation"')
    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)).toBeUndefined()
  })
})
