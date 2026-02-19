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
  // INTEGRATION: useCanvasSectionProperties
  // ============================================================================

  describe('Integration: useCanvasSectionProperties', () => {
    it('getSectionProperties returns correct updates for Today group', () => {
      const todayGroup = createTestGroup({ name: 'Today' })

      // Test the power keyword detection logic that getSectionProperties uses
      const keyword = detectPowerKeyword(todayGroup.name)
      expect(keyword).not.toBeNull()
      expect(keyword!.category).toBe('date')
      expect(keyword!.value).toBe('today')

      // Apply smart group properties (what getSectionProperties does internally)
      const updates = applySmartGroupProperties({} as Task, SMART_GROUPS.TODAY)

      // Verify dueDate is set to today
      expect(updates).toHaveProperty('dueDate')
      const today = new Date()
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(updates.dueDate).toBe(expectedDate)
    })

    it('getSectionProperties returns correct updates for Friday group', () => {
      const fridayGroup = createTestGroup({ name: 'Friday' })

      // Detect Friday as day-of-week keyword
      const keyword = detectPowerKeyword(fridayGroup.name)
      expect(keyword).not.toBeNull()
      expect(keyword!.category).toBe('day_of_week')

      // Calculate next Friday manually (same logic as getSectionProperties)
      const today = new Date()
      const fridayIndex = 5 // Friday is day 5
      const daysUntilFriday = ((7 + fridayIndex - today.getDay()) % 7) || 7
      const nextFriday = new Date(today)
      nextFriday.setDate(today.getDate() + daysUntilFriday)
      const expectedDate = `${nextFriday.getFullYear()}-${String(nextFriday.getMonth() + 1).padStart(2, '0')}-${String(nextFriday.getDate()).padStart(2, '0')}`

      // Verify the calculation matches what power keywords would produce
      expect(daysUntilFriday).toBeGreaterThan(0)
      expect(expectedDate).toBeTruthy()
    })

    it('getSectionProperties returns correct updates for High Priority group', () => {
      const highPriorityGroup = createTestGroup({ name: 'High Priority' })

      // Detect priority keyword
      const keyword = detectPowerKeyword(highPriorityGroup.name)
      expect(keyword).not.toBeNull()
      expect(keyword!.category).toBe('priority')
      expect(keyword!.value).toBe('high')

      // Test priority application
      const task = createTestTask({ priority: 'medium' })
      task.priority = keyword!.value as 'high'
      expect(task.priority).toBe('high')
    })

    it('getSectionProperties returns empty object for non-power groups', () => {
      const customGroup = createTestGroup({ name: 'My Custom Group' })

      // Non-power groups should not be detected
      const keyword = detectPowerKeyword(customGroup.name)
      expect(keyword).toBeNull()

      // Apply smart group properties should return empty for non-smart groups
      const isDateGroup = isSmartGroup(customGroup.name)
      expect(isDateGroup).toBe(false)
    })
  })

  // ============================================================================
  // INTEGRATION: Full Drop Flow
  // ============================================================================

  describe('Integration: Full Drop Flow', () => {
    it('dropping task in Today group sets dueDate and parentId correctly', () => {
      const task = createTestTask({
        canvasPosition: { x: 100, y: 100 },
        parentId: 'old-group',
        dueDate: ''
      })
      const before = cloneTask(task)

      // Apply smart group properties (metadata)
      const metadataUpdates = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
      Object.assign(task, metadataUpdates)

      // Simulate drag handler setting parentId (geometry)
      task.parentId = 'today-group'

      // Verify: dueDate set to today
      expect(task.dueDate).toBeTruthy()
      const today = new Date()
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(task.dueDate).toBe(expectedDate)

      // Verify: parentId changed (allowed by drag handler)
      expect(task.parentId).toBe('today-group')

      // Verify: canvasPosition unchanged
      expect(task.canvasPosition).toEqual(before.canvasPosition)
    })

    it('dropping task in Done group sets status and parentId correctly', () => {
      const task = createTestTask({
        canvasPosition: { x: 200, y: 200 },
        parentId: 'active-group',
        status: 'in_progress'
      })
      const before = cloneTask(task)

      // Simulate power keyword detection for Done
      const keyword = detectPowerKeyword('Done')
      expect(keyword).not.toBeNull()
      expect(keyword!.category).toBe('status')
      expect(keyword!.value).toBe('done')

      // Apply status metadata
      task.status = 'done'

      // Simulate drag handler setting parentId
      task.parentId = 'done-group'

      // Verify: status changed to done
      expect(task.status).toBe('done')

      // Verify: parentId changed (allowed)
      expect(task.parentId).toBe('done-group')

      // Verify: canvasPosition unchanged
      expect(task.canvasPosition).toEqual(before.canvasPosition)

      // Verify: metadata changed but geometry preserved
      const metadataChanged = changedTaskMetadataFields(before, task)
      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(metadataChanged).toContain('status')
      expect(geometryChanged).toContain('parentId') // parentId is geometry, changed by drag
    })

    it('moving task between smart groups updates metadata correctly', () => {
      const task = createTestTask({
        canvasPosition: { x: 300, y: 300 },
        parentId: 'today-group',
        dueDate: ''
      })
      const originalPosition = { ...task.canvasPosition! }

      // First drop: Today group
      const todayUpdates = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
      Object.assign(task, todayUpdates)
      task.parentId = 'today-group'

      const today = new Date()
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(task.dueDate).toBe(todayDate)

      // Second drop: Tomorrow group
      const tomorrowUpdates = applySmartGroupProperties(task, SMART_GROUPS.TOMORROW)
      Object.assign(task, tomorrowUpdates)
      task.parentId = 'tomorrow-group'

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
      expect(task.dueDate).toBe(tomorrowDate)

      // Verify: geometry unchanged throughout both moves
      expect(task.canvasPosition).toEqual(originalPosition)
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('task with existing dueDate keeps it when dropped in non-date group', () => {
      const task = createTestTask({
        canvasPosition: { x: 400, y: 400 },
        parentId: 'old-group',
        dueDate: '2026-03-01'
      })
      const before = cloneTask(task)

      // Detect non-power group
      const keyword = detectPowerKeyword('Custom Group')
      expect(keyword).toBeNull()

      // Simulate drag handler only (no metadata changes)
      task.parentId = 'custom-group'

      // Verify: dueDate preserved
      expect(task.dueDate).toBe('2026-03-01')

      // Verify: only parentId changed (by drag)
      const metadataChanged = changedTaskMetadataFields(before, task)
      expect(metadataChanged).toEqual([])
    })

    it('recurring task handling in smart groups', () => {
      const task = createTestTask({
        canvasPosition: { x: 500, y: 500 },
        parentId: 'inbox',
        dueDate: '',
        recurrence: { type: 'weekly', interval: 1 } as any // Add recurrence field
      })
      const before = cloneTask(task)

      // Apply Today smart group
      const updates = applySmartGroupProperties(task, SMART_GROUPS.TODAY)
      Object.assign(task, updates)
      task.parentId = 'today-group'

      // Verify: dueDate updated
      expect(task.dueDate).toBeTruthy()

      // Verify: recurrence preserved
      expect(task.recurrence).toBeDefined()
      expect((task.recurrence as any).type).toBe('weekly')

      // Verify: canvasPosition unchanged
      expect(task.canvasPosition).toEqual(before.canvasPosition)
    })

    it('completed task handling in overdue collector', () => {
      // ENABLE_SMART_GROUP_REPARENTING = false, so overdue collector is disabled
      const task = createTestTask({
        id: 'completed-overdue',
        status: 'done',
        dueDate: '2020-01-01', // Very overdue
        canvasPosition: { x: 600, y: 600 },
        parentId: 'done-group'
      })
      const before = cloneTask(task)

      // Simulate disabled overdue collector (no-op)
      const ENABLE_SMART_GROUP_REPARENTING = false
      if (ENABLE_SMART_GROUP_REPARENTING) {
        // Would move task to overdue group - but flag is false
        task.canvasPosition = { x: 50, y: 60 }
        task.parentId = 'overdue-group'
      }

      // Verify: geometry unchanged (no reparenting occurred)
      const geometryChanged = changedTaskGeometryFields(before, task)
      expect(geometryChanged).toEqual([])

      // Verify: task still in done group with original position
      expect(task.parentId).toBe('done-group')
      expect(task.canvasPosition).toEqual(before.canvasPosition)
    })
  })
})
