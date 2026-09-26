import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

const mocks = vi.hoisted(() => {
  const preferences = new Map<string, { value: string }>()
  return {
    tasks: [] as Task[],
    groups: [] as CanvasGroup[],
    updateTask: vi.fn(),
    canvasGeometryWithUndo: vi.fn(),
    preferences,
    sortStore: { mainSortKey: 'priority', mainSortDirection: 'desc' },
  }
})

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ rawTasks: mocks.tasks, updateTask: mocks.updateTask }),
  getTaskInstances: () => [],
  parseDateKey: (key: string) => new Date(`${key}T00:00:00`),
}))
vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({ _rawGroups: mocks.groups, groups: mocks.groups, updateGroup: vi.fn() }),
}))
vi.mock('@/stores/taskSort', () => ({ useTaskSortStore: () => mocks.sortStore }))
vi.mock('@/composables/usePersistentRef', () => ({
  usePersistentRef: (key: string) => {
    if (!mocks.preferences.has(key)) mocks.preferences.set(key, { value: 'priority_desc' })
    return mocks.preferences.get(key)
  },
}))
vi.mock('@/composables/undoSingleton', () => ({
  getUndoSystem: () => ({ canvasGeometryWithUndo: mocks.canvasGeometryWithUndo }),
}))

import { runTaskShuffle } from '@/composables/tasks/useTaskShuffle'

function task(id: string, order: number, priority: Task['priority']): Task {
  return { id, title: id, order, priority, status: 'todo', createdAt: new Date(0) } as Task
}

describe('task shuffle transaction', () => {
  afterEach(() => vi.useRealTimers())

  beforeEach(() => {
    mocks.tasks = [task('low', 0, 'low'), task('high', 1, 'high')]
    mocks.groups = []
    mocks.preferences.clear()
    mocks.sortStore.mainSortKey = 'priority'
    mocks.sortStore.mainSortDirection = 'desc'
    mocks.updateTask.mockReset().mockImplementation(async (id: string, updates: Partial<Task>) => {
      Object.assign(mocks.tasks.find(item => item.id === id)!, updates)
    })
    mocks.canvasGeometryWithUndo.mockReset().mockImplementation(async (_label, _ids, apply) => apply())
  })

  it('saves a shared order in one undo operation and displays manual order afterward', async () => {
    expect(await runTaskShuffle('priority')).toBe(true)
    expect(mocks.canvasGeometryWithUndo).toHaveBeenCalledTimes(1)
    expect(mocks.canvasGeometryWithUndo.mock.calls[0][1]).toEqual(['high', 'low'])
    expect(mocks.tasks.map(item => [item.id, item.order])).toEqual([['low', 1], ['high', 0]])
    expect(mocks.sortStore.mainSortKey).toBe('manual')
    expect(mocks.preferences.get('flowstate:board-sort-option')?.value).toBe('manual')
  })

  it('restores already written tasks and keeps sort preferences on a later write failure', async () => {
    let writes = 0
    mocks.updateTask.mockImplementation(async (id: string, updates: Partial<Task>) => {
      writes += 1
      if (writes === 2) throw new Error('disk failed')
      Object.assign(mocks.tasks.find(item => item.id === id)!, updates)
    })

    await expect(runTaskShuffle('priority')).rejects.toThrow('disk failed')
    expect(mocks.tasks.map(item => item.order)).toEqual([0, 1])
    expect(mocks.sortStore.mainSortKey).toBe('priority')
    expect(mocks.preferences.size).toBe(0)
  })

  it('restacks Canvas group members when started from another view', async () => {
    mocks.groups = [{
      id: 'today', name: 'Today', type: 'custom', layout: 'vertical', color: '#fff',
      isVisible: true, isCollapsed: false,
      position: { x: 100, y: 30, width: 320, height: 500 },
    } as CanvasGroup]
    mocks.tasks[0].parentId = 'today'
    mocks.tasks[0].canvasPosition = { x: 120, y: 100 }
    mocks.tasks[1].parentId = 'today'
    mocks.tasks[1].canvasPosition = { x: 120, y: 210 }

    await runTaskShuffle('priority')

    expect(mocks.tasks[1].canvasPosition).toEqual({ x: 120, y: 100 })
    expect(mocks.tasks[0].canvasPosition).toEqual({ x: 120, y: 470 })
  })

  it('restacks a due-today floating card into the visible Today order from another view', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T12:00:00'))
    mocks.groups = [{
      id: 'today', name: 'Today', type: 'custom', layout: 'vertical', color: '#fff',
      isVisible: true, isCollapsed: false,
      position: { x: 100, y: 30, width: 320, height: 500 },
    } as CanvasGroup]
    mocks.tasks[0].parentId = 'today'
    mocks.tasks[0].canvasPosition = { x: 120, y: 100 }
    mocks.tasks[1].parentId = ''
    mocks.tasks[1].dueDate = '2026-09-24'
    mocks.tasks[1].canvasPosition = { x: 20, y: 220 }

    await runTaskShuffle('priority')

    expect(mocks.tasks[1].canvasPosition).toEqual({ x: 120, y: 100 })
    expect(mocks.tasks[0].canvasPosition).toEqual({ x: 120, y: 470 })
    expect(mocks.tasks[1].parentId).toBe('')
    expect(mocks.tasks.map(item => [item.id, item.order])).toEqual([['low', 1], ['high', 0]])
  })
})
