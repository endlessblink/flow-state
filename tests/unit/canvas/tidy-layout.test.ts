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
import { formatDateKey } from '@/utils/dateUtils'

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
      { canvasPosition: { x: 20, y: 70 } },
      'DRAG'
    )
    expect(updateTask).toHaveBeenNthCalledWith(
      2,
      'task-low',
      { canvasPosition: { x: 20, y: 182 } },
      'DRAG'
    )
  })

  it('uses dynamic overflow columns for dense groups so Tidy does not create a huge vertical stack', () => {
    // Regression: 18+ tasks in Today made the group unusably tall when Tidy
    // capped dense groups at two columns. Explicit Tidy should compact enough
    // columns to keep the real canvas usable.
    const today = makeGroup('Today', 0)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today])
    const tasks = Array.from({ length: 18 }, (_, i) => ({
      id: `task-${i}`,
      parentId: today.id,
      canvasPosition: { x: 30, y: 100 + i * 110 },
      createdAt: '2026-04-01T00:00:00Z',
    })) as any
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks)

    const { tidyDayGroups } = useTidyLayout()
    const { groupMoves, taskMoves, release } = tidyDayGroups()
    release()

    expect(taskMoves.length).toBe(18)
    expect(taskMoves.slice(0, 5).every((move) => move.position.x === 20)).toBe(true)
    expect(taskMoves.slice(5, 10).every((move) => move.position.x === 260)).toBe(true)
    expect(taskMoves.slice(10, 15).every((move) => move.position.x === 500)).toBe(true)
    expect(taskMoves.slice(15).every((move) => move.position.x === 740)).toBe(true)
    expect(taskMoves[5].position.y).toBe(taskMoves[0].position.y)
    expect(taskMoves[10].position.y).toBe(taskMoves[0].position.y)
    expect(taskMoves[15].position.y).toBe(taskMoves[0].position.y)
    expect(groupMoves[0].size.width).toBe(980)
    expect(groupMoves[0].size.height).toBe(1000)
  })

  it('pulls a task due today into the Today group even when parented elsewhere (TASK-1798)', () => {
    // Date association: a task whose due date is today belongs in the Today
    // group, regardless of which group it currently lives in.
    const today = makeGroup('Today', 0)
    const mon = makeGroup('Monday', 500)
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, mon])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      {
        id: 'task-due-today',
        parentId: mon.id, // currently in the WRONG group
        dueDate: formatDateKey(new Date()),
        canvasPosition: { x: 520, y: 120 },
        createdAt: '2026-04-01T00:00:00Z',
      },
    ] as any)

    const { tidyDayGroups } = useTidyLayout()
    const { release } = tidyDayGroups()
    release()

    // First write re-homes the task into Today.
    expect(updateTask).toHaveBeenCalledWith(
      'task-due-today',
      { parentId: today.id },
      'DRAG'
    )
  })

  it('spatially adopts a loose task sitting inside a custom group (TASK-1798)', () => {
    // Custom groups have no date, so containment is the only association:
    // a loose (unparented) task whose center sits inside the custom group's
    // bounds gets adopted into it.
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
    const { release } = tidyDayGroups()
    release()

    expect(updateTask).toHaveBeenCalledWith(
      'task-loose',
      { parentId: custom.id },
      'DRAG'
    )
  })
})
