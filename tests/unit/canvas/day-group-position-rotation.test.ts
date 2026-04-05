/**
 * FEATURE-1048: Day Group Position Rotation Tests
 *
 * Tests for rotateDayGroupPositions() in useDayGroupRotation.ts.
 * Verifies that day-of-week canvas groups are physically repositioned
 * so today's group is leftmost, with subsequent days flowing left-to-right.
 *
 * Test isolation strategy:
 * - Pinia stores are mocked via vi.mock() so no DB/Supabase calls occur.
 * - useDateTransition is mocked to a no-op so no real timers start.
 * - canvasSyncInProgress is mocked to a plain writable ref.
 * - vi.useFakeTimers() / vi.setSystemTime() controls "today".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Mock dependencies — must precede composable import
// ============================================================================

// Suppress console.log noise from the composable
vi.stubGlobal('import.meta', { env: { DEV: false } })

// Mock useDateTransition to a no-op so no real midnight timers fire
vi.mock('@/composables/useDateTransition', () => ({
  useDateTransition: vi.fn()
}))

// canvasSyncInProgress is a module-level ref exported from useCanvasSync.
// Use vi.hoisted() so the ref is available before vi.mock() factories run.
const { mockCanvasSyncInProgress } = vi.hoisted(() => {
  const { ref } = require('vue')
  return { mockCanvasSyncInProgress: ref(false) }
})

vi.mock('@/composables/canvas/useCanvasSync', () => ({
  canvasSyncInProgress: mockCanvasSyncInProgress,
  isWritingBackStaleParents: { value: false }
}))

// Mock Supabase database so stores don't try real network calls
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

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useDayGroupRotation } from '@/composables/canvas/useDayGroupRotation'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

// ============================================================================
// Helpers
// ============================================================================

let groupIdCounter = 0
let taskIdCounter = 0

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
    id: `task-${++taskIdCounter}`,
    title: 'Test task',
    status: 'planned',
    ...overrides
  } as unknown as Task
}

/** Day names → JS day index (0=Sun … 6=Sat) */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Wednesday 2026-04-08 00:00:00 local — dayIndex 3
const WEDNESDAY = new Date(2026, 3, 8, 0, 0, 0, 0) // month is 0-based

// ============================================================================
// Test suite
// ============================================================================

