import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import TaskList from '@/components/tasks/TaskList.vue'
import type { Task, TaskGroup } from '@/types/tasks'

const task = (id: string): Task => ({
  id,
  title: id,
  status: 'todo',
  priority: null,
  tags: [],
  subtasks: [],
  isInInbox: true,
  createdAt: new Date(),
  updatedAt: new Date(),
})

const group = (tasks: Task[], key = 'all'): TaskGroup => ({
  key,
  label: key,
  title: key,
  tasks,
  parentTasks: tasks,
  childTasksMap: new Map(),
})

describe('TaskList hidden selection safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('removes a selected task when filtering removes its row', async () => {
    const visible = task('visible')
    const hidden = task('becomes-hidden')
    const wrapper = mount(TaskList, {
      props: {
        tasks: [visible, hidden],
        groups: [group([visible, hidden])],
        groupBy: 'none',
      },
      global: {
        stubs: {
          HierarchicalTaskRow: {
            props: ['task'],
            template: '<button class="row" @click="$emit(\'check\', task.id)">{{ task.id }}</button>',
          },
          AITaskAssistPopover: true,
          ProjectEmojiIcon: true,
        },
      },
    })

    expect(wrapper.find('[data-task-id="visible"]').exists()).toBe(true)
    await wrapper.findAll('.row')[1].trigger('click')
    expect(wrapper.get('.selection-count').text()).toBe('1 selected')

    await wrapper.setProps({
      tasks: [visible],
      groups: [group([visible])],
    })
    await nextTick()

    expect(wrapper.find('.selection-count').exists()).toBe(false)
    expect(wrapper.emitted('deleteSelected')).toBeUndefined()
  })

  it('removes selected tasks when their group is collapsed', async () => {
    const visible = task('visible')
    const wrapper = mount(TaskList, {
      props: {
        tasks: [visible],
        groups: [group([visible], 'today')],
        groupBy: 'dueDate',
      },
      global: {
        stubs: {
          HierarchicalTaskRow: {
            props: ['task'],
            template: '<button class="row" @click="$emit(\'check\', task.id)">{{ task.id }}</button>',
          },
          AITaskAssistPopover: true,
          ProjectEmojiIcon: true,
        },
      },
    })

    await wrapper.get('.row').trigger('click')
    expect(wrapper.get('.selection-count').text()).toBe('1 selected')

    await wrapper.get('.group-header').trigger('click')
    await nextTick()

    expect(wrapper.find('.row').exists()).toBe(false)
    expect(wrapper.find('.selection-count').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    expect(wrapper.emitted('deleteSelected')).toBeUndefined()
  })
})
