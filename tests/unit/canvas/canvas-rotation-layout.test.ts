/**
 * TASK-1788: unit coverage for useCanvasRotationLayout — the composable
 * extracted from CanvasView.vue (BUG-1786/BUG-1787 fixes lived inside the
 * SFC, only reachable via E2E). These tests pin the previously-uncovered
 * paths: applyCanonicalTaskMoves findNode null-retry and
 * handleRotateDayGroups canvasSyncInProgress pre-acquire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, nextTick } from 'vue'

// ============================================================================
// Mocks — order matters; hoisted spies must be defined before module imports.
// ============================================================================

vi.stubGlobal('import.meta', { env: { DEV: false } })

const {
  mockCanvasSyncInProgress,
  mockFindNode,
  mockUpdateNode,
  mockSetNodes,
  mockApplyNodeChanges,
  mockGetViewport,
  mockNodes,
  mockRotateDayGroups,
  mockRotateDayGroupPositions,
  mockRunCatchupIfNeeded,
  mockTidyDayGroups,
} = vi.hoisted(() => {
  const { ref: refImpl } = require('vue')
  return {
    mockCanvasSyncInProgress: refImpl(false),
    mockFindNode: vi.fn(),
    mockUpdateNode: vi.fn(),
    mockSetNodes: vi.fn(),
    mockApplyNodeChanges: vi.fn(),
    mockGetViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    mockNodes: refImpl<any[]>([]),
    mockRotateDayGroups: vi.fn(),
    mockRotateDayGroupPositions: vi.fn(),
    mockRunCatchupIfNeeded: vi.fn(),
    mockTidyDayGroups: vi.fn(),
  }
})

vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    findNode: mockFindNode,
    updateNode: mockUpdateNode,
    setNodes: mockSetNodes,
    applyNodeChanges: mockApplyNodeChanges,
    getViewport: mockGetViewport,
    nodes: mockNodes,
  }),
}))

vi.mock('@/composables/canvas/useCanvasSync', () => ({
  canvasSyncInProgress: mockCanvasSyncInProgress,
  isWritingBackStaleParents: { value: false },
}))

vi.mock('@/composables/canvas/useDayGroupRotation', () => ({
  useDayGroupRotation: () => ({
    rotateDayGroups: mockRotateDayGroups,
    rotateDayGroupPositions: mockRotateDayGroupPositions,
    runCatchupIfNeeded: mockRunCatchupIfNeeded,
    rotatedGroupsCount: ref(0),
    lastRotationTime: ref<Date | null>(null),
    showBanner: ref(false),
    dismissBanner: vi.fn(),
  }),
}))

vi.mock('@/composables/canvas/useTidyLayout', () => ({
  useTidyLayout: () => ({
    tidyDayGroups: mockTidyDayGroups,
  }),
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

import { useCanvasRotationLayout } from '@/composables/canvas/useCanvasRotationLayout'

// ============================================================================
// Helpers
// ============================================================================

const makeDeps = () => ({
  syncNodes: vi.fn(),
  handleNodesChange: vi.fn(),
  currentDay: ref(new Date('2026-05-17T10:00:00')),
})

const makeVfNode = (id: string, position = { x: 0, y: 0 }) => ({
  id,
  position,
  computedPosition: { x: position.x, y: position.y },
  width: 200,
  height: 100,
})

// ============================================================================
// Tests
// ============================================================================

describe('useCanvasRotationLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockCanvasSyncInProgress.value = false
    mockNodes.value = []
    mockFindNode.mockReset()
    mockUpdateNode.mockReset()
    mockSetNodes.mockReset()
    mockApplyNodeChanges.mockReset()
    mockGetViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 })
    mockRotateDayGroups.mockReset()
    mockRotateDayGroupPositions.mockReset()
    mockRunCatchupIfNeeded.mockReset()
    mockTidyDayGroups.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // applyCanonicalTaskMoves — null-retry path (BUG-1787)
  // ==========================================================================

  describe('applyCanonicalTaskMoves — null-retry path (BUG-1787)', () => {
    it('1: retries missing task nodes on nextTick when findNode initially returns null', async () => {
      // First call → null (not materialized). Second call (after nextTick) → real node.
      // CanvasIds.taskNodeId('abc') === 'abc' (no prefix for tasks).
      const taskNodeId = 'abc'
      let callCount = 0
      mockFindNode.mockImplementation((id: string) => {
        if (id === `section-grp-1`) return makeVfNode('section-grp-1', { x: 100, y: 100 })
        if (id === taskNodeId) {
          callCount++
          return callCount === 1 ? null : makeVfNode(taskNodeId, { x: 0, y: 0 })
        }
        return null
      })

      const { applyCanonicalTaskMoves } = useCanvasRotationLayout(makeDeps())

      applyCanonicalTaskMoves(
        [{ taskId: 'abc', parentId: 'grp-1', position: { x: 120, y: 130 } }],
        [{ groupId: 'grp-1', position: { x: 100, y: 100 } }]
      )

      // First pass: no updateNode call (findNode returned null → pushed to missing)
      expect(mockUpdateNode).not.toHaveBeenCalled()

      // Run pending nextTick — retry fires
      await nextTick()
      await nextTick() // recursive applyCanonicalTaskMoves does its own setNodes pass

      // Retry should have written: relative position = (120-100, 130-100) = (20, 30)
      expect(mockUpdateNode).toHaveBeenCalledWith(taskNodeId, expect.objectContaining({
        position: { x: 20, y: 30 },
        parentNode: 'section-grp-1',
      }))
    })

    it('2: logs [BUG-1787] warning when task nodes still missing after nextTick retry', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // findNode always returns null — task is truly missing
      mockFindNode.mockReturnValue(null)

      const { applyCanonicalTaskMoves } = useCanvasRotationLayout(makeDeps())

      applyCanonicalTaskMoves(
        [{ taskId: 'abcd1234', parentId: 'grp-1', position: { x: 50, y: 60 } }],
        []
      )

      await nextTick()
      await nextTick()

      expect(warnSpy).toHaveBeenCalled()
      const [msg, ids] = warnSpy.mock.calls[0]
      expect(msg).toMatch(/\[BUG-1787\]/)
      expect(msg).toMatch(/1\/1 task nodes still not found/)
      expect(ids).toContain('abcd1234')

      warnSpy.mockRestore()
    })

    it('3: does not infinitely retry — retry runs at most once', async () => {
      // findNode returns null on FIRST task-lookup call, then real node afterwards.
      // Parent group is always present. The retry should fire ONCE, then the
      // recursive applyCanonicalTaskMoves call sees the real task node, writes
      // updateNode, and stops — no second retry queued.
      const taskNodeId = 'loop'
      let taskCalls = 0
      mockFindNode.mockImplementation((id: string) => {
        if (id === taskNodeId) {
          taskCalls++
          return taskCalls <= 1 ? null : makeVfNode(taskNodeId)
        }
        if (id === 'section-g') return makeVfNode('section-g', { x: 0, y: 0 })
        return null
      })

      const { applyCanonicalTaskMoves } = useCanvasRotationLayout(makeDeps())
      applyCanonicalTaskMoves(
        [{ taskId: 'loop', parentId: 'g', position: { x: 10, y: 10 } }],
        [{ groupId: 'g', position: { x: 0, y: 0 } }]
      )

      await nextTick()
      await nextTick()
      await nextTick()
      await nextTick()

      // updateNode should be called exactly ONCE (during the retry).
      // If we were looping, this count would be 2+.
      expect(mockUpdateNode).toHaveBeenCalledTimes(1)
    })

    it('4: uses target group position from groupMoves for relative coord math', () => {
      const taskNodeId = 't1'
      mockFindNode.mockImplementation((id: string) => {
        if (id === taskNodeId) return makeVfNode(taskNodeId)
        return null
      })

      const { applyCanonicalTaskMoves } = useCanvasRotationLayout(makeDeps())

      // Task absolute (200, 300), parent moved to (50, 70) → expect relative (150, 230)
      applyCanonicalTaskMoves(
        [{ taskId: 't1', parentId: 'grp-x', position: { x: 200, y: 300 } }],
        [{ groupId: 'grp-x', position: { x: 50, y: 70 } }]
      )

      expect(mockUpdateNode).toHaveBeenCalledWith(taskNodeId, expect.objectContaining({
        position: { x: 150, y: 230 },
        parentNode: 'section-grp-x',
      }))
    })

    it('5: falls back to findNode for parent position when groupMoves omits the target', () => {
      const taskNodeId = 't2'
      mockFindNode.mockImplementation((id: string) => {
        if (id === taskNodeId) return makeVfNode(taskNodeId)
        if (id === 'section-grp-fallback') return makeVfNode('section-grp-fallback', { x: 80, y: 90 })
        return null
      })

      const { applyCanonicalTaskMoves } = useCanvasRotationLayout(makeDeps())

      applyCanonicalTaskMoves(
        [{ taskId: 't2', parentId: 'grp-fallback', position: { x: 200, y: 200 } }],
        [], // empty groupMoves → must fall back to findNode
      )

      expect(mockUpdateNode).toHaveBeenCalledWith(taskNodeId, expect.objectContaining({
        position: { x: 120, y: 110 }, // 200-80, 200-90
      }))
    })
  })

  // ==========================================================================
  // handleRotateDayGroups — sync-lock pre-acquire (BUG-1787)
  // ==========================================================================

  describe('handleRotateDayGroups — sync-lock pre-acquire (BUG-1787)', () => {
    it('6: pre-acquires canvasSyncInProgress=true BEFORE rotateDayGroups fires', () => {
      let capturedLockValue: boolean | undefined
      mockRotateDayGroups.mockImplementation(() => {
        capturedLockValue = mockCanvasSyncInProgress.value
      })
      mockRotateDayGroupPositions.mockReturnValue({
        groupMoves: [],
        taskMoves: [],
        pendingWrites: Promise.resolve(),
        release: vi.fn(),
      })

      const { handleRotateDayGroups } = useCanvasRotationLayout(makeDeps())
      handleRotateDayGroups()

      // The captured value must be `true` because handleRotateDayGroups should
      // have set the lock BEFORE invoking rotateDayGroups. If the pre-acquire
      // were removed, this would be `false` (rotateDayGroupPositions sets it
      // later inside the composable, not before rotateDayGroups).
      expect(capturedLockValue).toBe(true)
    })

    it('7: calls the release closure returned by rotateDayGroupPositions after pendingWrites resolve', async () => {
      const releaseSpy = vi.fn()
      mockRotateDayGroups.mockImplementation(() => {})
      mockRotateDayGroupPositions.mockReturnValue({
        groupMoves: [],
        taskMoves: [],
        pendingWrites: Promise.resolve(),
        release: releaseSpy,
      })

      const { handleRotateDayGroups } = useCanvasRotationLayout(makeDeps())
      handleRotateDayGroups()

      // Wait for double nextTick + microtask flush
      await nextTick()
      await nextTick()
      // The pendingWrites promise's .finally chain runs after a microtask.
      await Promise.resolve()
      await Promise.resolve()

      expect(releaseSpy).toHaveBeenCalledTimes(1)
    })
  })
})
