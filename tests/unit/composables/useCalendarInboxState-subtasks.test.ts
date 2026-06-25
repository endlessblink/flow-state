import { describe, expect, it, beforeEach, vi } from 'vitest'

const mockTaskStore = vi.hoisted(() => ({
  calendarFilteredTasks: [] as any[],
  hideCalendarDoneTasks: false,
  toggleCalendarDoneTasks: vi.fn(),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => mockTaskStore,
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
})
