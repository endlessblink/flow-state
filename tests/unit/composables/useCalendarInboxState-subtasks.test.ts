import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskSortStore } from '@/stores/taskSort'

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
    setActivePinia(createPinia())
    localStorage.clear()
    mockTaskStore.calendarFilteredTasks = []
    mockTaskStore.hideCalendarDoneTasks = false
    mockTaskStore.toggleCalendarDoneTasks.mockClear()
  })

  it('defaults to Today and follows the shared main sort before its local tie-breaker', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00+03:00'))
    mockTaskStore.calendarFilteredTasks = [
      task({ id: 'medium', title: 'A', priority: 'medium', dueDate: '2026-08-20', order: 0 }),
      task({ id: 'high-late', title: 'Z', priority: 'high', dueDate: '2026-08-20', createdAt: new Date('2026-08-20T10:00:00Z'), order: 1 }),
      task({ id: 'high-early', title: 'B', priority: 'high', dueDate: '2026-08-20', createdAt: new Date('2026-08-20T08:00:00Z'), order: 2 }),
    ]
    const mainSort = useTaskSortStore()
    mainSort.mainSortKey = 'priority'
    mainSort.mainSortDirection = 'asc'

    const state = useCalendarInboxState()
    state.sortBy.value = 'newest'

    expect(state.showTodayOnly.value).toBe(true)
    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['high-late', 'high-early', 'medium'])
  })

  it('keeps parent tasks visible while hiding tasks linked by parentTaskId', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({ id: 'parent', title: 'פרויקט בינה מעצבת', order: 0 }),
      task({ id: 'child', title: 'Child follow-up', parentTaskId: 'parent', order: 1 }),
      task({ id: 'standalone', title: 'Standalone task', order: 2 }),
    ]

    const state = useCalendarInboxState()
    state.showTodayOnly.value = false

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
    state.showTodayOnly.value = false

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
    state.showTodayOnly.value = false
    state.sortBy.value = 'canvasOrder'

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['unscheduled-task'])
  })

  it('keeps an unscheduled Canvas task available in the Calendar inbox', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'canvas-only-task',
        title: 'Canvas only task',
        canvasPosition: { x: 10, y: 20 },
        isInInbox: false,
      }),
    ]

    const state = useCalendarInboxState()
    state.showTodayOnly.value = false

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['canvas-only-task'])
  })

  it('excludes a due-today task already represented by a calendar instance', () => {
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

    expect(state.inboxTasks.value).toEqual([])
  })

  it('excludes a schedule-only task already represented on the calendar', () => {
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

    expect(state.inboxTasks.value).toEqual([])
  })

  it('excludes recurring tasks already represented on the calendar', () => {
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
    state.showTodayOnly.value = false

    expect(state.inboxTasks.value).toEqual([])
  })

  it('removes a recurring task from the calendar inbox after scheduling clears its inbox flag', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({
        id: 'scheduled-recurring-task',
        recurrenceRule: { pattern: 'weekly', interval: 1, endType: 'never' },
        instances: [{ scheduledDate: '2026-08-02', scheduledTime: '12:00', isRecurring: true }],
        isInInbox: false,
      }),
    ]

    const state = useCalendarInboxState()

    expect(state.inboxTasks.value).toEqual([])
  })

  it('keeps due-date-only tasks in the calendar inbox', () => {
    mockTaskStore.calendarFilteredTasks = [
      task({ id: 'due-date-only-task', title: 'Due date only', dueDate: '2026-08-02' }),
    ]

    const state = useCalendarInboxState()
    state.showTodayOnly.value = false

    expect(state.inboxTasks.value.map(item => item.id)).toEqual(['due-date-only-task'])
  })
})
