/**
 * Task-related type definitions for the Pomo-Flow application
 *
 * This file contains all TypeScript interfaces and types related to task management,
 * extracted from the monolithic tasks.ts store for better modularity and reusability.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

/**
 * Individual subtask within a parent task
 * Represents a smaller unit of work that contributes to a larger task
 */
export interface Subtask {
  /** Unique identifier for the subtask */
  id: string
  /** Reference to the parent task ID */
  parentTaskId: string
  /** Subtask title/name */
  title: string
  /** Detailed description of what needs to be done */
  description: string
  /** Number of Pomodoro sessions completed for this subtask */
  completedPomodoros: number
  /** Completion status of the subtask */
  isCompleted: boolean
  /** Timestamp when subtask was created */
  createdAt: Date
  /** Timestamp when subtask was last updated */
  updatedAt: Date
}

/**
 * Calendar instance of a task
 * Represents a specific scheduled occurrence of a task, enabling task reuse
 * across multiple dates/time slots without creating duplicate tasks
 */
export interface TaskInstance {
  /** Unique identifier for this instance */
  id: string
  /** Scheduled date for this instance (YYYY-MM-DD format) */
  scheduledDate: string
  /** Scheduled time for this instance (HH:MM format) */
  scheduledTime: string
  /** Optional duration override in minutes (defaults to task.estimatedDuration) */
  duration?: number
  /** Number of Pomodoros completed for this specific instance */
  completedPomodoros?: number
  /** Flag to distinguish "Later" scheduling from "No Date" */
  isLater?: boolean
}

/**
 * Core task status types
 * Represents the current state of a task in the workflow
 */
export type TaskStatus = 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'

/**
 * Task priority levels
 * Indicates importance and urgency of task completion
 */
export type TaskPriority = 'low' | 'medium' | 'high' | null

/**
 * Connection types between tasks
 * Defines how tasks relate to each other in dependency chains
 */
export type ConnectionType = 'sequential' | 'blocker' | 'reference'

/**
 * Main task interface
 * Represents a complete task with all properties and metadata
 */
export interface Task {
  /** Unique identifier for the task */
  id: string
  /** Task title/name */
  title: string
  /** Detailed description of the task */
  description: string
  /** Current status of the task */
  status: TaskStatus
  /** Priority level of the task */
  priority: TaskPriority
  /** Progress percentage (0-100) */
  progress: number
  /** Total number of completed Pomodoro sessions */
  completedPomodoros: number
  /** Array of subtasks belonging to this task */
  subtasks: Subtask[]
  /** Due date string (YYYY-MM-DD format) */
  dueDate: string
  /**
   * @deprecated Use instances array instead
   * Legacy scheduled date for backward compatibility
   */
  scheduledDate?: string
  /**
   * @deprecated Use instances array instead
   * Legacy scheduled time for backward compatibility
   */
  scheduledTime?: string
  /** Estimated duration in minutes for completion */
  estimatedDuration?: number
  /** Calendar instances - enables task reuse across multiple dates */
  instances?: TaskInstance[]
  /** Project ID this task belongs to */
  projectId: string
  /** Parent task ID for nested tasks (null means root-level) */
  parentTaskId?: string | null
  /** Timestamp when task was created */
  createdAt: Date
  /** Timestamp when task was last updated */
  updatedAt: Date

  // Canvas workflow fields
  /** Position coordinates on canvas (x, y) */
  canvasPosition?: { x: number; y: number }
  /** Flag indicating if task is in inbox (not yet positioned on canvas) */
  isInInbox?: boolean
  /** Array of task IDs this task depends on */
  dependsOn?: string[]
  /** Connection types for dependent tasks */
  connectionTypes?: { [targetTaskId: string]: ConnectionType }
}

/**
 * Project interface
 * Represents a project container for organizing related tasks
 */
