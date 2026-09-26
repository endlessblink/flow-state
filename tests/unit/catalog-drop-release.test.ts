import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import TaskList from '@/components/tasks/TaskList.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useTaskStore } from '@/stores/tasks'
import type { Task, TaskGroup } from '@/types/tasks'

const makeTask = (id: string, status: Task['status'], order: number): Task => ({
  id, title: id, status, order, priority: null, tags: [], subtasks: [],
  isInInbox: true, createdAt: new Date(), updatedAt: new Date(),
})

const makeGroup = (key: string, tasks: Task[]): TaskGroup => ({
  key, label: key, title: key, tasks, parentTasks: tasks, childTasksMap: new Map(),
})

describe('catalogue drop release', () => {
  it('renders the whole reordered selection together while the save is pending', async () => {
    setActivePinia(createPinia())
    const tasks = [0, 1, 2, 3].map(order => makeTask(`task-${order}`, 'todo', order))
    let finishSave!: () => void
    const save = new Promise<void>(resolve => { finishSave = resolve })
    const bulkSave = vi.spyOn(useTaskStore(), 'bulkUpdateTasksWithUndo').mockReturnValue(save)
    const dnd = useDragAndDrop()
    const wrapper = mount(TaskList, {
      props: { tasks, groups: [makeGroup('todo', tasks)], groupBy: 'status' },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { HierarchicalTaskRow: true, AITaskAssistPopover: true, ProjectEmojiIcon: true },
      },
    })
    const shownIds = () => wrapper.findAll('.group-tasks-area [data-task-id]').map(row => row.attributes('data-task-id'))

    try {
      dnd.startDrag({ type: 'task', taskId: tasks[2].id, taskIds: [tasks[2].id, tasks[3].id], title: '2 tasks', source: 'sidebar' })
      await wrapper.find('.group-tasks-area').trigger('drop')
      expect(bulkSave).toHaveBeenCalledOnce()
      expect(shownIds()).toEqual(['task-2', 'task-3', 'task-0', 'task-1'])

      // A live store may report each saved row separately; the display must stay atomic.
      const partlySaved = tasks.map((task, i) => ({ ...task, order: i === 2 ? 0 : task.order }))
      await wrapper.setProps({ tasks: partlySaved, groups: [makeGroup('todo', partlySaved)] })
      expect(shownIds()).toEqual(['task-2', 'task-3', 'task-0', 'task-1'])

      const finished = [tasks[2], tasks[3], tasks[0], tasks[1]].map((task, order) => ({ ...task, order }))
      await wrapper.setProps({ tasks: finished, groups: [makeGroup('todo', finished)] })
      finishSave()
      await save
      expect(shownIds()).toEqual(['task-2', 'task-3', 'task-0', 'task-1'])
    } finally {
      finishSave()
      dnd.endDrag()
      wrapper.unmount()
      bulkSave.mockRestore()
    }
  })

  it('ends the drag before the order save settles', async () => {
    setActivePinia(createPinia())
    const dragged = makeTask('dragged', 'todo', 5)
    const existing = makeTask('existing', 'done', 1)
    let finishSave!: () => void
    const save = new Promise<void>(resolve => { finishSave = resolve })
    const taskStore = useTaskStore()
    const bulkSave = vi.spyOn(taskStore, 'bulkUpdateTasksWithUndo').mockReturnValue(save)
    const dnd = useDragAndDrop()
    const wrapper = mount(TaskList, {
      props: {
        tasks: [dragged, existing],
        groups: [makeGroup('todo', [dragged]), makeGroup('done', [existing])],
        groupBy: 'status',
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { HierarchicalTaskRow: true, AITaskAssistPopover: true, ProjectEmojiIcon: true },
      },
    })

    try {
      dnd.startDrag({ type: 'task', taskId: dragged.id, title: dragged.title, source: 'sidebar' })
      await wrapper.find('[data-group-key="done"] .group-tasks-area').trigger('drop')

      expect(bulkSave).toHaveBeenCalledOnce()
      expect(dnd.isDragging.value).toBe(false)
      expect(wrapper.emitted('reorder')).toHaveLength(1)
    } finally {
      finishSave()
      dnd.endDrag()
      wrapper.unmount()
      bulkSave.mockRestore()
    }
  })
})
