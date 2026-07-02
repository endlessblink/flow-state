/**
 * BUG-1899 (transport half): canvas geometry must have ONE writer.
 *
 * useNodeSync.syncNodePosition used to write positions straight to Supabase
 * with a private optimistic-lock version map. That raced the sync-queue
 * writes from updateTask/updateGroup on the same rows: the queue never
 * updates the private map (constant `[NODE-SYNC] Conflict detected` retries),
 * and the two writers' updated_at race produced `LWW: Server wins … local
 * change DISCARDED` — silently dropping user edits (the "positions reset /
 * moved task reverts" class). Live symptoms also included 20s NODE-SYNC
 * timeouts from onSectionResizeEnd.
 *
 * New contract: syncNodePosition keeps its coordinate math (Vue Flow relative
 * → absolute) but dispatches through the store single-writer paths —
 * taskStore.updateTask / canvasStore.updateGroup — which persist via the sync
 * queue. It must NEVER touch Supabase directly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { CanvasGroup } from '@/types/canvas'

const { mockUpdateTask, mockUpdateGroup, mockSupabaseFrom } = vi.hoisted(() => ({
  mockUpdateTask: vi.fn().mockResolvedValue(undefined),
  mockUpdateGroup: vi.fn().mockResolvedValue(undefined),
  mockSupabaseFrom: vi.fn(() => {
    throw new Error('direct Supabase write from useNodeSync — single-writer violation')
  }),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
}))
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: [],
    updateTask: mockUpdateTask,
  }),
}))
vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    updateGroup: mockUpdateGroup,
  }),
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

import { useNodeSync } from '@/composables/canvas/useNodeSync'

const GROUPS: CanvasGroup[] = [
  {
    id: 'g1',
    name: 'Parent',
    type: 'custom',
    position: { x: 100, y: 100, width: 400, height: 600 },
  } as CanvasGroup,
]

function makeTaskNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'task-1',
    type: 'taskNode',
    position: { x: 50, y: 60 },
    parentNode: 'section-g1',
    data: {},
    ...overrides,
  } as Node
}

function makeGroupNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'section-g2',
    type: 'sectionNode',
    position: { x: 800, y: 200 },
    computedPosition: { x: 800, y: 200 },
    data: { width: 420, height: 900 },
    ...overrides,
  } as Node
}

describe('BUG-1899: useNodeSync routes through the store single-writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('task position sync dispatches taskStore.updateTask (absolute coords + parentId), never Supabase', async () => {
    const { syncNodePosition } = useNodeSync(ref(new Map()))
    const ok = await syncNodePosition('task-1', makeTaskNode(), GROUPS, 'tasks')

    expect(ok).toBe(true)
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
    expect(mockUpdateTask).toHaveBeenCalledTimes(1)
    const [id, updates] = mockUpdateTask.mock.calls[0]
    expect(id).toBe('task-1')
    // relative (50,60) inside g1 at (100,100) → absolute (150,160)
    expect(updates.canvasPosition).toEqual(expect.objectContaining({ x: 150, y: 160 }))
    expect(updates.parentId).toBe('g1')
    expect(updates.positionFormat).toBe('absolute')
  })

  it('group position sync dispatches canvasStore.updateGroup with size, never Supabase', async () => {
    const { syncNodePosition } = useNodeSync(ref(new Map()))
    const ok = await syncNodePosition('g2', makeGroupNode(), GROUPS, 'groups')

    expect(ok).toBe(true)
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
    expect(mockUpdateGroup).toHaveBeenCalledTimes(1)
    const [id, updates] = mockUpdateGroup.mock.calls[0]
    expect(id).toBe('g2')
    expect(updates.position).toEqual(expect.objectContaining({ x: 800, y: 200, width: 420, height: 900 }))
    expect(updates.parentGroupId).toBeNull()
  })

  it('returns false (no throw) when the store write rejects', async () => {
    mockUpdateTask.mockRejectedValueOnce(new Error('store write failed'))
    const { syncNodePosition } = useNodeSync(ref(new Map()))
    const ok = await syncNodePosition('task-1', makeTaskNode(), GROUPS, 'tasks')
    expect(ok).toBe(false)
  })
})
