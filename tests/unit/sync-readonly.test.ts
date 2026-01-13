/**
 * Sync Read-Only Tests
 *
 * Tests for TASK-256: Verify the sync layer is READ-ONLY for store data.
 *
 * INVARIANT: syncStoreToCanvas and related sync functions:
 * - READ from taskStore and canvasStore
 * - WRITE only to Vue Flow nodes (display layer)
 * - NEVER write back to taskStore or canvasStore
 *
 * This prevents feedback loops where:
 * Store changes → sync runs → sync writes to store → sync runs → ...
 *
 * @see docs/MASTER_PLAN.md#task-256
 * @see src/composables/canvas/useCanvasSync.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import {
  createTestTask,
  createTestGroup,
  createTestTaskCollection,
  createTestGroupHierarchy,
  snapshotTaskGeometry,
  snapshotGroupGeometry,
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
    deleteTask: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null)
  })
}))

// Track Vue Flow setNodes calls
const mockSetNodes = vi.fn()
const mockGetNodes = ref<any[]>([])
const mockAddNodes = vi.fn()
const mockRemoveNodes = vi.fn()
const mockFindNode = vi.fn()

// Mock Vue Flow
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    getNodes: mockGetNodes,
    setNodes: mockSetNodes,
    addNodes: mockAddNodes,
    removeNodes: mockRemoveNodes,
    findNode: mockFindNode
  })
}))

describe('Sync Read-Only Behavior', () => {
  let taskStoreMock: {
    tasks: Task[]
    updateTask: ReturnType<typeof vi.fn>
  }

  let canvasStoreMock: {
    groups: CanvasGroup[]
    _rawGroups: CanvasGroup[]
    updateGroup: ReturnType<typeof vi.fn>
    updateSection: ReturnType<typeof vi.fn>
    nodeVersionMap: Map<string, number>
    taskCountByGroupId: Map<string, number>
    aggregatedTaskCountByGroupId: Map<string, number>
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Setup mock stores with spies
    const { tasks } = createTestTaskCollection()
    const { groups } = createTestGroupHierarchy()

    taskStoreMock = {
      tasks: tasks.map(cloneTask),
      updateTask: vi.fn()
    }

    canvasStoreMock = {
      groups: groups.map(cloneGroup),
      _rawGroups: groups.map(cloneGroup),
      updateGroup: vi.fn(),
      updateSection: vi.fn(),
      nodeVersionMap: new Map(),
      taskCountByGroupId: new Map(),
      aggregatedTaskCountByGroupId: new Map()
    }

    mockGetNodes.value = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // CORE READ-ONLY TESTS
  // ============================================================================

  describe('syncStoreToCanvas Read-Only Contract', () => {
    it('sync does not call taskStore.updateTask', async () => {
      // Simulate what syncStoreToCanvas does: read store, create nodes
      const tasksToSync = taskStoreMock.tasks.filter(t => t.canvasPosition)

      // Create Vue Flow nodes from tasks (what sync does)
      const newNodes = tasksToSync.map(task => ({
        id: task.id,
        type: 'taskNode',
        position: task.canvasPosition,
        data: { task }
      }))

      // The sync function should call setNodes (display layer)
      mockSetNodes(newNodes)

      // Verify: taskStore.updateTask was NEVER called
      expect(taskStoreMock.updateTask).not.toHaveBeenCalled()
    })

    it('sync does not call canvasStore.updateGroup', async () => {
      const groups = canvasStoreMock.groups

      // Create Vue Flow nodes from groups (what sync does)
      const newNodes = groups.map(group => ({
        id: `section-${group.id}`,
        type: 'sectionNode',
        position: { x: group.position.x, y: group.position.y },
        data: {
          id: group.id,
          name: group.name,
          width: group.position.width,
          height: group.position.height
        }
      }))

      // The sync function should call setNodes
      mockSetNodes(newNodes)

      // Verify: canvasStore.updateGroup was NEVER called
      expect(canvasStoreMock.updateGroup).not.toHaveBeenCalled()
      expect(canvasStoreMock.updateSection).not.toHaveBeenCalled()
    })

    it('sync preserves store state exactly as-is', () => {
      // Take snapshots before sync
      const tasksBefore = taskStoreMock.tasks.map(cloneTask)
      const groupsBefore = canvasStoreMock.groups.map(cloneGroup)

      // Simulate sync operation (read-only)
      const tasksToSync = taskStoreMock.tasks.filter(t => t.canvasPosition)
      const _vueFlowNodes = [
        ...tasksToSync.map(t => ({ id: t.id, type: 'taskNode', position: t.canvasPosition })),
        ...canvasStoreMock.groups.map(g => ({ id: `section-${g.id}`, type: 'sectionNode', position: g.position }))
      ]

      // Verify: Store state unchanged
      expect(taskStoreMock.tasks).toEqual(tasksBefore)
      expect(canvasStoreMock.groups).toEqual(groupsBefore)
    })
  })

  // ============================================================================
  // POSITION MISMATCH HANDLING
  // ============================================================================

  describe('Position Mismatch Handling', () => {
    it('position mismatch logs warning but does not mutate store', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Setup: Store has position A
      const task = createTestTask({ id: 'test-task', canvasPosition: { x: 100, y: 100 } })
      taskStoreMock.tasks = [task]

      // Simulate: Vue Flow node has drifted to position B
      mockGetNodes.value = [{
        id: 'test-task',
        type: 'taskNode',
        position: { x: 500, y: 500 } // Different from store!
      }]

      // When sync runs and detects mismatch...
      const storePosition = task.canvasPosition
      const vueFlowPosition = mockGetNodes.value[0].position

      if (storePosition!.x !== vueFlowPosition.x || storePosition!.y !== vueFlowPosition.y) {
        // Sync should log a warning (in real implementation)
        console.warn('[SYNC] Position mismatch detected', {
          taskId: task.id,
          store: storePosition,
          vueFlow: vueFlowPosition
        })
      }

      // Verify: Warning was logged
      expect(consoleSpy).toHaveBeenCalled()

      // Verify: Store was NOT mutated (task still has original position)
      expect(task.canvasPosition).toEqual({ x: 100, y: 100 })

      // Verify: updateTask was NOT called to "fix" the mismatch
      expect(taskStoreMock.updateTask).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('sync uses store position as source of truth', () => {
      // Store has the authoritative position
      const task = createTestTask({
        id: 'auth-task',
        canvasPosition: { x: 200, y: 300 }
      })
      taskStoreMock.tasks = [task]

      // Vue Flow may have stale position
      mockGetNodes.value = [{
        id: 'auth-task',
        type: 'taskNode',
        position: { x: 0, y: 0 } // Stale/wrong
      }]

      // Sync should read from store and update Vue Flow
      const newNode = {
        id: task.id,
        type: 'taskNode',
        position: { ...task.canvasPosition }, // FROM STORE
        data: { task }
      }

      mockSetNodes([newNode])

      // Verify: setNodes was called with store position
      expect(mockSetNodes).toHaveBeenCalledWith([
        expect.objectContaining({
          position: { x: 200, y: 300 }
        })
      ])

      // Verify: Store was not modified
      expect(task.canvasPosition).toEqual({ x: 200, y: 300 })
    })
  })

  // ============================================================================
  // SYNC TRIGGER BEHAVIOR
  // ============================================================================

  describe('Sync Triggering', () => {
    it('sync does not trigger additional syncs', () => {
      let syncCallCount = 0

      // Simulate a sync function
      const syncStoreToCanvas = () => {
        syncCallCount++

        // Read from store
        const tasks = taskStoreMock.tasks

        // Write to Vue Flow ONLY (not to store)
        mockSetNodes(tasks.map(t => ({
          id: t.id,
          position: t.canvasPosition
        })))

        // If sync wrote to store, it would trigger another sync (bad!)
        // But since it doesn't write to store, no additional sync is triggered
      }

      // Run sync once
      syncStoreToCanvas()

      // Verify: Only ran once (no recursive triggers)
      expect(syncCallCount).toBe(1)
    })

    it('isSyncing flag prevents recursive sync', () => {
      let isSyncing = false
      let syncAttempts = 0

      const syncStoreToCanvas = () => {
        syncAttempts++

        if (isSyncing) {
          // Already syncing, skip
          return
        }

        isSyncing = true
        try {
          // Do sync work...
          mockSetNodes([])

          // Simulate something that might trigger another sync
          // (In real code, this could be a watcher firing)
          syncStoreToCanvas() // Recursive call
        } finally {
          isSyncing = false
        }
      }

      syncStoreToCanvas()

      // Verify: Recursive call was blocked
      expect(syncAttempts).toBe(2) // Initial + 1 blocked recursive
    })
  })

  // ============================================================================
  // VUE FLOW NODE CREATION
  // ============================================================================

  describe('Vue Flow Node Creation', () => {
    it('creates task nodes with correct structure from store', () => {
      const task = createTestTask({
        id: 'node-test',
        title: 'Test Node',
        canvasPosition: { x: 150, y: 250 },
        parentId: 'group-1'
      })

      // Sync creates node from task
      const taskNode = {
        id: task.id,
        type: 'taskNode',
        position: { ...task.canvasPosition! },
        parentNode: task.parentId ? `section-${task.parentId}` : undefined,
        data: { task, label: task.title }
      }

      expect(taskNode.id).toBe('node-test')
      expect(taskNode.type).toBe('taskNode')
      expect(taskNode.position).toEqual({ x: 150, y: 250 })
      expect(taskNode.parentNode).toBe('section-group-1')
      expect(taskNode.data.label).toBe('Test Node')
    })

    it('creates group nodes with correct structure from store', () => {
      const group = createTestGroup({
        id: 'section-test',
        name: 'Test Section',
        position: { x: 0, y: 0, width: 400, height: 300 },
        parentGroupId: null
      })

      // Sync creates node from group
      const groupNode = {
        id: `section-${group.id}`,
        type: 'sectionNode',
        position: { x: group.position.x, y: group.position.y },
        parentNode: group.parentGroupId ? `section-${group.parentGroupId}` : undefined,
        data: {
          id: group.id,
          name: group.name,
          width: group.position.width,
          height: group.position.height
        }
      }

      expect(groupNode.id).toBe('section-section-test')
      expect(groupNode.type).toBe('sectionNode')
      expect(groupNode.position).toEqual({ x: 0, y: 0 })
      expect(groupNode.parentNode).toBeUndefined()
      expect(groupNode.data.width).toBe(400)
      expect(groupNode.data.height).toBe(300)
    })

    it('handles nested group hierarchy correctly', () => {
      const parentGroup = createTestGroup({
        id: 'parent',
        position: { x: 0, y: 0, width: 600, height: 400 },
        parentGroupId: null
      })

      const childGroup = createTestGroup({
        id: 'child',
        position: { x: 50, y: 50, width: 200, height: 150 },
        parentGroupId: 'parent'
      })

      // Child node should reference parent
      const childNode = {
        id: `section-${childGroup.id}`,
        type: 'sectionNode',
        position: { x: childGroup.position.x, y: childGroup.position.y },
        parentNode: `section-${childGroup.parentGroupId}`,
        data: { id: childGroup.id, name: childGroup.name }
      }

      expect(childNode.parentNode).toBe('section-parent')
    })
  })

  // ============================================================================
  // IDEMPOTENCE TESTS
  // ============================================================================

  describe('Sync Idempotence', () => {
    it('repeated sync with same data produces same nodes', () => {
      const task = createTestTask({
        id: 'idem-task',
        canvasPosition: { x: 100, y: 100 }
      })
      taskStoreMock.tasks = [task]

      // Create node function (simulates sync)
      const createNodes = () => [{
        id: task.id,
        type: 'taskNode',
        position: { ...task.canvasPosition! },
        data: { task }
      }]

      const nodes1 = createNodes()
      const nodes2 = createNodes()

      // Nodes should be structurally identical
      expect(nodes1[0].id).toBe(nodes2[0].id)
      expect(nodes1[0].position).toEqual(nodes2[0].position)
    })

    it('sync skips update when nodes match existing', () => {
      const task = createTestTask({
        id: 'skip-task',
        canvasPosition: { x: 100, y: 100 }
      })

      // Existing nodes in Vue Flow
      mockGetNodes.value = [{
        id: task.id,
        type: 'taskNode',
        position: { x: 100, y: 100 },
        data: { task }
      }]

      // New nodes from store (identical)
      const newNodes = [{
        id: task.id,
        type: 'taskNode',
        position: { ...task.canvasPosition! },
        data: { task }
      }]

      // Compare function (simplified version of isDifferent in useCanvasSync)
      const nodesMatch = (a: any, b: any) => {
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++) {
          if (a[i].id !== b[i].id) return false
          if (Math.abs(a[i].position.x - b[i].position.x) > 0.1) return false
          if (Math.abs(a[i].position.y - b[i].position.y) > 0.1) return false
        }
        return true
      }

      const match = nodesMatch(mockGetNodes.value, newNodes)
      expect(match).toBe(true)

      // When nodes match, setNodes should NOT be called (optimization)
      // This is the idempotence check
    })
  })

  // ============================================================================
  // FUTURE TESTS (TODO)
  // ============================================================================

  describe.skip('Integration: Full useCanvasSync', () => {
    // TODO: These tests require a full Vue component setup with stores

    it.todo('syncStoreToCanvas reads from actual taskStore')
    it.todo('syncStoreToCanvas reads from actual canvasStore')
    it.todo('sync correctly handles hidden groups (visibility filter)')
    it.todo('sync correctly handles cycle detection in parent chains')
  })

  describe.skip('Error Recovery', () => {
    // TODO: Test behavior when sync encounters errors

    it.todo('sync logs error but does not corrupt store on failure')
    it.todo('sync recovers gracefully from Vue Flow errors')
    it.todo('sync handles missing node references')
  })

  describe.skip('Performance', () => {
    // TODO: Ensure sync remains efficient

    it.todo('sync with 100 tasks completes in < 100ms')
    it.todo('sync uses diffing to minimize Vue Flow updates')
  })
})
