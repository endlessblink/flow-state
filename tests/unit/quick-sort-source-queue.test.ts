import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

type MockTask = {
  id: string
  title: string
  status: 'todo' | 'done'
  projectId?: string
  dueDate?: string
  priority?: 'low' | 'medium' | 'high'
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

  it('postpones the current task without closing it', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])

    await quickSort.rescheduleCurrentTask('2026-07-11')

    expect(taskStore.updateTask).toHaveBeenCalledWith('first', { dueDate: '2026-07-11' })
    expect(quickSort.currentTask.value?.id).toBe('first')
    expect(quickSort.progress.value.current).toBe(0)
    expect(quickSort.canUndo.value).toBe(true)

    await quickSort.undoLastCategorization()
    expect(rawTasks.find(task => task.id === 'first')?.dueDate).toBe('2026-07-10')
    expect(quickSort.currentTask.value?.id).toBe('first')
  })

  it('does not absorb an unsaved priority edit into the postpone baseline', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10', priority: 'low' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    rawTasks[0].priority = 'medium'
    await quickSort.rescheduleCurrentTask('2026-07-11')
    await quickSort.saveTask()
    await quickSort.undoLastCategorization()

    expect(rawTasks[0].priority).toBe('low')
    expect(rawTasks[0].dueDate).toBe('2026-07-11')
    expect(quickSort.currentTask.value?.id).toBe('first')
  })

  it('preserves an unsaved priority baseline through postpone undo and redo', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10', priority: 'low' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    rawTasks[0].priority = 'medium'
    await quickSort.rescheduleCurrentTask('2026-07-11')
    await quickSort.undoLastCategorization()
    await quickSort.redoLastCategorization()
    await quickSort.saveTask()
    await quickSort.undoLastCategorization()

    expect(rawTasks[0].priority).toBe('low')
    expect(rawTasks[0].dueDate).toBe('2026-07-11')
    expect(quickSort.currentTask.value?.id).toBe('first')
  })

  it('rebuilds the postponed task snapshot when undo returns from another task', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', projectId: 'project-a', dueDate: '2026-07-10', priority: 'low' },
      { id: 'second', title: 'Second', status: 'todo', projectId: 'project-b', dueDate: '2026-07-10', priority: 'high' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    await quickSort.rescheduleCurrentTask('2026-07-11')
    quickSort.skipTask()
    await quickSort.undoLastCategorization()
    rawTasks[0].priority = 'medium'
    await quickSort.saveTask()
    await quickSort.undoLastCategorization()

    expect(rawTasks[0].priority).toBe('low')
    expect(rawTasks[0].projectId).toBe('project-a')
  })

  it('rebuilds the postponed task snapshot when redo returns from another task', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', projectId: 'project-a', dueDate: '2026-07-10', priority: 'low' },
      { id: 'second', title: 'Second', status: 'todo', projectId: 'project-b', dueDate: '2026-07-10', priority: 'high' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    await quickSort.rescheduleCurrentTask('2026-07-11')
    await quickSort.undoLastCategorization()
    quickSort.skipTask()
    await quickSort.redoLastCategorization()
    rawTasks[0].priority = 'medium'
    await quickSort.saveTask()
    await quickSort.undoLastCategorization()

    expect(rawTasks[0].priority).toBe('low')
    expect(rawTasks[0].projectId).toBe('project-a')
  })

  it('does not skip the following task when a postpone button is double-clicked', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])

    await Promise.all([
      quickSort.rescheduleCurrentTask('2026-07-11'),
      quickSort.rescheduleCurrentTask('2026-07-11')
    ])

    expect(quickSort.currentTask.value?.id).toBe('first')
    expect(quickSort.progress.value.current).toBe(0)
  })

  it('allows postponing a no-date task to be undone back to no date', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push({ id: 'no-date', title: 'No date', status: 'todo', dueDate: '' })

    const quickSort = useQuickSort()
    quickSort.startSession(['no-due-date'])
    await quickSort.rescheduleCurrentTask('2026-07-11')
    await quickSort.undoLastCategorization()

    expect(rawTasks[0].dueDate).toBe('')
    expect(quickSort.currentTask.value?.id).toBe('no-date')
  })

  it('redo clears the date again after undoing a clear-date action', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push({ id: 'dated', title: 'Dated', status: 'todo', dueDate: '2026-07-10' })

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    await quickSort.rescheduleCurrentTask('')
    await quickSort.undoLastCategorization()
    expect(rawTasks[0].dueDate).toBe('2026-07-10')

    await quickSort.redoLastCategorization()
    expect(rawTasks[0].dueDate).toBe('')
    expect(quickSort.currentTask.value?.id).toBe('dated')
  })

  it('coalesces conflicting rapid postpone clicks into one recorded write', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    const results = await Promise.all([
      quickSort.rescheduleCurrentTask('2026-07-11'),
      quickSort.rescheduleCurrentTask('2026-07-17')
    ])

    const firstTaskWrites = taskStore.updateTask.mock.calls.filter(([taskId]) => taskId === 'first')
    expect(firstTaskWrites).toEqual([['first', { dueDate: '2026-07-11' }]])
    expect(results).toEqual([true, false])
    expect(quickSort.currentTask.value?.id).toBe('first')
  })

  it('blocks competing card actions until an in-flight postpone finishes', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push(
      { id: 'first', title: 'First', status: 'todo', dueDate: '2026-07-10' },
      { id: 'second', title: 'Second', status: 'todo', dueDate: '2026-07-10' }
    )
    let resolveWrite!: () => void
    taskStore.updateTask.mockImplementationOnce((taskId: string, updates: Partial<MockTask>) => (
      new Promise<void>(resolve => {
        resolveWrite = () => {
          const task = rawTasks.find(candidate => candidate.id === taskId)
          if (task) Object.assign(task, updates)
          resolve()
        }
      })
    ))

    const quickSort = useQuickSort()
    quickSort.startSession(['today'])
    const postpone = quickSort.rescheduleCurrentTask('2026-07-11')

    await quickSort.saveTask()
    quickSort.skipTask()
    await quickSort.markTaskDone('first')
    expect(quickSort.currentTask.value?.id).toBe('first')
    expect(quickSort.progress.value.current).toBe(0)
    expect(rawTasks[0].status).toBe('todo')

    resolveWrite()
    await postpone
    expect(quickSort.currentTask.value?.id).toBe('first')
    expect(quickSort.progress.value.current).toBe(0)
  })
})
