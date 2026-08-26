import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import type { Subtask } from '@/types/tasks'
import TaskEditSubtasks from '@/components/tasks/edit/TaskEditSubtasks.vue'

vi.mock('lucide-vue-next', () => {
  const icon = defineComponent({
    name: 'IconStub',
    setup() {
      return () => h('svg')
    },
  })

  return {
    Check: icon,
    CheckCircle2: icon,
    ChevronDown: icon,
    Plus: icon,
    X: icon,
  }
})

function subtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: 'subtask-1',
    parentTaskId: 'task-1',
    title: 'Water the plants',
    description: '',
    completedPomodoros: 0,
    isCompleted: false,
    createdAt: new Date('2026-08-27T00:00:00Z'),
    updatedAt: new Date('2026-08-27T00:00:00Z'),
    ...overrides,
  }
}

describe('TaskEditSubtasks accessibility', () => {
  it('exposes state and action labels for the subtask controls', async () => {
    const wrapper = mount(TaskEditSubtasks, { props: { subtasks: [subtask()] } })

    expect(wrapper.get('.section-toggle').attributes()).toMatchObject({
      'aria-label': 'Toggle subtasks',
      'aria-expanded': 'true',
    })
    expect(wrapper.get('.inline-add-btn').attributes('aria-label')).toBe('Add subtask')
    expect(wrapper.get('[role="checkbox"]').attributes()).toMatchObject({
      'aria-checked': 'false',
      'aria-label': 'Mark subtask as complete',
    })
    expect(wrapper.get('.delete-subtask-btn').attributes('aria-label')).toBe('Delete subtask')

    await wrapper.get('[role="checkbox"]').trigger('click')
    await nextTick()

    expect(wrapper.get('[role="checkbox"]').attributes()).toMatchObject({
      'aria-checked': 'true',
      'aria-label': 'Mark subtask as incomplete',
    })
    expect(wrapper.emitted('update')).toHaveLength(1)
  })

  it('reports the collapsed state and hides the add control', async () => {
    const wrapper = mount(TaskEditSubtasks, { props: { subtasks: [] } })

    await wrapper.get('.section-toggle').trigger('click')

    expect(wrapper.get('.section-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.inline-add-btn').exists()).toBe(false)
  })
})
