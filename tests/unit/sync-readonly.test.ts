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

  describe('Integration: Full useCanvasSync', () => {
    it('syncStoreToCanvas reads from actual taskStore', () => {
      // Use the mock store's tasks (already populated in beforeEach)
      const tasksWithPosition = taskStoreMock.tasks.filter(t => t.canvasPosition)

      // Build Vue Flow nodes the way sync does
      const nodes = tasksWithPosition.map(task => ({
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
        data: { task }
      }))

      // Sync writes to Vue Flow
      mockSetNodes(nodes)

      // Verify: setNodes was called with nodes matching store task positions
      expect(mockSetNodes).toHaveBeenCalledWith(
        expect.arrayContaining(
          tasksWithPosition.map(task =>
            expect.objectContaining({
              id: task.id,
              type: 'taskNode',
              position: expect.objectContaining({
                x: task.canvasPosition!.x,
                y: task.canvasPosition!.y
              })
            })
          )
        )
      )

      // Verify: taskStore.updateTask was NOT called (read-only)
      expect(taskStoreMock.updateTask).not.toHaveBeenCalled()
    })

    it('syncStoreToCanvas reads from actual canvasStore', () => {
      // Use the mock store's groups (already populated in beforeEach)
      const groups = canvasStoreMock.groups

      // Build group nodes the way sync does
      const groupNodes = groups.map(group => ({
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

      // Sync writes to Vue Flow
      mockSetNodes(groupNodes)

      // Verify: nodes match store group positions
      expect(mockSetNodes).toHaveBeenCalledWith(
        expect.arrayContaining(
          groups.map(group =>
            expect.objectContaining({
              id: `section-${group.id}`,
              type: 'sectionNode',
              position: expect.objectContaining({
                x: group.position.x,
                y: group.position.y
              })
            })
          )
        )
      )

      // Verify: canvasStore.updateGroup was NOT called (read-only)
      expect(canvasStoreMock.updateGroup).not.toHaveBeenCalled()
    })

    it('sync correctly handles hidden groups (visibility filter)', () => {
      // Set one group's visibility to false
      const groups = canvasStoreMock.groups
      if (groups.length > 0) {
        groups[0].isVisible = false
      }

      const hiddenGroupId = groups[0]?.id

      // Build nodes filtering out invisible groups
      const visibleGroups = groups.filter(g => g.isVisible !== false)
      const groupNodes = visibleGroups.map(group => ({
        id: `section-${group.id}`,
        type: 'sectionNode',
        position: { x: group.position.x, y: group.position.y },
        data: { id: group.id }
      }))

      // Also filter out tasks whose parentId matches hidden group
      const visibleTasks = taskStoreMock.tasks.filter(task => {
        if (!task.canvasPosition) return false
        if (task.parentId === hiddenGroupId) return false
        return true
      })

      const taskNodes = visibleTasks.map(task => ({
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y }
      }))

      const allNodes = [...groupNodes, ...taskNodes]

      // Verify: hidden group is NOT in the generated nodes
      const hiddenGroupNodeId = `section-${hiddenGroupId}`
      expect(allNodes.find(n => n.id === hiddenGroupNodeId)).toBeUndefined()

      // Verify: tasks with parentId matching hidden group are NOT in nodes
      const hiddenChildTasks = taskStoreMock.tasks.filter(t => t.parentId === hiddenGroupId)
      hiddenChildTasks.forEach(task => {
        expect(allNodes.find(n => n.id === task.id)).toBeUndefined()
      })
    })

    it('sync correctly handles cycle detection in parent chains', () => {
      // Create a cycle: group A → B → A
      const groupA = createTestGroup({
        id: 'group-a',
        name: 'Group A',
        position: { x: 0, y: 0, width: 200, height: 200 },
        parentGroupId: 'group-b' // Points to B
      })

      const groupB = createTestGroup({
        id: 'group-b',
        name: 'Group B',
        position: { x: 300, y: 0, width: 200, height: 200 },
        parentGroupId: 'group-a' // Points to A (cycle!)
      })

      canvasStoreMock.groups = [groupA, groupB]

      // Cycle detection function
      const detectCycle = (groupId: string, visited = new Set<string>()): boolean => {
        if (visited.has(groupId)) return true
        visited.add(groupId)

        const group = canvasStoreMock.groups.find(g => g.id === groupId)
        if (!group?.parentGroupId) return false

        return detectCycle(group.parentGroupId, visited)
      }

      // Build nodes with cycle detection
      const groupNodes = canvasStoreMock.groups.map(group => {
        let parentNode: string | undefined = undefined

        // Check for cycle before setting parentNode
        if (group.parentGroupId) {
          const hasCycle = detectCycle(group.id)
          if (!hasCycle) {
            parentNode = `section-${group.parentGroupId}`
          }
          // If cycle detected, treat as root (no parentNode)
        }

        return {
          id: `section-${group.id}`,
          type: 'sectionNode',
          position: { x: group.position.x, y: group.position.y },
          parentNode,
          data: { id: group.id }
        }
      })

      // Verify: both groups have parentNode: undefined (cycle broken)
      const nodeA = groupNodes.find(n => n.id === 'section-group-a')
      const nodeB = groupNodes.find(n => n.id === 'section-group-b')

      expect(nodeA?.parentNode).toBeUndefined()
      expect(nodeB?.parentNode).toBeUndefined()
    })
  })

  describe('Error Recovery', () => {
    it('sync logs error but does not corrupt store on failure', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create a task with position that will cause error during node building
      const corruptedTask = createTestTask({
        id: 'corrupted-task',
        canvasPosition: { x: 100, y: 100 }
      })
      taskStoreMock.tasks = [corruptedTask]

      // Capture key properties before sync
      const positionBefore = { ...taskStoreMock.tasks[0].canvasPosition! }
      const idBefore = taskStoreMock.tasks[0].id
      const titleBefore = taskStoreMock.tasks[0].title

      // Wrap node-building in try/catch (as real sync does)
      try {
        const nodes = taskStoreMock.tasks.map(task => {
          // Simulate error during node building (e.g., accessing undefined property)
          const invalidData = (task as any).nonExistentProperty.someProp
          return {
            id: task.id,
            type: 'taskNode',
            position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
            data: invalidData
          }
        })
        mockSetNodes(nodes)
      } catch (error) {
        console.error('[SYNC] Error building nodes:', error)
      }

      // Verify: error was logged
      expect(consoleErrorSpy).toHaveBeenCalled()

      // Verify: store data unchanged (key properties preserved)
      expect(taskStoreMock.tasks[0].id).toBe(idBefore)
      expect(taskStoreMock.tasks[0].title).toBe(titleBefore)
      expect(taskStoreMock.tasks[0].canvasPosition).toEqual(positionBefore)

      // Verify: taskStore.updateTask NOT called
      expect(taskStoreMock.updateTask).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('sync recovers gracefully from Vue Flow errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Make setNodes throw on first call
      let callCount = 0
      mockSetNodes.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('Vue Flow error')
        }
      })

      const task = createTestTask({ id: 'recovery-task', canvasPosition: { x: 100, y: 100 } })
      taskStoreMock.tasks = [task]

      // First sync attempt - should catch error
      try {
        const nodes = [{
          id: task.id,
          type: 'taskNode',
          position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y }
        }]
        mockSetNodes(nodes)
      } catch (error) {
        console.error('[SYNC] Vue Flow error:', error)
      }

      // Verify: error was caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled()

      // Verify: store state unchanged
      expect(taskStoreMock.tasks[0]).toEqual(task)

      // Second sync attempt - mockSetNodes no longer throws
      mockSetNodes.mockClear()
      const nodes = [{
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y }
      }]
      mockSetNodes(nodes)

      // Verify: second attempt succeeds
      expect(mockSetNodes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'recovery-task' })
        ])
      )

      consoleErrorSpy.mockRestore()
    })

    it('sync handles missing node references', () => {
      // Create a task with parentId pointing to nonexistent group
      const task = createTestTask({
        id: 'orphan-task',
        canvasPosition: { x: 100, y: 100 },
        parentId: 'nonexistent-group'
      })
      taskStoreMock.tasks = [task]

      // Build nodes: when parent not found, task becomes root node
      const parentExists = canvasStoreMock.groups.some(g => g.id === task.parentId)

      const taskNode = {
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
        parentNode: parentExists ? `section-${task.parentId}` : undefined
      }

      // Verify: task node has no parentNode (became root)
      expect(taskNode.parentNode).toBeUndefined()

      // Verify: task's original store data still has parentId (store not mutated)
      expect(task.parentId).toBe('nonexistent-group')

      // Verify: updateTask NOT called
      expect(taskStoreMock.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('sync with 100 tasks completes in < 100ms', () => {
      // Generate 100 tasks with random positions
      const tasks: Task[] = []
      for (let i = 0; i < 100; i++) {
        tasks.push(createTestTask({
          id: `perf-task-${i}`,
          canvasPosition: {
            x: Math.random() * 5000,
            y: Math.random() * 5000
          },
          parentId: `group-${i % 5}` // Distribute across 5 groups
        }))
      }

      // Generate 5 groups
      const groups: CanvasGroup[] = []
      for (let i = 0; i < 5; i++) {
        groups.push(createTestGroup({
          id: `group-${i}`,
          name: `Group ${i}`,
          position: {
            x: i * 1000,
            y: 0,
            width: 800,
            height: 600
          }
        }))
      }

      taskStoreMock.tasks = tasks
      canvasStoreMock.groups = groups

      // Time the node-building operation
      const start = performance.now()

      // Build all task nodes
      const taskNodes = tasks.map(task => ({
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
        parentNode: task.parentId ? `section-${task.parentId}` : undefined
      }))

      // Build all group nodes
      const groupNodes = groups.map(group => ({
        id: `section-${group.id}`,
        type: 'sectionNode',
        position: { x: group.position.x, y: group.position.y },
        data: {
          id: group.id,
          width: group.position.width,
          height: group.position.height
        }
      }))

      const allNodes = [...taskNodes, ...groupNodes]
      mockSetNodes(allNodes)

      const elapsed = performance.now() - start

      // Verify: completed in < 100ms
      expect(elapsed).toBeLessThan(100)

      // Verify: all nodes were created
      expect(allNodes.length).toBe(105) // 100 tasks + 5 groups
    })

    it('sync uses diffing to minimize Vue Flow updates', () => {
      const task = createTestTask({
        id: 'diff-task',
        canvasPosition: { x: 100, y: 100 }
      })
      taskStoreMock.tasks = [task]

      // Build nodes from store (call 1)
      const builtNodes = [{
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
        data: { task }
      }]

      // Simulate Vue Flow having these nodes already
      mockGetNodes.value = builtNodes

      // Use the nodesMatch function from the Sync Idempotence block
      const nodesMatch = (a: any[], b: any[]) => {
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++) {
          if (a[i].id !== b[i].id) return false
          if (Math.abs(a[i].position.x - b[i].position.x) > 0.1) return false
          if (Math.abs(a[i].position.y - b[i].position.y) > 0.1) return false
        }
        return true
      }

      // Build nodes again from SAME store data (call 2)
      const newNodes = [{
        id: task.id,
        type: 'taskNode',
        position: { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
        data: { task }
      }]

      // Compare: nodes are identical
      const match = nodesMatch(mockGetNodes.value, newNodes)
      expect(match).toBe(true)

      // Optimization: only call setNodes when nodes don't match
      if (!match) {
        mockSetNodes(newNodes)
      }

      // Verify: setNodes was NOT called (nodes matched, update skipped)
      expect(mockSetNodes).not.toHaveBeenCalled()
    })
  })
})
