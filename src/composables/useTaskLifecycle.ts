/**
 * Task Lifecycle State Machine
 *
 * Manages the complete lifecycle of tasks across different views:
 * - Inbox (new tasks)
 * - Canvas sections (today, other sections)
 * - Calendar (scheduled tasks)
 * - Completed/Archived states
 *
 * Handles state transitions, validation, and synchronization.
 */

import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'

// Task lifecycle states - represents where a task currently lives
export enum TaskState {
  INBOX = 'inbox',
  CANVAS_TODAY = 'canvas-today',
  CANVAS_OTHER = 'canvas-other',
  CALENDAR = 'calendar',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

// Source views for drag operations
export enum TaskSourceView {
  INBOX = 'inbox',
  CANVAS = 'canvas',
  CALENDAR = 'calendar'
}

// Enhanced drag data for task transfers
export interface TaskDragData {
  taskId: string
  sourceView: TaskSourceView
  sourceState: TaskState
  targetStates: TaskState[]
  metadata: {
    taskTitle: string
    projectId: string
    hasInstances: boolean
    sourceSection?: string
  }
}

// State transition result
export interface StateTransitionResult {
  success: boolean
  fromState: TaskState
  toState: TaskState
  error?: string
  metadata?: unknown
}

// Metadata for state transitions
export interface TransitionMetadata {
  canvasPosition?: { x: number; y: number }
  instanceData?: {
    id?: string
    scheduledDate: string
    scheduledTime?: string
    duration?: number
  }
  [key: string]: unknown
}

export const useTaskLifecycle = () => {
  const taskStore = useTaskStore()

  // Current drag state for tracking operations
  const activeDragOperation = ref<{
    taskId: string | null
    sourceState: TaskState | null
    targetState: TaskState | null
    startTime: number | null
  }>({
    taskId: null,
    sourceState: null,
    targetState: null,
    startTime: null
  })

  // State transition validation matrix
  const validTransitions: Record<TaskState, TaskState[]> = {
    [TaskState.INBOX]: [
      TaskState.CANVAS_TODAY,
      TaskState.CANVAS_OTHER,
      TaskState.CALENDAR
    ],
    [TaskState.CANVAS_TODAY]: [
      TaskState.CALENDAR,
      TaskState.INBOX,
      TaskState.CANVAS_OTHER,
      TaskState.COMPLETED
    ],
    [TaskState.CANVAS_OTHER]: [
      TaskState.CALENDAR,
      TaskState.INBOX,
      TaskState.CANVAS_TODAY,
      TaskState.COMPLETED
    ],
    [TaskState.CALENDAR]: [
      TaskState.INBOX,
      TaskState.CANVAS_TODAY,
      TaskState.CANVAS_OTHER,
      TaskState.COMPLETED
    ],
    [TaskState.COMPLETED]: [
      TaskState.INBOX,
      TaskState.ARCHIVED
    ],
    [TaskState.ARCHIVED]: [
      TaskState.INBOX
    ]
  }

  /**
   * Get the current state of a task based on its properties
   */
  const getTaskState = (task: Task): TaskState => {
    // Check completion status first
    if (task.status === 'done') {
      return TaskState.COMPLETED
    }

    // Check if task has calendar instances (scheduled)
    if (task.instances && task.instances.length > 0) {
      return TaskState.CALENDAR
    }

    // Check canvas positioning
    if (task.canvasPosition) {
      // For now, determine if it's in "today" based on due date or other logic
      // This can be enhanced with actual canvas section detection
      if (task.dueDate) {
        const today = new Date()
        const dueDate = new Date(task.dueDate)
        if (dueDate.toDateString() === today.toDateString()) {
          return TaskState.CANVAS_TODAY
        }
      }
      return TaskState.CANVAS_OTHER
    }

    // Check if task is in inbox (has isInInbox flag or no positioning)
    if (task.isInInbox || (!task.canvasPosition && !task.instances)) {
      return TaskState.INBOX
    }

    // Default to canvas-other for positioned tasks without other indicators
    return TaskState.CANVAS_OTHER
  }

  /**
   * Validate if a state transition is allowed
   */
  const canTransition = (fromState: TaskState, toState: TaskState): boolean => {
    return validTransitions[fromState]?.includes(toState) || false
  }

  /**
   * Get all valid target states for a given source state
   */
  const getValidTargetStates = (sourceState: TaskState): TaskState[] => {
    return validTransitions[sourceState] || []
  }

  /**
   * Prepare task drag data for drag operations
   */
  const prepareDragData = (task: Task, sourceView: TaskSourceView): TaskDragData => {
    const sourceState = getTaskState(task)
    const targetStates = getValidTargetStates(sourceState)

    return {
      taskId: task.id,
      sourceView,
      sourceState,
      targetStates,
      metadata: {
        taskTitle: task.title,
        projectId: task.projectId,
        hasInstances: !!(task.instances && task.instances.length > 0),
        sourceSection: sourceView === TaskSourceView.CANVAS ? determineCanvasSection(task) : undefined
      }
    }
  }

  /**
   * Determine which canvas section a task belongs to
   */
  const determineCanvasSection = (task: Task): string => {
    // Logic to determine canvas section
    // This would need to be integrated with actual canvas section detection
    if (task.dueDate) {
      const today = new Date()
      const dueDate = new Date(task.dueDate)
      if (dueDate.toDateString() === today.toDateString()) {
        return 'today'
      }
    }
    return 'other'
  }

  /**
   * Execute a state transition for a task
   */
  const executeStateTransition = async (
    taskId: string,
    targetState: TaskState,
    metadata?: TransitionMetadata
  ): Promise<StateTransitionResult> => {
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (!task) {
      return {
        success: false,
        fromState: TaskState.INBOX,
        toState: targetState,
        error: 'Task not found'
      }
    }

    const fromState = getTaskState(task)

    // Validate transition
    if (!canTransition(fromState, targetState)) {
      return {
        success: false,
        fromState,
        toState: targetState,
        error: `Invalid transition from ${fromState} to ${targetState}`
      }
    }

    try {
      console.log(`🔄 [TaskLifecycle] Executing transition: ${task.title} (${fromState} → ${targetState})`)

      // Execute the transition based on target state
      const updatedTask = await performStateTransition(task, targetState, metadata)

      // Update the task in store
      await taskStore.updateTask(taskId, updatedTask)

      console.log(`✅ [TaskLifecycle] Transition completed: ${task.title} → ${targetState}`)

      return {
        success: true,
        fromState,
        toState: targetState,
        metadata: {
          taskId,
          taskTitle: task.title,
          transitionTime: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error(`❌ [TaskLifecycle] Transition failed:`, error)
      return {
        success: false,
        fromState,
        toState: targetState,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Perform the actual state transition logic
   */
  const performStateTransition = async (
    task: Task,
    targetState: TaskState,
    metadata?: TransitionMetadata
  ): Promise<Partial<Task>> => {
    const updates: Partial<Task> = {
      updatedAt: new Date()
    }

    switch (targetState) {
      case TaskState.INBOX:
        // Move task to inbox
        updates.isInInbox = true
        updates.canvasPosition = undefined
        updates.instances = []
        // Keep due date but remove calendar positioning
        break

      case TaskState.CANVAS_TODAY:
        // Move to canvas today section
        updates.isInInbox = false
        updates.canvasPosition = metadata?.canvasPosition || { x: 0, y: 0 }
        updates.instances = []
        // Set due date to today if not already set
        if (!updates.dueDate) {
          const today = new Date()
          updates.dueDate = today.toISOString().split('T')[0]
        }
        break

      case TaskState.CANVAS_OTHER:
        // Move to canvas other section
        updates.isInInbox = false
        updates.canvasPosition = metadata?.canvasPosition || { x: 0, y: 0 }
        updates.instances = []
        break

      case TaskState.CALENDAR:
        // Move to calendar - create calendar instance
        // Dec 16, 2025 fix: DO NOT set isInInbox here
        // isInInbox controls CANVAS inbox only, not calendar inbox
        // Calendar and Canvas systems are INDEPENDENT
        if (metadata?.instanceData) {
          updates.instances = [metadata.instanceData]
        }
        break

      case TaskState.COMPLETED:
        // Mark as completed
        updates.status = 'done'
        updates.progress = 100
        break

      case TaskState.ARCHIVED:
        // Archive task (could be a separate status)
        updates.status = 'done'
        break
    }

    return updates
  }

  /**
   * Start tracking a drag operation
   */
  const startDragOperation = (taskId: string, sourceState: TaskState) => {
    activeDragOperation.value = {
      taskId,
      sourceState,
      targetState: null,
      startTime: Date.now()
    }
    console.log(`🎯 [TaskLifecycle] Drag started: ${taskId} from ${sourceState}`)
  }

  /**
   * Update the target state for an active drag operation
   */
  const updateDragTarget = (targetState: TaskState) => {
    if (activeDragOperation.value.taskId) {
      activeDragOperation.value.targetState = targetState
      console.log(`📍 [TaskLifecycle] Drag target updated: ${targetState}`)
    }
  }

  /**
   * Complete the current drag operation
   */
  const completeDragOperation = async (): Promise<StateTransitionResult | null> => {
    const { taskId, sourceState, targetState } = activeDragOperation.value

    if (!taskId || !sourceState || !targetState) {
      console.warn(`⚠️ [TaskLifecycle] Incomplete drag operation data`)
      resetDragOperation()
      return null
    }

    console.log(`🏁 [TaskLifecycle] Completing drag: ${taskId} (${sourceState} → ${targetState})`)

    const result = await executeStateTransition(taskId, targetState, {
      dragOperation: true,
      dragStartTime: activeDragOperation.value.startTime
    })

    resetDragOperation()
    return result
  }

  /**
   * Reset drag operation state
   */
  const resetDragOperation = () => {
    activeDragOperation.value = {
      taskId: null,
      sourceState: null,
      targetState: null,
      startTime: null
    }
  }

  /**
   * Get all tasks in a specific state
   */
  const getTasksByState = (state: TaskState) => {
    return computed(() => {
      return taskStore.tasks.filter(task => getTaskState(task) === state)
    })
  }

  /**
   * Get task state statistics
   */
  const getStateStatistics = () => {
    return computed(() => {
      const stats = Object.values(TaskState).reduce((acc, state) => {
        acc[state] = 0
        return acc
      }, {} as Record<TaskState, number>)

      taskStore.tasks.forEach(task => {
        const state = getTaskState(task)
        stats[state]++
      })

      return stats
    })
  }

  // Computed properties for reactive state access
  const inboxTasks = getTasksByState(TaskState.INBOX)
  const canvasTodayTasks = getTasksByState(TaskState.CANVAS_TODAY)
  const canvasOtherTasks = getTasksByState(TaskState.CANVAS_OTHER)
  const calendarTasks = getTasksByState(TaskState.CALENDAR)
  const completedTasks = getTasksByState(TaskState.COMPLETED)
  const archivedTasks = getTasksByState(TaskState.ARCHIVED)

  const stateStatistics = getStateStatistics()

  // Diagnostic logging function
  const shouldLogTaskDiagnostics = () => {
    return import.meta.env.DEV && localStorage.getItem('debug-task-lifecycle') === 'true'
  }

  // Watch for changes and log them
  watch(stateStatistics, (newStats) => {
    if (shouldLogTaskDiagnostics()) {
      console.log(`📊 [TaskLifecycle] State statistics updated:`, newStats)
    }
  }, { deep: true })

  return {
    // State enums
    TaskState,
    TaskSourceView,

    // State management
    getTaskState,
    canTransition,
    getValidTargetStates,
    executeStateTransition,

    // Drag operations
    prepareDragData,
    startDragOperation,
    updateDragTarget,
    completeDragOperation,
    resetDragOperation,
    activeDragOperation: readonly(activeDragOperation),

    // Task collections
    inboxTasks,
    canvasTodayTasks,
    canvasOtherTasks,
    calendarTasks,
    completedTasks,
    archivedTasks,
    stateStatistics
  }
}

// Helper for readonly computed
const readonly = <T>(ref: { value: T }) => computed(() => ref.value)