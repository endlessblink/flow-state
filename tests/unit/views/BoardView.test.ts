// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import BoardView from '@/views/BoardView.vue'
import { ref } from 'vue'

// Mock the stores and composables
vi.mock('@/composables/board/useBoardModals', () => ({
  useBoardModals: () => ({
    showEditModal: ref(false),
    selectedTask: ref(null),
    showQuickTaskCreate: ref(false),
    pendingTaskColumnKey: ref(''),
    pendingTaskProjectId: ref(''),
    pendingTaskViewType: ref(''),
    showConfirmModal: ref(false),
    taskToDelete: ref(null),
    openEditModal: vi.fn(),
    closeEditModal: vi.fn(),
    openQuickTaskCreate: vi.fn(),
    closeQuickTaskCreate: vi.fn(),
    openConfirmModal: vi.fn(),
    closeConfirmModal: vi.fn(),
    provideProgressiveDisclosure: vi.fn(),
  })
}))

vi.mock('@/composables/board/useBoardContextMenu', () => ({
  useBoardContextMenu: () => ({
    showContextMenu: ref(false),
    contextMenuX: ref(0),
    contextMenuY: ref(0),
    contextMenuTask: ref(null),
    openContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
  })
}))

vi.mock('@/composables/board/useBoardActions', () => ({
  useBoardActions: () => ({
    selectTask: vi.fn(),
    startTimer: vi.fn(),
    createTaskForColumn: vi.fn(),
    deleteTask: vi.fn(),
    moveTask: vi.fn(),
    addSubtask: vi.fn(),
  })
}))

vi.mock('@/composables/board/useBoardState', () => ({
  useBoardState: () => ({
    tasksByProject: ref({}),
    projectsWithTasks: ref([]),
    totalDisplayedTasks: ref(0),
  })
}))

vi.mock('@/composables/useProgressiveDisclosure', () => ({
    provideProgressiveDisclosure: vi.fn()
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    hideDoneTasks: ref(false), // Default to false (showing done tasks)
    activeSmartView: 'none',
    tasks: [],
    toggleHideDoneTasks: vi.fn(),
  })
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({})
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: () => ({
    loadState: vi.fn()
  })
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    boardDensity: 'compact',
    loadFromStorage: vi.fn()
  })
}))

vi.mock('@vueuse/core', async () => {
    const actual = await vi.importActual('@vueuse/core')
    return {
        ...actual,
        useStorage: (key: string, initialValue: any) => ref(initialValue)
    }
})

describe('BoardView.vue', () => {
  it('renders accessibility attributes on toolbar buttons', () => {
    const wrapper = mount(BoardView, {
      global: {
        stubs: {
            KanbanSwimlane: true,
            TaskEditModal: true,
            QuickTaskCreateModal: true,
            TaskContextMenu: true,
            ConfirmationModal: true,
            FilterControls: true,
            SlidersHorizontal: true,
            CheckCircle: true,
            Circle: true,
            Flag: true,
            Calendar: true,
            ListTodo: true,
            Transition: true
        }
      }
    })

    // Check Filter Toggle
    const filterBtn = wrapper.find('.filter-toggle')
    expect(filterBtn.exists()).toBe(true)
    expect(filterBtn.attributes('aria-label')).toBe('Toggle filters')
    expect(filterBtn.attributes('aria-pressed')).toBe('false')

    // Check Done Column Toggle
    const doneBtn = wrapper.find('.done-column-toggle')
    expect(doneBtn.exists()).toBe(true)
    // hideDoneTasks is false -> title is "Hide done tasks"
    expect(doneBtn.attributes('aria-label')).toBe('Hide done tasks')
    expect(doneBtn.attributes('aria-pressed')).toBe('false')

    // Check View Type Switcher
    const viewTypeBtns = wrapper.findAll('.view-type-btn')
    expect(viewTypeBtns.length).toBe(3)

    // Check aria-labels
    expect(viewTypeBtns[0].attributes('aria-label')).toBe('Priority')
    expect(viewTypeBtns[1].attributes('aria-label')).toBe('Due Date')
    expect(viewTypeBtns[2].attributes('aria-label')).toBe('Status')

    // First one should be active (priority is default)
    expect(viewTypeBtns[0].attributes('aria-pressed')).toBe('true')
  })
})
