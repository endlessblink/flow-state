import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

type MockTask = {
  id: string
  title: string
  status: 'todo' | 'done'
  projectId?: string
  _soft_deleted?: boolean
}

const rawTasks: MockTask[] = []
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
    isUncategorizedTask: () => true
  })
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchQuickSortHistory: vi.fn().mockResolvedValue([])
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'test-user-id' }
  })
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: vi.fn().mockResolvedValue({ id: 1 })
}))

vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseQuickSortSession: vi.fn().mockReturnValue({})
}))

const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]) })
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useQuickSort undo/redo task mutations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    rawTasks.splice(0, rawTasks.length)
    taskStore.updateTask.mockClear()
    taskStore.deleteTask.mockClear()
    taskStore.createTask.mockClear()
    localStorageMock.clear()
  })

  it('reapplies MARK_DONE status across three redo cycles', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push({ id: 'task-1', title: 'Done task', status: 'todo' })

    const quickSort = useQuickSort()
    quickSort.startSession()

    await quickSort.markTaskDone('task-1')
    expect(rawTasks.find(task => task.id === 'task-1')?.status).toBe('done')

    for (let i = 0; i < 3; i += 1) {
      await quickSort.undoLastCategorization()
      expect(rawTasks.find(task => task.id === 'task-1')?.status).toBe('todo')

      await quickSort.redoLastCategorization()
      expect(rawTasks.find(task => task.id === 'task-1')?.status).toBe('done')
    }
  })

  it('re-deletes MARK_DONE_AND_DELETE tasks across three redo cycles without duplicates', async () => {
    const { useQuickSort } = await import('@/composables/useQuickSort')
    rawTasks.push({ id: 'task-1', title: 'Delete task', status: 'todo' })

    const quickSort = useQuickSort()
    quickSort.startSession()

    await quickSort.markDoneAndDeleteTask('task-1')
    expect(rawTasks.some(task => task.id === 'task-1')).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await quickSort.undoLastCategorization()
      expect(rawTasks.filter(task => task.id === 'task-1')).toHaveLength(1)
      expect(rawTasks.find(task => task.id === 'task-1')?.status).toBe('todo')

      await quickSort.redoLastCategorization()
      expect(rawTasks.some(task => task.id === 'task-1')).toBe(false)
    }
  })
})
