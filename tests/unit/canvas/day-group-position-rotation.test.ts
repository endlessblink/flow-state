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
    rotateDayGroupPositions().release()

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
    rotateDayGroupPositions().release()

    // TASK-1756 v8: canonical layout — origin X = min input X = 0,
    // spacing = DAY_GROUP_SPACING (420).
    // weekStart=1 (Mon). today=Wed. Distances: Wed=0, Thu=1, Fri=2, Sat=3, Sun=4, Mon=5, Tue=6
    // So: Wed→slot0(X0), Thu→slot1(X420), Fri→slot2(X840), Sat→slot3(X1260),
    //     Sun→slot4(X1680), Mon→slot5(X2100), Tue→slot6(X2520)
    const calls = updateGroup.mock.calls as Array<[string, { position: { x: number; y: number } }]>
    const posById = new Map(calls.map(([id, update]) => [id, update.position.x]))
    const byName = new Map(groups.map((g) => [g.name, g.id]))

    expect(posById.get(byName.get('Wednesday')!)).toBe(0)
    expect(posById.get(byName.get('Thursday')!)).toBe(420)
    expect(posById.get(byName.get('Friday')!)).toBe(840)
    expect(posById.get(byName.get('Saturday')!)).toBe(1260)
    expect(posById.get(byName.get('Sunday')!)).toBe(1680)
    expect(posById.get(byName.get('Monday')!)).toBe(2100)
    expect(posById.get(byName.get('Tuesday')!)).toBe(2520)
  })

  // --------------------------------------------------------------------------
  // Test 2b: With Today/Tomorrow smart-groups, day-of-week groups start from day+2
  // --------------------------------------------------------------------------

  it('2b: with Today+Tomorrow groups, day groups start from day-after-tomorrow', () => {
    // Today = Wednesday (dayIndex 3), weekStartsOn = 1
    // Today+Tomorrow exist → day groups start from Friday (day+2 = 5)
    ;(settingsStore as any).weekStartsOn = 1

    const dayOfWeekGroups = DAY_NAMES.map((name, i) => {
      return makeGroup({
        name,
        position: { x: (i + 2) * 350, y: 0, width: 350, height: 600 }
      })
    })
    // Add Today and Tomorrow smart-groups (not day-of-week, won't be moved)
    const todayGroup = makeGroup({ name: 'Today', position: { x: 0, y: 0, width: 350, height: 600 } })
    const tomorrowGroup = makeGroup({ name: 'Tomorrow', position: { x: 350, y: 0, width: 350, height: 600 } })
    const allGroups = [todayGroup, tomorrowGroup, ...dayOfWeekGroups]

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue(allGroups)
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions().release()

    // TASK-1756 v8: Today + Tomorrow now ARE part of the canonical layout.
    // Order: Today → Tomorrow → day-of-week by distance from startFrom (Fri).
    // All 9 groups (2 smart + 7 weekday) laid out at origin X = 0 with spacing 420.
    // Slot indices:
    //   Today→0(X0), Tomorrow→1(X420),
    //   Fri→2(X840), Sat→3(X1260), Sun→4(X1680), Mon→5(X2100),
    //   Tue→6(X2520), Wed→7(X2940), Thu→8(X3360)
    const calls = updateGroup.mock.calls as Array<[string, { position: { x: number } }]>
    const posById = new Map(calls.map(([id, update]) => [id, update.position.x]))
    const byName = new Map([
      ...dayOfWeekGroups.map((g) => [g.name, g.id] as const),
      ['Today', todayGroup.id] as const,
      ['Tomorrow', tomorrowGroup.id] as const,
    ])

    expect(posById.get(byName.get('Today')!)).toBe(0)
    expect(posById.get(byName.get('Tomorrow')!)).toBe(420)
    expect(posById.get(byName.get('Friday')!)).toBe(840)
    expect(posById.get(byName.get('Saturday')!)).toBe(1260)
    expect(posById.get(byName.get('Sunday')!)).toBe(1680)
    expect(posById.get(byName.get('Monday')!)).toBe(2100)
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
    rotateDayGroupPositions().release()

    // TASK-1756 v8: origin X = min input X = 0, spacing = 420.
    // Groups sorted by distance from Wed (3):
    //   Wed dist=0 → slot[0]=X0
    //   Fri dist=2 → slot[1]=X420
    //   Mon dist=5 → slot[2]=X840
    const calls = updateGroup.mock.calls as Array<[string, { position: { x: number } }]>
    const posById = new Map(calls.map(([id, u]) => [id, u.position.x]))

    expect(posById.get(wed.id)).toBe(0)
    expect(posById.get(fri.id)).toBe(420)
    expect(posById.get(mon.id)).toBe(840)
  })

  // --------------------------------------------------------------------------
  // Test 4: Child tasks move with parent group
  // --------------------------------------------------------------------------

  it('4: child tasks are restacked at canonical positions inside new parent', () => {
    // TASK-1756 v8: rotation no longer moves tasks by parent's delta.
    // Instead, tasks are restacked canonically via the layout primitive —
    // column 0 at groupX + GROUP_PADDING, row N at groupY + HEADER + PADDING + N*(taskH+gap).
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })

    const childTask = makeTask({
      id: 'child-1',
      parentId: 'grp-wed',
      canvasPosition: { x: 100, y: 50 }
    })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([childTask])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions().release()

    // Wed (today) → slot0 → newGroupX = 0, newGroupY = 0
    // Task 0 of Wed: x = 0 + PADDING(20) = 20
    //                y = 0 + HEADER(50) + PADDING(20) + 0*(100+10) = 70
    const taskCalls = updateTask.mock.calls as Array<[string, { canvasPosition: { x: number; y: number } }, string]>
    const childCall = taskCalls.find(([id]) => id === 'child-1')

    expect(childCall).toBeDefined()
    expect(childCall![1].canvasPosition.x).toBe(20)
    expect(childCall![1].canvasPosition.y).toBe(70)
    expect(childCall![2]).toBe('DRAG')
  })

  // --------------------------------------------------------------------------
  // Test 4b: Child tasks — example from spec (delta 350,0)
  // --------------------------------------------------------------------------

  it('4b: child of non-today group lands at canonical position inside its new slot', () => {
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
    rotateDayGroupPositions().release()

    // Mon → slot1 → newGroupX = 420 (origin 0 + 420), newGroupY = 0.
    // Task 0 of Mon: x = 420 + PADDING(20) = 440
    //                y = 0 + HEADER(50) + PADDING(20) + 0*(100+10) = 70
    const taskCalls = updateTask.mock.calls as Array<[string, { canvasPosition: { x: number; y: number } }, string]>
    const childCall = taskCalls.find(([id]) => id === 'child-mon')

    expect(childCall).toBeDefined()
    expect(childCall![1].canvasPosition.x).toBe(440)
    expect(childCall![1].canvasPosition.y).toBe(70)
  })

  // --------------------------------------------------------------------------
  // Test 5: Single group → no-op (need >= 2 groups)
  // --------------------------------------------------------------------------

  it('5: single day group → no updates fired', () => {
    const wed = makeGroup({ name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions().release()

    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateTask).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // Test 6: Already in correct order → no updates fired
  // --------------------------------------------------------------------------

  it('6: groups already in order still get canonical width/height writes', () => {
    // TASK-1756 v8: even if X positions and weekday order are already correct,
    // canonical layout normalises width (350) and height (920). So updateGroup
    // IS always called — dimensions get normalised every rotation.
    const wed = makeGroup({ name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const thu = makeGroup({ name: 'Thursday', position: { x: 420, y: 0, width: 350, height: 600 } })
    const fri = makeGroup({ name: 'Friday', position: { x: 840, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed, thu, fri])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions().release()

    // All 3 groups get their size normalized (width=350, height=920) even
    // though positions don't change.
    const calls = updateGroup.mock.calls as Array<[string, { position: { width: number; height: number } }]>
    expect(calls.length).toBe(3)
    for (const [, update] of calls) {
      expect(update.position.width).toBe(350)
      expect(update.position.height).toBe(920)
    }
    expect(updateTask).not.toHaveBeenCalled() // no tasks
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
    rotateDayGroupPositions().release()

    // At least one group moved, so updateGroup was called with sync=true
    expect(syncStates.length).toBeGreaterThan(0)
    expect(syncStates.every((s) => s === true)).toBe(true)

    // After rotation, flag is reset
    expect(mockCanvasSyncInProgress.value).toBe(false)
  })

  // --------------------------------------------------------------------------
  // Test 8: Non-day groups are ignored
  // --------------------------------------------------------------------------

  it('8: custom-named groups are ignored; smart + day-of-week groups are included', () => {
    // TASK-1756 v8: "Today" is a smart group and IS part of the canonical
    // layout now. Custom-named groups (no power keyword) are still ignored.
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    const today = makeGroup({ name: 'Today', position: { x: 0, y: 0, width: 350, height: 600 } })
    const custom = makeGroup({ name: 'My Custom Group', position: { x: 700, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed, today, custom])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    rotateDayGroupPositions().release()

    const updatedIds = updateGroup.mock.calls.map(([id]: [string]) => id)
    // Today + Wed are the 2 qualifying inputs — both get written.
    expect(updatedIds).toContain(today.id)
    expect(updatedIds).toContain(wed.id)
    // Custom group never touched.
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
    rotateDayGroupPositions().release()

    const taskCalls = updateTask.mock.calls as Array<[string, unknown, string]>
    expect(taskCalls.length).toBeGreaterThan(0)
    taskCalls.forEach(([_id, _update, source]) => {
      expect(source).toBe('DRAG')
    })
  })

  // --------------------------------------------------------------------------
  // Test 10 (TASK-1756 v2): Stacked groups → canonical row layout
  // --------------------------------------------------------------------------

  it('10: stacked day groups (identical X) are laid out into a canonical row', () => {
    // All three groups spawn at the exact same default position
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday',    position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const fri = makeGroup({ id: 'grp-fri', name: 'Friday',    position: { x: 0, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed, fri])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    const { groupMoves: moves, release } = rotateDayGroupPositions()
    release()

    // Today = Wednesday (2026-04-08, dayIndex 3). weekStartsOn=1 (Monday).
    // Normalized: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    // Distances from Wed(2): Wed=0, Fri=2, Mon=5 → slot indices 0, 1, 2
    // GROUP_SPACING = 420, origin X = 0, origin Y = 0
    // Wed already sits at slot 0 (deltaX=0) so it's skipped from the moves
    // array — only Fri (→ 420) and Mon (→ 840) produce moves.
    const byNode = new Map(moves.map((m) => [m.nodeId, m.position.x]))
    expect(byNode.get('section-' + fri.id)).toBe(420)
    expect(byNode.get('section-' + mon.id)).toBe(840)
    // And the store should have been updated for Fri and Mon via updateGroup
    const groupIdsUpdated = updateGroup.mock.calls.map(([id]: [string]) => id)
    expect(groupIdsUpdated).toContain(fri.id)
    expect(groupIdsUpdated).toContain(mon.id)
  })

  // --------------------------------------------------------------------------
  // Test 11 (TASK-1756 v2): canvasSyncInProgress is held until release()
  // --------------------------------------------------------------------------

  it('11: rotateDayGroupPositions keeps canvasSyncInProgress true until release() is called', () => {
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday',    position: { x:   0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    const { release } = rotateDayGroupPositions()

    // Flag must still be held — the sync gate protects applyDayGroupMoves
    expect(mockCanvasSyncInProgress.value).toBe(true)

    release()
    expect(mockCanvasSyncInProgress.value).toBe(false)

    // release() is idempotent
    release()
    expect(mockCanvasSyncInProgress.value).toBe(false)
  })

  // --------------------------------------------------------------------------
  // Test 12 (TASK-1756 v3): non-stacked layout reorders into chronological slots
  // --------------------------------------------------------------------------

  it('12: non-stacked layout reorders today-first into existing X-slots', () => {
    // Three groups spread horizontally at X=[0, 500, 1000]. Today=Wed → Wed
    // must end up at the leftmost existing slot (x=0). Previous v1.3.56
    // "preserve user layout" gate has been removed in v1.3.57.
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0,    y: 0, width: 350, height: 600 } })
    const tue = makeGroup({ id: 'grp-tue', name: 'Tuesday', position: { x: 500, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 1000, y: 0, width: 350, height: 600 } })

    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, tue, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    const { groupMoves: moves, release } = rotateDayGroupPositions()
    release()

    expect(moves.length).toBeGreaterThan(0)
    const byNode = new Map(moves.map((m) => [m.nodeId, m.position.x]))
    expect(byNode.get('section-' + wed.id)).toBe(0)
  })
})
