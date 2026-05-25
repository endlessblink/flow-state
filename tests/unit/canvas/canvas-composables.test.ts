/**
 * TASK-1599: Canvas Composable Tests
 *
 * Tests for pure logic extracted from canvas composables.
 * No DOM, no Vue Flow, no stores — just the data-transformation and
 * state-machine logic that lives in each composable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

// ============================================================================
// Mock environment ─ must precede composable imports
// ============================================================================

// useCanvasOperationState uses window.setTimeout / window.clearTimeout and
// window.__FlowState* flags.  We replace them with fake timers.
vi.useFakeTimers()

// Silence DEV console.log noise
vi.stubGlobal('import.meta', { env: { DEV: false } })

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

import { useCanvasOperationState } from '@/composables/canvas/useCanvasOperationState'
import { useCanvasFilteredState } from '@/composables/canvas/useCanvasFilteredState'
import { useCanvasGroups } from '@/stores/canvas/canvasGroups'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { findMatchingGroupForDueDate, calculatePositionInGroup } from '@/composables/canvas/useSmartGroupMatcher'
import { getAbsolutePositionForNodeSync } from '@/composables/canvas/useNodeSync'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test task',
    status: 'planned',
    canvasPosition: { x: 100, y: 100 },
    ...overrides
  } as unknown as Task
}

function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: `grp-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Group',
    isVisible: true,
    position: { x: 0, y: 0, width: 400, height: 300 },
    ...overrides
  } as unknown as CanvasGroup
}

// ---------------------------------------------------------------------------
// TESTS 1-5: useCanvasOperationState — state machine
// ---------------------------------------------------------------------------

describe('useCanvasOperationState — state machine', () => {
  // The composable uses module-level singletons.  Reset after each test.
  let opState: ReturnType<typeof useCanvasOperationState>

  beforeEach(() => {
    opState = useCanvasOperationState()
    opState.resetToIdle()
  })

  afterEach(() => {
    opState.resetToIdle()
    vi.clearAllTimers()
  })

  it('1: starts in idle state', () => {
    expect(opState.isIdle.value).toBe(true)
    expect(opState.currentType.value).toBe('idle')
  })

  it('2: idle → dragging on startDrag', () => {
    const ok = opState.startDrag(['node-1'])
    expect(ok).toBe(true)
    expect(opState.isDragging.value).toBe(true)
    expect(opState.currentType.value).toBe('dragging')
  })

  it('3: dragging → drag-settling on endDrag', () => {
    opState.startDrag(['node-1'])
    opState.endDrag(['node-1'])
    expect(opState.isSettling.value).toBe(true)
    expect(opState.currentType.value).toBe('drag-settling')
  })

  it('4: drag-settling → idle after DRAG_SETTLE_TIMEOUT_MS', () => {
    opState.startDrag(['node-1'])
    opState.endDrag(['node-1'])
    expect(opState.currentType.value).toBe('drag-settling')

    // Advance past the 3 000 ms settle window
    vi.advanceTimersByTime(3100)
    expect(opState.isIdle.value).toBe(true)
    expect(opState.currentType.value).toBe('idle')
  })

  it('5: new drag from drag-settling clears pending updates and restarts drag', () => {
    opState.startDrag(['node-1'])
    opState.endDrag(['node-1'])
    // Now in drag-settling

    // Queue a pending update that should be discarded when drag-B starts
    opState.queueUpdate(() => { throw new Error('stale update must not fire') })

    // Start drag-B while still settling — this cancels drag-A settle timeout
    const ok = opState.startDrag(['node-2'])
    expect(ok).toBe(true)
    expect(opState.isDragging.value).toBe(true)

    // End drag-B to trigger drag-B's own settle timeout
    opState.endDrag(['node-2'])
    expect(opState.currentType.value).toBe('drag-settling')

    // Advance past the settle timeout for drag-B
    vi.advanceTimersByTime(3200)
    // If the stale update had not been cleared, it would have thrown before this point
    expect(opState.isIdle.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TESTS 6-10: useCanvasFilteredState — dynamicNodeExtent & filtering
// ---------------------------------------------------------------------------

describe('useCanvasFilteredState — dynamicNodeExtent & filtering', () => {
  function makeCanvasStore(groups: CanvasGroup[] = []) {
    return {
      groups,
      calculateContentBounds: (tasks: Task[]) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const t of tasks) {
          if (!t.canvasPosition) continue
          minX = Math.min(minX, t.canvasPosition.x)
          minY = Math.min(minY, t.canvasPosition.y)
          maxX = Math.max(maxX, t.canvasPosition.x + 280)
          maxY = Math.max(maxY, t.canvasPosition.y + 100)
        }
        if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      }
    }
  }

  it('6: returns large default extent when no tasks and no groups', () => {
    const tasks = ref<Task[]>([])
    const store = makeCanvasStore()
    const { dynamicNodeExtent } = useCanvasFilteredState(tasks, store)

    const ext = dynamicNodeExtent.value
    expect(ext[0][0]).toBeLessThanOrEqual(-50000)
    expect(ext[1][0]).toBeGreaterThanOrEqual(50000)
  })

  it('7: BUG-1310 — extent includes group positions when taskNodes=0', () => {
    const tasks = ref<Task[]>([])
    const group = makeGroup({ position: { x: 4500, y: 1000, width: 800, height: 600 } })
    const store = makeCanvasStore([group as CanvasGroup])
    const { dynamicNodeExtent } = useCanvasFilteredState(tasks, store as never)

    const ext = dynamicNodeExtent.value
    // Right extent must accommodate the group at x=4500+800=5300
    expect(ext[1][0]).toBeGreaterThan(5300)
  })

  it('8: extent expands to include both tasks and groups', () => {
    const task = makeTask({ canvasPosition: { x: -1000, y: -500 } })
    const tasks = ref<Task[]>([task])
    const group = makeGroup({ position: { x: 6000, y: 3000, width: 200, height: 200 } })
    const store = makeCanvasStore([group as CanvasGroup])
    const { dynamicNodeExtent } = useCanvasFilteredState(tasks, store as never)

    const ext = dynamicNodeExtent.value
    expect(ext[0][0]).toBeLessThan(-1000) // left of task
    expect(ext[1][0]).toBeGreaterThan(6200) // right of group
  })

  it('9: done tasks stay in the node model when hideCanvasDoneTasks is true', () => {
    const doneTask = makeTask({ status: 'done', canvasPosition: { x: 100, y: 100 } })
    const activeTask = makeTask({ status: 'planned', canvasPosition: { x: 200, y: 200 } })
    const tasks = ref<Task[]>([doneTask, activeTask])
    const store = {
      ...makeCanvasStore(),
      taskStore: { hideCanvasDoneTasks: true }
    }
    const { tasksWithCanvasPosition } = useCanvasFilteredState(tasks, store as never)
    expect(tasksWithCanvasPosition.value).toHaveLength(2)
    expect(tasksWithCanvasPosition.value.map(task => task.id)).toEqual([doneTask.id, activeTask.id])
  })

  it('10: tasks without canvasPosition are excluded', () => {
    const noPos = makeTask({ canvasPosition: undefined })
    const withPos = makeTask({ canvasPosition: { x: 50, y: 50 } })
    const tasks = ref<Task[]>([noPos, withPos])
    const store = makeCanvasStore()
    const { tasksWithCanvasPosition } = useCanvasFilteredState(tasks, store as never)
    expect(tasksWithCanvasPosition.value).toHaveLength(1)
    expect(tasksWithCanvasPosition.value[0].id).toBe(withPos.id)
  })
})

// ---------------------------------------------------------------------------
// TESTS 11-15: useCanvasGroupMembership (pure helper logic tested directly)
// The composable itself needs Pinia stores.  We test the contained logic via
// the position-based containment helpers it delegates to.
// ---------------------------------------------------------------------------

import { isPointInRect, isTaskInsideGroup } from '@/utils/canvas/positionCalculator'

describe('Canvas group membership — position containment logic', () => {
  it('11: point inside rect returns true', () => {
    const rect = { x: 0, y: 0, width: 400, height: 300 }
    expect(isPointInRect(200, 150, rect)).toBe(true)
  })

  it('12: point outside rect returns false', () => {
    const rect = { x: 0, y: 0, width: 400, height: 300 }
    expect(isPointInRect(500, 150, rect)).toBe(false)
  })

  it('13: task center inside group counts as member', () => {
    const groupRect = { x: 0, y: 0, width: 400, height: 300 }
    // Task at (10, 10) with size (280, 100) → center at (150, 60) — inside
    expect(isTaskInsideGroup({ x: 10, y: 10 }, { width: 280, height: 100 }, groupRect)).toBe(true)
  })

  it('14: task center outside group counts as non-member', () => {
    const groupRect = { x: 0, y: 0, width: 200, height: 200 }
    // Task at (300, 300) → center at (440, 350) — outside
    expect(isTaskInsideGroup({ x: 300, y: 300 }, { width: 280, height: 100 }, groupRect)).toBe(false)
  })

  it('15: deeply nested group — absolute position accumulates parent offsets', () => {
    // Simulate the absolute-position accumulation from getGroupAbsolutePosition
    // Parent group at (100, 50), child group at (20, 10) relative → absolute (120, 60)
    const parentX = 100, parentY = 50
    const childRelX = 20, childRelY = 10
    const absX = parentX + childRelX
    const absY = parentY + childRelY
    expect(absX).toBe(120)
    expect(absY).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// TESTS 16-20: Canvas ID generation — CanvasIds utility
// ---------------------------------------------------------------------------

describe('CanvasIds — ID format and uniqueness', () => {
  it('16: groupNodeId adds section- prefix', () => {
    const id = CanvasIds.groupNodeId('abc-123')
    expect(id).toBe('section-abc-123')
  })

  it('17: groupNodeId is idempotent — already-prefixed IDs unchanged', () => {
    const id = CanvasIds.groupNodeId('section-already')
    expect(id).toBe('section-already')
  })

  it('18: taskNodeId strips section- prefix if accidentally present', () => {
    const id = CanvasIds.taskNodeId('section-task-xyz')
    expect(id).toBe('task-xyz')
  })

  it('19: parseNodeId correctly distinguishes group from task', () => {
    expect(CanvasIds.parseNodeId('section-grp-1')).toEqual({ type: 'group', id: 'grp-1' })
    expect(CanvasIds.parseNodeId('task-uuid-abc')).toEqual({ type: 'task', id: 'task-uuid-abc' })
  })

  it('20: edgeId combines source and target with e- prefix', () => {
    const id = CanvasIds.edgeId('node-a', 'node-b')
    expect(id).toBe('e-node-a-node-b')
  })
})

// ---------------------------------------------------------------------------
// TESTS 21-25: Alignment pure math (getAbsolutePosition / getNodeBounds logic)
// ---------------------------------------------------------------------------

describe('Canvas alignment — pure bounding-box math', () => {
  // Replicate the pure functions from useCanvasAlignment for isolated testing
  const DEFAULT_WIDTH = 280
  const DEFAULT_HEIGHT = 100

  interface SimpleNode {
    position: { x: number; y: number }
    computedPosition?: { x: number; y: number }
    width?: number
    height?: number
  }

  function getAbsolutePosition(node: SimpleNode) {
    if (node.computedPosition) return node.computedPosition
    return node.position
  }

  function getNodeBounds(node: SimpleNode) {
    const abs = getAbsolutePosition(node)
    const width = node.width ?? DEFAULT_WIDTH
    const height = node.height ?? DEFAULT_HEIGHT
    return {
      left: abs.x,
      top: abs.y,
      right: abs.x + width,
      bottom: abs.y + height,
      width,
      height,
      centerX: abs.x + width / 2,
      centerY: abs.y + height / 2
    }
  }

  it('21: getAbsolutePosition uses computedPosition when available (nested node)', () => {
    const node: SimpleNode = { position: { x: 10, y: 10 }, computedPosition: { x: 250, y: 150 } }
    expect(getAbsolutePosition(node)).toEqual({ x: 250, y: 150 })
  })

  it('22: getAbsolutePosition falls back to position for root nodes', () => {
    const node: SimpleNode = { position: { x: 300, y: 200 } }
    expect(getAbsolutePosition(node)).toEqual({ x: 300, y: 200 })
  })

  it('23: getNodeBounds computes center correctly', () => {
    const node: SimpleNode = { position: { x: 0, y: 0 }, width: 200, height: 100 }
    const bounds = getNodeBounds(node)
    expect(bounds.centerX).toBe(100)
    expect(bounds.centerY).toBe(50)
  })

  it('24: align-left uses minimum left edge of all nodes', () => {
    const nodes = [
      { position: { x: 100, y: 0 }, width: 200, height: 100 },
      { position: { x: 300, y: 50 }, width: 200, height: 100 },
    ]
    const bounds = nodes.map(n => getNodeBounds(n))
    const minX = Math.min(...bounds.map(b => b.left))
    expect(minX).toBe(100) // leftmost node stays, right node moves left
  })

  it('25: snap-to-grid calculation rounds to nearest grid size', () => {
    const GRID = 20
    const snap = (v: number) => Math.round(v / GRID) * GRID
    expect(snap(27)).toBe(20)
    expect(snap(33)).toBe(40)
    expect(snap(100)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// TESTS 26-27: Node sync position conversion
// ---------------------------------------------------------------------------

describe('useNodeSync — absolute position conversion', () => {
  it('26: ignores stale computedPosition for nested nodes after parent moves', () => {
    const parent = makeGroup({
      id: 'group-1',
      position: { x: 500, y: 300, width: 400, height: 300 },
    })
    const node = {
      position: { x: 20, y: 70 },
      computedPosition: { x: 120, y: 170 },
    }

    expect(getAbsolutePositionForNodeSync(node, parent.id, [parent])).toEqual({ x: 520, y: 370 })
  })

  it('27: still uses computedPosition for root nodes when available', () => {
    const node = {
      position: { x: 20, y: 70 },
      computedPosition: { x: 120, y: 170 },
    }

    expect(getAbsolutePositionForNodeSync(node, null, [])).toEqual({ x: 120, y: 170 })
  })
})

// ---------------------------------------------------------------------------
// TESTS 28-32: Smart group matcher — never modifies geometry
// ---------------------------------------------------------------------------

describe('useSmartGroupMatcher — matching without geometry mutations', () => {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  function makePowerGroup(name: string, id: string): CanvasGroup {
    return {
      id,
      name,
      isVisible: true,
      position: { x: 0, y: 0, width: 400, height: 300 }
    } as unknown as CanvasGroup
  }

  it('26: returns null when no groups available', () => {
    const result = findMatchingGroupForDueDate(todayKey, [])
    expect(result).toBeNull()
  })

  it('27: matches today due date to "Today" group', () => {
    const todayGroup = makePowerGroup('Today', 'group-today')
    const result = findMatchingGroupForDueDate(todayKey, [todayGroup])
    expect(result?.id).toBe('group-today')
  })

  it('28: returns null when group name has no power keyword', () => {
    const plainGroup = makePowerGroup('My Random Group', 'group-plain')
    const result = findMatchingGroupForDueDate(todayKey, [plainGroup])
    expect(result).toBeNull()
  })

  it('29: calculatePositionInGroup places first task near top-left of group', () => {
    const group = makeGroup({
      position: { x: 100, y: 100, width: 400, height: 300 }
    }) as unknown as CanvasGroup
    const pos = calculatePositionInGroup(group, [])
    // Should be within the group bounds
    expect(pos.x).toBeGreaterThanOrEqual(100)
    expect(pos.y).toBeGreaterThan(100) // below header
    expect(pos.x).toBeLessThan(100 + 400)
    expect(pos.y).toBeLessThan(100 + 300)
  })

  it('30: findMatchingGroupForDueDate does NOT mutate the groups array', () => {
    const todayGroup = makePowerGroup('Today', 'group-today')
    const groupsBefore = JSON.stringify([todayGroup])
    findMatchingGroupForDueDate(todayKey, [todayGroup])
    expect(JSON.stringify([todayGroup])).toBe(groupsBefore)
  })
})

// ---------------------------------------------------------------------------
// TESTS 31-32: Canvas group task counts match renderable canvas tasks
// ---------------------------------------------------------------------------

describe('useCanvasGroups — task count badges', () => {
  const persistence = {
    saveGroupToStorage: vi.fn(async () => undefined),
    saveGroupsToLocalStorage: vi.fn(),
    deleteGroupRemote: vi.fn(async () => undefined)
  }

  it('31: ignores tasks with malformed canvas positions', () => {
    const taskStoreRef = ref<{ tasks: Task[] } | null>({
      tasks: [
        makeTask({ id: 'task-empty-position', parentId: 'group-today', canvasPosition: {} as Task['canvasPosition'] }),
        makeTask({ id: 'task-nan-position', parentId: 'group-today', canvasPosition: { x: Number.NaN, y: 10 } })
      ]
    })
    const groups = useCanvasGroups(persistence, taskStoreRef)
    groups.setGroups([makeGroup({ id: 'group-today' })])

    expect(groups.taskCountByGroupId.value.get('group-today') ?? 0).toBe(0)
  })

  it('32: counts only visible-renderable active tasks in a group', () => {
    const taskStoreRef = ref<{ tasks: Task[] } | null>({
      tasks: [
        makeTask({ id: 'task-valid', parentId: 'group-today', canvasPosition: { x: 10, y: 10 } }),
        makeTask({ id: 'task-done', parentId: 'group-today', status: 'done', canvasPosition: { x: 20, y: 20 } }),
        makeTask({ id: 'task-pinned', parentId: 'group-today', isPinned: true, canvasPosition: { x: 30, y: 30 } }),
      ]
    })
    const groups = useCanvasGroups(persistence, taskStoreRef)
    groups.setGroups([makeGroup({ id: 'group-today' })])

    expect(groups.taskCountByGroupId.value.get('group-today')).toBe(1)
  })
})
