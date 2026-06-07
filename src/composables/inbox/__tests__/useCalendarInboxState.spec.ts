import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Task } from '@/types/tasks'

const { taskStoreMock, canvasStoreMock } = vi.hoisted(() => ({
  taskStoreMock: {
    calendarFilteredTasks: [] as Task[],
    hideCalendarDoneTasks: false,
    toggleCalendarDoneTasks: vi.fn(),
    rootProjects: [],
  },
  canvasStoreMock: {
    groups: [],
  },
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => taskStoreMock,
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => canvasStoreMock,
}))

vi.mock('@/composables/canvas/useCanvasGroupMembership', () => ({
  useCanvasGroupMembership: () => ({
    groupsWithCounts: ref([]),
    filterTasksByGroup: (tasks: Task[]) => tasks,
  }),
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isTodayTask: (task: Task) => {
      const today = new Date()
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      return task.dueDate?.slice(0, 10) === todayString
    },
  }),
}))

vi.mock('@/i18n/useDirection', () => ({
  useDirection: () => ({
    isRTL: ref(false),
  }),
}))

const todayStr = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const tomorrowStr = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
}

const task = (overrides: Partial<Task>): Task => ({
  id: 'task',
  title: 'Task',
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
  createdAt: new Date('2026-06-07T10:00:00'),
  updatedAt: new Date('2026-06-07T10:00:00'),
  ...overrides,
} as Task)

describe('useCalendarInboxState', () => {
  beforeEach(() => {
    taskStoreMock.calendarFilteredTasks = []
    taskStoreMock.hideCalendarDoneTasks = false
    taskStoreMock.toggleCalendarDoneTasks.mockClear()
    canvasStoreMock.groups = []
    localStorage.clear()
  })

  it('excludes done tasks and completion records from the active calendar inbox', async () => {
    const doneTask = task({
      id: 'done-task',
      title: 'Done task',
      status: 'done',
      dueDate: todayStr(),
      instances: [{ id: 'done-inst', scheduledDate: todayStr(), scheduledTime: '16:00', duration: 30 }]
    })
    const completionRecord = task({
      id: 'completion-record',
      title: 'Completion record',
      status: 'done',
      isCompletionRecord: true,
      dueDate: todayStr()
    })
    const activeTask = task({
      id: 'active-task',
      title: 'Active task',
      dueDate: todayStr()
    })

    taskStoreMock.calendarFilteredTasks = [doneTask, completionRecord, activeTask]

    const { useCalendarInboxState } = await import('../useCalendarInboxState')
    const state = useCalendarInboxState()

    expect(state.baseInboxTasks.value.map(t => t.id)).toEqual(['active-task'])
    expect(state.todayCount.value).toBe(1)
  })

  it('keeps active due-today tasks visible when scheduled on another day', async () => {
    const dueTodayScheduledTomorrow = task({
      id: 'due-today-scheduled-tomorrow',
      title: 'Due today, scheduled tomorrow',
      dueDate: todayStr(),
      instances: [{
        id: 'tomorrow-inst',
        scheduledDate: tomorrowStr(),
        scheduledTime: '09:00',
        duration: 30,
        status: 'scheduled'
      }]
    })

    taskStoreMock.calendarFilteredTasks = [dueTodayScheduledTomorrow]

    const { useCalendarInboxState } = await import('../useCalendarInboxState')
    const state = useCalendarInboxState()
    state.showTodayOnly.value = true

    expect(state.baseInboxTasks.value.map(t => t.id)).toEqual(['due-today-scheduled-tomorrow'])
    expect(state.inboxTasks.value.map(t => t.id)).toEqual(['due-today-scheduled-tomorrow'])
  })
})
