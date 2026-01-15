// Task type definitions for Pomo-Flow
// These types are extracted from src/stores/tasks.ts for centralization and reuse

export interface Subtask {
  id: string
  parentTaskId: string
  title: string
  description: string
  completedPomodoros: number
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TaskInstance {
  id?: string
  taskId?: string
  scheduledDate: string
  scheduledTime?: string
  duration?: number
  completedPomodoros?: number
  status?: 'scheduled' | 'completed' | 'skipped'
  isRecurring?: boolean
  isLater?: boolean
  pomodoroTracking?: {
    completed: number
    total: number
  }
  createdAt?: Date
  updatedAt?: Date
  // Recurrence fields
  isModified?: boolean
  isSkipped?: boolean
  parentTaskId?: string
}

export interface NotificationPreferences {
  enabled: boolean
  timing: number // minutes before due date
  sound: boolean
  vibration: boolean
}

import { type TaskRecurrence, type RecurringTaskInstance } from './recurrence'

export { type TaskRecurrence, type RecurringTaskInstance }

export interface Task {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Subtask[]
  dueDate: string // Simplified: Single date field - when this task needs to be completed by
  dueTime?: string // Optional specific time for the due date (HH:MM format)
  estimatedDuration?: number // in minutes
  // Legacy scheduling fields (for backward compatibility)
  scheduledDate?: string // YYYY-MM-DD format for legacy support
  scheduledTime?: string // HH:MM format for legacy time support
  // Task classification and planning
  isUncategorized?: boolean // true if task has no project assigned
  estimatedPomodoros?: number // Estimated pomodoro sessions
  projectId: string
  parentId?: string // Link to Canvas Group (Section) - Persisted in position JSON
  parentTaskId?: string | null // For nested tasks - null means root-level task
  createdAt: Date
  updatedAt: Date
  // Canvas workflow fields
  canvasPosition?: { x: number; y: number }
  positionVersion?: number // Version for conflict resolution
  positionFormat?: 'absolute' | 'relative' // TASK-240: Transition to relative-only
  isInInbox?: boolean // True if not yet positioned on canvas
  dependsOn?: string[] // Task IDs this depends on
  tags?: string[] // Task labels for categorization and filtering
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
  // Recurrence and notification fields
  recurrence?: TaskRecurrence // Recurrence pattern and generated instances
  notificationPreferences?: NotificationPreferences // Notification settings for this task
  recurringInstances?: RecurringTaskInstance[] // Generated recurring task instances (for backwards compatibility)
  instances?: TaskInstance[] // Calendar instances for scheduled tasks

  // New SQL-aligned fields (Migration Phase 2)
  order?: number
  columnId?: string
  completedAt?: Date | string

  // Soft Delete Support (Phase 14)
  _soft_deleted?: boolean
  deletedAt?: Date | string
}

export interface Project {
  id: string
  name: string
  color: string | string[] // Support both hex and emoji colors
  colorType: 'hex' | 'emoji'
  emoji?: string // For emoji-based colors
  viewType: 'status' | 'date' | 'priority' // Kanban view type for this project
  parentId?: string | null // For nested projects
  createdAt: Date
  updatedAt: Date
}

// Type aliases and utility types
export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
export type ProjectViewType = Project['viewType']

// Calendar event types (used by calendar composables)
export interface CalendarEvent {
  id: string // instanceId
  taskId: string
  instanceId: string
  title: string
  startTime: Date
  endTime: Date
  duration: number
  startSlot: number
  slotSpan: number
  color: string
  column: number
  totalColumns: number
  isDueDate: boolean // Whether this represents a task due date
  projectId?: string // Project association for visual styling
}

export interface WeekEvent extends CalendarEvent {
  dayIndex: number
}

// Calendar drag ghost (visual feedback during drag operations)
export interface DragGhost {
  visible: boolean
  title: string
  duration: number
  slotIndex: number
  taskId?: string
}

// Task creation types
export interface CreateTaskData {
  title: string
  description?: string
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  dueTime?: string
  estimatedDuration?: number
  estimatedPomodoros?: number
  parentTaskId?: string | null
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  id: string
  progress?: number
  completedPomodoros?: number
  canvasPosition?: { x: number; y: number }
  dependsOn?: string[]
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
}