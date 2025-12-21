/**
 * Task Disappearance Logger
 *
 * Tracks and logs when tasks disappear from the store without explicit user deletion.
 * Stores snapshots and logs to help debug mysterious task disappearances.
 *
 * Usage:
 *   import { taskDisappearanceLogger } from '@/utils/taskDisappearanceLogger'
 *   taskDisappearanceLogger.enable()  // Start monitoring
 *   taskDisappearanceLogger.getDisappearedTasks()  // View disappeared tasks
 *   taskDisappearanceLogger.getLogs()  // View all logs
 */

import type { Task } from '@/stores/tasks'

export interface TaskSnapshot {
  timestamp: number
  taskCount: number
  taskIds: string[]
  taskSummary: { id: string; title: string; status: string }[]
  source: string
  stackTrace?: string
}

export interface DisappearedTask {
  task: { id: string; title: string; status: string; projectId: string }
  disappearedAt: number
  lastSeenAt: number
  lastSeenSource: string
  disappearedDuring: string
  stackTrace?: string
  wasUserDeletion: boolean
}

export interface TaskLogEntry {
  timestamp: number
  type: 'snapshot' | 'deletion' | 'disappeared' | 'restoration' | 'warning' | 'array-replacement'
  message: string
  details?: Record<string, unknown>
  stackTrace?: string
}

const STORAGE_KEY = 'pomoflow-task-disappearance-log'
const MAX_SNAPSHOTS = 50
const MAX_LOGS = 200
const MAX_DISAPPEARED = 100

class TaskDisappearanceLogger {
  private enabled = false
  private snapshots: TaskSnapshot[] = []
  private logs: TaskLogEntry[] = []
  private disappearedTasks: DisappearedTask[] = []
  private lastSnapshot: TaskSnapshot | null = null
  private userDeletionIds: Set<string> = new Set()
  private snapshotInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Enable the logger and start monitoring
   */
  enable() {
    if (this.enabled) return
    this.enabled = true
    this.log('info', 'Task disappearance logger ENABLED')
    console.log('%c[TASK-LOGGER] Monitoring enabled - tracking task disappearances', 'color: #4CAF50; font-weight: bold')

    // Take periodic snapshots
    this.snapshotInterval = setInterval(() => {
      this.autoSnapshot()
    }, 30000) // Every 30 seconds
  }

