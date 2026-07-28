/**
 * TASK-1756: persisted `lastRotationDate` guard inside useDayGroupRotation.
 *
 * Verifies that the catch-up entry point is idempotent on the same day,
 * re-runs after the day changes, and that `{ force: true }` bypasses the
 * guard so the toolbar button always acts.
 *
 * Note: VueUse's `useStorage` flushes writes to localStorage asynchronously.
 * We use `__getLastRotationDateForTest` / `__setLastRotationDateForTest` to
 * read and seed the in-memory ref directly so tests stay synchronous.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Mocks — must precede composable import
// ============================================================================

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
  __getLastRotationDateForTest,
  __setLastRotationDateForTest
} from '@/composables/canvas/useDayGroupRotation'
import { __forceRefreshCurrentDay } from '@/composables/useCurrentDay'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

// Wednesday 2026-04-08 → YYYY-MM-DD = '2026-04-08'
const WEDNESDAY = new Date(2026, 3, 8, 10, 0, 0, 0)
const WEDNESDAY_STR = '2026-04-08'
const YESTERDAY_STR = '2026-04-07'

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

describe('useDayGroupRotation — catch-up guard', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let settingsStore: ReturnType<typeof useSettingsStore>
  let updateTask: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(WEDNESDAY)
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

  it('1: fresh marker → first rotateDayGroups writes today', () => {
    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups()

    expect(__getLastRotationDateForTest()).toBe(WEDNESDAY_STR)
    expect(updateTask).toHaveBeenCalledTimes(1)
  })

  it('2: same-day second call is a no-op (guard hit)', () => {
    __setLastRotationDateForTest(WEDNESDAY_STR)

    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups()

    expect(updateTask).not.toHaveBeenCalled()
  })

  it('3: marker set to yesterday → rotation runs and updates marker', () => {
    __setLastRotationDateForTest(YESTERDAY_STR)

    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups()

    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(__getLastRotationDateForTest()).toBe(WEDNESDAY_STR)
  })

  it('4: `{ force: true }` bypasses the guard even when marker is today', () => {
    __setLastRotationDateForTest(WEDNESDAY_STR)

    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledTimes(1)
  })

  it('4b: forced toolbar rotation keeps a same-day Saturday task on today even with Today/Tomorrow groups', () => {
    const saturday = new Date(2026, 3, 18, 10, 0, 0, 0)
    vi.setSystemTime(saturday)
    __forceRefreshCurrentDay()

    const today = makeGroup({ name: 'Today' })
    const tomorrow = makeGroup({ name: 'Tomorrow' })
    const sat = makeGroup({ name: 'Saturday' })
    const task = makeTask({ id: 'sat-task', parentId: sat.id, dueDate: '2026-04-17' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow, sat])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([task])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups({ force: true })

    expect(updateTask).toHaveBeenCalledWith(
      'sat-task',
      { dueDate: '2026-04-18' },
      'SMART-GROUP'
    )
    expect(updateTask).not.toHaveBeenCalledWith(
      'sat-task',
      { dueDate: '2026-04-25' },
      'SMART-GROUP'
    )
  })

  it('5: feature flag off → no rotation, no marker write', () => {
    ;(settingsStore as any).enableDayGroupSuggestions = false

    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { rotateDayGroups } = useDayGroupRotation()
    rotateDayGroups()

    expect(updateTask).not.toHaveBeenCalled()
    expect(__getLastRotationDateForTest()).toBe('')
  })

  it('6: runCatchupIfNeeded is idempotent on the same day', () => {
    const wed = makeGroup({ name: 'Wednesday' })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([
      makeTask({ parentId: wed.id, dueDate: YESTERDAY_STR })
    ])

    const { runCatchupIfNeeded } = useDayGroupRotation()

    const first = runCatchupIfNeeded()
    first.release()
    expect(updateTask).toHaveBeenCalledTimes(1)

    updateTask.mockClear()
    const second = runCatchupIfNeeded()
    second.release()
    expect(updateTask).not.toHaveBeenCalled()
    expect(second.groupMoves).toEqual([])
    expect(second.taskMoves).toEqual([])
  })

  // BUG-1980: after a missed midnight (app closed at 00:00), the on-launch
  // catch-up must fully re-align — group positions AND task re-homing — not
  // just dueDate metadata. A genuine day boundary is "marker present and older
  // than today"; same-day reloads and first-ever launches stay metadata-only.

  it('7: genuine missed-midnight → catch-up returns position group moves', () => {
    __setLastRotationDateForTest(YESTERDAY_STR)

    const updateGroup = vi.fn()
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(updateGroup)

    // Two day groups placed out of canonical order so rotation produces moves.
    // Today = Wednesday → Wed should take the leftmost slot.
    const mon = makeGroup({ name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { runCatchupIfNeeded } = useDayGroupRotation()
    const result = runCatchupIfNeeded()
    result.release()

    expect(result.groupMoves.length).toBeGreaterThan(0)
    expect(updateGroup).toHaveBeenCalled()
  })

  it('8: genuine missed-midnight → stale-dated task re-homed to its matching group', () => {
    __setLastRotationDateForTest(YESTERDAY_STR)
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(vi.fn())

    // Today = Wednesday. A task dated today but parked in the Thursday group
    // must be re-homed into the Today group during the launch catch-up.
    const today = makeGroup({ name: 'Today', position: { x: 0, y: 0, width: 350, height: 600 } })
    const tomorrow = makeGroup({ name: 'Tomorrow', position: { x: 416, y: 0, width: 350, height: 600 } })
    const thursday = makeGroup({ name: 'Thursday', position: { x: 832, y: 0, width: 350, height: 600 } })
    const staleChild = makeTask({
      id: 'stale-child',
      parentId: thursday.id,
      dueDate: WEDNESDAY_STR,
      canvasPosition: { x: 852, y: 160 },
    })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([today, tomorrow, thursday])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([staleChild])

    const { runCatchupIfNeeded } = useDayGroupRotation()
    const result = runCatchupIfNeeded()
    result.release()

    const rehome = result.taskMoves.find((m) => m.taskId === 'stale-child')
    expect(rehome?.parentId).toBe(today.id)
  })

  it('9: first-ever launch (empty marker) stays metadata-only — no group moves', () => {
    __setLastRotationDateForTest('')

    const updateGroup = vi.fn()
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(updateGroup)

    const mon = makeGroup({ name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { runCatchupIfNeeded } = useDayGroupRotation()
    const result = runCatchupIfNeeded()
    result.release()

    // First run must not clobber manually-arranged group positions.
    expect(result.groupMoves).toEqual([])
    expect(updateGroup).not.toHaveBeenCalled()
  })
})
