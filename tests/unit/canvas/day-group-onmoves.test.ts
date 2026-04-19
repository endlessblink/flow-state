/**
 * TASK-1756: Verify the Vue Flow `onMoves` payload.
 *
 * The rotation composable computes target positions but cannot touch Vue
 * Flow state itself (the store is the authoritative reactive source for
 * controlled-mode usage). It therefore hands the moves back to CanvasView
 * via two channels:
 *   1. Return value of `rotateDayGroupPositions()`
 *   2. `options.onMoves` callback when the midnight timer fires
 *
 * If either channel drops the payload or emits the wrong node IDs, the
 * canvas store advances but nothing moves on screen. These tests pin both.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// --- Mocks (must precede composable import) --------------------------------

vi.stubGlobal('import.meta', { env: { DEV: false } })

// Capture the onDayChange callback so we can manually invoke the midnight
// path without waiting for a real timer.
let capturedOnDayChange: ((prev: Date, next: Date) => void) | undefined
vi.mock('@/composables/useDateTransition', () => ({
  useDateTransition: (opts: { onDayChange?: (p: Date, n: Date) => void }) => {
    capturedOnDayChange = opts?.onDayChange
    return {}
  }
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

// --- Imports ---------------------------------------------------------------

import { useDayGroupRotation } from '@/composables/canvas/useDayGroupRotation'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import type { CanvasGroup } from '@/types/canvas'

let idCounter = 0
function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: `grp-${++idCounter}`,
    name: 'Group',
    isVisible: true,
    position: { x: 0, y: 0, width: 350, height: 600 },
    ...overrides
  } as unknown as CanvasGroup
}

// Wednesday 2026-04-08 — matches existing position-rotation test suite
const WEDNESDAY = new Date(2026, 3, 8, 0, 0, 0, 0)

describe('useDayGroupRotation() — onMoves / Vue Flow bridge', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let settingsStore: ReturnType<typeof useSettingsStore>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(WEDNESDAY)
    setActivePinia(createPinia())
    capturedOnDayChange = undefined

    canvasStore = useCanvasStore()
    taskStore = useTaskStore()
    settingsStore = useSettingsStore()
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(() => {})
    vi.spyOn(taskStore, 'updateTask').mockImplementation(() => {})
    ;(settingsStore as any).enableDayGroupPositionRotation = true
    ;(settingsStore as any).enableDayGroupSuggestions = true
    ;(settingsStore as any).weekStartsOn = 1
    mockCanvasSyncInProgress.value = false
    idCounter = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('return value carries section-prefixed Vue Flow node IDs, not raw group IDs', () => {
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const { rotateDayGroupPositions } = useDayGroupRotation()
    const { moves, release } = rotateDayGroupPositions()
    release()

    expect(moves.length).toBeGreaterThan(0)
    for (const move of moves) {
      // CanvasView calls findNode(nodeId) which expects 'section-<groupId>'
      expect(move.nodeId.startsWith('section-')).toBe(true)
      expect(move.nodeId).not.toBe('grp-mon')
      expect(move.nodeId).not.toBe('grp-wed')
    }
  })

  it('onMoves callback fires at midnight with the computed move payload', () => {
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const onMoves = vi.fn()
    useDayGroupRotation({ onMoves })

    expect(capturedOnDayChange).toBeTypeOf('function')
    // Simulate midnight transition
    capturedOnDayChange!(WEDNESDAY, new Date(2026, 3, 9))

    expect(onMoves).toHaveBeenCalledTimes(1)
    const payload = onMoves.mock.calls[0][0] as Array<{ nodeId: string; position: { x: number; y: number } }>
    expect(payload.length).toBeGreaterThan(0)
    // Every node ID is the Vue-Flow-prefixed form
    for (const m of payload) {
      expect(m.nodeId.startsWith('section-')).toBe(true)
    }
  })

  it('onMoves is NOT called when midnight rotation has no work to do', () => {
    // Already in correct order → no moves
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const thu = makeGroup({ id: 'grp-thu', name: 'Thursday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([wed, thu])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const onMoves = vi.fn()
    useDayGroupRotation({ onMoves })

    capturedOnDayChange!(WEDNESDAY, new Date(2026, 3, 9))

    expect(onMoves).not.toHaveBeenCalled()
  })

  it('onMoves is NOT called when feature flag is off', () => {
    ;(settingsStore as any).enableDayGroupPositionRotation = false

    const mon = makeGroup({ name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const onMoves = vi.fn()
    useDayGroupRotation({ onMoves })

    capturedOnDayChange!(WEDNESDAY, new Date(2026, 3, 9))

    expect(onMoves).not.toHaveBeenCalled()
  })

  it('getNodePosition is used in preference to store position when provided', () => {
    // Store says Mon=0 / Wed=350, but Vue Flow says Mon=1000 / Wed=1350 (user
    // dragged them but store is stale). Rotation must use the Vue Flow values
    // so the visible nodes swap correctly.
    const mon = makeGroup({ id: 'grp-mon', name: 'Monday', position: { x: 0, y: 0, width: 350, height: 600 } })
    const wed = makeGroup({ id: 'grp-wed', name: 'Wednesday', position: { x: 350, y: 0, width: 350, height: 600 } })
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue([mon, wed])
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])

    const getNodePosition = vi.fn((nodeId: string) => {
      if (nodeId === 'section-grp-mon') return { x: 1000, y: 0 }
      if (nodeId === 'section-grp-wed') return { x: 1350, y: 0 }
      return undefined
    })

    const { rotateDayGroupPositions } = useDayGroupRotation({ getNodePosition })
    const { moves, release } = rotateDayGroupPositions()
    release()

    // Slots are the Vue Flow Xs sorted: [1000, 1350]. Wed (today) → slot 0 = 1000.
    const wedMove = moves.find((m) => m.nodeId === 'section-grp-wed')
    expect(wedMove?.position.x).toBe(1000)
    const monMove = moves.find((m) => m.nodeId === 'section-grp-mon')
    expect(monMove?.position.x).toBe(1350)
  })

})
