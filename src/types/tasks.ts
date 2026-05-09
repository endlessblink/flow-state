// Task type definitions for Pomo-Flow
// These types are extracted from src/stores/tasks.ts for centralization and reuse

// BUG-1569: Moved here from taskOperations.ts to break circular dependency
export const UNCATEGORIZED_PROJECT_ID = 'uncategorized' as const

export interface Subtask {
  id: string
  parentTaskId: string
  title: string
  description: string
  completedPomodoros: number
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
  canvasPosition?: { x: number; y: number } | null
}

/** Mini-canvas user-drawn connection between two child nodes (subtask or note). */
export interface MiniCanvasEdge {
  id: string             // stable id, format: `user-${source}-${target}`
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** Mini-canvas free-form planning note (not a subtask) */
export interface PlanningNote {
  id: string
  title: string
  description: string
  color?: string
  imageUrl?: string
  canvasPosition: { x: number; y: number }
  createdAt: string
  updatedAt: string
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
  // TASK-1219: Per-instance notification override
  timeBlockNotifications?: import('./timeBlockNotifications').TimeBlockNotificationOverride
}

// FEATURE-1363: Re-export consolidated NotificationPreferences from notifications.ts
export type { NotificationPreferences, TaskReminder } from './notifications'
import type { NotificationPreferences, TaskReminder } from './notifications'

import { type TaskRecurrence, type RecurringTaskInstance } from './recurrence'

export { type TaskRecurrence, type RecurringTaskInstance }

/** FEATURE-1414: Image attachment stored in Google Drive */
export interface TaskAttachment {
  id: string              // Local UUID (crypto.randomUUID())
  driveFileId: string     // Google Drive file ID
  name: string            // Original filename
  mimeType: string        // e.g. 'image/jpeg'
  thumbnailUrl?: string   // Drive thumbnail URL
  uploadedAt: string      // ISO date string
}

/** TASK-1403: Simplified recurrence rule for clone-on-complete model */
export interface SimpleRecurrenceRule {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number                    // Every N [days/weeks/months/years]
  weekdays?: number[]                 // For weekly: [0-6] (Sun-Sat)
  monthDay?: number                   // For monthly: day of month
  monthWeekday?: { nth: number, day: number }  // For monthly: Nth weekday
  endType: 'never' | 'after_count' | 'on_date'
  endDate?: string                    // ISO date for on_date
  endCount?: number                   // Max occurrences for after_count
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'done'
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
  canvasDismissed?: boolean // True if user explicitly removed from canvas (prevents auto-re-placement)
  dependsOn?: string[] // Task IDs this depends on
  tags?: string[] // Task labels for categorization and filtering
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
  // Recurrence and notification fields
  recurrence?: TaskRecurrence // Recurrence pattern and generated instances (legacy)
  recurrenceRule?: SimpleRecurrenceRule  // TASK-1403: Simplified recurrence for clone-on-complete
  recurrenceParentId?: string            // Links to original task in recurrence chain
  recurrenceCount?: number               // How many times this task has recurred
  notificationPreferences?: NotificationPreferences // Notification settings for this task
  reminders?: TaskReminder[] // FEATURE-1363: Custom date/time reminders
  recurringInstances?: RecurringTaskInstance[] // Generated recurring task instances (for backwards compatibility)
  instances?: TaskInstance[] // Calendar instances for scheduled tasks
  attachments?: TaskAttachment[] // FEATURE-1414: Image attachments via Google Drive
  planningNotes?: PlanningNote[] // Mini-canvas free-form planning nodes
  miniCanvasEdges?: MiniCanvasEdge[] // User-drawn connections inside Thinking Flow

  // New SQL-aligned fields (Migration Phase 2)
  order?: number
  columnId?: string
  completedAt?: Date | string

  // Soft Delete Support (Phase 14)
  _soft_deleted?: boolean
  deletedAt?: Date | string

  // "Done for now" tracking - shows badge when task was rescheduled via this feature
  // Resets when dueDate changes to something other than this value
  doneForNowUntil?: string // YYYY-MM-DD format
  // Marks a task clone created as a calendar history entry for a recurring task completion (read-only record)
  isCompletionRecord?: boolean
  isPinned?: boolean
  // Workspace collaboration (Phase 1)
  workspaceId?: string | null
  assignedTo?: string | null
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
  // Workspace collaboration
  workspaceId?: string | null
}

// Type aliases and utility types
export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
export type ProjectViewType = Project['viewType']

// Project tree node — shared between the store's projectTree getter and
// consumers (CategorySelector, sidebar flatten helpers). Orphans whose
// parentId points at a no-longer-existing project are bucketed under the
// null root so they remain reachable from a single traversal.
export interface ProjectTreeNode {
  project: Project
  children: ProjectTreeNode[]
  depth: number
}

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
  instanceStatus?: 'scheduled' | 'completed' | 'skipped' // TASK-1285: Instance completion tracking
  taskStatus?: Task['status'] // TASK-1285: Parent task status for UI display
  isVirtual?: boolean // Display-only recurring event preview (no physical task)
}

/** TASK-1418: Virtual recurring event for calendar preview (display-only, no physical task) */
export interface VirtualCalendarEvent {
  id: string              // 'virtual-{taskId}-{date}'
  taskId: string          // The chain head task's ID
  title: string
  scheduledDate: string   // YYYY-MM-DD
  scheduledTime?: string
  duration?: number
  isVirtual: true         // Discriminator — always true
  projectId?: string
  priority: Task['priority']
  recurrenceRule: SimpleRecurrenceRule
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

// TASK-1334: Group By types for All Tasks view
export type GroupByType = 'none' | 'project' | 'status' | 'priority' | 'dueDate'

export interface TaskGroup {
  key: string
  title: string
  emoji?: string
  color?: string | string[]
  tasks: Task[]
  parentTasks: Task[]
  indent?: number
}