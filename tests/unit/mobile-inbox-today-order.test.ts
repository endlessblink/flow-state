import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import MobileInboxTaskList from '@/mobile/components/MobileInboxTaskList.vue'
import { useMobileInboxLogic } from '@/mobile/composables/useMobileInboxLogic'
import type { Task } from '@/types/tasks'

const groupBy = ref<'none' | 'date' | 'project' | 'priority'>('none')
const hideDoneTasks = ref(false)
let taskStoreTasks: Task[] = []

const makeTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id ?? crypto.randomUUID(),
  title: overrides.title ?? 'Task',
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? null,
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: overrides.dueDate ?? '',
  projectId: overrides.projectId ?? null,
  createdAt: overrides.createdAt ?? new Date('2026-06-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? new Date('2026-06-01T08:00:00Z'),
  canvasPosition: overrides.canvasPosition,
  parentId: overrides.parentId,
})

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: taskStoreTasks,
    projects: [{ id: 'project-1', name: 'Project', color: '#14b8a6' }],
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    groups: [{ id: 'today-group', position: { x: 0, y: 0 } }],
  }),
}))

vi.mock('@/composables/mobile/useMobileFilters', () => ({
  useMobileFilters: () => ({
    groupBy,
    hideDoneTasks,
    setGroupBy: (value: 'none' | 'date' | 'project' | 'priority') => {
      groupBy.value = value
    },
  }),
}))

vi.mock('@/composables/useWhisperSpeech', () => ({
  useWhisperSpeech: () => ({
    isRecording: ref(false),
    isProcessing: ref(false),
    isQueued: ref(false),
    isSupported: ref(false),
    hasApiKey: ref(false),
    transcript: ref(''),
    error: ref(null),
    recordingDuration: ref(0),
    isOnline: ref(true),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/composables/useOfflineVoiceQueue', () => ({
  useOfflineVoiceQueue: () => ({
    pendingCount: ref(0),
    hasPending: ref(false),
    isProcessing: ref(false),
    enqueue: vi.fn(),
  }),
}))

vi.mock('@/composables/useHaptics', () => ({
  useHaptics: () => ({ triggerHaptic: vi.fn() }),
}))

vi.mock('@/i18n/useDirection', () => ({
  useDirection: () => ({ isRTL: ref(false) }),
}))

vi.mock('@/composables/supabase/_infrastructure', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

describe('PWA mobile Today task ordering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T10:00:00+03:00'))
    localStorage.clear()
    groupBy.value = 'none'
    hideDoneTasks.value = false
    taskStoreTasks = [
      makeTask({
        id: 'overdue-first-on-canvas',
        title: 'Overdue from stale phone state',
        dueDate: '2026-06-20',
        projectId: 'project-1',
        canvasPosition: { x: 0, y: 10 },
        parentId: 'today-group',
      }),
      makeTask({
        id: 'rescheduled-today',
        title: 'Rescheduled for today in Electron',
        dueDate: '2026-06-22',
        projectId: 'project-1',
        canvasPosition: { x: 0, y: 80 },
        parentId: 'today-group',
      }),
    ]
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Today section before Overdue in the main PWA task view', () => {
    const wrapper = mount(MobileInboxTaskList, {
      props: {
        filteredTasks: taskStoreTasks,
        groupedTasks: [],
        viewMode: 'today',
        activeTimeFilter: 'all',
        groupBy: 'none',
        timeFilterLabel: 'all',
        isTimerActive: () => false,
        priorityLabel: (priority: string) => priority,
        isOverdue: (dueDate?: string | Date) => {
          if (!dueDate) return false
          const date = new Date(dueDate)
          date.setHours(0, 0, 0, 0)
          return date.getTime() < new Date('2026-06-22T00:00:00+03:00').getTime()
        },
        getProjectName: () => 'Project',
      },
      global: {
        stubs: {
          SwipeableTaskItem: { template: '<div><slot /></div>' },
        },
      },
    })

    const sectionTitles = wrapper.findAll('.group-title').map(el => el.text())
    expect(sectionTitles).toEqual(['Today', 'Overdue'])
  })

  it('keeps today tasks before overdue tasks in Today mode even when canvas order is older first', () => {
    const Host = defineComponent({
      setup() {
        return useMobileInboxLogic()
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const vm = wrapper.vm as unknown as ReturnType<typeof useMobileInboxLogic>

    vm.setViewMode('today')
    expect(vm.filteredTasks.map(task => task.id)).toEqual([
      'rescheduled-today',
      'overdue-first-on-canvas',
    ])
  })

  it('keeps today tasks before overdue tasks inside grouped Today-mode buckets', async () => {
    groupBy.value = 'project'
    const Host = defineComponent({
      setup() {
        return useMobileInboxLogic()
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const vm = wrapper.vm as unknown as ReturnType<typeof useMobileInboxLogic>

    vm.setViewMode('today')
    await nextTick()

    expect(vm.groupedTasks).toHaveLength(1)
    expect(vm.groupedTasks[0].tasks.map(task => task.id)).toEqual([
      'rescheduled-today',
      'overdue-first-on-canvas',
    ])
  })
})
