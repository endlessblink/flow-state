import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest'

const mockTaskStore = vi.hoisted(() => ({
  calendarFilteredTasks: [] as any[],
  hideCalendarDoneTasks: false,
  toggleCalendarDoneTasks: vi.fn(),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => mockTaskStore,
  getTaskInstances: (task: any) => task.instances ?? [],
  parseDateKey: (dateKey: string) => new Date(`${dateKey}T00:00:00`),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({ groups: [] }),
}))

vi.mock('@/composables/canvas/useCanvasGroupMembership', () => ({
  useCanvasGroupMembership: () => ({
    groupsWithCounts: { value: [] },
    filterTasksByGroup: (tasks: any[]) => tasks,
  }),
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isTodayTask: () => false,
  }),
}))

vi.mock('@/i18n/useDirection', () => ({
  useDirection: () => ({
    isRTL: { value: false },
  }),
}))

import { useCalendarInboxState } from '@/composables/inbox/useCalendarInboxState'

const task = (overrides: Record<string, unknown>) => ({
  id: 'task',
  title: 'Task',
  status: 'todo',
  createdAt: new Date('2026-06-01T08:00:00.000Z'),
  updatedAt: new Date('2026-06-01T08:00:00.000Z'),
  isPinned: false,
  instances: [],
  ...overrides,
})

describe('useCalendarInboxState subtask filtering', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    localStorage.clear()
    mockTaskStore.calendarFilteredTasks = []
    mockTaskStore.hideCalendarDoneTasks = false
    mockTaskStore.toggleCalendarDoneTasks.mockClear()
  })

  it('keeps parent tasks visible while hiding tasks linked by parentTaskId', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({ id: 'parent', title: 'פרויקט בינה מעצבת' }),
      task({ id: 'child', title: 'Child follow-up', parentTaskId: 'parent' }),
      task({ id: 'standalone', title: 'Standalone task' }),
    ]

    const state = useCalendarInboxState()

    expect(state.inboxTasks.value.map(item => item.title)).toEqual([
      'פרויקט בינה מעצבת',
      'Child follow-up',
      'Standalone task',
    ])

    state.hideSubtasks.value = true

    expect(state.inboxTasks.value.map(item => item.title)).toEqual([
      'פרויקט בינה מעצבת',
      'Standalone task',
    ])
  })

  it('hides top-level calendar cards that are backed by embedded subtasks', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'parent',
        title: 'פרויקט בינה מעצבת',
        subtasks: [
          {
            id: 'embedded-subtask',
            parentTaskId: 'parent',
            title: 'לבדוק משימות בגושן',
            description: '',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date('2026-06-01T08:00:00.000Z'),
            updatedAt: new Date('2026-06-01T08:00:00.000Z'),
          },
        ],
      }),
      task({ id: 'embedded-subtask', title: 'לבדוק משימות בגושן' }),
      task({ id: 'standalone', title: 'Standalone task' }),
    ]

    const state = useCalendarInboxState()

    state.hideSubtasks.value = true

    expect(state.inboxTasks.value.map(item => item.title)).toEqual([
      'פרויקט בינה מעצבת',
      'Standalone task',
    ])
  })

  it('keeps scheduled canvas tasks out of the calendar inbox when sorted by canvas order', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'scheduled-canvas-task',
        title: 'Scheduled canvas task',
        canvasPosition: { x: 10, y: 20 },
        instances: [{ scheduledDate: '2026-08-02', scheduledTime: '12:00' }],
      }),
      task({ id: 'unscheduled-task', title: 'Unscheduled task' }),
    ]

    const state = useCalendarInboxState()
    state.sortBy.value = 'canvasOrder'

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['unscheduled-task'])
  })

  it('keeps a task due today visible in the Today filter even when it has a calendar instance', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00+03:00'))
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'due-today-with-calendar-instance',
        title: 'Due today with calendar instance',
        dueDate: '2026-08-20',
        instances: [{ scheduledDate: '2026-08-21', scheduledTime: '12:00' }],
      }),
      task({
        id: 'due-tomorrow-with-calendar-instance',
        title: 'Due tomorrow with calendar instance',
        dueDate: '2026-08-21',
        instances: [{ scheduledDate: '2026-08-20', scheduledTime: '12:00' }],
      }),
    ]

    const state = useCalendarInboxState()
    state.showTodayOnly.value = true

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['due-today-with-calendar-instance'])
  })

  it('keeps a schedule-only task visible in the Today filter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00+03:00'))
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'scheduled-only-today',
        title: 'Scheduled only today',
        dueDate: '',
        instances: [{ scheduledDate: '2026-08-20', scheduledTime: '12:00' }],
      }),
    ]

    const state = useCalendarInboxState()
    state.showTodayOnly.value = true

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['scheduled-only-today'])
  })

  it('keeps recurring scheduled tasks visible in the calendar inbox', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'recurring-canvas-task',
        title: 'Recurring canvas task',
        canvasPosition: { x: 10, y: 20 },
        recurrenceRule: { pattern: 'weekly', interval: 1, endType: 'never' },
        instances: [{ scheduledDate: '2026-08-02', scheduledTime: '12:00', isRecurring: true }],
      }),
    ]

    const state = useCalendarInboxState()

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['recurring-canvas-task'])
  })

  it('keeps due-date-only tasks in the calendar inbox', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({ id: 'due-date-only-task', title: 'Due date only', dueDate: '2026-08-02' }),
    ]

    const state = useCalendarInboxState()

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['due-date-only-task'])
  })
})
