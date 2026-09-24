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
