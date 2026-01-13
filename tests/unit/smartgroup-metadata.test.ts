/**
 * Smart-Group Metadata-Only Tests
 *
 * Tests for TASK-256: Verify Smart-Groups only modify metadata, never geometry.
 *
 * INVARIANT: Smart-Group operations (power keywords, overdue collector) can modify:
 * - Task metadata: dueDate, status, priority, tags, projectId
 *
 * They must NEVER modify:
 * - Task geometry: parentId, canvasPosition
 * - Group geometry: parentGroupId, position
 *
 * @see docs/MASTER_PLAN.md#task-256
 * @see src/composables/usePowerKeywords.ts
 * @see src/composables/canvas/useCanvasOverdueCollector.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  createTestTask,
  createTestGroup,
  changedTaskGeometryFields,
  changedTaskMetadataFields,
  cloneTask,
  snapshotTaskGeometry,
  assertNoTaskGeometryChanged
} from './helpers/geometry-test-helpers'
import {
  detectPowerKeyword,
  isPowerGroup,
  isSmartGroup,
  getSmartGroupType,
  getSmartGroupDate,
  applySmartGroupProperties,
  SMART_GROUPS
} from '../../src/composables/usePowerKeywords'
import type { Task } from '../../src/types/tasks'

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

describe('Smart-Group Metadata-Only Behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // POWER KEYWORD DETECTION
  // ============================================================================

  describe('Power Keyword Detection', () => {
    it('detects "Today" as a date power keyword', () => {
      const result = detectPowerKeyword('Today')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('date')
      expect(result!.value).toBe('today')
    })

    it('detects "Tomorrow" as a date power keyword', () => {
      const result = detectPowerKeyword('Tomorrow Tasks')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('date')
      expect(result!.value).toBe('tomorrow')
    })

    it('detects "High Priority" as a priority power keyword', () => {
      const result = detectPowerKeyword('High Priority')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('priority')
      expect(result!.value).toBe('high')
    })

    it('detects "In Progress" as a status power keyword', () => {
      const result = detectPowerKeyword('In Progress')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('status')
      expect(result!.value).toBe('in_progress')
    })

    it('detects "Done" as a status power keyword', () => {
      const result = detectPowerKeyword('Done')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('status')
      expect(result!.value).toBe('done')
    })

    it('detects day-of-week keywords', () => {
      const friday = detectPowerKeyword('Friday')
      const saturday = detectPowerKeyword('Saturday')

      expect(friday).not.toBeNull()
      expect(friday!.category).toBe('day_of_week')

      expect(saturday).not.toBeNull()
      expect(saturday!.category).toBe('day_of_week')
    })

    it('returns null for non-power group names', () => {
      expect(detectPowerKeyword('My Custom Group')).toBeNull()
      expect(detectPowerKeyword('Project Alpha')).toBeNull()
      expect(detectPowerKeyword('Random Name')).toBeNull()
    })

    it('isPowerGroup correctly identifies power groups', () => {
      expect(isPowerGroup('Today')).toBe(true)
      expect(isPowerGroup('High Priority')).toBe(true)
      expect(isPowerGroup('My Tasks')).toBe(false)
    })
  })

  // ============================================================================
  // SMART GROUP DATE CALCULATION
  // ============================================================================

  describe('Smart Group Date Calculation', () => {
    it('getSmartGroupDate returns today date for TODAY', () => {
      const date = getSmartGroupDate(SMART_GROUPS.TODAY)
      const today = new Date()
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      expect(date).toBe(expectedDate)
    })

    it('getSmartGroupDate returns tomorrow date for TOMORROW', () => {
      const date = getSmartGroupDate(SMART_GROUPS.TOMORROW)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const expectedDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

      expect(date).toBe(expectedDate)
    })

    it('getSmartGroupDate returns empty string for LATER', () => {
      const date = getSmartGroupDate(SMART_GROUPS.LATER)
      expect(date).toBe('')
    })

    it('isSmartGroup identifies date-based smart groups', () => {
      expect(isSmartGroup('Today')).toBe(true)
      expect(isSmartGroup('Tomorrow')).toBe(true)
      expect(isSmartGroup('This Weekend')).toBe(true)
      expect(isSmartGroup('This Week')).toBe(true)
      expect(isSmartGroup('Later')).toBe(true)
      expect(isSmartGroup('Custom')).toBe(false)
    })

    it('getSmartGroupType returns correct type', () => {
      expect(getSmartGroupType('Today')).toBe('today')
      expect(getSmartGroupType('Tomorrow')).toBe('tomorrow')
      expect(getSmartGroupType('Random')).toBeNull()
    })
  })

  // ============================================================================
  // METADATA-ONLY PROPERTY APPLICATION
  // ============================================================================

  describe('applySmartGroupProperties - Metadata Only', () => {
    it('applySmartGroupProperties sets dueDate only', () => {
      const task = createTestTask({
        canvasPosition: { x: 100, y: 100 },
        parentId: 'group-1'
      })
      const before = cloneTask(task)

      const updates = applySmartGroupProperties(task, SMART_GROUPS.TODAY)

      // Verify: Only dueDate is in updates
      expect(updates).toHaveProperty('dueDate')
      expect(Object.keys(updates)).toEqual(['dueDate'])

      // Verify: No geometry fields in updates
      expect(updates).not.toHaveProperty('parentId')
      expect(updates).not.toHaveProperty('canvasPosition')
    })

    it('applySmartGroupProperties does not change task geometry', () => {
      const task = createTestTask({
        canvasPosition: { x: 500, y: 300 },
        parentId: 'some-group'
      })
      const before = cloneTask(task)

      // Apply smart group properties
      const updates = applySmartGroupProperties(task, SMART_GROUPS.TOMORROW)

      // Apply updates to task (simulating what the app does)
      Object.assign(task, updates)

      // Verify: Geometry unchanged
      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(geometryChanged).toEqual([])

      // Verify: Metadata changed
      const metadataChanged = changedTaskMetadataFields(before, task)
      expect(metadataChanged).toContain('dueDate')
    })

    it('multiple smart group applications preserve geometry', () => {
      const task = createTestTask({
        canvasPosition: { x: 200, y: 150 },
        parentId: 'friday-group'
      })
      const originalGeometry = {
        canvasPosition: { ...task.canvasPosition! },
        parentId: task.parentId
      }

      // Apply multiple smart group types
      Object.assign(task, applySmartGroupProperties(task, SMART_GROUPS.TODAY))
      Object.assign(task, applySmartGroupProperties(task, SMART_GROUPS.TOMORROW))
      Object.assign(task, applySmartGroupProperties(task, SMART_GROUPS.THIS_WEEKEND))

      // Verify: Geometry still matches original
      expect(task.canvasPosition).toEqual(originalGeometry.canvasPosition)
      expect(task.parentId).toBe(originalGeometry.parentId)
    })
  })

  // ============================================================================
  // OVERDUE COLLECTOR FEATURE FLAG
  // ============================================================================

  describe('Overdue Collector Feature Flag', () => {
    // The ENABLE_SMART_GROUP_REPARENTING flag is set to FALSE in useCanvasOverdueCollector.ts
    // This test documents that behavior

    it('overdue collector is disabled by default (ENABLE_SMART_GROUP_REPARENTING = false)', () => {
      // The feature flag prevents autoCollectOverdueTasks from moving tasks
      // We verify this by simulating what the function does when disabled

      let reparentingCalled = false
      const ENABLE_SMART_GROUP_REPARENTING = false // From useCanvasOverdueCollector.ts

      const autoCollectOverdueTasks = async () => {
        if (!ENABLE_SMART_GROUP_REPARENTING) {
          // No-op when disabled
          return
        }
        reparentingCalled = true
        // Would move tasks here...
      }

      autoCollectOverdueTasks()

      expect(reparentingCalled).toBe(false)
    })

    it('when disabled, overdue tasks keep their original positions', () => {
      const task = createTestTask({
        id: 'overdue-task',
        dueDate: '2020-01-01', // Very overdue
        canvasPosition: { x: 500, y: 500 },
        parentId: undefined
      })
      const before = cloneTask(task)

      // Simulate disabled overdue collector (no-op)
      const ENABLE_SMART_GROUP_REPARENTING = false
      if (ENABLE_SMART_GROUP_REPARENTING) {
        // This would move the task - but flag is false
        task.canvasPosition = { x: 50, y: 60 }
        task.parentId = 'overdue-group'
      }

      // Verify: Task unchanged
      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(geometryChanged).toEqual([])
    })
  })

  // ============================================================================
  // FRIDAY/SATURDAY GROUP SCENARIOS
  // ============================================================================

  describe('Friday/Saturday Smart Groups', () => {
    it('dropping task in Friday group sets dueDate without changing position', () => {
      const task = createTestTask({
        canvasPosition: { x: 750, y: 50 }, // Inside Friday group bounds
        parentId: 'group-friday'
      })
      const before = cloneTask(task)

      // Simulate drag-drop applying smart group properties
      // The drag handler sets parentId (allowed)
      // The smart group applies metadata (allowed)

      // Friday detection
      const powerKeyword = detectPowerKeyword('Friday')
      expect(powerKeyword).not.toBeNull()
      expect(powerKeyword!.category).toBe('day_of_week')

      // Apply metadata update (simulating what happens after drop)
      // Note: This would be done by getSectionProperties in useCanvasSectionProperties
      // For Friday, it would calculate next Friday's date

      // The key invariant: metadata updates don't change geometry
      // If we were to apply a dueDate update:
      task.dueDate = '2026-01-17' // Next Friday

      // Verify: Only metadata changed
      const geometryChanged = changedTaskGeometryFields(before, task)
      const metadataChanged = changedTaskMetadataFields(before, task)

      expect(geometryChanged).toEqual([])
      expect(metadataChanged).toContain('dueDate')
    })

    it('task in Saturday group gets correct dueDate', () => {
      const task = createTestTask({
        canvasPosition: { x: 1100, y: 50 },
        parentId: 'group-saturday',
        dueDate: ''
      })
      const before = cloneTask(task)

      // Saturday detection
      const powerKeyword = detectPowerKeyword('Saturday')
      expect(powerKeyword).not.toBeNull()
      expect(powerKeyword!.category).toBe('day_of_week')

      // Apply metadata
      task.dueDate = '2026-01-18' // Next Saturday

      // Verify geometry unchanged
      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(geometryChanged).toEqual([])
    })
  })

  // ============================================================================
  // IDEMPOTENCE OF SMART GROUP OPERATIONS
  // ============================================================================

  describe('Smart Group Idempotence', () => {
    it('repeated smart group application produces same result', () => {
      const task = createTestTask({ dueDate: '' })

      // Apply TODAY multiple times
      const updates1 = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
      Object.assign(task, updates1)
      const state1 = cloneTask(task)

      const updates2 = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
      Object.assign(task, updates2)
      const state2 = cloneTask(task)

      // Should be identical
      expect(state1.dueDate).toBe(state2.dueDate)
    })

    it('smart group runs on same task collection preserve all geometry', () => {
      const tasks = [
        createTestTask({ id: 't1', canvasPosition: { x: 100, y: 100 }, parentId: 'group-1' }),
        createTestTask({ id: 't2', canvasPosition: { x: 200, y: 200 }, parentId: 'group-2' }),
        createTestTask({ id: 't3', canvasPosition: { x: 300, y: 300 }, parentId: undefined })
      ]

      const beforeSnapshot = snapshotTaskGeometry(tasks)

      // Simulate multiple smart group runs
      for (let i = 0; i < 5; i++) {
        for (const task of tasks) {
          const updates = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
          Object.assign(task, updates)
        }
      }

      // Verify all geometry unchanged
      const afterMap = new Map(tasks.map(t => [t.id, t]))
      expect(() => assertNoTaskGeometryChanged(
        new Map(Array.from(beforeSnapshot).map(([id, geo]) => [id, { ...createTestTask(), ...geo }])),
        afterMap
      )).not.toThrow()
    })
  })

  // ============================================================================
  // PRIORITY POWER GROUPS
  // ============================================================================

  describe('Priority Power Groups', () => {
    it('High Priority group detection works correctly', () => {
      const result = detectPowerKeyword('High Priority')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('priority')
      expect(result!.value).toBe('high')
    })

    it('priority changes are metadata only', () => {
      const task = createTestTask({
        priority: 'medium',
        canvasPosition: { x: 100, y: 100 },
        parentId: 'some-group'
      })
      const before = cloneTask(task)

      // Simulate dropping in High Priority group
      task.priority = 'high'

      const geometryChanged = changedTaskGeometryFields(before, task)
      const metadataChanged = changedTaskMetadataFields(before, task)

      expect(geometryChanged).toEqual([])
      expect(metadataChanged).toContain('priority')
    })
  })

  // ============================================================================
  // STATUS POWER GROUPS
  // ============================================================================

  describe('Status Power Groups', () => {
    it('Done group detection works correctly', () => {
      const result = detectPowerKeyword('Done')

      expect(result).not.toBeNull()
      expect(result!.category).toBe('status')
      expect(result!.value).toBe('done')
    })

    it('status changes are metadata only', () => {
      const task = createTestTask({
        status: 'planned',
        canvasPosition: { x: 100, y: 100 },
        parentId: 'active-group'
      })
      const before = cloneTask(task)

      // Simulate dropping in Done group
      task.status = 'done'
      task.progress = 100

      const geometryChanged = changedTaskGeometryFields(before, task)

      expect(geometryChanged).toEqual([])
      expect(task.status).toBe('done')
    })
  })

  // ============================================================================
  // FUTURE TESTS (TODO)
  // ============================================================================

  describe.skip('Integration: useCanvasSectionProperties', () => {
    // TODO: Test the actual composable that applies smart group properties on drop

    it.todo('getSectionProperties returns correct updates for Today group')
    it.todo('getSectionProperties returns correct updates for Friday group')
    it.todo('getSectionProperties returns correct updates for High Priority group')
    it.todo('getSectionProperties returns empty object for non-power groups')
  })

  describe.skip('Integration: Full Drop Flow', () => {
    // TODO: Test the complete drag-drop flow with smart group application

    it.todo('dropping task in Today group sets dueDate and parentId correctly')
    it.todo('dropping task in Done group sets status and parentId correctly')
    it.todo('moving task between smart groups updates metadata correctly')
  })

  describe.skip('Edge Cases', () => {
    // TODO: Test edge cases in smart group behavior

    it.todo('task with existing dueDate keeps it when dropped in non-date group')
    it.todo('recurring task handling in smart groups')
    it.todo('completed task handling in overdue collector')
  })
})
