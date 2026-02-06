// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TaskRowActions from '@/components/tasks/row/TaskRowActions.vue'

describe('TaskRowActions', () => {
  it('renders dynamic aria-labels based on taskTitle prop', () => {
    const taskTitle = 'My Important Task'
    const wrapper = mount(TaskRowActions, {
      props: {
        taskTitle
      }
    })

    const playBtn = wrapper.find('button[title="Start Timer"]')
    const editBtn = wrapper.find('button[title="Edit Task"]')
    const duplicateBtn = wrapper.find('button[title="Duplicate Task"]')

    expect(playBtn.attributes('aria-label')).toBe(`Start timer for ${taskTitle}`)
    expect(editBtn.attributes('aria-label')).toBe(`Edit ${taskTitle}`)
    expect(duplicateBtn.attributes('aria-label')).toBe(`Duplicate ${taskTitle}`)
  })
})
