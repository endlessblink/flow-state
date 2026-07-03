import { mount, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const pinTask = vi.fn()
const unpinTask = vi.fn()
const pinFromTask = vi.fn()
const selectAndStartTimer = vi.fn()
const loadPinnedTasks = vi.fn()
const dismissFromFrequent = vi.fn()

vi.mock('@/composables/useQuickTasks', () => ({
  useQuickTasks: () => ({
    quickTaskItems: ref([]),
    unpinTask,
    pinTask,
    pinFromTask,
    selectAndStartTimer,
    loadPinnedTasks,
    dismissFromFrequent,
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: [],
    activeStatusFilter: null,
    getProjectById: () => null,
  }),
}))

vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({
    activeProjectId: null,
    isDescendantOf: () => false,
    getProjectById: () => null,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

describe('QuickTaskDropdown pin create row', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    pinTask.mockResolvedValue({ status: 'created' })
    unpinTask.mockReset()
    pinFromTask.mockReset()
    selectAndStartTimer.mockReset()
    loadPinnedTasks.mockReset()
    dismissFromFrequent.mockReset()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('pins the typed Hebrew title when the visible create row is clicked', async () => {
    const { default: QuickTaskDropdown } = await import('@/components/timer/QuickTaskDropdown.vue')
    wrapper = mount(QuickTaskDropdown, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: false,
        },
      },
    })

    await wrapper.get('button.quick-task-trigger').trigger('click')
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.quick-add-input')
    expect(input).toBeTruthy()
    input!.value = 'לארגן משימות'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const createRow = document.body.querySelector<HTMLElement>('.quick-item--create')
    expect(createRow?.textContent).toContain('לארגן משימות')
    createRow!.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(pinTask).toHaveBeenCalledWith('לארגן משימות')
    expect(input!.value).toBe('')
  })
})
