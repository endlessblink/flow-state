/**
 * Task Service for coordinating task operations
 *
 * Provides a high-level interface for task management operations,
 * coordinating between stores, persistence, and business logic.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

import type {
  Task,
  Subtask,
  TaskInstance,
  Project,
  CreateTaskData,
  UpdateTaskData,
  TaskFilter,
  TaskValidationResult,
  TaskStatistics,
  ApiResponse
} from '@/types'
import { eventBus } from './EventBus'

/**
 * Task Service implementation
 * Coordinates task operations with proper error handling and event emission
 */
export class TaskService {
  /**
   * Create a new task with validation and event emission
   *
   * @param taskData - Data for creating the task
   * @returns Promise resolving to the created task or error
   */
  async createTask(taskData: CreateTaskData): Promise<ApiResponse<Task>> {
    try {
      // Validate task data
      const validation = this.validateTaskData(taskData)
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Task validation failed',
          details: { errors: validation.errors }
        }
      }

      // Emit task creation event
      eventBus.emit('task:creating', { data: taskData })

      // Create task with proper defaults
      const task: Task = {
        id: this.generateId(),
        title: taskData.title.trim(),
        description: taskData.description?.trim() || '',
        status: taskData.status || 'planned',
        priority: taskData.priority || null,
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: taskData.dueDate || '',
        estimatedDuration: taskData.estimatedDuration,
        projectId: taskData.projectId || 'default',
        parentTaskId: taskData.parentTaskId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Canvas workflow defaults
        isInInbox: true, // New tasks start in inbox
        dependsOn: [],
        connectionTypes: {}
      }

      // Emit task created event
      eventBus.emit('task:created', { task })

