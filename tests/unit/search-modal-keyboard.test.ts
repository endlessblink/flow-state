import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import SearchModal from '@/components/layout/SearchModal.vue'
import { useTaskStore } from '@/stores/tasks'

describe('SearchModal keyboard selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('emits the highlighted task when Enter is pressed in the search input', async () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks = [{
      id: 'task-1',
      title: 'Open this task',
      status: 'todo',
      priority: 'high',
      tags: [],
      subtasks: [],
      isInInbox: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]

    const wrapper = mount(SearchModal, {
      props: { isOpen: true },
      global: { stubs: { Search: true, FileText: true, FolderOpen: true, ChevronRight: true, Crosshair: true } },
    })

    const input = wrapper.get('input')
    await input.setValue('Open')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('selectTask')?.[0]?.[0]).toMatchObject({
      id: 'task-1',
      title: 'Open this task',
    })
  })
})
