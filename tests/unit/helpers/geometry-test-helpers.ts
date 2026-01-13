/**
 * Geometry Test Helpers
 *
 * Helper functions for testing geometry invariants in the canvas system.
 * These helpers make it easy to detect which fields changed between two states.
 *
 * @module tests/unit/helpers/geometry-test-helpers
 */

import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas/types'

/**
 * Geometry fields on a task that should ONLY be changed by drag handlers
 */
export const TASK_GEOMETRY_FIELDS = ['parentId', 'canvasPosition'] as const
export type TaskGeometryField = typeof TASK_GEOMETRY_FIELDS[number]

/**
 * Geometry fields on a group that should ONLY be changed by drag/resize handlers
 */
export const GROUP_GEOMETRY_FIELDS = ['parentGroupId', 'position'] as const
export type GroupGeometryField = typeof GROUP_GEOMETRY_FIELDS[number]

/**
 * Metadata fields on a task that Smart-Groups CAN modify
 */
export const TASK_METADATA_FIELDS = ['dueDate', 'status', 'priority', 'tags', 'projectId'] as const
export type TaskMetadataField = typeof TASK_METADATA_FIELDS[number]

/**
 * Deep compare two positions with tolerance for floating point
 */
function positionsEqual(
  a: { x: number; y: number } | undefined | null,
  b: { x: number; y: number } | undefined | null,
  tolerance = 0.001
): boolean {
  if (a === b) return true
  if (!a && !b) return true
  if (!a || !b) return false
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance
}

/**
 * Deep compare group positions (includes width/height)
 */
function groupPositionsEqual(
  a: { x: number; y: number; width: number; height: number } | undefined | null,
  b: { x: number; y: number; width: number; height: number } | undefined | null,
  tolerance = 0.001
): boolean {
  if (a === b) return true
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance
  )
}

/**
 * Get the list of geometry fields that changed between two task states
 *
 * @param before - Task state before the operation
 * @param after - Task state after the operation
 * @returns Array of geometry field names that changed
 *
 * @example
 * ```ts
 * const changed = changedTaskGeometryFields(taskBefore, taskAfter)
 * expect(changed).toEqual(['parentId', 'canvasPosition']) // For drag
 * expect(changed).toEqual([]) // For Smart-Group operations
 * ```
 */
export function changedTaskGeometryFields(
  before: Partial<Task>,
  after: Partial<Task>
): TaskGeometryField[] {
  const changed: TaskGeometryField[] = []

  // Check parentId
  if (before.parentId !== after.parentId) {
    changed.push('parentId')
  }

  // Check canvasPosition
  if (!positionsEqual(before.canvasPosition, after.canvasPosition)) {
    changed.push('canvasPosition')
  }

  return changed
}

/**
 * Get the list of geometry fields that changed between two group states
 *
 * @param before - Group state before the operation
 * @param after - Group state after the operation
 * @returns Array of geometry field names that changed
 *
 * @example
 * ```ts
 * const changed = changedGroupGeometryFields(groupBefore, groupAfter)
 * expect(changed).toEqual(['parentGroupId', 'position']) // For drag
 * expect(changed).toEqual([]) // For non-geometry operations
 * ```
 */
export function changedGroupGeometryFields(
  before: Partial<CanvasGroup>,
  after: Partial<CanvasGroup>
): GroupGeometryField[] {
  const changed: GroupGeometryField[] = []

  // Check parentGroupId
  if (before.parentGroupId !== after.parentGroupId) {
    changed.push('parentGroupId')
  }

  // Check position (includes width/height)
  if (!groupPositionsEqual(before.position, after.position)) {
    changed.push('position')
  }

  return changed
}

/**
 * Get the list of metadata fields that changed between two task states
 *
 * @param before - Task state before the operation
 * @param after - Task state after the operation
 * @returns Array of metadata field names that changed
 */
export function changedTaskMetadataFields(
  before: Partial<Task>,
  after: Partial<Task>
): TaskMetadataField[] {
  const changed: TaskMetadataField[] = []

  if (before.dueDate !== after.dueDate) changed.push('dueDate')
  if (before.status !== after.status) changed.push('status')
  if (before.priority !== after.priority) changed.push('priority')
  if (before.projectId !== after.projectId) changed.push('projectId')
  // Tags comparison (arrays)
  if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) changed.push('tags')

  return changed
}

/**
 * Deep clone a task for snapshot comparison
 */
export function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task))
}

/**
 * Deep clone a group for snapshot comparison
 */
export function cloneGroup(group: CanvasGroup): CanvasGroup {
  return JSON.parse(JSON.stringify(group))
}

/**
 * Create a minimal task fixture for testing
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Test Task',
    description: '',
    status: 'planned',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    canvasPosition: { x: 100, y: 100 },
    isInInbox: false,
    ...overrides
  }
}

/**
 * Create a minimal group fixture for testing
 */
