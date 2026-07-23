import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppShortcuts } from '@/composables/app/useAppShortcuts'
import { useTaskStore } from '@/stores/tasks'

describe('global shortcut hidden-selection safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('prunes non-rendered task ids before opening bulk delete', async () => {
    let shortcuts!: ReturnType<typeof useAppShortcuts>
    const Harness = defineComponent({
      setup() {
        shortcuts = useAppShortcuts()
        return () => h('div', { 'data-task-id': 'visible' })
      },
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: Harness }],
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    const taskStore = useTaskStore()
    taskStore.selectTask('visible')
    taskStore.selectTask('hidden-stale')
    const confirmDelete = vi.fn()
    window.addEventListener('confirm-delete-selected', confirmDelete)

    await shortcuts.handleDeleteSelectedTasks()

    expect(taskStore.selectedTaskIds).toEqual(['visible'])
    expect(confirmDelete).toHaveBeenCalledTimes(1)
    window.removeEventListener('confirm-delete-selected', confirmDelete)
    wrapper.unmount()
  })
})
