/**
 * BUG-1787 regression: rotateDayGroups now also rotates Today / Tomorrow
 * power-keyword groups, not just day-of-week groups.
 *
 * Before this fix, tasks parented to a "Tomorrow" group kept yesterday's
 * dueDate after midnight — the group's header would correctly read the new
 * date (via reactive useCurrentDay) but the child task's dueDate badge stayed
 * stale.
 *
 * These tests also guard the existing day-of-week rotation path so a future
 * regression on that side will fail loudly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.stubGlobal('import.meta', { env: { DEV: false } })

vi.mock('@/composables/useDateTransition', () => ({
  useDateTransition: vi.fn()
}))

const { mockCanvasSyncInProgress } = vi.hoisted(() => {
  const { ref } = require('vue')
  return { mockCanvasSyncInProgress: ref(false) }
})

vi.mock('@/composables/canvas/useCanvasSync', () => ({
  canvasSyncInProgress: mockCanvasSyncInProgress,
  isWritingBackStaleParents: { value: false }
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchGroups: vi.fn().mockResolvedValue([]),
    fetchTasks: vi.fn().mockResolvedValue([]),
    saveTask: vi.fn(),
    saveTasks: vi.fn(),
    deleteTask: vi.fn()
  })
}))

import {
  useDayGroupRotation,
  __setLastRotationDateForTest
} from '@/composables/canvas/useDayGroupRotation'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

// Sunday 2026-05-17 → matches the date the user was on when reporting BUG-1787
const TODAY = new Date(2026, 4, 17, 10, 0, 0, 0)
const TODAY_STR = '2026-05-17'
const TOMORROW_STR = '2026-05-18'
const TUESDAY_STR = '2026-05-19' // next Tuesday from Sunday 17/05
const SATURDAY_STR = '2026-05-23' // next Saturday from Sunday 17/05

let groupIdCounter = 0
function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: `grp-${++groupIdCounter}`,
    name: 'Group',
    isVisible: true,
    position: { x: 0, y: 0, width: 350, height: 600 },
    ...overrides
  } as unknown as CanvasGroup
}
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test task',
    status: 'planned',
    ...overrides
  } as unknown as Task
}

describe('BUG-1787: rotateDayGroups handles Today / Tomorrow power groups', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let settingsStore: ReturnType<typeof useSettingsStore>
  let updateTask: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    localStorage.clear()
    __setLastRotationDateForTest('')

    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    taskStore = useTaskStore()
    settingsStore = useSettingsStore()

    updateTask = vi.fn()
    vi.spyOn(taskStore, 'updateTask').mockImplementation(updateTask)

    ;(settingsStore as any).enableDayGroupSuggestions = true
    ;(settingsStore as any).enableDayGroupPositionRotation = true
    ;(settingsStore as any).weekStartsOn = 1

    mockCanvasSyncInProgress.value = false
    groupIdCounter = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
    __setLastRotationDateForTest('')
  })

  it('updates Today-group child dueDate to today when stale', () => {
    const todayGroup = makeGroup({ name: 'Today' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([todayGroup])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: todayGroup.id, dueDate: '2026-05-15' })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(1)
    const [, updates, source] = updateTask.mock.calls[0]
    expect(updates).toEqual({ dueDate: TODAY_STR })
    expect(source).toBe('SMART-GROUP')
  })

  it('updates Tomorrow-group child dueDate to tomorrow when stale', () => {
    const tomorrowGroup = makeGroup({ name: 'Tomorrow' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([tomorrowGroup])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: tomorrowGroup.id, dueDate: TODAY_STR })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(updateTask.mock.calls[0][1]).toEqual({ dueDate: TOMORROW_STR })
  })

  it('skips Today-group child when dueDate already matches today', () => {
    const todayGroup = makeGroup({ name: 'Today' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([todayGroup])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: todayGroup.id, dueDate: TODAY_STR })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).not.toHaveBeenCalled()
  })

  it('does NOT rotate "this week" / "later" span-keyword groups', () => {
    // These are spans, not specific dates — leaving dueDate alone is correct.
    const thisWeek = makeGroup({ name: 'This Week' })
    const later = makeGroup({ name: 'Later' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([thisWeek, later])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: thisWeek.id, dueDate: '2026-01-01' }),
      makeTask({ parentId: later.id, dueDate: '2026-01-01' })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).not.toHaveBeenCalled()
  })

  it('still rotates day-of-week groups (regression guard for prior behavior)', () => {
    const tuesday = makeGroup({ name: 'Tuesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([tuesday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: tuesday.id, dueDate: '2026-01-01' })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(updateTask.mock.calls[0][1]).toEqual({ dueDate: TUESDAY_STR })
  })

  it('rotates Today, Tomorrow, and day-of-week groups in one pass', () => {
    const today = makeGroup({ name: 'Today' })
    const tomorrow = makeGroup({ name: 'Tomorrow' })
    const saturday = makeGroup({ name: 'Saturday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow, saturday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: today.id, dueDate: '2026-01-01' }),
      makeTask({ parentId: tomorrow.id, dueDate: '2026-01-01' }),
      makeTask({ parentId: saturday.id, dueDate: '2026-01-01' })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(3)
    const dates = updateTask.mock.calls.map(c => c[1].dueDate).sort()
    expect(dates).toEqual([TODAY_STR, TOMORROW_STR, SATURDAY_STR].sort())
  })

  it('rotateDayGroupPositions holds canvasSyncInProgress=true while computing, releases on release()', () => {
    // BUG-1787 part 3: sync-lock semantics. Verifies the existing contract
    // that `rotateDayGroupPositions` sets the lock to true at start and
    // exposes a `release()` closure that flips it back to false. The
    // CanvasView.vue handler relies on this — if it changes, the
    // pre-acquire pattern in handleRotateDayGroups would silently break.
    const today = makeGroup({
      name: 'Today',
      position: { x: 0, y: 0, width: 400, height: 800 } as any,
    })
    const tomorrow = makeGroup({
      name: 'Tomorrow',
      position: { x: 500, y: 0, width: 400, height: 800 } as any,
    })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    expect(mockCanvasSyncInProgress.value).toBe(false)

    const { release } = useDayGroupRotation().rotateDayGroupPositions()
    expect(mockCanvasSyncInProgress.value, 'lock must be held during/after rotateDayGroupPositions').toBe(true)

    release()
    expect(mockCanvasSyncInProgress.value, 'lock must be released after release()').toBe(false)
  })

  it('skips done tasks even inside rotated groups', () => {
    const tomorrow = makeGroup({ name: 'Tomorrow' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([tomorrow])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: tomorrow.id, dueDate: TODAY_STR, status: 'done' }),
      makeTask({ parentId: tomorrow.id, dueDate: TODAY_STR, status: 'planned' })
    ])

    useDayGroupRotation().rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(updateTask.mock.calls[0][1]).toEqual({ dueDate: TOMORROW_STR })
  })
})
