/**
 * useCanvasDrag - Drag and drop handling for canvas
 *
 * TASK-184: Canvas System Rebuild - Phase 4 & 5
 *
 * Responsibilities:
 * - Handle drops from inbox to canvas
 * - Handle node drag stop (position updates)
 * - Detect containment (task inside group)
 * - Assign parent-child relationships
 * - Persist positions to store
 *
 * Target: ~300 lines
 */
import { useCanvasNodes } from './useCanvasNodes'
import { useCanvasGroups } from './useCanvasGroups'
import { useCanvasNewStore } from '@/stores/canvasNew'
import { findSmallestContainingRect, type Rect } from '@/utils/geometry'
import type { Node } from '@vue-flow/core'

interface DragData {
  type: 'inbox-task' | 'canvas-task' | 'canvas-group'
  taskId?: string
  groupId?: string
}

export function useCanvasDrag() {
  const { moveTaskToCanvas, updateTaskPosition, assignTaskToGroup, getTaskById } = useCanvasNodes()
  const { updateGroupPosition, persistGroup } = useCanvasGroups()
  const canvasStore = useCanvasNewStore()

  // ============================================
  // DROP HANDLERS
  // ============================================

  /**
   * Handle drop event on canvas
   * Converts screen coordinates to canvas coordinates
   */
  async function handleCanvasDrop(
    event: DragEvent,
    project: (coords: { x: number; y: number }) => { x: number; y: number },
    containerRect: DOMRect
  ): Promise<void> {
    if (!event.dataTransfer) return

    // Get drop position in canvas coordinates
    const screenPosition = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top
    }
    const canvasPosition = project(screenPosition)

    console.log('[useCanvasDrag] Drop at canvas position:', canvasPosition)

    // Try to parse drag data
    try {
      const dataString = event.dataTransfer.getData('application/json')
      if (!dataString) {
        console.log('[useCanvasDrag] No JSON data in drop')
        return
      }

      const data: DragData = JSON.parse(dataString)
      console.log('[useCanvasDrag] Drop data:', data)

      // Handle based on type
      switch (data.type) {
        case 'inbox-task':
          if (data.taskId) {
            await handleInboxTaskDrop(data.taskId, canvasPosition)
          }
          break
        default:
          console.log('[useCanvasDrag] Unknown drop type:', data.type)
      }
    } catch (error) {
      console.error('[useCanvasDrag] Error parsing drop data:', error)
    }
  }

  /**
   * Handle dropping a task from inbox onto canvas
   * Phase 5: Also checks if dropped inside a group
   */
  async function handleInboxTaskDrop(
    taskId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    console.log('[useCanvasDrag] Dropping inbox task:', taskId, position)

    // Check if position is inside any group
    const containingGroup = findContainingGroup(position.x, position.y)

    if (containingGroup) {
      console.log('[useCanvasDrag] Task dropped inside group:', containingGroup.id)

      // Calculate relative position within the group
      const relativePosition = {
        x: position.x - containingGroup.position.x,
        y: position.y - containingGroup.position.y
      }

      // Move task to canvas with relative position and assign to group
      await moveTaskToCanvas(taskId, relativePosition)
      await assignTaskToGroup(taskId, containingGroup.id)

      console.log('[useCanvasDrag] Task assigned to group with relative position:', relativePosition)
    } else {
      // Move task to canvas at the drop position (no parent)
      await moveTaskToCanvas(taskId, position)
      console.log('[useCanvasDrag] Task moved to canvas (no parent group)')
    }
  }

  // ============================================
  // NODE DRAG HANDLERS
  // ============================================

  /**
   * Handle node drag stop - persist position
   * Phase 5: Also passes computedPosition for containment detection
   */
  async function handleNodeDragStop(event: { node: Node }): Promise<void> {
    const { node } = event
    console.log('[useCanvasDrag] Node drag stop:', node.id, node.position)

    // Determine node type from ID prefix
    if (node.id.startsWith('task-')) {
      const taskId = node.id.replace('task-', '')
      // Pass both position (relative) and computedPosition (absolute) for containment detection
      await handleTaskDragStop(taskId, node.position, node.computedPosition)
    } else if (node.id.startsWith('section-')) {
      const groupId = node.id.replace('section-', '')
      await handleGroupDragStop(groupId, node.position)
    }
  }

  /**
   * Handle task node drag stop
   * Phase 5: Also handles containment detection for parent-child assignment
   */
  async function handleTaskDragStop(
    taskId: string,
    position: { x: number; y: number },
    computedPosition?: { x: number; y: number }
  ): Promise<void> {
    console.log('[useCanvasDrag] Task drag stop:', taskId, position)

    // Get the task to check its current parent
    const task = getTaskById(taskId)
    const currentParentId = (task as any)?.parentGroupId

    // Use computedPosition (absolute) if available, otherwise use position
    // Vue Flow's position is relative when task has a parent
    const absolutePosition = computedPosition ?? position

    // Check if the task's absolute position is inside any group
    const containingGroup = findContainingGroup(absolutePosition.x, absolutePosition.y)
    const newParentId = containingGroup?.id ?? null

    // Check if parent changed
    if (currentParentId !== newParentId) {
      if (newParentId) {
        // Task moved INTO a group (or to a different group)
        console.log('[useCanvasDrag] Task moved to group:', newParentId)

        // Calculate relative position within the new parent
        const relativePosition = {
          x: absolutePosition.x - containingGroup!.position.x,
          y: absolutePosition.y - containingGroup!.position.y
        }

        await assignTaskToGroup(taskId, newParentId, relativePosition)
      } else {
        // Task moved OUT of a group
        console.log('[useCanvasDrag] Task moved out of group')

        // Use absolute position since task is now at root level
        await assignTaskToGroup(taskId, null)
        await updateTaskPosition(taskId, absolutePosition)
      }
    } else {
      // Parent didn't change, just update position
      await updateTaskPosition(taskId, position)
    }
  }

  /**
   * Handle group node drag stop
   */
  async function handleGroupDragStop(
    groupId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    console.log('[useCanvasDrag] Group drag stop:', groupId, position)

    // Update position in store
    updateGroupPosition(groupId, position)

    // Persist to Supabase
    await persistGroup(groupId)
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Find the smallest group that contains a point
   * Returns the group if found, or null if point is not inside any group
   */
  function findContainingGroup(x: number, y: number) {
    // Convert groups to Rect format for geometry check
    const groupRects = canvasStore.groups.map(group => ({
      ...group,
      x: group.position.x,
      y: group.position.y,
      width: group.dimensions.width,
      height: group.dimensions.height
    }))

    // Find smallest containing group (handles nested groups correctly)
    const containingGroup = findSmallestContainingRect(x, y, groupRects)
    return containingGroup
  }

  /**
   * Create drag data for a task
   */
  function createTaskDragData(taskId: string): string {
    const data: DragData = {
      type: 'inbox-task',
      taskId
    }
    return JSON.stringify(data)
  }

  /**
   * Check if drop target is valid
   */
  function isValidDropTarget(event: DragEvent): boolean {
    // For now, any drop on the canvas is valid
    return true
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // Drop handlers
    handleCanvasDrop,
    handleInboxTaskDrop,

    // Node drag handlers
    handleNodeDragStop,
    handleTaskDragStop,
    handleGroupDragStop,

    // Utilities
    createTaskDragData,
    isValidDropTarget
  }
}