      return {
        success: true,
        data: task,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Update an existing task with validation and event emission
   *
   * @param taskId - ID of task to update
   * @param updateData - Data to update
   * @returns Promise resolving to updated task or error
   */
  async updateTask(taskId: string, updateData: UpdateTaskData): Promise<ApiResponse<Task>> {
    try {
      // Validate inputs
      if (!taskId) {
        return {
          success: false,
          error: 'Task ID is required',
          timestamp: new Date()
        }
      }

      // Validate update data
      const validation = this.validateUpdateData(updateData)
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Task update validation failed',
          details: { errors: validation.errors }
        }
      }

      // Emit task update event
      eventBus.emit('task:updating', { taskId, data: updateData })

      // In a real implementation, this would update the task in the store
      // For now, we'll emit an event that the store can listen to
      eventBus.emit('task:updated', { taskId, data: updateData })

      return {
        success: true,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Delete a task with validation and cleanup
   *
   * @param taskId - ID of task to delete
   * @returns Promise resolving to deletion result
   */
  async deleteTask(taskId: string): Promise<ApiResponse<void>> {
    try {
      if (!taskId) {
        return {
          success: false,
          error: 'Task ID is required',
          timestamp: new Date()
        }
      }

      // Emit task deletion event
      eventBus.emit('task:deleting', { taskId })

      // Check if task has dependencies
      const dependencies = await this.getTaskDependencies(taskId)
      if (dependencies.length > 0) {
        return {
          success: false,
          error: 'Cannot delete task with dependencies',
          details: { dependencies }
        }
      }

      // Emit task deleted event
      eventBus.emit('task:deleted', { taskId })

      return {
        success: true,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Add a subtask to a parent task
   *
   * @param parentTaskId - ID of parent task
   * @param subtaskData - Data for subtask creation
   * @returns Promise resolving to created subtask or error
   */
  async addSubtask(parentTaskId: string, subtaskData: { title: string; description?: string }): Promise<ApiResponse<Subtask>> {
    try {
      if (!parentTaskId) {
        return {
          success: false,
          error: 'Parent task ID is required',
          timestamp: new Date()
        }
      }

      if (!subtaskData.title?.trim()) {
        return {
          success: false,
          error: 'Subtask title is required',
          timestamp: new Date()
        }
      }

      const subtask: Subtask = {
        id: this.generateId(),
        parentTaskId,
        title: subtaskData.title.trim(),
        description: subtaskData.description?.trim() || '',
        completedPomodoros: 0,
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Emit subtask added event
      eventBus.emit('subtask:added', { parentTaskId, subtask })

      return {
        success: true,
        data: subtask,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Update a subtask
   *
   * @param subtaskId - ID of subtask to update
   * @param updates - Data to update
   * @returns Promise resolving to update result
   */
  async updateSubtask(subtaskId: string, updates: Partial<Subtask>): Promise<ApiResponse<void>> {
    try {
      if (!subtaskId) {
        return {
          success: false,
          error: 'Subtask ID is required',
          timestamp: new Date()
        }
      }

      // Emit subtask update event
      eventBus.emit('subtask:updated', { subtaskId, updates })

      return {
        success: true,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Add a task instance for calendar scheduling
   *
   * @param taskId - ID of parent task
   * @param instanceData - Data for instance creation
   * @returns Promise resolving to created instance or error
   */
  async addTaskInstance(taskId: string, instanceData: {
    scheduledDate: string
    scheduledTime: string
    duration?: number
  }): Promise<ApiResponse<TaskInstance>> {
    try {
      if (!taskId) {
        return {
          success: false,
          error: 'Task ID is required',
          timestamp: new Date()
        }
      }

      if (!instanceData.scheduledDate || !instanceData.scheduledTime) {
        return {
          success: false,
          error: 'Scheduled date and time are required',
          timestamp: new Date()
        }
      }

      const instance: TaskInstance = {
        id: this.generateId(),
        scheduledDate: instanceData.scheduledDate,
        scheduledTime: instanceData.scheduledTime,
        duration: instanceData.duration,
        completedPomodoros: 0,
        isLater: false
      }

      // Emit instance added event
      eventBus.emit('instance:added', { taskId, instance })

      return {
        success: true,
        data: instance,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Get task statistics
   *
   * @param filter - Optional filter to limit statistics scope
   * @returns Task statistics
   */
  async getTaskStatistics(filter?: TaskFilter): Promise<TaskStatistics> {
    try {
      // Emit statistics request event
      eventBus.emit('stats:requested', { filter })

      // In a real implementation, this would calculate from store data
      // For now, return default statistics
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        plannedTasks: 0,
        backlogTasks: 0,
        onHoldTasks: 0,
        totalEstimatedMinutes: 0,
        totalCompletedPomodoros: 0
      }
    } catch (error) {
      // Return default statistics on error
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        plannedTasks: 0,
        backlogTasks: 0,
        onHoldTasks: 0,
        totalEstimatedMinutes: 0,
        totalCompletedPomodoros: 0
      }
    }
  }

  /**
   * Validate task data
   *
   * @param taskData - Task data to validate
   * @returns Validation result
   */
  private validateTaskData(taskData: CreateTaskData): TaskValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required field validation
    if (!taskData.title?.trim()) {
      errors.push('Task title is required')
    }

    if (taskData.title && taskData.title.length > 200) {
      errors.push('Task title must be less than 200 characters')
    }

    if (taskData.description && taskData.description.length > 2000) {
      warnings.push('Task description is very long (over 2000 characters)')
    }

    // Date validation
    if (taskData.dueDate && !this.isValidDate(taskData.dueDate)) {
      errors.push('Due date is invalid')
    }

    // Duration validation
    if (taskData.estimatedDuration && taskData.estimatedDuration < 0) {
      errors.push('Estimated duration must be positive')
    }

    if (taskData.estimatedDuration && taskData.estimatedDuration > 480) {
      warnings.push('Estimated duration exceeds 8 hours')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate task update data
   *
   * @param updateData - Update data to validate
   * @returns Validation result
   */
  private validateUpdateData(updateData: UpdateTaskData): TaskValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Title validation
    if (updateData.title !== undefined) {
      if (!updateData.title?.trim()) {
        errors.push('Task title cannot be empty')
      }
      if (updateData.title && updateData.title.length > 200) {
        errors.push('Task title must be less than 200 characters')
      }
    }

    // Progress validation
    if (updateData.progress !== undefined) {
      if (updateData.progress < 0 || updateData.progress > 100) {
        errors.push('Progress must be between 0 and 100')
      }
    }

    // Date validation
    if (updateData.dueDate !== undefined && updateData.dueDate && !this.isValidDate(updateData.dueDate)) {
      errors.push('Due date is invalid')
    }

    // Duration validation
    if (updateData.estimatedDuration !== undefined && updateData.estimatedDuration !== null) {
      if (updateData.estimatedDuration < 0) {
        errors.push('Estimated duration must be positive')
      }
      if (updateData.estimatedDuration > 480) {
        warnings.push('Estimated duration exceeds 8 hours')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get task dependencies
   *
   * @param taskId - Task ID to check dependencies for
   * @returns Array of dependent task IDs
   */
  private async getTaskDependencies(taskId: string): Promise<string[]> {
    // In a real implementation, this would check the store for dependent tasks
    // For now, return empty array
    return []
  }

  /**
   * Validate date string
   *
   * @param dateString - Date string to validate (YYYY-MM-DD format)
   * @returns Whether date is valid
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateString)) return false

    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime())
  }

  /**
   * Generate unique ID
   *
   * @returns Unique identifier
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Create singleton instance
export const taskService = new TaskService()

// Export type for dependency injection
export type TaskServiceInterface = TaskService

/**
 * Composable for using the task service
 * Provides a Vue-friendly interface to the task service
 */
export function useTaskService() {
  return {
    // Task operations
    createTask: taskService.createTask.bind(taskService),
    updateTask: taskService.updateTask.bind(taskService),
    deleteTask: taskService.deleteTask.bind(taskService),

    // Subtask operations
    addSubtask: taskService.addSubtask.bind(taskService),
    updateSubtask: taskService.updateSubtask.bind(taskService),

    // Instance operations
    addTaskInstance: taskService.addTaskInstance.bind(taskService),

    // Statistics
    getTaskStatistics: taskService.getTaskStatistics.bind(taskService)
  }
}