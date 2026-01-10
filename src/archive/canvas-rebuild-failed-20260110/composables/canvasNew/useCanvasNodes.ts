/**
 * useCanvasNodes - Task node management for canvas
 *
 * TASK-184: Canvas System Rebuild - Phase 3
 *
 * Responsibilities:
 * - Convert tasks to Vue Flow nodes
 * - Filter canvas vs inbox tasks
 * - Sync task nodes to Vue Flow
 *
 * Target: ~200 lines
 */
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Node } from '@vue-flow/core'
import type { Task } from '@/types/tasks'

// Node type for Vue Flow
export const TASK_NODE_TYPE = 'taskNode'

// Default dimensions for task nodes
const DEFAULT_TASK_WIDTH = 220
const DEFAULT_TASK_HEIGHT = 80

export function useCanvasNodes() {
  const taskStore = useTaskStore()

  // ============================================
  // COMPUTED
  // ============================================

  /**
   * Tasks that should appear on the canvas (not in inbox)
   */
  const canvasTasks = computed<Task[]>(() => {
    return taskStore.tasks.filter((task: Task) => {
      // Task is on canvas if:
      // 1. isInInbox is explicitly false, OR
      // 2. Has a canvasPosition and isInInbox is not true
      if (task.isInInbox === true) return false
      if (task.isInInbox === false) return true
      return !!task.canvasPosition
    })
  })

  /**
   * Tasks that should appear in the inbox
   */
  const inboxTasks = computed<Task[]>(() => {
    return taskStore.tasks.filter((task: Task) => {
      if (task.isInInbox === true) return true
      if (task.isInInbox === false) return false
      return !task.canvasPosition
    })
  })

  /**
   * Convert canvas tasks to Vue Flow nodes
   */
  const taskNodes = computed<Node[]>(() => {
    return canvasTasks.value.map((task) => createTaskNode(task))
  })

  /**
   * Count tasks per group (for group task count display)
   * Returns a Map of groupId -> task count
   *
   * IMPORTANT: This counts DIRECT children only.
   * For recursive counting (including tasks in nested groups),
   * use getRecursiveTaskCount() which is computed in CanvasViewNew
   */
  const taskCountsByGroup = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>()

    canvasTasks.value.forEach((task: Task) => {
      const groupId = (task as any).parentGroupId
      if (groupId) {
        counts.set(groupId, (counts.get(groupId) ?? 0) + 1)
      }
    })

    return counts
  })

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Create a Vue Flow node from a task
   */
  function createTaskNode(task: Task): Node {
    // Determine parent group if task has one
    // Tasks can be nested in groups via parentGroupId (stored in task metadata)
    const parentGroupId = (task as any).parentGroupId

    return {
      id: `task-${task.id}`,
      type: TASK_NODE_TYPE,
      position: {
        x: task.canvasPosition?.x ?? 100,
        y: task.canvasPosition?.y ?? 100
      },
      // Parent node for nesting (Phase 5)
      parentNode: parentGroupId ? `section-${parentGroupId}` : undefined,
      // Tasks should always appear ABOVE groups (z-index 1 vs group's -1)
      zIndex: 1,
      data: {
        ...task,
        // Include all task data for the component
      },
      // Style
      style: {
        width: `${DEFAULT_TASK_WIDTH}px`,
        // Height is auto based on content
      }
    }
  }

  /**
   * Get a task by ID
   */
  function getTaskById(taskId: string): Task | undefined {
    return taskStore.tasks.find((t: Task) => t.id === taskId)
  }

  /**
   * Move a task from inbox to canvas at specified position
   */
  async function moveTaskToCanvas(
    taskId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    console.log('[useCanvasNodes] Moving task to canvas:', taskId, position)

    const task = getTaskById(taskId)
    if (!task) {
      console.warn('[useCanvasNodes] Task not found:', taskId)
      return
    }

    // Update task in store
    await taskStore.updateTask(taskId, {
      canvasPosition: position,
      isInInbox: false
    })

    console.log('[useCanvasNodes] Task moved to canvas:', taskId)
  }

  /**
   * Move a task back to inbox
   */
  async function moveTaskToInbox(taskId: string): Promise<void> {
    console.log('[useCanvasNodes] Moving task to inbox:', taskId)

    await taskStore.updateTask(taskId, {
      canvasPosition: undefined,
      isInInbox: true
    })

    console.log('[useCanvasNodes] Task moved to inbox:', taskId)
  }

  /**
   * Update a task's canvas position
   */
  async function updateTaskPosition(
    taskId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    await taskStore.updateTask(taskId, {
      canvasPosition: position
    })
  }

  /**
   * Assign a task to a parent group
   */
  async function assignTaskToGroup(
    taskId: string,
    groupId: string | null,
    relativePosition?: { x: number; y: number }
  ): Promise<void> {
    console.log('[useCanvasNodes] Assigning task to group:', taskId, groupId)

    const updates: Partial<Task> = {
      // @ts-ignore - parentGroupId is not in Task type yet
      parentGroupId: groupId
    }

    if (relativePosition) {
      updates.canvasPosition = relativePosition
    }

    await taskStore.updateTask(taskId, updates)
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // Computed
    canvasTasks,
    inboxTasks,
    taskNodes,
    taskCountsByGroup,

    // Actions
    moveTaskToCanvas,
    moveTaskToInbox,
    updateTaskPosition,
    assignTaskToGroup,

    // Helpers
    createTaskNode,
    getTaskById
  }
}
