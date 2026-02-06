/**
 * Canvas Coordinate Utilities
 * TASK-241: Single source of truth for position conversion
 *
 * ============================================================================
 * FULLY ABSOLUTE ARCHITECTURE
 * ============================================================================
 *
 * DATABASE/STORE (Source of Truth):
 *   - Every node (task or group, root or nested) stores ABSOLUTE coordinates
 *   - No node ever stores relative coordinates
 *   - This makes DB values = world positions (simple to reason about)
 *
 * VUE FLOW (Display Layer):
 *   - Root nodes: position = absolute (same as DB)
 *   - Nested nodes: position = relative to parent (Vue Flow requirement)
 *   - parentNode is set for nested items
 *
 * CONVERSION BOUNDARIES:
 *   - READ PATH (DB → Vue Flow): Convert absolute to relative for nested nodes
 *   - WRITE PATH (Vue Flow → DB): Convert relative to absolute for nested nodes
 *
 * These conversions happen ONLY in this file and at the sync boundaries.
 */

import type { Node } from '@vue-flow/core'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas/types'

export interface Position {
  x: number
  y: number
}

export interface GroupPosition extends Position {
  width: number
  height: number
}

// =============================================================================
// CORE CONVERSION FUNCTIONS (Used at Read/Write Boundaries)
// =============================================================================

/**
 * Convert absolute position (from DB) to relative position (for Vue Flow)
 * Call this when LOADING nodes for display
 *
 * Formula: relative = absolute - parentAbsolute
 */
export function toRelativePosition(
  absolutePos: Position,
  parentAbsolutePos: Position | null
): Position {
  if (!parentAbsolutePos) {
    return absolutePos // Root nodes stay absolute
  }

  return {
    x: absolutePos.x - parentAbsolutePos.x,
    y: absolutePos.y - parentAbsolutePos.y
  }
}

/**
 * Convert relative position (from Vue Flow) to absolute position (for DB)
 * Call this when SAVING after drag end
 *
 * Formula: absolute = relative + parentAbsolute
 */
export function toAbsolutePosition(
  relativePos: Position,
  parentAbsolutePos: Position | null
): Position {
  if (!parentAbsolutePos) {
    return relativePos // Root nodes are already absolute
  }

  return {
    x: relativePos.x + parentAbsolutePos.x,
    y: relativePos.y + parentAbsolutePos.y
  }
}

// =============================================================================
// GROUP ABSOLUTE POSITION HELPER
// =============================================================================

/**
 * Get the absolute position of a group from the store
 *
 * FULLY ABSOLUTE ARCHITECTURE:
 * - All groups store absolute coordinates directly in DB/store
 * - Just return the stored position - no parent chain traversal needed
 * - This is the key simplification of the Fully Absolute approach
 *
 * @param groupId The group ID to look up
 * @param allGroups All groups array for lookup
 * @returns The absolute position from the store
 */
export function getGroupAbsolutePosition(
  groupId: string,
  allGroups: CanvasGroup[]
): Position {
  const group = allGroups.find(g => g.id === groupId)
  if (!group || !group.position) {
    // BUG-1209: Log warning instead of silently returning origin.
    // Returning {0,0} for a missing group causes children to compute
    // abs = relative + {0,0} = relative, teleporting them near origin.
    console.warn(`[COORDINATES] getGroupAbsolutePosition: group ${groupId.slice(0, 8)} not found in ${allGroups.length} groups — returning {0,0}. This WILL cause drift if used for coordinate conversion.`)
    return { x: 0, y: 0 }
  }

  // FULLY ABSOLUTE: position in store IS the absolute position
  // No traversal needed - just return it directly
  return { x: group.position.x, y: group.position.y }
}

// =============================================================================
// READ PATH: DB → Vue Flow (Position Conversion for Display)
// =============================================================================

/**
 * Convert a group's DB absolute position to Vue Flow position
 * - Root groups: returns absolute (no conversion)
 * - Nested groups: returns relative to parent
 *
 * @param group The group with absolute position from DB
 * @param allGroups All groups for parent lookup
 * @returns Position for Vue Flow (relative if nested, absolute if root)
 */
