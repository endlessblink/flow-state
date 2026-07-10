import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

type MockTask = {
  id: string
  title: string
  status: 'todo' | 'done'
  projectId?: string
  dueDate?: string
  isUncategorized?: boolean
  isPinned?: boolean
  _soft_deleted?: boolean
}

const rawTasks = reactive<MockTask[]>([])
const taskStore = {
  rawTasks,
  _rawTasks: rawTasks,
  updateTask: vi.fn(async (taskId: string, updates: Partial<MockTask>) => {
    const task = rawTasks.find(candidate => candidate.id === taskId)
    if (task) Object.assign(task, updates)
  }),
  deleteTask: vi.fn(async (taskId: string) => {
    const index = rawTasks.findIndex(candidate => candidate.id === taskId)
    if (index >= 0) rawTasks.splice(index, 1)
  }),
  createTask: vi.fn(async (task: MockTask) => {
    rawTasks.push({ ...task })
  })
}

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => taskStore
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isUncategorizedTask: (task: MockTask) => task.status !== 'done' && (
      task.isUncategorized === true || !task.projectId || task.projectId === 'uncategorized'
    )
  })
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({ fetchQuickSortHistory: vi.fn().mockResolvedValue([]) })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'test-user-id' } })
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: vi.fn().mockResolvedValue({ id: 1 })
}))

vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseQuickSortSession: vi.fn().mockReturnValue({})
}))

const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
  removeItem: vi.fn((key: string) => { delete storage[key] }),
  clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]) })
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Quick Sort source queues', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 10, 12))
    rawTasks.splice(0, rawTasks.length)
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('loads an assigned overdue task instead of the default uncategorized task', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'future-inbox', title: 'Future inbox', status: 'todo', dueDate: '2026-07-20' },
      { id: 'assigned-overdue', title: 'Assigned overdue', status: 'todo', projectId: 'project-1', dueDate: '2026-07-09' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['overdue'])

    expect(quickSort.currentTask.value?.id).toBe('assigned-overdue')
  })

  it('combines sources as a deduplicated union while preserving raw task order', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'inbox-today', title: 'Inbox today', status: 'todo', dueDate: '2026-07-10' },
      { id: 'assigned-today', title: 'Assigned today', status: 'todo', projectId: 'project-1', dueDate: '2026-07-10' },
      { id: 'future', title: 'Future', status: 'todo', projectId: 'project-1', dueDate: '2026-07-30' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['uncategorized', 'today'])

    expect(quickSort.currentTask.value?.id).toBe('inbox-today')
    await quickSort.saveTask()
    expect(quickSort.currentTask.value?.id).toBe('assigned-today')
    await quickSort.saveTask()
    expect(quickSort.isComplete.value).toBe(true)
  })

  it('snapshots matching task IDs so new tasks do not leak into an active session', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'overdue-1', title: 'First', status: 'todo', projectId: 'project-1', dueDate: '2026-07-08' },
      { id: 'overdue-2', title: 'Second', status: 'todo', projectId: 'project-1', dueDate: '2026-07-09' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['overdue'])
    rawTasks.push({ id: 'late-arrival', title: 'Late arrival', status: 'todo', projectId: 'project-1', dueDate: '2026-07-07' })

    await quickSort.saveTask()
    expect(quickSort.currentTask.value?.id).toBe('overdue-2')
    await quickSort.saveTask()
    expect(quickSort.isComplete.value).toBe(true)
    expect(quickSort.currentTask.value).toBeNull()
  })

  it('reports per-pool counts and a deduplicated combined preview before starting', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'inbox-today', title: 'Inbox today', status: 'todo', dueDate: '2026-07-10' },
      { id: 'assigned-overdue', title: 'Overdue', status: 'todo', projectId: 'project-1', dueDate: '2026-07-09' },
      { id: 'assigned-next', title: 'Next', status: 'todo', projectId: 'project-1', dueDate: '2026-07-15' }
    )

    const quickSort = useQuickSort()

    expect(quickSort.sourceCounts).toBeDefined()
    expect(quickSort.sourceCounts.value).toMatchObject({
      uncategorized: 1,
      overdue: 1,
      today: 1,
      'next-3-days': 0,
      'next-7-days': 1,
      'no-due-date': 0
    })

    quickSort.selectedSources.value = ['uncategorized', 'today', 'overdue']
    expect(quickSort.sourcePreviewTasks.value.map(task => task.id)).toEqual(['inbox-today', 'assigned-overdue'])
  })

  it('advances when the current captured task is completed externally', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'overdue-1', title: 'First', status: 'todo', projectId: 'project-1', dueDate: '2026-07-08' },
      { id: 'overdue-2', title: 'Second', status: 'todo', projectId: 'project-1', dueDate: '2026-07-09' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['overdue'])
    await nextTick()
    await taskStore.updateTask('overdue-1', { status: 'done' })
    await nextTick()
    await nextTick()

    expect(quickSort.currentTask.value?.id).toBe('overdue-2')
  })

  it('skips a captured current task that was completed while the app was closed', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'done-current', title: 'Done elsewhere', status: 'done', projectId: 'project-1', dueDate: '2026-07-08' },
      { id: 'overdue-next', title: 'Still open', status: 'todo', projectId: 'project-1', dueDate: '2026-07-09' }
    )
    const store = useQuickSortStore()
    store.hasInterruptedSession = true
    store.interruptedSessionData = {
      currentSessionId: 'session-resume-done',
      sessionStartTime: Date.now(),
      tasksSortedInSession: 0,
      undoStack: [],
      redoStack: [],
      processedTaskIds: [],
      currentTaskId: 'done-current',
      sources: ['overdue'],
      queuedTaskIds: ['done-current', 'overdue-next']
    }

    const quickSort = useQuickSort()

    expect(quickSort.tryResumeSession()).toBe(true)
    expect(quickSort.currentTask.value?.id).toBe('overdue-next')
  })
})
