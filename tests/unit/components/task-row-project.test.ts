import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import TaskRowProject from '@/components/tasks/row/TaskRowProject.vue'
import { useProjectStore } from '@/stores/projects'
import type { Project } from '@/types/tasks'

const workProject: Project = {
  id: 'project-1',
  name: 'Work',
  color: '#2DD4BF',
  colorType: 'hex',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mountProjectPicker = (props: {
  visual: { type: string; content?: string; color?: string }
  projectDisplayName: string
  currentProjectId?: string | null
}) => mount(TaskRowProject, {
  attachTo: document.body,
  props,
  global: {
    stubs: {
      Transition: false
    }
  }
})

describe('TaskRowProject', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      width: 16,
      height: 16,
      top: 100,
      right: 116,
      bottom: 116,
      left: 100,
      toJSON: () => {}
    } as DOMRect)

    const projectStore = useProjectStore()
    projectStore._rawProjects = [workProject]
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('emits the selected project id from the teleported dropdown', async () => {
    const wrapper = mountProjectPicker({
      visual: { type: 'other' },
      projectDisplayName: 'Uncategorized',
      currentProjectId: null
    })

    await wrapper.find('.project-placeholder').trigger('click')
    await nextTick()

    const items = document.body.querySelectorAll<HTMLButtonElement>('.project-dropdown__item')
    expect(items).toHaveLength(2)
    items[1].click()
    await nextTick()

    expect(wrapper.emitted('update:projectId')).toEqual([['project-1']])

    wrapper.unmount()
  })

  it('emits null when selecting Uncategorized from the teleported dropdown', async () => {
    const wrapper = mountProjectPicker({
      visual: { type: 'emoji', content: '💼' },
      projectDisplayName: 'Work',
      currentProjectId: 'project-1'
    })

    await wrapper.find('.project-emoji-badge').trigger('click')
    await nextTick()

    const items = document.body.querySelectorAll<HTMLButtonElement>('.project-dropdown__item')
    expect(items).toHaveLength(2)
    items[0].click()
    await nextTick()

    expect(wrapper.emitted('update:projectId')).toEqual([[null]])

    wrapper.unmount()
  })
})