export function createTestGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Test Group',
    type: 'custom',
    color: '#3b82f6',
    layout: 'vertical',
    position: { x: 0, y: 0, width: 300, height: 200 },
    isCollapsed: false,
    isVisible: true,
    parentGroupId: null,
    ...overrides
  }
}

/**
 * Create a collection of tasks in different states for testing
 */
export function createTestTaskCollection(): { tasks: Task[], byId: Map<string, Task> } {
  const tasks: Task[] = [
    createTestTask({ id: 'task-1', title: 'Task 1', canvasPosition: { x: 100, y: 100 }, parentId: undefined }),
    createTestTask({ id: 'task-2', title: 'Task 2', canvasPosition: { x: 200, y: 100 }, parentId: 'group-1' }),
    createTestTask({ id: 'task-3', title: 'Task 3', canvasPosition: { x: 300, y: 100 }, parentId: 'group-2' }),
    createTestTask({ id: 'task-4', title: 'Inbox Task', isInInbox: true, canvasPosition: undefined }),
  ]

  const byId = new Map(tasks.map(t => [t.id, t]))
  return { tasks, byId }
}

/**
 * Create a collection of groups for testing nesting
 */
export function createTestGroupHierarchy(): { groups: CanvasGroup[], byId: Map<string, CanvasGroup> } {
  const groups: CanvasGroup[] = [
    createTestGroup({
      id: 'group-1',
      name: 'Root Group',
      position: { x: 0, y: 0, width: 600, height: 400 },
      parentGroupId: null
    }),
    createTestGroup({
      id: 'group-2',
      name: 'Nested Group',
      position: { x: 50, y: 50, width: 200, height: 150 },
      parentGroupId: 'group-1'
    }),
    createTestGroup({
      id: 'group-friday',
      name: 'Friday',
      position: { x: 700, y: 0, width: 300, height: 300 },
      parentGroupId: null
    }),
    createTestGroup({
      id: 'group-saturday',
      name: 'Saturday',
      position: { x: 1050, y: 0, width: 300, height: 300 },
      parentGroupId: null
    }),
  ]

  const byId = new Map(groups.map(g => [g.id, g]))
  return { groups, byId }
}

/**
 * Assert that no geometry fields changed on any task in a collection
 */
export function assertNoTaskGeometryChanged(
  before: Map<string, Task>,
  after: Map<string, Task>
): void {
  for (const [id, taskBefore] of before) {
    const taskAfter = after.get(id)
    if (!taskAfter) continue // Task was deleted, that's OK for this check

    const changed = changedTaskGeometryFields(taskBefore, taskAfter)
    if (changed.length > 0) {
      throw new Error(
        `Task ${id} had geometry changes when none expected: ${changed.join(', ')}\n` +
        `Before: parentId=${taskBefore.parentId}, pos=${JSON.stringify(taskBefore.canvasPosition)}\n` +
        `After: parentId=${taskAfter.parentId}, pos=${JSON.stringify(taskAfter.canvasPosition)}`
      )
    }
  }
}

/**
 * Assert that no geometry fields changed on any group in a collection
 */
export function assertNoGroupGeometryChanged(
  before: Map<string, CanvasGroup>,
  after: Map<string, CanvasGroup>
): void {
  for (const [id, groupBefore] of before) {
    const groupAfter = after.get(id)
    if (!groupAfter) continue // Group was deleted, that's OK for this check

    const changed = changedGroupGeometryFields(groupBefore, groupAfter)
    if (changed.length > 0) {
      throw new Error(
        `Group ${id} (${groupBefore.name}) had geometry changes when none expected: ${changed.join(', ')}\n` +
        `Before: parentGroupId=${groupBefore.parentGroupId}, pos=${JSON.stringify(groupBefore.position)}\n` +
        `After: parentGroupId=${groupAfter.parentGroupId}, pos=${JSON.stringify(groupAfter.position)}`
      )
    }
  }
}

/**
 * Create a snapshot of task geometry fields for comparison
 */
export function snapshotTaskGeometry(tasks: Task[]): Map<string, { parentId?: string; canvasPosition?: { x: number; y: number } }> {
  return new Map(
    tasks.map(t => [t.id, {
      parentId: t.parentId,
      canvasPosition: t.canvasPosition ? { ...t.canvasPosition } : undefined
    }])
  )
}

/**
 * Create a snapshot of group geometry fields for comparison
 */
export function snapshotGroupGeometry(groups: CanvasGroup[]): Map<string, { parentGroupId?: string | null; position: typeof groups[0]['position'] }> {
  return new Map(
    groups.map(g => [g.id, {
      parentGroupId: g.parentGroupId,
      position: { ...g.position }
    }])
  )
}
