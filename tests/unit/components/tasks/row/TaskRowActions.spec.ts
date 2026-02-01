// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TaskRowActions from '@/components/tasks/row/TaskRowActions.vue'

describe('TaskRowActions.vue', () => {
  it('renders with correct aria-labels', () => {
    const wrapper = mount(TaskRowActions, {
      props: {
        taskTitle: 'My Task'
      }
    })

    const startBtn = wrapper.find('button[title="Start Timer"]')
    const editBtn = wrapper.find('button[title="Edit Task"]')
    const duplicateBtn = wrapper.find('button[title="Duplicate Task"]')

    expect(startBtn.attributes('aria-label')).toBe('Start timer for My Task')
    expect(editBtn.attributes('aria-label')).toBe('Edit task My Task')
    expect(duplicateBtn.attributes('aria-label')).toBe('Duplicate task My Task')
  })
})
