/**
 * Simple Task Service - Direct Store Access Pattern
 *
 * This service provides a clean interface for task operations with DIRECT access
 * to Pinia stores for optimal performance and instant sync across all views.
 *
 * Key Principle: NO ABSTRACTION LAYERS - direct store access = instant sync
 */

import { useTaskStore } from '@/stores/tasks'
import type { Task, TaskInstance, Subtask, Project } from '@/stores/tasks'

export interface NewTaskData {
  title: string
  description?: string
  status?: Task['status']
  priority?: Task['priority']
  progress?: number
  estimatedDuration?: number
  projectId?: string
  parentTaskId?: string
  dueDate?: string
  canvasPosition?: { x: number; y: number }
}

export interface UpdateTaskData extends Partial<NewTaskData> {
  id: string
}

export interface NewTaskInstanceData {
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration?: number
}

export interface NewSubtaskData {
  parentTaskId: string
  title: string
  description?: string
}

/**
 * Simple Task Service - Business logic with DIRECT store access
 *
 * This follows the two-layer architecture:
 * Layer 1: Direct Pinia Store (state + persistence)
 * Layer 2: Simple Service (business logic only)
 *
 * NO adapters, NO orchestrators, NO complexity
 */
export function useTaskServiceSimple() {
  const taskStore = useTaskStore()

  /**
   * Create a new task with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const createTask = async (taskData: NewTaskData): Promise<Task> => {
    try {
      // Validate required fields
      if (!taskData.title || taskData.title.trim().length === 0) {
        throw new Error('Task title is required')
      }

      // Use store's createTaskWithUndo method (handles persistence automatically)
      const task = await taskStore.createTaskWithUndo({
        title: taskData.title.trim(),
        description: taskData.description?.trim() || '',
        status: taskData.status || 'planned',
        priority: taskData.priority || null,
        progress: taskData.progress || 0,
        estimatedDuration: taskData.estimatedDuration,
        projectId: taskData.projectId || taskStore.getDefaultProjectId(),
        parentTaskId: taskData.parentTaskId || null,
        dueDate: taskData.dueDate || '',
        canvasPosition: taskData.canvasPosition
      })

      console.log(`✅ SimpleTaskService: Created task "${task.title}" (ID: ${task.id})`)
      return task
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to create task`, error)
      throw error
    }
  }

  /**
   * Update an existing task with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const updateTask = async (updateData: UpdateTaskData): Promise<Task> => {
    try {
      const { id, ...updates } = updateData

      if (!id) {
        throw new Error('Task ID is required for updates')
      }

      // Clean the update data
      const cleanUpdates: Partial<Task> = {}
      if (updates.title !== undefined) {
        cleanUpdates.title = updates.title?.trim() || ''
      }
      if (updates.description !== undefined) {
        cleanUpdates.description = updates.description?.trim() || ''
      }
      if (updates.status !== undefined) {
        cleanUpdates.status = updates.status
      }
      if (updates.priority !== undefined) {
        cleanUpdates.priority = updates.priority
      }
      if (updates.progress !== undefined) {
        cleanUpdates.progress = Math.max(0, Math.min(100, updates.progress))
      }
      if (updates.estimatedDuration !== undefined) {
        cleanUpdates.estimatedDuration = updates.estimatedDuration
      }
      if (updates.projectId !== undefined) {
        cleanUpdates.projectId = updates.projectId
      }
      if (updates.parentTaskId !== undefined) {
        cleanUpdates.parentTaskId = updates.parentTaskId
      }
      if (updates.dueDate !== undefined) {
        cleanUpdates.dueDate = updates.dueDate
      }
      if (updates.canvasPosition !== undefined) {
        cleanUpdates.canvasPosition = updates.canvasPosition
      }

      // Use store's updateTaskWithUndo method
      const task = await taskStore.updateTaskWithUndo(id, cleanUpdates)

      console.log(`✅ SimpleTaskService: Updated task "${task.title}" (ID: ${id})`)
      return task
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to update task (ID: ${updateData.id})`, error)
      throw error
    }
  }

  /**
   * Delete a task with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      if (!taskId) {
        throw new Error('Task ID is required for deletion')
      }

      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      await taskStore.deleteTaskWithUndo(taskId)

      console.log(`✅ SimpleTaskService: Deleted task "${task.title}" (ID: ${taskId})`)
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to delete task (ID: ${taskId})`, error)
      throw error
    }
  }

  /**
   * Create a task instance (calendar scheduling)
   */
  const createTaskInstance = async (instanceData: NewTaskInstanceData): Promise<TaskInstance> => {
    try {
      const instance = await taskStore.createTaskInstanceWithUndo(instanceData)

      console.log(`✅ SimpleTaskService: Created instance for task (ID: ${instanceData.taskId})`)
      return instance
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to create instance for task (ID: ${instanceData.taskId})`, error)
      throw error
    }
  }

  /**
   * Update a task instance
   */
  const updateTaskInstance = async (
    taskId: string,
    instanceId: string,
    updates: Partial<TaskInstance>
  ): Promise<TaskInstance> => {
    try {
      const instance = await taskStore.updateTaskInstanceWithUndo(taskId, instanceId, updates)

      console.log(`✅ SimpleTaskService: Updated instance ${instanceId} for task (ID: ${taskId})`)
      return instance
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to update instance ${instanceId} for task (ID: ${taskId})`, error)
      throw error
    }
  }

  /**
   * Delete a task instance
   */
  const deleteTaskInstance = async (taskId: string, instanceId: string): Promise<void> => {
    try {
      await taskStore.deleteTaskInstanceWithUndo(taskId, instanceId)

      console.log(`✅ SimpleTaskService: Deleted instance ${instanceId} for task (ID: ${taskId})`)
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to delete instance ${instanceId} for task (ID: ${taskId})`, error)
      throw error
    }
  }

  /**
   * Create a subtask
   */
  const createSubtask = async (subtaskData: NewSubtaskData): Promise<Subtask> => {
    try {
      const subtask = await taskStore.createSubtaskWithUndo(subtaskData)

      console.log(`✅ SimpleTaskService: Created subtask "${subtaskData.title}" for task (ID: ${subtaskData.parentTaskId})`)
      return subtask
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to create subtask for task (ID: ${subtaskData.parentTaskId})`, error)
      throw error
    }
  }

  /**
   * Update a subtask
   */
  const updateSubtask = async (
    parentTaskId: string,
    subtaskId: string,
    updates: Partial<Subtask>
  ): Promise<Subtask> => {
    try {
      const subtask = await taskStore.updateSubtaskWithUndo(parentTaskId, subtaskId, updates)

      console.log(`✅ SimpleTaskService: Updated subtask ${subtaskId} for task (ID: ${parentTaskId})`)
      return subtask
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to update subtask ${subtaskId} for task (ID: ${parentTaskId})`, error)
      throw error
    }
  }

  /**
   * Delete a subtask
   */
  const deleteSubtask = async (parentTaskId: string, subtaskId: string): Promise<void> => {
    try {
      await taskStore.deleteSubtaskWithUndo(parentTaskId, subtaskId)

      console.log(`✅ SimpleTaskService: Deleted subtask ${subtaskId} for task (ID: ${parentTaskId})`)
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to delete subtask ${subtaskId} for task (ID: ${parentTaskId})`, error)
      throw error
    }
  }

  /**
   * Convenience: Toggle task status (planned → in_progress → done → planned)
   */
  const toggleTaskStatus = async (taskId: string): Promise<Task> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      let newStatus: Task['status']
      switch (task.status) {
        case 'planned':
          newStatus = 'in_progress'
          break
        case 'in_progress':
          newStatus = 'done'
          break
        case 'done':
          newStatus = 'planned'
          break
        default:
          newStatus = 'planned'
      }

      const updatedTask = await updateTask({ id: taskId, status: newStatus })

      console.log(`✅ SimpleTaskService: Toggled task "${task.title}" status from ${task.status} to ${newStatus}`)
      return updatedTask
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to toggle status for task (ID: ${taskId})`, error)
      throw error
    }
  }

  /**
   * Convenience: Mark task as complete
   */
  const completeTask = async (taskId: string): Promise<Task> => {
    return await updateTask({ id: taskId, status: 'done' })
  }

  /**
   * Convenience: Mark task as in progress
   */
  const startTask = async (taskId: string): Promise<Task> => {
    return await updateTask({ id: taskId, status: 'in_progress' })
  }

  /**
   * Convenience: Move task to different project
   */
  const moveTaskToProject = async (taskId: string, projectId: string): Promise<void> => {
    try {
      await taskStore.moveTaskToProjectWithUndo(taskId, projectId)

      console.log(`✅ SimpleTaskService: Moved task (ID: ${taskId}) to project (ID: ${projectId})`)
    } catch (error) {
      console.error(`❌ SimpleTaskService: Failed to move task (ID: ${taskId}) to project (ID: ${projectId})`, error)
      throw error
    }
  }

  return {
    // Core CRUD operations (DIRECT store access)
    createTask,
    updateTask,
    deleteTask,

    // Task instances (calendar scheduling)
    createTaskInstance,
    updateTaskInstance,
    deleteTaskInstance,

    // Subtasks
    createSubtask,
    updateSubtask,
    deleteSubtask,

    // Convenience operations
    toggleTaskStatus,
    completeTask,
    startTask,
    moveTaskToProject,

    // Direct store access for reading (components should use computed properties)
    store: taskStore
  }
}

/**
 * Type guards for validation
 */
export const isValidTaskData = (data: any): data is NewTaskData => {
  return (
    typeof data === 'object' &&
    typeof data.title === 'string' &&
    data.title.trim().length > 0
  )
}

export const isValidUpdateTaskData = (data: any): data is UpdateTaskData => {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.trim().length > 0
  )
}