describe('rotateDayGroupPositions()', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let settingsStore: ReturnType<typeof useSettingsStore>
  let updateGroup: ReturnType<typeof vi.fn>
  let updateTask: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(WEDNESDAY)

    setActivePinia(createPinia())

    canvasStore = useCanvasStore()
    taskStore = useTaskStore()
    settingsStore = useSettingsStore()

    updateGroup = vi.fn()
    updateTask = vi.fn()

    // Spy on store mutation methods
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(updateGroup)
    vi.spyOn(taskStore, 'updateTask').mockImplementation(updateTask)

    // Enable both feature flags by default
    ;(settingsStore as any).enableDayGroupPositionRotation = true
    ;(settingsStore as any).enableDayGroupSuggestions = true
    ;(settingsStore as any).weekStartsOn = 1 // Monday (most common)

    // Reset sync flag
    mockCanvasSyncInProgress.value = false

    groupIdCounter = 0
    taskIdCounter = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // Test 1: Manual call works even with feature flag off (flag only gates midnight auto-trigger)
  // --------------------------------------------------------------------------

  it('1: manual call works even with feature flag off', () => {
    ;(settingsStore as any).enableDayGroupPositionRotation = false

    const groups = [
      makeGroup({ name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } }),
      makeGroup({ name: 'Tuesday', position: { x: 350, y: 0, width: 350, height: 600 } }),
      makeGroup({ name: 'Wednesday', position: { x: 700, y: 0, width: 350, height: 600 } })
    ]
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue(groups)
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // Manual trigger should still work — flag only gates midnight auto-trigger
    expect(updateGroup).toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // Test 2: 7 day groups — full week rotation, today (Wednesday) goes leftmost
  // --------------------------------------------------------------------------

  it('2: 7 day groups rotate with weekStartsOn=1 — Sunday goes to end', () => {
    // Today = Wednesday (dayIndex 3), weekStartsOn = 1 (Monday)
    ;(settingsStore as any).weekStartsOn = 1

    const groups = DAY_NAMES.map((name, i) => {
      return makeGroup({
        name,
        position: { x: i * 350, y: 0, width: 350, height: 600 }
      })
    })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue(groups)
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // weekStartsOn=1 (Mon). Normalized day indices (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6)
    // Today Wed = normalized 2. Distances: Wed=0, Thu=1, Fri=2, Sat=3, Sun=4, Mon=5, Tue=6
    // So: Wed→slot0(X0), Thu→slot1(X350), Fri→slot2(X700), Sat→slot3(X1050),
    //     Sun→slot4(X1400), Mon→slot5(X1750), Tue→slot6(X2100)
    // Key: Sunday is at slot 4 (not slot 1 like it would be without weekStartsOn)

    const calls = updateGroup.mock.calls as Array<[string, { position: { x: number; y: number } }]>
    const posById = new Map(calls.map(([id, update]) => [id, update.position.x]))
    const byName = new Map(groups.map((g) => [g.name, g.id]))

    expect(posById.get(byName.get('Wednesday')!)).toBe(0)
    expect(posById.get(byName.get('Thursday')!)).toBe(350)
    expect(posById.get(byName.get('Friday')!)).toBe(700)
    expect(posById.get(byName.get('Saturday')!)).toBe(1050)
    expect(posById.get(byName.get('Sunday')!)).toBe(1400)
    expect(posById.get(byName.get('Monday')!)).toBe(1750)
    expect(posById.get(byName.get('Tuesday')!)).toBe(2100)
  })

  // --------------------------------------------------------------------------
  // Test 3: Partial set (3 groups: Mon/Wed/Fri) — today=Wednesday
  // --------------------------------------------------------------------------

  it('3: partial set — Mon/Wed/Fri groups, today=Wednesday, Wed gets leftmost slot', () => {
    // Place them in alphabetical/arbitrary X order: Fri=0, Mon=350, Wed=700
    const fri = makeGroup({ name: 'Friday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const mon = makeGroup({ name: 'Monday', position: { x: 350, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ name: 'Wednesday', position: { x: 700, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([fri, mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // Slots sorted by X: 0, 350, 700
    // Groups sorted by distance from Wed (3):
    //   Wed dist=0 → slot[0]=X0
    //   Fri  dist=2 → slot[1]=X350
    //   Mon  dist=5 → slot[2]=X700
    const calls = updateGroup.mock.calls as Array<[string, { position: { x: number } }]>
    const posById = new Map(calls.map(([id, u]) => [id, u.position.x]))

    expect(posById.get(wed.id)).toBe(0)
    expect(posById.get(fri.id)).toBe(350)
    expect(posById.get(mon.id)).toBe(700)
  })

  // --------------------------------------------------------------------------
  // Test 4: Child tasks move with parent group
  // --------------------------------------------------------------------------

  it('4: child tasks move by same delta as their parent group', () => {
    // Mon is at X=0, Wed is at X=350. Today=Wed → Wed should go to X=0, Mon to X=350.
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })

    // Child of Wed group at (100, 50). After Wed moves by delta (-350, 0) → (100-350, 50) NO...
    // Wed moves from X=350 → X=0, delta = 0 - 350 = -350
    // So child (100, 50) → (100 + (-350), 50) = (-250, 50)
    const childTask = makeTask({
      id: 'child-1',
      parentId: 'grp-wed',
      canvasPosition: { x: 100, y: 50 }
    })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([childTask])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // Wed (today) → slot X=0, delta = 0 - 350 = -350
    // child should be called with x: 100 + (-350) = -250, y: 50 + 0 = 50
    const taskCalls = updateTask.mock.calls as Array<[string, { canvasPosition: { x: number; y: number } }, string]>
    const childCall = taskCalls.find(([id]) => id === 'child-1')

    expect(childCall).toBeDefined()
    expect(childCall![1].canvasPosition.x).toBe(-250)
    expect(childCall![1].canvasPosition.y).toBe(50)
    expect(childCall![2]).toBe('DRAG')
  })

  // --------------------------------------------------------------------------
  // Test 4b: Child tasks — example from spec (delta 350,0)
  // --------------------------------------------------------------------------

  it('4b: child task at (100, 50) with group delta (+350, 0) ends at (450, 50)', () => {
    // Mon at X=350, Wed at X=0. Today=Wed → Wed stays at 0 (no move), Mon stays at 350 (no move).
    // To get a delta of +350 for a child, we need the parent group to move +350.
    // Let's put Wed at X=0 and Mon at X=350. Today=Wednesday.
    // Slots sorted by X: 0, 350.
    // Groups by dist from Wed: Wed dist=0→slot X=0, Mon dist=5→slot X=350.
    // Wed is already at X=0, Mon is already at X=350. No moves. Children not touched.
    //
    // For the +350 scenario: put Mon at X=0, Wed at X=350, then rotate.
    // Wed (today) → slot X=0, delta = 0 - 350 = -350 (not +350).
    // For +350: put a non-today group at X=0 that should move to X=350.
    // Mon at X=0 → after rotation Mon needs slot X=350 → delta = +350.
    // A child of Mon at (100, 50) → (100+350, 50) = (450, 50). ✓

    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })

    const childOfMon = makeTask({
      id: 'child-mon',
      parentId: 'grp-mon',
      canvasPosition: { x: 100, y: 50 }
    })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([childOfMon])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // Mon dist from Wed=3: (1 - 3 + 7) % 7 = 5 → slot[1] = X=350, delta = +350
    const taskCalls = updateTask.mock.calls as Array<[string, { canvasPosition: { x: number; y: number } }, string]>
    const childCall = taskCalls.find(([id]) => id === 'child-mon')

    expect(childCall).toBeDefined()
    expect(childCall![1].canvasPosition.x).toBe(450)
    expect(childCall![1].canvasPosition.y).toBe(50)
  })

  // --------------------------------------------------------------------------
  // Test 5: Single group → no-op (need >= 2 groups)
  // --------------------------------------------------------------------------

  it('5: single day group → no updates fired', () => {
    const wed = makeGroup({ name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateTask).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // Test 6: Already in correct order → no updates fired
  // --------------------------------------------------------------------------

  it('6: groups already in correct rotation order → no updates fired', () => {
    // Today=Wednesday. Correct order: Wed=0, Thu=350, Fri=700.
    const wed = makeGroup({ name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const thu = makeGroup({ name: 'Thursday', position: { x: 350, y: 0, width: 350, height: 600 } })
    const fri = makeGroup({ name: 'Friday', position: { x: 700, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed, thu, fri])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateTask).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // Test 7: canvasSyncInProgress is set during rotation and reset after
  // --------------------------------------------------------------------------

  it('7: canvasSyncInProgress is true during updates and false after', () => {
    const mon = makeGroup({ name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const syncStates: boolean[] = []
    updateGroup.mockImplementation(() => {
      syncStates.push(mockCanvasSyncInProgress.value)
    })

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // At least one group moved, so updateGroup was called with sync=true
    expect(syncStates.length).toBeGreaterThan(0)
    expect(syncStates.every((s) => s === true)).toBe(true)

    // After rotation, flag is reset
    expect(mockCanvasSyncInProgress.value).toBe(false)
  })

  // --------------------------------------------------------------------------
  // Test 8: Non-day groups are ignored
  // --------------------------------------------------------------------------

  it('8: non-day-of-week groups are ignored during rotation', () => {
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    const today = makeGroup({ name: 'Today', position: { x: 0, y: 0, width: 350, height: 600 } })
    const custom = makeGroup({ name: 'My Custom Group', position: { x: 700, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed, today, custom])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    // Only 1 day-of-week group found → less than 2, no rotation
    expect(updateGroup).not.toHaveBeenCalled()

    // 'Today' and 'My Custom Group' should never be touched
    const updatedIds = updateGroup.mock.calls.map(([id]: [string]) => id)
    expect(updatedIds).not.toContain(today.id)
    expect(updatedIds).not.toContain(custom.id)
  })

  // --------------------------------------------------------------------------
  // Test 9: updateTask uses 'DRAG' as the source (geometry invariant)
  // --------------------------------------------------------------------------

  it('9: updateTask is always called with source="DRAG" (geometry invariant)', () => {
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })

    const tasks = [
      makeTask({ id: 't1', parentId: 'grp-mon', canvasPosition: { x: 10, y: 10 } }),
      makeTask({ id: 't2', parentId: 'grp-wed', canvasPosition: { x: 20, y: 20 } })
    ]

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue(tasks)

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions()

    const taskCalls = updateTask.mock.calls as Array<[string, unknown, string]>
    expect(taskCalls.length).toBeGreaterThan(0)
    taskCalls.forEach(([_id, _update, source]) => {
      expect(source).toBe('DRAG')
    })
  })
})
