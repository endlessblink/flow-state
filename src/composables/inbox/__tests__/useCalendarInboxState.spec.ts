import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

const taskStoreMock = {
  calendarFilteredTasks: [] as Task[],
}

const canvasStoreMock = {
  groups: [],
}

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => taskStoreMock,
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => canvasStoreMock,
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isTodayTask: (task: Task) => Boolean(task.dueDate),
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

const task = (overrides: Partial<Task>): Task => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Calendar inbox task',
  description: '',
  status: overrides.status ?? 'todo',
  priority: 'medium',
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  projectId: '',
  isInInbox: true,
  isPinned: false,
  dueDate: '',
  createdAt: new Date('2026-06-07T10:00:00Z'),
  updatedAt: new Date('2026-06-07T10:00:00Z'),
  ...overrides,
} as Task)

describe('useCalendarInboxState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    taskStoreMock.calendarFilteredTasks = []
    canvasStoreMock.groups = []
    localStorage.clear()
  })

  it('hides completed tasks from the final inbox list by default', async () => {
    const activeTask = task({ id: 'active-task', status: 'todo' })
    const doneTask = task({ id: 'done-task', status: 'done' })
    taskStoreMock.calendarFilteredTasks = [activeTask, doneTask]

    const { useCalendarInboxState } = await import('@/composables/inbox/useCalendarInboxState')
    const state = useCalendarInboxState()

    expect(state.hideCalendarDoneTasks.value).toBe(true)
    expect(state.baseInboxTasks.value.map(t => t.id)).toEqual(['active-task'])
    expect(state.inboxTasks.value.map(t => t.id)).toEqual(['active-task'])
  })

  it('still hides completed tasks when canvas inclusion filters are active', async () => {
    const activeCanvasTask = task({
      id: 'active-canvas-task',
      status: 'todo',
      canvasPosition: { x: 10, y: 10 },
      instances: [{ id: 'active-instance', scheduledDate: '2026-06-08', scheduledTime: '09:00', duration: 30, status: 'scheduled' }],
    })
    const doneCanvasTask = task({
      id: 'done-canvas-task',
      status: 'done',
      canvasPosition: { x: 20, y: 20 },
      instances: [{ id: 'done-instance', scheduledDate: '2026-06-08', scheduledTime: '09:00', duration: 30, status: 'scheduled' }],
    })
    taskStoreMock.calendarFilteredTasks = [activeCanvasTask, doneCanvasTask]

    const { useCalendarInboxState } = await import('@/composables/inbox/useCalendarInboxState')
    const state = useCalendarInboxState()
    state.sortBy.value = 'canvasOrder'

    expect(state.inboxTasks.value.map(t => t.id)).toEqual(['active-canvas-task'])

    state.setHideCalendarDoneTasks(false)

    expect(state.inboxTasks.value.map(t => t.id)).toEqual(['active-canvas-task', 'done-canvas-task'])
  })
})
