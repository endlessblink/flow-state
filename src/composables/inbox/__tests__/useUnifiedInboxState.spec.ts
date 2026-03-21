import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

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
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => canvasStoreMock,
}))

vi.mock('@/composables/useSmartViews', () => ({
  useSmartViews: () => ({
    isTodayTask: () => false,
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
      status: 'planned',
      priority: 'medium',
      isInInbox: true,
      isPinned: false,
      createdAt: new Date('2026-03-19T10:00:00Z'),
      updatedAt: new Date('2026-03-19T10:00:00Z'),
    } as Task

    taskStoreMock.filteredTasks = [duplicateTask, { ...duplicateTask }]
    taskStoreMock._rawTasks = [duplicateTask, { ...duplicateTask }]

    const { useUnifiedInboxState } = await import('@/composables/inbox/useUnifiedInboxState')
    const state = useUnifiedInboxState({ context: 'standalone' })

    expect(state.baseInboxTasks.value).toHaveLength(1)
    expect(state.inboxTasks.value).toHaveLength(1)
    expect(state.pinnedTasks.value).toHaveLength(0)
    expect(state.doneTaskCount.value).toBe(0)
  })
})