  /**
   * Disable the logger
   */
  disable() {
    if (!this.enabled) return
    this.enabled = false
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval)
      this.snapshotInterval = null
    }
    this.log('info', 'Task disappearance logger DISABLED')
  }

  /**
   * Mark a task ID as being deleted by user action (not a bug)
   */
  markUserDeletion(taskId: string) {
    this.userDeletionIds.add(taskId)
    // Clean up old user deletion markers after 5 minutes
    setTimeout(() => this.userDeletionIds.delete(taskId), 300000)
  }

  /**
   * Take a snapshot of the current task state
   */
  takeSnapshot(tasks: Task[], source: string): TaskSnapshot {
    const stackTrace = this.getStackTrace()

    const snapshot: TaskSnapshot = {
      timestamp: Date.now(),
      taskCount: tasks.length,
      taskIds: tasks.map(t => t.id),
      taskSummary: tasks.map(t => ({
        id: t.id,
        title: t.title?.substring(0, 50) || 'Untitled',
        status: t.status
      })),
      source,
      stackTrace
    }

    // Detect disappeared tasks
    if (this.lastSnapshot) {
      const currentIds = new Set(snapshot.taskIds)
      const missingIds = this.lastSnapshot.taskIds.filter(id => !currentIds.has(id))

      for (const missingId of missingIds) {
        const wasUserDeletion = this.userDeletionIds.has(missingId)
        const lastTask = this.lastSnapshot.taskSummary.find(t => t.id === missingId)

        if (!wasUserDeletion && lastTask) {
          this.recordDisappearance({
            task: { ...lastTask, projectId: 'unknown' },
            disappearedAt: snapshot.timestamp,
            lastSeenAt: this.lastSnapshot.timestamp,
            lastSeenSource: this.lastSnapshot.source,
            disappearedDuring: source,
            stackTrace,
            wasUserDeletion: false
          })

          console.error(
            `%c[TASK-LOGGER] TASK DISAPPEARED!`,
            'color: #f44336; font-weight: bold; font-size: 14px',
            '\n  Task:', lastTask.title,
            '\n  ID:', missingId,
            '\n  Last seen:', this.lastSnapshot.source,
            '\n  Disappeared during:', source,
            '\n  Stack trace:', stackTrace
          )
        } else if (wasUserDeletion) {
          this.log('deletion', `User deleted task: "${lastTask?.title || missingId}"`, { taskId: missingId })
          this.userDeletionIds.delete(missingId)
        }
      }

      // Log if task count significantly changed
      const countDiff = this.lastSnapshot.taskCount - snapshot.taskCount
      if (countDiff > 1) {
        this.log('warning', `Multiple tasks removed: ${countDiff} tasks`, {
          previousCount: this.lastSnapshot.taskCount,
          currentCount: snapshot.taskCount,
          source,
          stackTrace
        })
      }
    }

    this.lastSnapshot = snapshot
    this.snapshots.push(snapshot)

    // Trim old snapshots
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS)
    }

    this.saveToStorage()
    return snapshot
  }

  /**
   * Log when tasks array is being replaced (critical operation)
   */
  logArrayReplacement(
    oldTasks: Task[],
    newTasks: Task[],
    source: string
  ) {
    const stackTrace = this.getStackTrace()
    const oldIds = new Set(oldTasks.map(t => t.id))
    const newIds = new Set(newTasks.map(t => t.id))

    const removedIds = [...oldIds].filter(id => !newIds.has(id))
    const addedIds = [...newIds].filter(id => !oldIds.has(id))

    this.log('array-replacement', `Task array replaced via ${source}`, {
      previousCount: oldTasks.length,
      newCount: newTasks.length,
      removedCount: removedIds.length,
      addedCount: addedIds.length,
      removedIds: removedIds.slice(0, 10),
      addedIds: addedIds.slice(0, 10),
      stackTrace
    })

    if (removedIds.length > 0) {
      console.warn(
        `%c[TASK-LOGGER] Array replacement removed ${removedIds.length} tasks`,
        'color: #ff9800; font-weight: bold',
        '\n  Source:', source,
        '\n  Removed IDs:', removedIds,
        '\n  Stack:', stackTrace
      )
    }

    // Check for non-user deletions
    for (const removedId of removedIds) {
      if (!this.userDeletionIds.has(removedId)) {
        const oldTask = oldTasks.find(t => t.id === removedId)
        if (oldTask) {
          this.recordDisappearance({
            task: {
              id: oldTask.id,
              title: oldTask.title?.substring(0, 50) || 'Untitled',
              status: oldTask.status,
              projectId: oldTask.projectId || 'unknown'
            },
            disappearedAt: Date.now(),
            lastSeenAt: this.lastSnapshot?.timestamp || Date.now(),
            lastSeenSource: 'array-replacement',
            disappearedDuring: source,
            stackTrace,
            wasUserDeletion: false
          })
        }
      }
    }

    this.saveToStorage()
  }

  /**
   * Get all disappeared tasks
   */
  getDisappearedTasks(): DisappearedTask[] {
    return [...this.disappearedTasks]
  }

  /**
   * Get all logs
   */
  getLogs(): TaskLogEntry[] {
    return [...this.logs]
  }

  /**
   * Get recent snapshots
   */
  getSnapshots(): TaskSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Search for a specific task in history
   */
  findTaskInHistory(searchTerm: string): {
    foundIn: TaskSnapshot[]
    lastSeen: TaskSnapshot | null
    disappeared: DisappearedTask | null
  } {
    const searchLower = searchTerm.toLowerCase()
    const foundIn: TaskSnapshot[] = []
    let lastSeen: TaskSnapshot | null = null

    for (const snapshot of this.snapshots) {
      const found = snapshot.taskSummary.some(
        t => t.id.includes(searchTerm) || t.title.toLowerCase().includes(searchLower)
      )
      if (found) {
        foundIn.push(snapshot)
        lastSeen = snapshot
      }
    }

    const disappeared = this.disappearedTasks.find(
      d => d.task.id.includes(searchTerm) || d.task.title.toLowerCase().includes(searchLower)
    ) || null

    return { foundIn, lastSeen, disappeared }
  }

  /**
   * Clear all logs and history
   */
  clearHistory() {
    this.snapshots = []
    this.logs = []
    this.disappearedTasks = []
    this.lastSnapshot = null
    localStorage.removeItem(STORAGE_KEY)
    console.log('%c[TASK-LOGGER] History cleared', 'color: #2196F3')
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      disappearedTasks: this.disappearedTasks,
      logs: this.logs,
      snapshots: this.snapshots.map(s => ({
        ...s,
        stackTrace: undefined // Reduce size
      }))
    }, null, 2)
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.group('%c[TASK-LOGGER] Summary', 'color: #9C27B0; font-weight: bold')
    console.log('Enabled:', this.enabled)
    console.log('Snapshots stored:', this.snapshots.length)
    console.log('Log entries:', this.logs.length)
    console.log('Disappeared tasks:', this.disappearedTasks.length)

    if (this.disappearedTasks.length > 0) {
      console.group('Disappeared Tasks:')
      this.disappearedTasks.forEach(d => {
        console.log(`  - "${d.task.title}" (ID: ${d.task.id})`)
        console.log(`    Disappeared: ${new Date(d.disappearedAt).toLocaleString()}`)
        console.log(`    During: ${d.disappearedDuring}`)
      })
      console.groupEnd()
    }

    console.groupEnd()
  }

  // Private methods

  private autoSnapshot() {
    if (!this.enabled) return

    // Try to get tasks from the store - this is a lightweight check
    try {
      const tasksElement = document.querySelector('[data-task-count]')
      if (tasksElement) {
        const count = parseInt(tasksElement.getAttribute('data-task-count') || '0', 10)
        if (this.lastSnapshot && this.lastSnapshot.taskCount > count + 5) {
          this.log('warning', `Auto-check: Task count dropped significantly (${this.lastSnapshot.taskCount} -> ${count})`)
        }
      }
    } catch {
      // Ignore DOM errors
    }
  }

  private recordDisappearance(disappeared: DisappearedTask) {
    // Check if we already recorded this disappearance
    const exists = this.disappearedTasks.some(
      d => d.task.id === disappeared.task.id &&
        Math.abs(d.disappearedAt - disappeared.disappearedAt) < 60000
    )

    if (!exists) {
      this.disappearedTasks.unshift(disappeared)

      // Trim old entries
      if (this.disappearedTasks.length > MAX_DISAPPEARED) {
        this.disappearedTasks = this.disappearedTasks.slice(0, MAX_DISAPPEARED)
      }

      this.log('disappeared', `Task disappeared: "${disappeared.task.title}"`, {
        taskId: disappeared.task.id,
        disappearedDuring: disappeared.disappearedDuring
      })
    }
  }

  private log(type: TaskLogEntry['type'] | 'info', message: string, details?: Record<string, unknown>) {
    const entry: TaskLogEntry = {
      timestamp: Date.now(),
      type: type === 'info' ? 'snapshot' : type,
      message,
      details
    }

    this.logs.unshift(entry)

    // Trim old logs
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS)
    }
  }

  private getStackTrace(): string {
    try {
      const stack = new Error().stack || ''
      // Clean up the stack trace, remove internal frames
      return stack
        .split('\n')
        .slice(2, 10)
        .map(line => line.trim())
        .join('\n')
    } catch {
      return 'Stack trace unavailable'
    }
  }

  private saveToStorage() {
    try {
      const data = {
        disappearedTasks: this.disappearedTasks,
        logs: this.logs.slice(0, 50), // Save only recent logs
        lastSnapshot: this.lastSnapshot
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[TASK-LOGGER] Failed to save to storage:', e)
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.disappearedTasks = data.disappearedTasks || []
        this.logs = data.logs || []
        this.lastSnapshot = data.lastSnapshot || null

        if (this.disappearedTasks.length > 0) {
          console.log(
            `%c[TASK-LOGGER] Loaded ${this.disappearedTasks.length} disappeared task records from storage`,
            'color: #ff9800'
          )
        }
      }
    } catch (e) {
      console.warn('[TASK-LOGGER] Failed to load from storage:', e)
    }
  }
}

// Singleton instance
export const taskDisappearanceLogger = new TaskDisappearanceLogger()

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { taskLogger: TaskDisappearanceLogger }).taskLogger = taskDisappearanceLogger
}

// Convenience functions for console usage
export const enableTaskLogging = () => taskDisappearanceLogger.enable()
export const disableTaskLogging = () => taskDisappearanceLogger.disable()
export const getDisappearedTasks = () => taskDisappearanceLogger.getDisappearedTasks()
export const findTask = (term: string) => taskDisappearanceLogger.findTaskInHistory(term)
export const taskLoggerSummary = () => taskDisappearanceLogger.printSummary()
