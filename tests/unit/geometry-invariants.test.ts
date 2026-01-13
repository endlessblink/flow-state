/**
 * Geometry Invariants Tests
 *
 * Tests for TASK-256: Verify the "single writer" rule for geometry fields.
 *
 * INVARIANT: Only drag/resize handlers can modify:
 * - Task: parentId, canvasPosition
 * - Group: parentGroupId, position
 *
 * All other operations (sync, Smart-Groups, watchers) must be READ-ONLY for geometry.
 *
 * @see docs/MASTER_PLAN.md#task-256
 * @see src/composables/canvas/useCanvasInteractions.ts (allowed writer)
 * @see src/composables/canvas/useCanvasSync.ts (must be read-only)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  changedTaskGeometryFields,
  changedGroupGeometryFields,
  createTestTask,
  createTestGroup,
  createTestTaskCollection,
  createTestGroupHierarchy,
  snapshotTaskGeometry,
  snapshotGroupGeometry,
  assertNoTaskGeometryChanged,
  assertNoGroupGeometryChanged,
  cloneTask,
  cloneGroup
} from './helpers/geometry-test-helpers'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas/types'

// Mock the Supabase database composable
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

// Mock Vue Flow context (not available in unit tests)
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    getNodes: { value: [] },
    setNodes: vi.fn(),
    findNode: vi.fn(),
    updateNode: vi.fn(),
    addNodes: vi.fn(),
    removeNodes: vi.fn()
  })
}))

describe('Geometry Invariants', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // HELPER FUNCTION TESTS
  // ============================================================================

  describe('changedTaskGeometryFields helper', () => {
    it('detects parentId change', () => {
      const before = createTestTask({ parentId: undefined })
      const after = createTestTask({ parentId: 'group-1' })

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toContain('parentId')
    })

    it('detects canvasPosition change', () => {
      const before = createTestTask({ canvasPosition: { x: 0, y: 0 } })
      const after = createTestTask({ canvasPosition: { x: 100, y: 200 } })

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toContain('canvasPosition')
    })

    it('detects both parentId and canvasPosition changes', () => {
      const before = createTestTask({
        parentId: undefined,
        canvasPosition: { x: 0, y: 0 }
      })
      const after = createTestTask({
        parentId: 'group-1',
        canvasPosition: { x: 100, y: 200 }
      })

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toEqual(['parentId', 'canvasPosition'])
    })

    it('returns empty array when geometry unchanged', () => {
      const task = createTestTask({
        parentId: 'group-1',
        canvasPosition: { x: 100, y: 100 }
      })
      const before = cloneTask(task)
      const after = { ...cloneTask(task), title: 'Changed Title', status: 'done' as const }

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toEqual([])
    })

    it('handles undefined canvasPosition correctly', () => {
      const before = createTestTask({ canvasPosition: undefined })
      const after = createTestTask({ canvasPosition: { x: 100, y: 100 } })

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toContain('canvasPosition')
    })

    it('ignores sub-pixel position differences', () => {
      const before = createTestTask({ canvasPosition: { x: 100, y: 100 } })
      const after = createTestTask({ canvasPosition: { x: 100.0001, y: 100.0001 } })

      const changed = changedTaskGeometryFields(before, after)

      expect(changed).toEqual([])
    })
  })

  describe('changedGroupGeometryFields helper', () => {
    it('detects parentGroupId change', () => {
      const before = createTestGroup({ parentGroupId: null })
      const after = createTestGroup({ parentGroupId: 'parent-group' })

      const changed = changedGroupGeometryFields(before, after)

      expect(changed).toContain('parentGroupId')
    })

    it('detects position change', () => {
      const before = createTestGroup({
        position: { x: 0, y: 0, width: 300, height: 200 }
      })
      const after = createTestGroup({
        position: { x: 100, y: 50, width: 300, height: 200 }
      })

      const changed = changedGroupGeometryFields(before, after)

      expect(changed).toContain('position')
    })

    it('detects dimension change as position change', () => {
      const before = createTestGroup({
        position: { x: 0, y: 0, width: 300, height: 200 }
      })
      const after = createTestGroup({
        position: { x: 0, y: 0, width: 400, height: 300 }
      })

      const changed = changedGroupGeometryFields(before, after)

      expect(changed).toContain('position')
    })

    it('returns empty array when geometry unchanged', () => {
      const group = createTestGroup()
      const before = cloneGroup(group)
      const after = { ...cloneGroup(group), name: 'Changed Name', color: '#ff0000' }

      const changed = changedGroupGeometryFields(before, after)

      expect(changed).toEqual([])
    })
  })

  // ============================================================================
  // SINGLE-WRITER RULE: TASK DRAG
  // ============================================================================

  describe('Task Drag Geometry Changes', () => {
    it('simulated task drag should only change dragged task geometry', () => {
      // Setup: Multiple tasks
      const { tasks, byId } = createTestTaskCollection()
      const beforeSnapshot = snapshotTaskGeometry(tasks)

      // Simulate: Drag task-1 to new position and into group-1
      const draggedTask = byId.get('task-1')!
      const afterDrag = {
        ...draggedTask,
        canvasPosition: { x: 500, y: 500 },
        parentId: 'group-1'
      }

      // Verify: Only dragged task changed
      const changed = changedTaskGeometryFields(draggedTask, afterDrag)
      expect(changed).toEqual(['parentId', 'canvasPosition'])

      // Verify: Other tasks unchanged
      const task2Before = beforeSnapshot.get('task-2')
      const task2After = { parentId: byId.get('task-2')!.parentId, canvasPosition: byId.get('task-2')!.canvasPosition }
      expect(task2Before).toEqual(task2After)
    })

    it('task drag end only updates the moved task in store', async () => {
      // This test verifies the contract that onNodeDragStop only modifies
      // the task that was actually dragged

      const tasks = [
        createTestTask({ id: 'drag-target', canvasPosition: { x: 0, y: 0 } }),
        createTestTask({ id: 'bystander-1', canvasPosition: { x: 200, y: 0 } }),
        createTestTask({ id: 'bystander-2', canvasPosition: { x: 400, y: 0 } })
      ]

      const beforeSnapshot = new Map(tasks.map(t => [t.id, cloneTask(t)]))

      // Simulate drag end: only drag-target moves
      const dragTarget = tasks.find(t => t.id === 'drag-target')!
      dragTarget.canvasPosition = { x: 100, y: 100 }
      dragTarget.parentId = 'some-group'

      // Verify only drag-target changed
      const dragTargetBefore = beforeSnapshot.get('drag-target')!
      const dragTargetChanged = changedTaskGeometryFields(dragTargetBefore, dragTarget)
      expect(dragTargetChanged).toContain('canvasPosition')
      expect(dragTargetChanged).toContain('parentId')

      // Verify bystanders unchanged
      for (const task of tasks.filter(t => t.id !== 'drag-target')) {
        const before = beforeSnapshot.get(task.id)!
        const changed = changedTaskGeometryFields(before, task)
        expect(changed).toEqual([])
      }
    })
  })

  // ============================================================================
  // SINGLE-WRITER RULE: GROUP DRAG
  // ============================================================================

  describe('Group Drag Geometry Changes', () => {
    it('simulated group drag should only change dragged group geometry', () => {
      const { groups, byId } = createTestGroupHierarchy()
      const beforeSnapshot = snapshotGroupGeometry(groups)

      // Simulate: Drag group-friday to new position
      const draggedGroup = byId.get('group-friday')!
      const newPosition = { x: 800, y: 100, width: 300, height: 300 }

      // Apply the change (simulating what useCanvasInteractions does)
      draggedGroup.position = newPosition

      // Verify: Only dragged group position changed
      const changed = changedGroupGeometryFields(
        { ...byId.get('group-friday')!, position: beforeSnapshot.get('group-friday')!.position },
        draggedGroup
      )
      expect(changed).toContain('position')

      // Verify: Other groups unchanged
      const group1Before = beforeSnapshot.get('group-1')!
      expect(byId.get('group-1')!.position).toEqual(group1Before.position)
    })

    it('group drag into another group changes only parentGroupId and position', () => {
      const { groups } = createTestGroupHierarchy()
      const nestedGroup = groups.find(g => g.id === 'group-2')!
      const beforeSnapshot = cloneGroup(nestedGroup)

      // Simulate: Drag nested group out of its parent (detach)
      nestedGroup.parentGroupId = null
      nestedGroup.position = { x: 1000, y: 500, width: 200, height: 150 }

      const changed = changedGroupGeometryFields(beforeSnapshot, nestedGroup)

      expect(changed).toEqual(['parentGroupId', 'position'])
    })
  })

  // ============================================================================
  // READ-ONLY VERIFICATION: NON-DRAG OPERATIONS
  // ============================================================================

  describe('Non-Geometry Operations Must Not Change Geometry', () => {
    it('metadata updates should not change geometry fields', () => {
      const task = createTestTask({
        parentId: 'group-1',
        canvasPosition: { x: 100, y: 100 }
      })
      const before = cloneTask(task)

      // Simulate metadata update (what Smart-Groups do)
      task.dueDate = '2026-01-15'
      task.status = 'in_progress'
      task.priority = 'high'
      task.tags = ['urgent']

      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(geometryChanged).toEqual([])
    })

    it('group metadata updates should not change geometry fields', () => {
      const group = createTestGroup({
        parentGroupId: 'parent-1',
        position: { x: 100, y: 100, width: 300, height: 200 }
      })
      const before = cloneGroup(group)

      // Simulate metadata update
      group.name = 'Updated Name'
      group.color = '#ff0000'
      group.isCollapsed = true

      const geometryChanged = changedGroupGeometryFields(before, group)
      expect(geometryChanged).toEqual([])
    })

    it('assertNoTaskGeometryChanged throws on geometry mutation', () => {
      const task = createTestTask({ canvasPosition: { x: 0, y: 0 } })
      const beforeMap = new Map([[task.id, cloneTask(task)]])

      // Mutate geometry (simulating a bug)
      task.canvasPosition = { x: 999, y: 999 }
      const afterMap = new Map([[task.id, task]])

      expect(() => assertNoTaskGeometryChanged(beforeMap, afterMap)).toThrow()
    })

    it('assertNoTaskGeometryChanged passes when only metadata changed', () => {
      const task = createTestTask({ canvasPosition: { x: 100, y: 100 } })
      const beforeMap = new Map([[task.id, cloneTask(task)]])

      // Only metadata changes
      task.title = 'New Title'
      task.status = 'done'
      const afterMap = new Map([[task.id, task]])

      expect(() => assertNoTaskGeometryChanged(beforeMap, afterMap)).not.toThrow()
    })
  })

  // ============================================================================
  // BATCH OPERATION VERIFICATION
  // ============================================================================

  describe('Batch Operations Geometry Integrity', () => {
    it('bulk status update preserves all task geometry', () => {
      const { tasks } = createTestTaskCollection()
      const beforeSnapshot = snapshotTaskGeometry(tasks)

      // Simulate bulk status update (e.g., mark all done)
      tasks.forEach(t => {
        t.status = 'done'
        t.progress = 100
      })

      // Verify geometry unchanged for all tasks
      const afterMap = new Map(tasks.map(t => [t.id, t]))
      expect(() => assertNoTaskGeometryChanged(
        new Map(Array.from(beforeSnapshot).map(([id, geo]) => [id, { ...createTestTask(), ...geo }])),
        afterMap
      )).not.toThrow()
    })

    it('project assignment preserves task geometry', () => {
      const task = createTestTask({
        canvasPosition: { x: 100, y: 100 },
        parentId: 'group-1'
      })
      const before = cloneTask(task)

      // Assign to project (should not affect canvas position)
      task.projectId = 'project-123'

      const changed = changedTaskGeometryFields(before, task)
      expect(changed).toEqual([])
    })
  })

  // ============================================================================
  // FUTURE TESTS (TODO)
  // ============================================================================

  describe.skip('Integration: useCanvasInteractions', () => {
    // TODO: These tests require a full Vue component setup with VueFlow context
    // They verify the actual drag handlers work correctly

    it.todo('onNodeDragStop updates task store with new position')
    it.todo('onNodeDragStop updates task parentId based on containment')
    it.todo('onNodeDragStop syncs child tasks when parent group moves')
    it.todo('onSectionResizeEnd updates group position and dimensions')
  })

  describe.skip('Integration: Canvas Store Direct Mutations', () => {
    // TODO: Test actual store mutations to ensure they follow the single-writer rule

    it.todo('updateTask from non-drag source does not change geometry')
    it.todo('updateGroup from non-drag source does not change geometry')
    it.todo('patchGroups respects position locks during sync')
  })

  describe.skip('Stress Test: Concurrent Operations', () => {
    // TODO: Verify geometry stability under rapid operations

    it.todo('rapid drag-drop maintains geometry integrity')
    it.todo('sync during drag does not corrupt positions')
  })
})
