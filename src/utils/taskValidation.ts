/**
 * Task Validation Utility
 * BUG-060 FIX: Multi-layer defense against undefined/invalid task IDs
 *
 * This utility provides centralized validation for task data integrity,
 * preventing phantom tasks, sync loops, and data corruption.
 */

import type { Task } from '@/types/tasks'
import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'

/**
 * Validation result with detailed error information
 */
export interface TaskValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  taskId: string | undefined
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  validTasks: Task[]
  invalidTasks: { task: unknown; errors: string[] }[]
  totalProcessed: number
  validCount: number
  invalidCount: number
}

/**
 * UUID regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Check if a task ID is valid
 * Valid IDs must be:
 * - Non-empty strings
 * - Not 'undefined' or 'null' literals
 * - Valid UUID format OR legacy prefixed format (group-xxx, instance-xxx, etc.)
 */
export function isValidTaskId(id: unknown): id is string {
  if (typeof id !== 'string') return false
  if (id === '') return false
  if (id === 'undefined') return false
  if (id === 'null') return false
  if (id.trim() === '') return false

  // Check for valid UUID format (Supabase requirement)
  if (UUID_REGEX.test(id)) return true

  // Allow legacy prefixed IDs (group-xxx, instance-xxx, recovered-xxx, etc.)
  if (id.includes('-') && !id.match(/^\d+$/)) return true

  // Block pure numeric IDs (e.g., "1767970660403") - these break Supabase
  if (/^\d+$/.test(id)) {
    console.warn(`🛡️ [VALIDATION] Blocking numeric ID: ${id} (not UUID compatible)`)
    return false
  }

  return true
}

/**
 * Generate a fallback task ID
 * Used when a task has no valid ID but needs to be preserved
 */
export function generateFallbackId(prefix: string = 'recovered'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Validate a single task object
 */
export function validateTask(task: unknown): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if task is an object
  if (!task || typeof task !== 'object') {
    return {
      isValid: false,
      errors: ['Task is not a valid object'],
      warnings: [],
      taskId: undefined
    }
  }

  const taskObj = task as Record<string, unknown>

  // Critical: Check ID
  if (!isValidTaskId(taskObj.id)) {
    errors.push(`Invalid task ID: ${JSON.stringify(taskObj.id)} (type: ${typeof taskObj.id})`)
  }

  // Check title (optional but warned)
  if (!taskObj.title || typeof taskObj.title !== 'string' || taskObj.title.trim() === '') {
    warnings.push('Task has no valid title')
  }

  // Check for required fields
  if (!taskObj.status) {
    warnings.push('Task has no status, will default to "planned"')
  }

  // Check dates
  if (taskObj.createdAt && !(taskObj.createdAt instanceof Date) && typeof taskObj.createdAt !== 'string') {
    warnings.push('Task has invalid createdAt format')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    taskId: isValidTaskId(taskObj.id) ? taskObj.id : undefined
  }
}

/**
 * Validate and sanitize a batch of tasks
 * Returns valid tasks and reports on invalid ones
 */
export function validateAndSanitizeTasks(tasks: unknown[]): BatchValidationResult {
  const validTasks: Task[] = []
  const invalidTasks: { task: unknown; errors: string[] }[] = []

  if (!Array.isArray(tasks)) {
    console.error('🛡️ [VALIDATION] validateAndSanitizeTasks received non-array:', typeof tasks)
    return {
      validTasks: [],
      invalidTasks: [],
      totalProcessed: 0,
      validCount: 0,
      invalidCount: 0
    }
  }

  for (const task of tasks) {
    const result = validateTask(task)

    if (result.isValid) {
      validTasks.push(task as Task)
    } else {
      invalidTasks.push({ task, errors: result.errors })
      console.warn('🛡️ [VALIDATION] Invalid task detected:', {
        errors: result.errors,
        taskSnapshot: JSON.stringify(task).substring(0, 200)
      })
    }

    // Log warnings even for valid tasks
    if (result.warnings.length > 0 && result.isValid) {
      console.warn(`🛡️ [VALIDATION] Task ${result.taskId} has warnings:`, result.warnings)
    }
  }

  return {
    validTasks,
    invalidTasks,
    totalProcessed: tasks.length,
    validCount: validTasks.length,
    invalidCount: invalidTasks.length
  }
}

/**
 * Sanitize a task by fixing recoverable issues
 * Returns null if task is unrecoverable
 */
