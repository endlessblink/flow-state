/**
 * SERVICE-ORCHESTRATOR-ENHANCED TASK SERVICE
 *
 * Enhanced task service that integrates with ServiceOrchestrator for unified data access.
 * Provides high-level task management with proper service orchestration.
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

export interface ServiceOrchestratorInterface {
  createTask(taskData: Partial<Task>): Promise<ApiResponse<Task>>
  updateTask(taskId: string, updates: Partial<Task>): Promise<ApiResponse<Task>>
  deleteTask(taskId: string): Promise<ApiResponse<void>>
  createProject(projectData: Partial<Project>): Promise<ApiResponse<Project>>
  updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>>
  deleteProject(projectId: string): Promise<ApiResponse<void>>
  getAllTasks(): Task[]
  getAllProjects(): Project[]
  getTaskById(taskId: string): Task | null
  getProjectById(projectId: string): Project | null
  getFilteredTasks(options?: any): Task[]
  getFilteredTaskCount(options?: any): number
  createMultipleTasks(tasksData: Partial<Task>[]): Promise<any>
  deleteMultipleTasks(taskIds: string[]): Promise<any>
}

/**
 * Enhanced Task Service implementation
 * Integrates with ServiceOrchestrator for unified task management
 */
export class TaskServiceEnhanced {
  constructor(private serviceOrchestrator: ServiceOrchestratorInterface) {}

  /**
   * Create a new task with enhanced validation and ServiceOrchestrator integration
   */
  async createTask(taskData: CreateTaskData): Promise<ApiResponse<Task>> {
    try {
      // Validate task data
      const validation = this.validateTaskData(taskData)
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Task validation failed',
          details: { errors: validation.errors, warnings: validation.warnings }
        }
      }

      // Prepare task data for ServiceOrchestrator
      const enhancedTaskData: Partial<Task> = {
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
        connectionTypes: {},
        instances: taskData.instances || []
      }

      // Create task through ServiceOrchestrator
      const result = await this.serviceOrchestrator.createTask(enhancedTaskData)

