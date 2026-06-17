/**
 * TASK-1871: NO-OP write guards (the API rate-limit storm fix).
 *
 * The day-group layout (tidy/rotation) emitted a move for EVERY group/task even
 * when the position was unchanged (x=1616 -> 1616). Re-running it re-wrote
 * identical positions → hundreds of saves → "API rate limit exceeded" → auth/sync
 * cascade. These tests pin the fix:
 *   1. rotateDayGroupPositions is IDEMPOTENT — once positions are canonical, a
 *      second run emits ZERO moves (no storm).
 *   2. updateGroup skips a write entirely when the position is unchanged (the
 *      systemic guard, so ANY caller is storm-proof — verified via positionVersion
 *      not advancing on a no-op).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/composables/useDateTransition', () => ({
  useDateTransition: () => ({}),
}))
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
    saveGroup: vi.fn(), deleteGroup: vi.fn(),
    fetchGroups: vi.fn().mockResolvedValue([]), fetchTasks: vi.fn().mockResolvedValue([]),
    saveTask: vi.fn(), saveTasks: vi.fn(), deleteTask: vi.fn(),
  }),
}))

import { useDayGroupRotation } from '@/composables/canvas/useDayGroupRotation'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import type { CanvasGroup } from '@/types/canvas'

const WEDNESDAY = new Date(2026, 3, 8, 0, 0, 0, 0)
const mkGroup = (id: string, name: string, x: number): CanvasGroup => ({
  id, name, isVisible: true, position: { x, y: 0, width: 350, height: 600 },
} as unknown as CanvasGroup)

describe('layout no-op skip (TASK-1871)', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let settingsStore: ReturnType<typeof useSettingsStore>

  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(WEDNESDAY)
    setActivePinia(createPinia())
    canvasStore = useCanvasStore(); taskStore = useTaskStore(); settingsStore = useSettingsStore()
    ;(settingsStore as any).enableDayGroupPositionRotation = true
    ;(settingsStore as any).enableDayGroupSuggestions = true
    ;(settingsStore as any).weekStartsOn = 1
    mockCanvasSyncInProgress.value = false
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('rotation is idempotent: a second run after applying the moves emits ZERO moves', () => {
    const groups = [mkGroup('grp-wed', 'Wednesday', 0), mkGroup('grp-thu', 'Thursday', 350)]
    vi.spyOn(canvasStore, 'groups', 'get').mockReturnValue(groups)
    vi.spyOn(taskStore, 'rawTasks', 'get').mockReturnValue([])
    vi.spyOn(canvasStore, 'updateGroup').mockImplementation(() => {})
    vi.spyOn(taskStore, 'updateTask').mockImplementation(() => {})

    const { rotateDayGroupPositions } = useDayGroupRotation()

    // First run produces the canonical moves.
    const first = rotateDayGroupPositions()
    first.release()
    expect(first.groupMoves.length).toBeGreaterThan(0)

    // Apply the moves to the store (what the app does), so positions are now canonical.
    for (const m of first.groupMoves) {
      const id = m.nodeId.replace(/^section-/, '')
      const g = groups.find((x) => x.id === id)
      if (g) g.position = { x: m.position.x, y: m.position.y, width: m.size.width, height: m.size.height }
    }

    // Second run: every move is now a no-op → filtered out → ZERO moves (no storm).
    const second = rotateDayGroupPositions()
    second.release()
    expect(second.groupMoves.length, 'idempotent re-run must emit no moves').toBe(0)
  })

  it('updateGroup skips the write when position is unchanged (no version bump)', async () => {
    const g = mkGroup('grp-x', 'Custom', 100)
    g.positionVersion = 5
    canvasStore.setGroups([g])

    // No-op: identical position → must not bump positionVersion / write.
    await canvasStore.updateGroup('grp-x', { position: { x: 100, y: 0, width: 350, height: 600 } })
    expect(canvasStore.groups.find((x) => x.id === 'grp-x')?.positionVersion).toBe(5)

    // Real change → version advances.
    await canvasStore.updateGroup('grp-x', { position: { x: 500, y: 0, width: 350, height: 600 } })
    expect(canvasStore.groups.find((x) => x.id === 'grp-x')?.positionVersion).toBe(6)
  })
})