export function groupPositionToVueFlow(
  group: CanvasGroup,
  allGroups: CanvasGroup[]
): Position {
  const absolutePos = sanitizePosition(group.position)

  if (!group.parentGroupId || group.parentGroupId === 'NONE') {
    // Root group - use absolute position directly
    return absolutePos
  }

  // Nested group - convert absolute to relative for Vue Flow
  const parentAbsolute = getGroupAbsolutePosition(group.parentGroupId, allGroups)
  return toRelativePosition(absolutePos, parentAbsolute)
}

/**
 * Convert a task's DB absolute position to Vue Flow position
 * - Tasks without parent: returns absolute (no conversion)
 * - Tasks in groups: returns relative to parent group
 *
 * @param task The task with absolute position from DB
 * @param allGroups All groups for parent lookup
 * @returns Position for Vue Flow (relative if nested, absolute if root)
 */
export function taskPositionToVueFlow(
  task: Task,
  allGroups: CanvasGroup[]
): Position | null {
  if (!task.canvasPosition) {
    return null
  }

  const absolutePos = sanitizePosition(task.canvasPosition)

  if (!task.parentId || task.parentId === 'NONE') {
    // No parent - use absolute position directly
    return absolutePos
  }

  // Task in group - convert absolute to relative for Vue Flow
  const parentAbsolute = getGroupAbsolutePosition(task.parentId, allGroups)
  return toRelativePosition(absolutePos, parentAbsolute)
}

// =============================================================================
// WRITE PATH: Vue Flow → DB (Position Conversion for Saving)
// =============================================================================

/**
 * Convert Vue Flow node position to DB absolute position
 * - Root nodes: returns as-is (already absolute)
 * - Nested nodes: converts relative to absolute
 *
 * IMPORTANT: Prefer using Vue Flow's computedPosition when available,
 * as it already provides the world-space absolute position.
 *
 * @param node The Vue Flow node
 * @param parentGroupId The parent group ID (null for root nodes)
 * @param allGroups All groups for parent lookup
 * @returns Absolute position for DB storage
 */
export function vueFlowPositionToDb(
  node: Node,
  parentGroupId: string | null,
  allGroups: CanvasGroup[]
): Position {
  // If computedPosition is available, use it directly (already absolute)
  const vfNode = node as Node & { computedPosition?: Position }
  if (vfNode.computedPosition) {
    return {
      x: vfNode.computedPosition.x,
      y: vfNode.computedPosition.y
    }
  }

  // Fallback: manually convert relative to absolute
  const relativePos = sanitizePosition(node.position)

  if (!parentGroupId || parentGroupId === 'NONE') {
    return relativePos // Already absolute
  }

  const parentAbsolute = getGroupAbsolutePosition(parentGroupId, allGroups)
  return toAbsolutePosition(relativePos, parentAbsolute)
}

// =============================================================================
// VALIDATION & SANITIZATION
// =============================================================================

/**
 * Validate that a position is valid (not NaN, not undefined)
 */
export function isValidPosition(pos: unknown): pos is Position {
  const p = pos as Position | undefined | null
  return (
    p !== null &&
    p !== undefined &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    !isNaN(p.x) &&
    !isNaN(p.y)
  )
}

/**
 * Sanitize a position - return fallback if invalid
 */
export function sanitizePosition(pos: unknown, fallback: Position = { x: 0, y: 0 }): Position {
  if (isValidPosition(pos)) {
    return { x: pos.x, y: pos.y }
  }
  return fallback
}

/**
 * Round position to avoid floating point drift
 */
export function roundPosition(pos: Position, decimals: number = 0): Position {
  const factor = Math.pow(10, decimals)
  return {
    x: Math.round(pos.x * factor) / factor,
    y: Math.round(pos.y * factor) / factor
  }
}

/**
 * Check if two positions are equal (within tolerance)
 */
export function positionsEqual(
  a: Position,
  b: Position,
  tolerance: number = 0.5
): boolean {
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance
  )
}

// =============================================================================
// LEGACY COMPATIBILITY (for existing code that uses these)
// =============================================================================

/**
 * Get absolute position for a task based on its parentId
 * @deprecated Use taskPositionToVueFlow for read path, vueFlowPositionToDb for write path
 */
export function getTaskAbsolutePosition(
  task: Task,
  _allGroups: CanvasGroup[]
): Position | null {
  if (!task.canvasPosition) {
    return null
  }

  // In Fully Absolute Architecture, task.canvasPosition IS already absolute
  return sanitizePosition(task.canvasPosition)
}