export interface Project {
  /** Unique identifier for the project */
  id: string
  /** Project name */
  name: string
  /** Project color (supports hex, emoji, or gradient) */
  color: string | string[]
  /** Color type classification */
  colorType: 'hex' | 'emoji' | 'color' | 'gradient'
  /** Optional emoji for emoji-based colors */
  emoji?: string
  /** Default Kanban view type for this project */
  viewType: 'status' | 'date' | 'priority'
  /** Parent project ID for nested projects */
  parentId?: string | null
  /** Timestamp when project was created */
  createdAt: Date
  /** Timestamp when project was last modified */
  updatedAt?: Date
  /** Data source classification for prioritization */
  dataSource?: 'user' | 'template' | 'localStorage' | 'hardcoded'
  /** Optional project description */
  description?: string
}

/**
 * Task creation data interface
 * Represents the minimum required data to create a new task
 */
export interface CreateTaskData {
  /** Task title (required) */
  title: string
  /** Optional task description */
  description?: string
  /** Optional initial status */
  status?: TaskStatus
  /** Optional initial priority */
  priority?: TaskPriority
  /** Optional project assignment */
  projectId?: string
  /** Optional parent task for nesting */
  parentTaskId?: string | null
  /** Optional due date */
  dueDate?: string
  /** Optional estimated duration */
  estimatedDuration?: number
}

/**
 * Task update data interface
 * Represents partial data for updating an existing task
 */
export interface UpdateTaskData {
  /** Optional updated title */
  title?: string
  /** Optional updated description */
  description?: string
  /** Optional updated status */
  status?: TaskStatus
  /** Optional updated priority */
  priority?: TaskPriority
  /** Optional updated progress */
  progress?: number
  /** Optional updated project assignment */
  projectId?: string
  /** Optional updated due date */
  dueDate?: string
  /** Optional updated estimated duration */
  estimatedDuration?: number
  /** Optional canvas position */
  canvasPosition?: { x: number; y: number }
  /** Optional inbox status */
  isInInbox?: boolean
  /** Optional dependencies */
  dependsOn?: string[]
  /** Optional connection types */
  connectionTypes?: { [targetTaskId: string]: ConnectionType }
}

/**
 * Task validation result interface
 * Represents the outcome of task data validation
 */
export interface TaskValidationResult {
  /** Whether the task data is valid */
  isValid: boolean
  /** Array of validation error messages */
  errors: string[]
  /** Array of validation warning messages */
  warnings: string[]
}

/**
 * Task filter configuration interface
 * Defines criteria for filtering and searching tasks
 */
export interface TaskFilter {
  /** Status values to include */
  statuses?: TaskStatus[]
  /** Priority values to include */
  priorities?: TaskPriority[]
  /** Project IDs to include */
  projectIds?: string[]
  /** Tags to include */
  tags?: string[]
  /** Date range for filtering */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Search query string */
  searchQuery?: string
  /** Whether to include completed tasks */
  includeCompleted?: boolean
  /** Whether to include archived tasks */
  includeArchived?: boolean
}

/**
 * Task statistics interface
 * Represents aggregated data about tasks
 */
export interface TaskStatistics {
  /** Total number of tasks */
  totalTasks: number
  /** Number of completed tasks */
  completedTasks: number
  /** Number of tasks in progress */
  inProgressTasks: number
  /** Number of planned tasks */
  plannedTasks: number
  /** Number of backlog tasks */
  backlogTasks: number
  /** Number of on-hold tasks */
  onHoldTasks: number
  /** Total estimated duration in minutes */
  totalEstimatedMinutes: number
  /** Total completed Pomodoro sessions */
  totalCompletedPomodoros: number
  /** Average completion time in minutes */
  averageCompletionTime?: number
}

/**
 * Task export/import data interface
 * Represents task data for export/import operations
 */
export interface TaskExportData {
  /** Version of export format */
  version: string
  /** Export timestamp */
  exportedAt: Date
  /** Array of tasks */
  tasks: Task[]
  /** Array of projects */
  projects: Project[]
  /** Export metadata */
  metadata?: {
    [key: string]: any
  }
}