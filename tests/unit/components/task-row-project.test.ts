import { mount, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import TaskRowProject from '@/components/tasks/row/TaskRowProject.vue'
import { useProjectStore } from '@/stores/projects'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const projectRoot = resolve(__dirname, '../../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

let wrappers: VueWrapper[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  const projectStore = useProjectStore()
  projectStore._rawProjects = [
    {
      id: 'project-work',
      name: 'Work',
      emoji: '💼',
      colorType: 'emoji',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
})

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers = []
  document.body.innerHTML = ''
})

const mountProjectPicker = () => {
  const wrapper = mount(TaskRowProject, {
    attachTo: document.body,
    props: {
      visual: { type: 'placeholder' },
      projectDisplayName: 'Uncategorized',
      currentProjectId: null
    },
    global: {
      stubs: {
        ProjectEmojiIcon
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('TaskRowProject', () => {
  it('emits selected project ids from the teleported dropdown', async () => {
    const wrapper = mountProjectPicker()

    await wrapper.find('.project-placeholder').trigger('click')
    const projectButton = document.body.querySelectorAll('.project-dropdown__item')[1] as HTMLButtonElement
    expect(projectButton).toBeTruthy()

    projectButton.click()

    expect(wrapper.emitted('update:projectId')).toEqual([['project-work']])
  })

  it('uses neutral overlay menu tokens instead of the old purple popup colors', () => {
    const source = readSource('src/components/tasks/row/TaskRowProject.vue')

    expect(source).toContain('background: var(--overlay-component-bg) !important')
    expect(source).toContain('border: var(--overlay-component-border) !important')
    expect(source).toContain('box-shadow: var(--overlay-component-shadow)')
    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain('@click.stop="selectProject(project.id)"')

    expect(source).not.toContain('rgba(28, 25, 45')
  })

  it('keeps inline row project updates explicit about uncategorized state', () => {
    const source = readSource('src/components/tasks/HierarchicalTaskRow.vue')

    expect(source).toContain("{ projectId: val ?? undefined, isUncategorized: !val }")
  })
})
