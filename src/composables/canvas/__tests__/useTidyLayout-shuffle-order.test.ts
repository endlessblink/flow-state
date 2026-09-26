import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { syncFlag } = vi.hoisted(() => ({ syncFlag: { value: false } }))
vi.mock('@/composables/canvas/useCanvasSync', () => ({
  canvasSyncInProgress: syncFlag,
  isWritingBackStaleParents: { value: false },
}))
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveGroup: vi.fn(), deleteGroup: vi.fn(), fetchGroups: vi.fn().mockResolvedValue([]),
    fetchTasks: vi.fn().mockResolvedValue([]), saveTask: vi.fn(), saveTasks: vi.fn(), deleteTask: vi.fn(),
  }),
}))

import { useTidyLayout } from '../useTidyLayout'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { positionManager } from '@/services/canvas/PositionManager'

describe('Canvas F2 reorder after a global shuffle', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    vi.restoreAllMocks()
    positionManager.clear()
    syncFlag.value = false
  })

  it('keeps unique global order values and preserves another group task slot', async () => {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const group = {
      id: 'today', name: 'Today', isVisible: true,
      position: { x: 0, y: 0, width: 400, height: 900 },
    }
    const tasks = [
      { id: 'a', order: 0, parentId: 'today', canvasPosition: { x: 20, y: 100 }, createdAt: '2026-01-01' },
      { id: 'other', order: 1, parentId: 'tomorrow', canvasPosition: { x: 420, y: 100 }, createdAt: '2026-01-01' },
      { id: 'b', order: 2, parentId: 'today', canvasPosition: { x: 20, y: 300 }, createdAt: '2026-01-01' },
    ]
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([group] as any)
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks as any)
    const updateTask = vi.spyOn(taskStore, 'updateTask').mockImplementation(async (id, updates) => {
      const task = tasks.find((candidate) => candidate.id === id)
      if (task) Object.assign(task, updates)
      return true
    })

    const result = useTidyLayout().reorderColumn('today', new Map([['b', { x: 20, y: 60 }]]))
    await result.commit()
    result.release()

    expect(tasks.map((task) => [task.id, task.order])).toEqual([
      ['a', 2], ['other', 1], ['b', 0],
    ])
    expect(updateTask).not.toHaveBeenCalledWith('other', expect.anything(), expect.anything())
  })
})
