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
    expect(second.moves).toEqual([])
  })
})
