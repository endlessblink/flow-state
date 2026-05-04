/**
 * TASK-1756 v8: useTidyLayout composable tests.
 *
 * Verifies:
 *  1. Tidy applies today's semantic order for day groups.
 *  2. Custom-named groups are ignored.
 *  3. Safe to call with no day-groups present.
 *  4. Holds canvasSyncInProgress until release().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.stubGlobal('import.meta', { env: { DEV: false } })

const { mockCanvasSyncInProgress } = vi.hoisted(() => {
  const { ref } = require('vue')
  return { mockCanvasSyncInProgress: ref(false) }
})

vi.mock('@/composables/canvas/useCanvasSync', () => ({
  canvasSyncInProgress: mockCanvasSyncInProgress,
  isWritingBackStaleParents: { value: false },
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchGroups: vi.fn().mockResolvedValue([]),
    fetchTasks: vi.fn().mockResolvedValue([]),
    saveTask: vi.fn(),
    saveTasks: vi.fn(),
    deleteTask: vi.fn(),
  }),
}))

import { useTidyLayout } from '@/composables/canvas/useTidyLayout'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { CanvasGroup } from '@/types/canvas'

let counter = 0
function makeGroup(name: string, x: number, y = 0): CanvasGroup {
  return {
    id: `grp-${++counter}-${name.toLowerCase()}`,
    name,
    isVisible: true,
    position: { x, y, width: 300, height: 200 },
  } as unknown as CanvasGroup
}

describe('useTidyLayout', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let updateGroup: ReturnType<typeof vi.fn>
  let updateTask: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T12:00:00Z')) // Monday
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    taskStore = useTaskStore()
    updateGroup = vi.fn()
    updateTask = vi.fn()
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(updateGroup)
    vi.spyOn(taskStore, 'updateTask').mockImplementation(updateTask)
    mockCanvasSyncInProgress.value = false
    counter = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('orders day groups from the current weekday instead of preserving broken X order', () => {
    const fri = makeGroup('Friday', 100)
    const mon = makeGroup('Monday', 500)
    const tue = makeGroup('Tuesday', 50)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([fri, mon, tue])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, release } = tidyDayGroups()
    release()

    const byNode = new Map(groupMoves.map((m) => [m.groupId, m.position.x]))
    // Origin = min X = 50. Monday is today, then Tuesday, then Friday.
    expect(byNode.get(mon.id)).toBe(50)
    expect(byNode.get(tue.id)).toBe(466)
    expect(byNode.get(fri.id)).toBe(882)
  })

  it('includes custom-named groups alongside day groups', () => {
    // 2026-05-03: Tidy was broadened to lay out every group on the canvas
    // (custom + smart + day-of-week), preserving the user's left-to-right
    // X order. Previously custom groups were filtered out and the button
    // silently no-op'd for users without day groups.
    const mon = makeGroup('Monday', 0)
    const custom = makeGroup('Project Work', 200)
    const tue = makeGroup('Tuesday', 400)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, custom, tue])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves.length).toBe(3)
    expect(groupMoves.find((m) => m.groupId === custom.id)).toBeDefined()
    const updatedIds = updateGroup.mock.calls.map(([id]: [string]) => id)
    expect(updatedIds).toContain(custom.id)
    expect(updatedIds).toContain(mon.id)
    expect(updatedIds).toContain(tue.id)
  })

  it('is safe with zero day-groups on canvas', () => {
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, taskMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves).toEqual([])
    expect(taskMoves).toEqual([])
    expect(updateGroup).not.toHaveBeenCalled()
  })

  it('holds canvasSyncInProgress true until release() is called', () => {
    const mon = makeGroup('Monday', 0)
    const tue = makeGroup('Tuesday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, tue])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { release } = tidyDayGroups()

    expect(mockCanvasSyncInProgress.value).toBe(true)
    release()
    expect(mockCanvasSyncInProgress.value).toBe(false)
  })

  it('includes Today + Tomorrow smart groups alongside day-of-week', () => {
    const today = makeGroup('Today', 0)
    const tomorrow = makeGroup('Tomorrow', 100)
    const mon = makeGroup('Monday', 200)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow, mon])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves.length).toBe(3)
    const byNode = new Map(groupMoves.map((m) => [m.groupId, m.position.x]))
    // Smart groups stay before weekday groups.
    expect(byNode.get(today.id)).toBe(0)
    expect(byNode.get(tomorrow.id)).toBe(416)
    expect(byNode.get(mon.id)).toBe(832)
  })

  it('returns taskMoves and persists child task positions in a vertical stack during tidy', () => {
    const mon = makeGroup('Monday', 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-low',
        parentId: mon.id,
        canvasPosition: { x: 200, y: 500 },
        createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'task-high',
        parentId: mon.id,
        canvasPosition: { x: 150, y: 100 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves.map((move) => move.taskId)).toEqual(['task-high', 'task-low'])
    expect(taskMoves[0]?.parentId).toBe(mon.id)
    expect(taskMoves[0]?.position).toEqual({ x: 20, y: 70 })
    expect(taskMoves[1]?.position).toEqual({ x: 20, y: 180 })
    expect(updateTask).toHaveBeenCalledTimes(2)
    expect(updateTask).toHaveBeenNthCalledWith(
      1,
      'task-high',
      { canvasPosition: { x: 20, y: 70 } },
      'DRAG'
    )
    expect(updateTask).toHaveBeenNthCalledWith(
      2,
      'task-low',
      { canvasPosition: { x: 20, y: 180 } },
      'DRAG'
    )
  })
})
