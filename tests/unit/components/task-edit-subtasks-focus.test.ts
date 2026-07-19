import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskEditSubtasks from '@/components/tasks/edit/TaskEditSubtasks.vue'
import type { Subtask } from '@/stores/tasks'

const makeSubtask = (): Subtask => ({
  id: 'subtask-1',
  parentTaskId: 'task-1',
  title: 'ספריות שאפשר להשתמש בהן',
  description: '',
  completedPomodoros: 0,
  isCompleted: false,
  createdAt: new Date('2026-07-19T00:00:00.000Z'),
  updatedAt: new Date('2026-07-19T00:00:00.000Z'),
})

describe('TaskEditSubtasks description focus', () => {
  it('keeps an empty description open while focus moves from its title into the description', async () => {
    const subtask = makeSubtask()
    const wrapper = mount(TaskEditSubtasks, {
      props: { subtasks: [subtask] },
      attachTo: document.body,
    })

    const title = wrapper.get<HTMLInputElement>('.subtask-title-input')
    const description = wrapper.get<HTMLTextAreaElement>('.subtask-desc-input')

    await title.trigger('focus')
    expect(description.isVisible()).toBe(true)

    await title.trigger('blur', { relatedTarget: description.element })
    expect(description.isVisible()).toBe(true)

    await description.trigger('focus')
    await description.trigger('focusout', {
      relatedTarget: wrapper.get('.custom-checkbox').element,
    })
    expect(description.isVisible()).toBe(false)

    await title.trigger('focus')
    await title.trigger('blur', { relatedTarget: description.element })
    await description.setValue('אפשר להשתמש בספרייה הזו')
    expect(subtask.description).toBe('אפשר להשתמש בספרייה הזו')

    wrapper.unmount()
  })
})