      if (result.success && result.data) {
        console.log(`✅ Task created: ${result.data.title} (${result.data.id})`)
        return {
          success: true,
          data: result.data,
          timestamp: new Date(),
          details: { warnings: validation.warnings }
        }
      } else {
        return {
          success: false,
          error: result.error || 'Failed to create task',
          timestamp: new Date()
        }
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
   * Update an existing task with enhanced validation
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

      // Check if task exists
      const existingTask = this.serviceOrchestrator.getTaskById(taskId)
      if (!existingTask) {
        return {
          success: false,
          error: 'Task not found',
          timestamp: new Date()
        }
      }

      // Validate update data
      const validation = this.validateUpdateData(updateData)
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Task update validation failed',
          details: { errors: validation.errors, warnings: validation.warnings }
        }
      }

      // Prepare update data with timestamp
      const enhancedUpdateData: Partial<Task> = {
        ...updateData,
        updatedAt: new Date()
      }

      // Update task through ServiceOrchestrator
      const result = await this.serviceOrchestrator.updateTask(taskId, enhancedUpdateData)

      if (result.success && result.data) {
        console.log(`✅ Task updated: ${result.data.title} (${taskId})`)
        return {
          success: true,
          data: result.data,
          timestamp: new Date(),
          details: { warnings: validation.warnings }
        }
      } else {
        return {
          success: false,
          error: result.error || 'Failed to update task',
          timestamp: new Date()
        }
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

      // Check if task exists
      const existingTask = this.serviceOrchestrator.getTaskById(taskId)
      if (!existingTask) {
        return {
          success: false,
          error: 'Task not found',
          timestamp: new Date()
        }
      }

      // Check if task has dependencies
      const dependencies = await this.getTaskDependencies(taskId)
      if (dependencies.length > 0) {
        return {
          success: false,
          error: 'Cannot delete task with dependencies',
          details: { dependencies }
        }
      }

      // Delete task through ServiceOrchestrator
      const result = await this.serviceOrchestrator.deleteTask(taskId)

      if (result.success) {
        console.log(`✅ Task deleted: ${existingTask.title} (${taskId})`)
        return {
          success: true,
          timestamp: new Date()
        }
      } else {
        return {
          success: false,
          error: result.error || 'Failed to delete task',
          timestamp: new Date()
        }
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
   * Create multiple tasks efficiently
   */
  async createMultipleTasks(tasksData: CreateTaskData[]): Promise<ApiResponse<Task[]>> {
    try {
      // Validate all tasks first
      const validationResults = tasksData.map(data => this.validateTaskData(data))
      const invalidTasks = validationResults.filter(result => !result.isValid)

      if (invalidTasks.length > 0) {
        return {
          success: false,
          error: 'Multiple tasks failed validation',
          details: {
            errors: invalidTasks.flatMap(result => result.errors),
            warnings: validationResults.flatMap(result => result.warnings)
          }
        }
      }

      // Prepare enhanced task data
      const enhancedTasksData = tasksData.map(taskData => ({
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
        isInInbox: true,
        dependsOn: [],
        connectionTypes: {},
        instances: taskData.instances || []
      }))

      // Create tasks through ServiceOrchestrator
      const result = await this.serviceOrchestrator.createMultipleTasks(enhancedTasksData)

      if (result.success) {
        console.log(`✅ Created ${result.summary.successful} tasks successfully`)
        return {
          success: true,
          data: result.results,
          timestamp: new Date(),
          details: {
            summary: result.summary,
            warnings: validationResults.flatMap(result => result.warnings)
          }
        }
      } else {
        return {
          success: false,
          error: 'Failed to create multiple tasks',
          details: {
            errors: result.errors,
            summary: result.summary
          }
        }
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
   * Delete multiple tasks efficiently
   */
  async deleteMultipleTasks(taskIds: string[]): Promise<ApiResponse<void>> {
    try {
      if (!taskIds.length) {
        return {
          success: false,
          error: 'No task IDs provided',
          timestamp: new Date()
        }
      }

      // Validate all task IDs exist
      const existingTasks = taskIds
        .map(id => this.serviceOrchestrator.getTaskById(id))
        .filter(task => task !== null)

      if (existingTasks.length !== taskIds.length) {
        return {
          success: false,
          error: 'One or more tasks not found',
          timestamp: new Date()
        }
      }

      // Delete tasks through ServiceOrchestrator
      const result = await this.serviceOrchestrator.deleteMultipleTasks(taskIds)

      if (result.success) {
        console.log(`✅ Deleted ${result.summary.successful} tasks successfully`)
        return {
          success: true,
          timestamp: new Date(),
          details: { summary: result.summary }
        }
      } else {
        return {
          success: false,
          error: 'Failed to delete multiple tasks',
          details: {
            errors: result.errors,
            summary: result.summary
          }
        }
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
   * Get comprehensive task statistics
   */
  async getTaskStatistics(filter?: TaskFilter): Promise<TaskStatistics> {
    try {
      let tasks: Task[]

      if (filter) {
        tasks = this.serviceOrchestrator.getFilteredTasks(filter)
      } else {
        tasks = this.serviceOrchestrator.getAllTasks()
      }

      // Calculate statistics
      const stats: TaskStatistics = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        plannedTasks: tasks.filter(t => t.status === 'planned').length,
        backlogTasks: tasks.filter(t => t.status === 'backlog').length,
        onHoldTasks: tasks.filter(t => t.status === 'on_hold').length,
        totalEstimatedMinutes: tasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0),
        totalCompletedPomodoros: tasks.reduce((sum, task) => sum + (task.completedPomodoros || 0), 0)
      }

      return stats
    } catch (error) {
      console.error('Failed to get task statistics:', error)
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
   * Search tasks with advanced filtering
   */
  async searchTasks(query: string, options: {
    searchIn?: Array<'title' | 'description'>
    caseSensitive?: boolean
    projectId?: string
    status?: string[]
    priority?: string[]
  } = {}): Promise<ApiResponse<Task[]>> {
    try {
      let tasks = this.serviceOrchestrator.getAllTasks()

      // Apply filters
      if (options.projectId) {
        tasks = tasks.filter(task => task.projectId === options.projectId)
      }

      if (options.status?.length) {
        tasks = tasks.filter(task => options.status!.includes(task.status))
      }

      if (options.priority?.length) {
        tasks = tasks.filter(task => task.priority && options.priority!.includes(task.priority))
      }

      // Apply text search
      if (query.trim()) {
        const searchQuery = options.caseSensitive ? query : query.toLowerCase()
        const searchFields = options.searchIn || ['title', 'description']

        tasks = tasks.filter(task => {
          return searchFields.some(field => {
            let value = ''
            if (field === 'title') value = task.title
            if (field === 'description') value = task.description

            if (!options.caseSensitive) {
              value = value.toLowerCase()
            }

            return value.includes(searchQuery)
          })
        })
      }

      return {
        success: true,
        data: tasks,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Private helper methods
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

  private async getTaskDependencies(taskId: string): Promise<string[]> {
    // Check for tasks that depend on this task
    const allTasks = this.serviceOrchestrator.getAllTasks()
    return allTasks
      .filter(task => task.dependsOn?.includes(taskId))
      .map(task => task.id)
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateString)) return false

    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime())
  }
}

/**
 * Composable for using the enhanced task service
 */
export function useTaskServiceEnhanced(serviceOrchestrator: ServiceOrchestratorInterface) {
  const taskService = new TaskServiceEnhanced(serviceOrchestrator)

  return {
    // Task operations
    createTask: taskService.createTask.bind(taskService),
    updateTask: taskService.updateTask.bind(taskService),
    deleteTask: taskService.deleteTask.bind(taskService),
    createMultipleTasks: taskService.createMultipleTasks.bind(taskService),
    deleteMultipleTasks: taskService.deleteMultipleTasks.bind(taskService),

    // Search and statistics
    searchTasks: taskService.searchTasks.bind(taskService),
    getTaskStatistics: taskService.getTaskStatistics.bind(taskService)
  }
}