export function sanitizeTask(task: unknown, options: {
  generateIdIfMissing?: boolean
  idPrefix?: string
} = {}): Task | null {
  const { generateIdIfMissing = true, idPrefix = 'sanitized' } = options

  if (!task || typeof task !== 'object') {
    return null
  }

  const taskObj = task as Record<string, unknown>

  // Handle missing/invalid ID
  let taskId = taskObj.id as string | undefined
  if (!isValidTaskId(taskId)) {
    if (generateIdIfMissing) {
      taskId = generateFallbackId(idPrefix)
      // console.log(`🛡️ [SANITIZE] Generated fallback ID: ${taskId}`)
    } else {
      console.error('🛡️ [SANITIZE] Task has invalid ID and generateIdIfMissing is false')
      return null
    }
  }

  // Build sanitized task
  const sanitizedTask: Task = {
    id: taskId,
    title: (typeof taskObj.title === 'string' && taskObj.title.trim())
      ? taskObj.title
      : 'Recovered Task',
    description: typeof taskObj.description === 'string' ? taskObj.description : '',
    status: isValidStatus(taskObj.status) ? taskObj.status : 'planned',
    priority: isValidPriority(taskObj.priority) ? taskObj.priority : 'medium',
    progress: typeof taskObj.progress === 'number' ? taskObj.progress : 0,
    completedPomodoros: typeof taskObj.completedPomodoros === 'number' ? taskObj.completedPomodoros : 0,
    subtasks: Array.isArray(taskObj.subtasks) ? taskObj.subtasks : [],
    dueDate: typeof taskObj.dueDate === 'string' ? taskObj.dueDate : new Date().toISOString().split('T')[0],
    projectId: typeof taskObj.projectId === 'string' ? taskObj.projectId : UNCATEGORIZED_PROJECT_ID,
    createdAt: parseDate(taskObj.createdAt) || new Date(),
    updatedAt: parseDate(taskObj.updatedAt) || new Date(),
    instances: Array.isArray(taskObj.instances) ? taskObj.instances : [],
    isInInbox: typeof taskObj.isInInbox === 'boolean' ? taskObj.isInInbox : true,
    canvasPosition: taskObj.canvasPosition as Task['canvasPosition'],
    parentTaskId: typeof taskObj.parentTaskId === 'string' ? taskObj.parentTaskId : null
  }

  return sanitizedTask
}

/**
 * Load-time sanitization for tasks from database
 * Filters out invalid tasks and sanitizes recoverable ones
 */
export function sanitizeLoadedTasks(loadedData: unknown): Task[] {
  if (!Array.isArray(loadedData)) {
    console.warn('🛡️ [LOAD-SANITIZE] Loaded data is not an array')
    return []
  }

  const sanitizedTasks: Task[] = []
  const droppedCount = { invalid: 0, recovered: 0 }

  for (const item of loadedData) {
    const validation = validateTask(item)

    if (validation.isValid) {
      // Task is valid, add directly
      sanitizedTasks.push(item as Task)
    } else {
      // Try to sanitize
      const sanitized = sanitizeTask(item, {
        generateIdIfMissing: true,
        idPrefix: 'db-recovery'
      })

      if (sanitized) {
        sanitizedTasks.push(sanitized)
        droppedCount.recovered++
        // console.log(`🛡️ [LOAD-SANITIZE] Recovered task: ${sanitized.id}`)
      } else {
        droppedCount.invalid++
        console.error('🛡️ [LOAD-SANITIZE] Dropped unrecoverable task:', item)
      }
    }
  }

  if (droppedCount.invalid > 0 || droppedCount.recovered > 0) {
    // console.log(`🛡️ [LOAD-SANITIZE] Summary: ${sanitizedTasks.length} valid, ${droppedCount.recovered} recovered, ${droppedCount.invalid} dropped`)
  }

  return sanitizedTasks
}

/**
 * Pre-save validation - blocks saving of invalid tasks
 */
export function validateBeforeSave(tasks: Task[]): {
  canSave: boolean
  validTasks: Task[]
  blockedTasks: Task[]
  reason?: string
} {
  const validTasks: Task[] = []
  const blockedTasks: Task[] = []

  for (const task of tasks) {
    if (isValidTaskId(task.id)) {
      validTasks.push(task)
    } else {
      blockedTasks.push(task)
      console.error(`🛡️ [PRE-SAVE] BLOCKED task with invalid ID:`, {
        id: task.id,
        title: task.title,
        stack: new Error().stack
      })
    }
  }

  if (blockedTasks.length > 0) {
    return {
      canSave: true, // Still save valid tasks
      validTasks,
      blockedTasks,
      reason: `Blocked ${blockedTasks.length} tasks with invalid IDs`
    }
  }

  return {
    canSave: true,
    validTasks,
    blockedTasks: []
  }
}

// Helper functions
function isValidStatus(status: unknown): status is Task['status'] {
  const validStatuses = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
  return typeof status === 'string' && validStatuses.includes(status)
}

function isValidPriority(priority: unknown): priority is Task['priority'] {
  const validPriorities = ['low', 'medium', 'high', null]
  return validPriorities.includes(priority as any)
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === 'number') {
    return new Date(value)
  }
  return null
}

/**
 * Debug utility: Log task ID statistics
 */
export function logTaskIdStats(tasks: Task[], context: string = 'unknown'): void {
  const stats = {
    total: tasks.length,
    validIds: 0,
    emptyStringIds: 0,
    undefinedStringIds: 0,
    nullStringIds: 0,
    actualUndefined: 0,
    actualNull: 0,
    otherInvalid: 0
  }

  for (const task of tasks) {
    if (isValidTaskId(task.id)) {
      stats.validIds++
    } else if (task.id === '') {
      stats.emptyStringIds++
    } else if (task.id === 'undefined') {
      stats.undefinedStringIds++
    } else if (task.id === 'null') {
      stats.nullStringIds++
    } else if (task.id === undefined) {
      stats.actualUndefined++
    } else if (task.id === null) {
      stats.actualNull++
    } else {
      stats.otherInvalid++
    }
  }

  if (stats.validIds !== stats.total) {
    console.warn(`🛡️ [ID-STATS] ${context}:`, stats)
  }
}
