import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import type { Task } from '@/types/tasks'

const taskRecords = ref<Task[]>([])

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    getTask: (taskId: string) => taskRecords.value.find(task => task.id === taskId)
  })
}))

import { useCanvasModalsStore } from '@/stores/canvas/modals'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Original canvas task',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    scheduledDate: '',
    scheduledTime: '09:00',
    estimatedDuration: 60,
    projectId: '',
    createdAt: new Date('2026-07-22T09:00:00.000Z'),
    updatedAt: new Date('2026-07-22T09:00:00.000Z'),
    ...overrides
  } as Task
}

describe('canvas modal task resolution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    taskRecords.value = []
  })

  it('opens the edit modal with the current task from the store instead of a stale canvas snapshot', () => {
    const modals = useCanvasModalsStore()
    const staleSnapshot = makeTask({ title: 'Old title from node snapshot', priority: 'low' })
    const canonicalTask = makeTask({ title: 'Fresh title from task store', priority: 'high' })
    taskRecords.value = [canonicalTask]

    modals.openEditModal(staleSnapshot)

    expect(modals.selectedTask?.title).toBe('Fresh title from task store')
    expect(modals.selectedTask?.priority).toBe('high')
  })

  it('keeps the selected canvas task synced by id after task metadata changes', async () => {
    const modals = useCanvasModalsStore()
    const originalTask = makeTask()
    taskRecords.value = [originalTask]

    modals.openEditModal({ ...originalTask })
    expect(modals.selectedTask?.title).toBe('Original canvas task')

    taskRecords.value = [
      makeTask({
        title: 'Renamed after metadata refresh',
        projectId: 'project-2',
        priority: 'high'
      })
    ]

    await nextTick()

    expect(modals.selectedTask?.title).toBe('Renamed after metadata refresh')
    expect(modals.selectedTask?.projectId).toBe('project-2')
    expect(modals.selectedTask?.priority).toBe('high')
  })
})
