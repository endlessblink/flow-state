import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'
import { useTaskSortStore } from '@/stores/taskSort'

const taskStoreMock = {
  filteredTasks: [] as Task[],
  calendarFilteredTasks: [] as Task[],
  _rawTasks: [] as Task[],
  isLoadingFromDatabase: false,
}

const canvasStoreMock = {
  groups: [],
}

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => taskStoreMock,
  getTaskInstances: (task: Task) => task.instances ?? [],
  parseDateKey: (dateKey: string) => new Date(`${dateKey}T00:00:00`),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => canvasStoreMock,
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isTodayTask: (task: Task) => {
      const today = new Date()
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      return String(task.dueDate ?? '').slice(0, 10) === dateKey
    },
    isNext3DaysTask: () => false,
    isWeekTask: () => false,
    isThisMonthTask: () => false,
  }),
}))

vi.mock('@/composables/canvas/useCanvasGroupMembership', () => ({
  useCanvasGroupMembership: () => ({
    groupsWithCounts: ref([]),
    filterTasksByGroup: (tasks: Task[]) => tasks,
  }),
}))

vi.mock('@/i18n/useDirection', () => ({
  useDirection: () => ({
    direction: ref<'ltr' | 'rtl'>('ltr'),
    isRTL: ref(false),
    isLTR: ref(true),
    directionPreference: ref<'ltr' | 'rtl' | 'auto'>('auto'),
    setDirection: () => {},
    updateDocumentDirection: () => {},
  }),
}))

describe('useUnifiedInboxState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    taskStoreMock.filteredTasks = []
    taskStoreMock.calendarFilteredTasks = []
    taskStoreMock._rawTasks = []
    taskStoreMock.isLoadingFromDatabase = false
    canvasStoreMock.groups = []
    localStorage.clear()
  })

  it('dedupes duplicate task ids in inbox counts and visible list', async () => {
    const duplicateTask: Task = {
      id: 'task-1',
      title: 'Duplicate Inbox Task',
      description: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '',
      projectId: '',
      isInInbox: true,
      isPinned: false,
      createdAt: new Date('2026-03-19T10:00:00Z'),
      updatedAt: new Date('2026-03-19T10:00:00Z'),
    } as Task

    taskStoreMock.filteredTasks = [duplicateTask, { ...duplicateTask }]
    taskStoreMock._rawTasks = [duplicateTask, { ...duplicateTask }]

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const state = useUnifiedInboxState({ context: 'standalone' })
    state.activeTimeFilter.value = 'all'
    await nextTick()

    expect(state.baseInboxTasks.value).toHaveLength(1)
    expect(state.inboxTasks.value).toHaveLength(1)
    expect(state.pinnedTasks.value).toHaveLength(0)
    expect(state.doneTaskCount.value).toBe(0)
  })

  it('hides due-today tasks from calendar inbox when scheduled on another day', async () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const task: Task = {
      id: 'task-due-today',
      title: 'Due today, scheduled tomorrow',
      description: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      projectId: '',
      isInInbox: true,
      isPinned: false,
      dueDate: todayStr,
      instances: [{ id: 'inst-1', scheduledDate: tomorrowStr, scheduledTime: '09:00', duration: 30, status: 'scheduled' }],
      createdAt: new Date('2026-03-19T10:00:00Z'),
      updatedAt: new Date('2026-03-19T10:00:00Z'),
    } as Task

    taskStoreMock.calendarFilteredTasks = [task]
    taskStoreMock._rawTasks = [task]

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const state = useUnifiedInboxState({ context: 'calendar' })

    expect(state.baseInboxTasks.value).toHaveLength(0)
    expect(state.inboxTasks.value).toHaveLength(0)
  })

  it('keeps a scheduled due-today task out of the calendar Today inbox', async () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const task: Task = {
      id: 'task-due-today-filtered',
      title: 'Due today survives Today filter',
      description: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      projectId: '',
      isInInbox: true,
      isPinned: false,
      dueDate: todayStr,
      instances: [{ id: 'inst-2', scheduledDate: tomorrowStr, scheduledTime: '09:00', duration: 30, status: 'scheduled' }],
      createdAt: new Date('2026-03-19T10:00:00Z'),
      updatedAt: new Date('2026-03-19T10:00:00Z'),
    } as Task

    taskStoreMock.calendarFilteredTasks = [task]
    taskStoreMock._rawTasks = [task]

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const state = useUnifiedInboxState({ context: 'calendar' })
    state.activeTimeFilter.value = 'today'
    await nextTick()

    expect(state.inboxTasks.value).toHaveLength(0)
  })

  it('keeps a task already represented on Calendar out of its Today inbox', async () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const otherDay = new Date(today)
    otherDay.setDate(today.getDate() - 2)
    const otherDayStr = `${otherDay.getFullYear()}-${String(otherDay.getMonth() + 1).padStart(2, '0')}-${String(otherDay.getDate()).padStart(2, '0')}`

    const task: Task = {
      id: 'task-pixie-shape',
      title: 'Pixie due today but scheduled elsewhere',
      description: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      projectId: '',
      isInInbox: false,
      isPinned: false,
      dueDate: todayStr,
      canvasPosition: { x: 10, y: 20 },
      instances: [{ id: 'inst-3', scheduledDate: otherDayStr, scheduledTime: '09:00', duration: 30, status: 'scheduled' }],
      createdAt: new Date('2026-03-19T10:00:00Z'),
      updatedAt: new Date('2026-03-19T10:00:00Z'),
    } as Task

    taskStoreMock.calendarFilteredTasks = [task]
    taskStoreMock._rawTasks = [task]

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const state = useUnifiedInboxState({ context: 'calendar' })
    state.activeTimeFilter.value = 'today'
    await nextTick()

    expect(state.baseInboxTasks.value).toHaveLength(0)
    expect(state.inboxTasks.value).toHaveLength(0)
  })

  it('defaults both inbox contexts to Today and follows the global priority order', async () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tasks = [
      { id: 'medium', title: 'Medium', status: 'todo', priority: 'medium', dueDate: todayStr, isInInbox: true, createdAt: today, updatedAt: today, order: 0 },
      { id: 'high', title: 'High', status: 'todo', priority: 'high', dueDate: todayStr, isInInbox: true, createdAt: today, updatedAt: today, order: 1 },
      { id: 'placed', title: 'Placed', status: 'todo', priority: 'immediate', dueDate: todayStr, isInInbox: false, canvasPosition: { x: 1, y: 1 }, createdAt: today, updatedAt: today, order: 2 },
    ] as Task[]
    taskStoreMock.filteredTasks = tasks
    taskStoreMock.calendarFilteredTasks = tasks
    taskStoreMock._rawTasks = tasks

    const globalSort = useTaskSortStore()
    globalSort.mainSortKey = 'priority'
    globalSort.mainSortDirection = 'asc'

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const canvas = useUnifiedInboxState({ context: 'canvas' })
    const standalone = useUnifiedInboxState({ context: 'standalone' })

    expect(canvas.activeTimeFilter.value).toBe('today')
    expect(standalone.activeTimeFilter.value).toBe('today')
    expect(canvas.inboxTasks.value.map(task => task.id)).toEqual(['high', 'medium'])
  })
})
