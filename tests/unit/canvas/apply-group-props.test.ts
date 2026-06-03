/**
 * TASK-1811 — Apply a group's due date / properties to the tasks inside it.
 *
 * Covers `applyGroupPropsToTasks(groupId, mode)` in
 * src/composables/canvas/useCanvasTaskActions.ts:
 *  1. mode 'dueDate' applies ONLY the group's resolved dueDate to its children.
 *  2. mode 'all' applies the full resolved property set (priority/status too).
 *  3. Children are filtered: done / soft-deleted / completion-record / pinned
 *     tasks and tasks in other groups are excluded.
 *  4. Updates are metadata-only — no position / parentId / canvasPosition.
 *  5. A group with no resolvable dueDate applies nothing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

// ─── Mutable mock state ──────────────────────────────────────────────────────
let rawTasksValue: any[] = []
let rawGroupsValue: any[] = []
let resolvedPropsValue: Record<string, unknown> = {}

const mockBulkUpdateTasksWithUndo = vi.fn().mockResolvedValue(undefined)
const mockShowToast = vi.fn()

vi.mock('@/stores/tasks', () => ({
    useTaskStore: () => ({
        get _rawTasks() { return rawTasksValue },
        tasks: [],
        bulkUpdateTasksWithUndo: mockBulkUpdateTasksWithUndo,
    }),
}))

vi.mock('@/stores/canvas', () => ({
    useCanvasStore: () => ({
        get _rawGroups() { return rawGroupsValue },
        get groups() { return rawGroupsValue },
    }),
}))

vi.mock('@/stores/canvas/modals', () => ({
    useCanvasModalsStore: () => ({
        isBulkDeleteModalOpen: ref(false),
        bulkDeleteItems: ref([]),
        bulkDeleteIsPermanent: ref(false),
        isQuickTaskCreateOpen: ref(false),
        quickTaskPosition: ref({ x: 0, y: 0 }),
        groupInheritedProps: ref(null),
    }),
}))

vi.mock('@/stores/canvasImages', () => ({
    useCanvasImagesStore: () => ({ images: [], removeCanvasImage: vi.fn() }),
}))

vi.mock('@/composables/undoSingleton', () => ({ pushImageDeleteUndo: vi.fn() }))

vi.mock('@vue-flow/core', () => ({
    useVueFlow: () => ({ getNodes: ref([]), setNodes: vi.fn() }),
}))

vi.mock('@/utils/deletedGroupsTracker', () => ({
    markGroupDeleted: vi.fn(),
    confirmGroupDeleted: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

// getSectionProperties is the resolver; return our controlled resolved props.
vi.mock('@/composables/canvas/useCanvasSectionProperties', () => ({
    useCanvasSectionProperties: () => ({
        getSectionProperties: () => resolvedPropsValue,
    }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDeps() {
    return {
        syncNodes: vi.fn(),
        syncEdges: vi.fn(),
        closeCanvasContextMenu: vi.fn(),
        screenToFlowCoordinate: vi.fn().mockReturnValue({ x: 0, y: 0 }),
        recentlyDeletedGroups: ref(new Set<string>()),
        undoHistory: {},
    }
}

function task(overrides: Record<string, unknown>) {
    return { status: 'planned', dueDate: '', _soft_deleted: false, isCompletionRecord: false, isPinned: false, ...overrides }
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('TASK-1811 — applyGroupPropsToTasks', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
        rawTasksValue = []
        rawGroupsValue = [{ id: 'g1', name: 'Today', position: { x: 0, y: 0, width: 300, height: 400 } }]
        resolvedPropsValue = { dueDate: '2026-06-01', priority: 'high', status: 'in_progress' }
    })

    it("mode 'dueDate' applies ONLY the dueDate to eligible children", async () => {
        const { useCanvasTaskActions } = await import('@/composables/canvas/useCanvasTaskActions')
        rawTasksValue = [
            task({ id: 't1', parentId: 'g1', dueDate: 'old', priority: 'low' }),
            task({ id: 't2', parentId: 'g1' }),
        ]
        const actions = useCanvasTaskActions(buildDeps() as any)

        const res = await actions.applyGroupPropsToTasks('g1', 'dueDate')

        expect(res).toEqual({ success: true, count: 2 })
        expect(mockBulkUpdateTasksWithUndo).toHaveBeenCalledTimes(1)
        const payload = mockBulkUpdateTasksWithUndo.mock.calls[0][0]
        expect(payload).toEqual([
            { id: 't1', updates: { dueDate: '2026-06-01' } },
            { id: 't2', updates: { dueDate: '2026-06-01' } },
        ])
        // Metadata-only — no geometry leaked in.
        for (const { updates } of payload) {
            expect(updates).not.toHaveProperty('parentId')
            expect(updates).not.toHaveProperty('canvasPosition')
            expect(updates).not.toHaveProperty('position')
        }
    })

    it("mode 'all' applies the full resolved property set", async () => {
        const { useCanvasTaskActions } = await import('@/composables/canvas/useCanvasTaskActions')
        rawTasksValue = [task({ id: 't1', parentId: 'g1' })]
        const actions = useCanvasTaskActions(buildDeps() as any)

        await actions.applyGroupPropsToTasks('g1', 'all')

        const payload = mockBulkUpdateTasksWithUndo.mock.calls[0][0]
        expect(payload[0].updates).toEqual({ dueDate: '2026-06-01', priority: 'high', status: 'in_progress' })
    })

    it('excludes done / soft-deleted / completion-record / pinned tasks and other groups', async () => {
        const { useCanvasTaskActions } = await import('@/composables/canvas/useCanvasTaskActions')
        rawTasksValue = [
            task({ id: 'keep', parentId: 'g1' }),
            task({ id: 'done', parentId: 'g1', status: 'done' }),
            task({ id: 'deleted', parentId: 'g1', _soft_deleted: true }),
            task({ id: 'record', parentId: 'g1', isCompletionRecord: true }),
            task({ id: 'pinned', parentId: 'g1', isPinned: true }),
            task({ id: 'other', parentId: 'g2' }),
        ]
        const actions = useCanvasTaskActions(buildDeps() as any)

        const res = await actions.applyGroupPropsToTasks('g1', 'dueDate')

        expect(res.count).toBe(1)
        const payload = mockBulkUpdateTasksWithUndo.mock.calls[0][0]
        expect(payload.map((p: any) => p.id)).toEqual(['keep'])
    })

    it('applies nothing when the group has no resolvable dueDate', async () => {
        const { useCanvasTaskActions } = await import('@/composables/canvas/useCanvasTaskActions')
        resolvedPropsValue = {} // no dueDate
        rawTasksValue = [task({ id: 't1', parentId: 'g1' })]
        const actions = useCanvasTaskActions(buildDeps() as any)

        const res = await actions.applyGroupPropsToTasks('g1', 'dueDate')

        expect(res).toEqual({ success: false, count: 0 })
        expect(mockBulkUpdateTasksWithUndo).not.toHaveBeenCalled()
    })

    it('reports zero and skips the write when the group has no eligible tasks', async () => {
        const { useCanvasTaskActions } = await import('@/composables/canvas/useCanvasTaskActions')
        rawTasksValue = [task({ id: 'done', parentId: 'g1', status: 'done' })]
        const actions = useCanvasTaskActions(buildDeps() as any)

        const res = await actions.applyGroupPropsToTasks('g1', 'dueDate')

        expect(res).toEqual({ success: true, count: 0 })
        expect(mockBulkUpdateTasksWithUndo).not.toHaveBeenCalled()
    })
})
