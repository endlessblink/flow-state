import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
})

describe('TaskEditSubtasks description editing', () => {
  it('lets a mouse click focus and edit an empty description without opening it through the title', async () => {
    const subtask = makeSubtask()
    const wrapper = mount(TaskEditSubtasks, {
      props: { subtasks: [subtask] },
      attachTo: document.body,
    })

    const description = wrapper.get<HTMLTextAreaElement>('.subtask-desc-input')
    expect(description.isVisible()).toBe(true)

    await description.trigger('mousedown')
    description.element.focus()
    await nextTick()

    expect(document.activeElement).toBe(description.element)
    await description.setValue('אפשר להשתמש בספרייה הזו')
    expect(subtask.description).toBe('אפשר להשתמש בספרייה הזו')

    wrapper.unmount()
  })
})
