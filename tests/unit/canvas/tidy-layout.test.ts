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
import { lockManager } from '@/services/canvas/LockManager'
import { positionManager } from '@/services/canvas/PositionManager'
import { getUndoSystem } from '@/composables/undoSingleton'
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
    positionManager.clear()
    vi.useRealTimers()
  })

  it('returns the complete visual layout on a second Tidy without repeating persistence or undo', async () => {
    const today = makeGroup('Today', 0)
    const tasks = Array.from({ length: 4 }, (_, index) => ({
      id: `repair-${index}`, parentId: today.id,
      canvasPosition: { x: 20, y: 100 + index * 400 },
      createdAt: '2026-04-01T00:00:00Z',
    }))
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks as any)
    updateGroup.mockImplementation((_id, changes) => Object.assign(today, changes))
    updateTask.mockImplementation((id, changes) => {
      const task = tasks.find(task => task.id === id)
      if (task) Object.assign(task, changes)
    })
    const pushUndo = vi.spyOn(getUndoSystem(), 'pushCanvasGeometryUndoSnapshot')
    const { tidyDayGroups } = useTidyLayout({ getNodeSize: () => ({ width: 280, height: 400 }) })
    const first = tidyDayGroups()
    await first.pendingWrites
    first.release()
    expect(today.position.height).toBeGreaterThan(1600)
    updateGroup.mockClear()
    updateTask.mockClear()
    pushUndo.mockClear()

    // The store is correct but the renderer may still show its old 200px frame.
    // A repeated explicit Tidy must provide all geometry needed to repair it.
    const second = tidyDayGroups()
    expect(second.groupMoves).toEqual(first.groupMoves)
    expect(second.taskMoves).toEqual(first.taskMoves)
    expect(mockCanvasSyncInProgress.value).toBe(true)
    expect(lockManager.isLocked(today.id)).toBe(true)
    expect(tasks.every(task => lockManager.isLocked(task.id))).toBe(true)
    await second.pendingWrites
    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateTask).not.toHaveBeenCalled()
    expect(pushUndo).not.toHaveBeenCalled()
    second.release()
    expect(mockCanvasSyncInProgress.value).toBe(false)
    expect(lockManager.isLocked(today.id)).toBe(false)
    expect(tasks.some(task => lockManager.isLocked(task.id))).toBe(false)
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

  it('ignores hidden groups instead of moving saved off-canvas state', () => {
    const visible = makeGroup('Project Work', 200)
    const hidden = { ...makeGroup('Hidden Archive', 900), isVisible: false }
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([visible, hidden])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'hidden-task',
        parentId: hidden.id,
        canvasPosition: { x: 920, y: 160 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, taskMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves.map((move) => move.groupId)).toEqual([visible.id])
    expect(taskMoves).toEqual([])
    expect(updateGroup).toHaveBeenCalledTimes(1)
    expect(updateGroup).toHaveBeenCalledWith(
      visible.id,
      expect.objectContaining({ position: expect.any(Object) })
    )
    expect(updateGroup).not.toHaveBeenCalledWith(
      hidden.id,
      expect.objectContaining({ position: expect.any(Object) })
    )
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

  it('repairs persisted groups when the visible renderer projection is empty', () => {
    const monday = makeGroup('Monday', -405, -273)
    const nested = {
      ...makeGroup('Tuesday', 11, -273),
      parentGroupId: monday.id,
    }
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([])
    vi.spyOn(canvasStore, '_rawGroups', 'get').mockReturnValue([monday, nested])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves.map((move) => move.groupId)).toEqual([monday.id, nested.id])
    expect(updateGroup).toHaveBeenCalledWith(
      nested.id,
      expect.objectContaining({ parentGroupId: null })
    )
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

  it('releases Tidy position locks so tasks remain draggable afterwards', () => {
    const today = makeGroup('Today', 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-after-tidy',
        parentId: today.id,
        canvasPosition: { x: 30, y: 100 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { release } = tidyDayGroups()

    expect(lockManager.getLockOwner(today.id)).toBe('user-drag')
    expect(lockManager.getLockOwner('task-after-tidy')).toBe('user-drag')

    release()

    expect(lockManager.isLocked(today.id)).toBe(false)
    expect(lockManager.isLocked('task-after-tidy')).toBe(false)
    expect(mockCanvasSyncInProgress.value).toBe(false)
  })

  it('matches Rotate order when Today + Tomorrow smart groups exist', () => {
    const today = makeGroup('Today', 0)
    const tomorrow = makeGroup('Tomorrow', 100)
    const mon = makeGroup('Monday', 200)
    const wed = makeGroup('Wednesday', 300)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow, mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, release } = tidyDayGroups()
    release()

    expect(groupMoves.length).toBe(4)
    const byNode = new Map(groupMoves.map((m) => [m.groupId, m.position.x]))
    // On Monday, Rotate/Tidy both place Today, Tomorrow, then Wednesday.
    expect(byNode.get(today.id)).toBe(0)
    expect(byNode.get(tomorrow.id)).toBe(416)
    expect(byNode.get(wed.id)).toBe(832)
    expect(byNode.get(mon.id)).toBe(1248)
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

    // TASK-1798: Tidy now stacks from directly under the header (y = 0 + HEADER
    // 50 + PADDING 20 = 70), not from the current topmost task. So the low task
    // rises to the top instead of staying at y=500.
    expect(taskMoves.map((move) => move.taskId)).toEqual(['task-high', 'task-low'])
    expect(taskMoves[0]?.parentId).toBe(mon.id)
    expect(taskMoves[0]?.position).toEqual({ x: 20, y: 70 })
    expect(taskMoves[1]?.position).toEqual({ x: 20, y: 182 })
    expect(updateTask).toHaveBeenCalledTimes(2)
    expect(updateTask).toHaveBeenNthCalledWith(
      1,
      'task-high',
      { canvasPosition: { x: 20, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
    expect(updateTask).toHaveBeenNthCalledWith(
      2,
      'task-low',
      { canvasPosition: { x: 20, y: 182 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  it('keeps dense groups in one measured-height vertical stack', () => {
    // User preference: Tidy must not move tasks into side-by-side columns. It
    // should stack from the header with measured heights and tight gaps.
    const today = makeGroup('Today', 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    const tasks = Array.from({ length: 18 }, (_, i) => ({
      id: `task-${i}`,
      parentId: today.id,
      canvasPosition: { x: 30, y: 100 + i * 110 },
      createdAt: '2026-04-01T00:00:00Z',
    })) as any
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks)

    const { tidyDayGroups } = useTidyLayout({
      getNodeSize: (nodeId) => nodeId.startsWith('task-') ? { width: 280, height: 100 } : undefined,
    })
    const { groupMoves, taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves.length).toBe(18)
    expect(taskMoves.every((move) => move.position.x === 20)).toBe(true)
    for (let i = 1; i < taskMoves.length; i++) {
      expect(taskMoves[i].position.y).toBeGreaterThan(taskMoves[i - 1].position.y)
      expect(taskMoves[i].position.y - taskMoves[i - 1].position.y).toBeLessThanOrEqual(128)
    }
    expect(groupMoves[0].size.width).toBe(400)
    expect(groupMoves[0].size.height).toBeGreaterThan(1000)
  })

  it('uses measured task heights so visible gaps stay compact for varied cards', () => {
    const today = makeGroup('Today', 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    const tasks = [
      {
        id: 'short-card',
        parentId: today.id,
        canvasPosition: { x: 30, y: 100 },
        createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'tall-card',
        parentId: today.id,
        canvasPosition: { x: 30, y: 200 },
        createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'medium-card',
        parentId: today.id,
        canvasPosition: { x: 30, y: 300 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any
    const heights = new Map([
      ['short-card', 112],
      ['tall-card', 176],
      ['medium-card', 144],
    ])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks)

    const { tidyDayGroups } = useTidyLayout({
      getNodeSize: (nodeId) => heights.has(nodeId)
        ? { width: 280, height: heights.get(nodeId)! }
        : undefined,
    })
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves.map((move) => move.taskId)).toEqual(['short-card', 'tall-card', 'medium-card'])

    const visualGaps = taskMoves.slice(1).map((move, index) => {
      const previous = taskMoves[index]
      return move.position.y - (previous.position.y + heights.get(previous.taskId)!)
    })
    expect(visualGaps.every((gap) => gap >= 10 && gap <= 24)).toBe(true)
    expect(taskMoves[1].position.y - taskMoves[0].position.y).not.toBe(
      taskMoves[2].position.y - taskMoves[1].position.y
    )
  })

  it('does not leave blank rows for done tasks hidden on canvas', () => {
    const today = makeGroup('Today', 0)
    taskStore.hideCanvasDoneTasks = true
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'active-top',
        parentId: today.id,
        status: 'todo',
        canvasPosition: { x: 30, y: 100 },
        createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'hidden-done',
        parentId: today.id,
        status: 'done',
        canvasPosition: { x: 30, y: 200 },
        createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'active-bottom',
        parentId: today.id,
        status: 'todo',
        canvasPosition: { x: 30, y: 300 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout({
      getNodeSize: (nodeId) => nodeId.startsWith('active-')
        ? { width: 280, height: 80 }
        : undefined,
    })
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves.map((move) => move.taskId)).toEqual(['active-top', 'active-bottom'])
    expect(taskMoves.map((move) => move.position.y)).toEqual([70, 166])
    expect(updateTask).not.toHaveBeenCalledWith(
      'hidden-done',
      expect.anything(),
      'DRAG'
    )
  })

  it('does not reparent tasks by due date during tidy', () => {
    // Tidy is layout-only. Due-date moves belong to explicit move/drag flows,
    // otherwise tasks appear to vanish from the user's current group.
    const today = makeGroup('Today', 0)
    const mon = makeGroup('Monday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, mon])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-due-today',
        parentId: mon.id,
        dueDate: '2026-05-04',
        canvasPosition: { x: 520, y: 120 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves[0]?.parentId).toBe(mon.id)
    expect(updateTask).not.toHaveBeenCalledWith('task-due-today', { parentId: today.id }, 'DRAG')
  })

  it('adopts a loose dated task into its matching day group during tidy', () => {
    const today = makeGroup('Today', 0)
    const monday = makeGroup('Monday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, monday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'loose-task-due-today',
        parentId: undefined,
        dueDate: '2026-05-04',
        canvasPosition: { x: -400, y: 520 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves).toContainEqual(expect.objectContaining({
      taskId: 'loose-task-due-today',
      parentId: today.id,
      position: { x: 20, y: 70 },
    }))
    expect(updateTask).toHaveBeenCalledWith(
      'loose-task-due-today',
      { parentId: today.id, canvasPosition: { x: 20, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  it('repairs a stale parent claim from the task visual position', () => {
    const today = makeGroup('Today', 0)
    const monday = makeGroup('Monday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, monday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'stale-parent-task',
        parentId: monday.id,
        canvasPosition: { x: 30, y: 100 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout({
      getNodePosition: (nodeId) => nodeId === 'stale-parent-task' ? { x: 30, y: 100 } : undefined,
    })
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves).toHaveLength(1)
    expect(taskMoves[0].parentId).toBe(today.id)
    expect(updateTask).toHaveBeenCalledWith(
      'stale-parent-task',
      expect.objectContaining({ parentId: today.id }),
      'DRAG'
    )
  })

  it('repairs a stale parent when a dated card is visibly outside every lane', () => {
    const today = makeGroup('Today', 0)
    const monday = makeGroup('Monday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, monday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'outside-all-lanes',
        // The old Monday parent survived a failed drag, but the card is now
        // visibly outside both columns. Tidy should recover it by date.
        parentId: monday.id,
        dueDate: '2026-05-04',
        canvasPosition: { x: -400, y: 520 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves).toContainEqual(expect.objectContaining({
      taskId: 'outside-all-lanes',
      parentId: today.id,
      position: { x: 20, y: 70 },
    }))
    expect(updateTask).toHaveBeenCalledWith(
      'outside-all-lanes',
      { parentId: today.id, canvasPosition: { x: 20, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  it('spatially adopts loose tasks sitting inside visible groups during tidy', () => {
    // A loose task visibly sitting inside a group needs membership before Tidy
    // can stack it with the group. Already-parented tasks are covered by the
    // due-date test above and are not moved between groups.
    const custom = makeGroup('Project Work', 200) // bounds x:200..500, y:0..200
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([custom])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-loose',
        parentId: undefined,
        // center = (300 + 220/2, 80 + 100/2) = (410, 130) — inside the group.
        canvasPosition: { x: 300, y: 80 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves[0]?.parentId).toBe(custom.id)
    expect(updateTask).toHaveBeenCalledWith(
      'task-loose',
      { parentId: custom.id, canvasPosition: { x: 220, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  it('adopts loose tasks below a group when they are visibly in its column', () => {
    const custom = makeGroup('Project Work', 200, 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([custom])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-below',
        parentId: undefined,
        canvasPosition: { x: 220, y: 520 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves[0]?.parentId).toBe(custom.id)
    expect(taskMoves[0]?.position).toEqual({ x: 220, y: 70 })
    expect(updateTask).toHaveBeenCalledWith(
      'task-below',
      { parentId: custom.id, canvasPosition: { x: 220, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  it('adopts a visibly aligned loose task when its saved position is stale', () => {
    const today = makeGroup('Today', 200, 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-with-stale-saved-position',
        parentId: undefined,
        // The persisted X position is stale, but Vue Flow visibly renders the
        // card below Today in its column. Tidy must recover that visible state.
        canvasPosition: { x: 800, y: 520 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout({
      getNodePosition: (nodeId) => nodeId === 'task-with-stale-saved-position'
        ? { x: 220, y: 520 }
        : undefined,
    })
    const { taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves).toHaveLength(1)
    expect(taskMoves[0]).toMatchObject({
      taskId: 'task-with-stale-saved-position',
      parentId: today.id,
      position: { x: 220, y: 70 },
    })
    expect(updateTask).toHaveBeenCalledWith(
      'task-with-stale-saved-position',
      { parentId: today.id, canvasPosition: { x: 220, y: 70 }, positionFormat: 'absolute' },
      'DRAG'
    )
  })

  // TASK-1809b: reorderColumn must return moves synchronously (for instant paint)
  // and defer task persistence into commit(), so the wrapper can let the drag
  // handler's write land first and reorder still wins last-write-wins.
  describe('reorderColumn (TASK-1809b instant-paint split)', () => {
    it('reorders a Today column without emitting or persisting group geometry', () => {
      const today = {
        ...makeGroup('Today', 180, 160),
        position: { x: 180, y: 160, width: 420, height: 900 },
      }
      vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
      vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
        { id: 'top', parentId: today.id, canvasPosition: { x: 244, y: 252 }, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'dropped', parentId: today.id, canvasPosition: { x: 244, y: 396 }, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'bottom', parentId: today.id, canvasPosition: { x: 244, y: 540 }, createdAt: '2026-04-01T00:00:00Z' },
      ] as any)

      const { reorderColumn } = useTidyLayout()
      const result = reorderColumn(today.id, new Map([['dropped', { x: 244, y: 180 }]]))

      expect(result.taskMoves.map((move) => move.taskId)).toEqual(['dropped', 'top', 'bottom'])
      expect(result.groupMoves).toEqual([])
      expect(updateGroup).not.toHaveBeenCalled()

      result.release()
    })

    it('returns task moves synchronously WITHOUT writing tasks until commit()', () => {
      const today = makeGroup('Today', 0, 0)
      vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
      vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
        { id: 'a', parentId: today.id, canvasPosition: { x: 20, y: 400 }, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'b', parentId: today.id, canvasPosition: { x: 20, y: 110 }, createdAt: '2026-04-01T00:00:00Z' },
      ] as any)

      const { reorderColumn } = useTidyLayout()
      const result = reorderColumn(today.id)

      // Moves available immediately for applyCanonicalMoves (instant paint).
      expect(result.taskMoves.length).toBe(2)
      // Lowest-Y card sorts to the top slot.
      expect(result.taskMoves[0].taskId).toBe('b')
      // Sync flag held until release().
      expect(mockCanvasSyncInProgress.value).toBe(true)
      // NO task write yet — persistence is deferred to commit().
      expect(updateTask).not.toHaveBeenCalled()

      result.release()
      expect(mockCanvasSyncInProgress.value).toBe(false)
    })

    it('commit() persists each reordered task and is idempotent', async () => {
      const today = makeGroup('Today', 0, 0)
      vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
      vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
        { id: 'a', parentId: today.id, canvasPosition: { x: 20, y: 400 }, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'b', parentId: today.id, canvasPosition: { x: 20, y: 110 }, createdAt: '2026-04-01T00:00:00Z' },
      ] as any)
      updateTask.mockResolvedValue(undefined)

      const { reorderColumn } = useTidyLayout()
      const result = reorderColumn(today.id)
      expect(updateTask).not.toHaveBeenCalled()

      await result.commit()
      expect(updateTask).toHaveBeenCalledTimes(2)
      expect(updateTask).toHaveBeenCalledWith(
        'b',
        { order: 0, canvasPosition: result.taskMoves[0].position, positionFormat: 'absolute' },
        'DRAG'
      )

      // Idempotent: a second commit() does not double-write.
      await result.commit()
      expect(updateTask).toHaveBeenCalledTimes(2)

      result.release()
    })
  })
})
