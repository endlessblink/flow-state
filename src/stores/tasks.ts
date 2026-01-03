import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useTaskStates } from './tasks/taskStates'
import { useTaskPersistence } from './tasks/taskPersistence'
import { useTaskOperations } from './tasks/taskOperations'
import { useTaskHistory } from './tasks/taskHistory'
import { useProjectStore } from './projects'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { transactionManager } from '@/services/sync/TransactionManager'
// TASK-089: Updated to use unified canvas state lock system
import { isPositionLocked, getLockedPosition } from '@/utils/canvasStateLock'

// Export types and utilities for backward compatibility
export type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance } from '@/types/tasks'
import type { Task } from '@/types/tasks'
export { parseDateKey, formatDateKey } from '@/utils/dateUtils'

/**
 * getTaskInstances function - for compatibility with TaskEditModal
 * Returns recurring instances for a task, simplified for current system
 */
export const getTaskInstances = (task: any) => task.recurringInstances || []

/**
 * Clear only hardcoded test tasks while preserving user's real tasks
 */
export const clearHardcodedTestTasks = async () => {
  console.log('🗑️ Clearing hardcoded test tasks only (preserving real tasks)...')
  const { useDatabase, DB_KEYS } = await import('@/composables/useDatabase')
  const { usePersistentStorage } = await import('@/composables/usePersistentStorage')
  const { useDemoGuard } = await import('@/composables/useDemoGuard')

  const db = useDatabase()
  const persistentStorage = usePersistentStorage()
  const demoGuard = useDemoGuard()

  try {
    const allowClear = await demoGuard.allowDemoData()
    if (!allowClear) return

    const savedTasks = await db.load<any[]>(DB_KEYS.TASKS)
    if (!savedTasks || savedTasks.length === 0) return

    const testTaskPatterns = [
      /^Test Task$/, /^Test Task \d+$/, /^Medium priority task/, /^Low priority task/,
      /^No priority task/, /^Completed high priority task/, /^Task \d+ - Performance Testing/, /^New Task$/
    ]

    const realTasks = savedTasks.filter(task => !testTaskPatterns.some(pattern => pattern.test(task.title)))
    await db.atomicTransaction([
      () => db.save(DB_KEYS.TASKS, realTasks),
      async () => { await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, realTasks) }
    ], 'clear-test-tasks')

    console.log(`✅ Test tasks cleared. Kept ${realTasks.length} real tasks.`)
  } catch (error) {
    console.error('❌ Failed to clear test tasks:', error)
  }
}

export const useTaskStore = defineStore('tasks', () => {
  const projectStore = useProjectStore()

  // 1. Initialize State
  const states = useTaskStates()
  const {
    tasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    activeSmartView, activeStatusFilter,
    activeDurationFilter, isLoadingFromDatabase, manualOperationInProgress,
    isLoadingFilters, syncInProgress, runAllTaskMigrations, calendarFilteredTasks
  } = states

  // 2. Initialize Persistence
  // BUG-057: Pass syncInProgress to prevent saves during sync operations
  const persistence = useTaskPersistence(
    tasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    activeSmartView, activeStatusFilter,
    isLoadingFromDatabase, manualOperationInProgress, isLoadingFilters,
    syncInProgress,
    runAllTaskMigrations
  )
  const { saveTasksToStorage, saveSpecificTasks, loadFromDatabase, loadPersistedFilters, persistFilters, importTasksFromJSON, importFromRecoveryTool, importTasks } = persistence

  // 3. Initialize Operations
  const operations = useTaskOperations(
    tasks, states.selectedTaskIds, activeSmartView, activeStatusFilter,
    activeDurationFilter, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    manualOperationInProgress, saveTasksToStorage, saveSpecificTasks, persistFilters, runAllTaskMigrations
  )

  // 4. Initialize History
  const history = useTaskHistory(tasks, manualOperationInProgress, saveTasksToStorage)
  const { restoreState, undoRedoEnabledActions } = history

  // 5. Initialization Logic
  const initializeFromPouchDB = async () => {
    try {
      const dbReady = await projectStore.initializeFromPouchDB()
      if (!dbReady) console.debug('⚠️ Project store failed to initialize')
      await loadFromDatabase()
      runAllTaskMigrations()

      // Phase 14: Crash Recovery
      await transactionManager.initialize()
      window.addEventListener('pomoflow-wal-replay', async (event: any) => {
        const { transactions } = event.detail
        if (!transactions || !transactions.length) return

        console.debug(`🚑 Recovering ${transactions.length} pending transactions...`)
        for (const tx of transactions) {
          try {
            // Replay logic based on tx.operation and tx.collection
            if (tx.collection === 'tasks') {
              // Note: 'create' data has { ...taskData, id }
              // 'update' data has { taskId, updates }
              // 'delete' data has { taskId }
              // 'bulk_update' has { type: 'bulk_delete', taskIds }

              if (tx.operation === 'create') {
                await operations.createTask(tx.data)
              } else if (tx.operation === 'update') {
                if (tx.data.action === 'restore') {
                  console.warn('Skipping restore replay for now')
                } else {
                  await operations.updateTask(tx.data.taskId, tx.data.updates)
                }
              } else if (tx.operation === 'delete') {
                await operations.deleteTask(tx.data.taskId)
              } else if (tx.operation === 'bulk_update' && tx.data.type === 'bulk_delete') {
                await operations.bulkDeleteTasks(tx.data.taskIds)
              }
            }
            // Mark as replayed/committed
            await transactionManager.commit(tx._id)
          } catch (err) {
            console.error(`❌ Failed to replay transaction ${tx._id}`, err)
            // Determine if we should rollback or retry later
          }
        }
      })

      // Trigger replay check
      await transactionManager.replayPendingTransactions()

    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Store initialization failed',
        error: error as Error,
        showNotification: true
      })
    }
  }

  // Auto-init on store creation
  initializeFromPouchDB().catch(() => { })

  // BUG-057 FIX: Incremental update from sync - updates individual task without full reload
  // This prevents infinite loops by not triggering save watchers
  // BUG-061 FIX: Added validation and date conversion safety
  const updateTaskFromSync = (taskId: string, taskDoc: Task | null, isDeleted = false) => {
    syncInProgress.value = true
    try {
      if (isDeleted || !taskDoc) {
        // Remove deleted task
        const idx = tasks.value.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          tasks.value.splice(idx, 1)
        }
      } else {
        // BUG-061 FIX: Validate task before adding/updating
        if (!taskDoc.id || !taskDoc.title === undefined) {
          console.warn('⚠️ [TASK STORE] Ignoring invalid task from sync (missing id or title):', taskId)
          return
        }

        // BUG-061 FIX: Ensure dates are Date objects (defensive)
        const normalizedTask: Task = {
          ...taskDoc,
          createdAt: taskDoc.createdAt instanceof Date
            ? taskDoc.createdAt
            : new Date(taskDoc.createdAt || Date.now()),
          updatedAt: taskDoc.updatedAt instanceof Date
            ? taskDoc.updatedAt
            : new Date(taskDoc.updatedAt || Date.now())
        }

        // Update or add task
        const idx = tasks.value.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          const currentTask = tasks.value[idx]

          // Phase 14: Conflict Prevention
          // 1. If we are actively dragging/editing (manualOperationInProgress), ignore sync for now
          // 2. If local task is newer than incoming task (based on updatedAt), ignore sync (Last Write Wins)
          if (manualOperationInProgress.value) {
            console.log(`🛡️ [SYNC-PROTECT] Ignoring sync for ${taskId} during manual operation`)
            return
          }

          if (currentTask.updatedAt > normalizedTask.updatedAt) {
            console.log(`🛡️ [SYNC-PROTECT] Ignoring sync for ${taskId} - local version is newer (${currentTask.updatedAt.toISOString()} vs ${normalizedTask.updatedAt.toISOString()})`)
            return
          }

          // BUG-FIX: Check position lock - preserve local canvasPosition if locked
          // This prevents sync from overwriting positions during the push window after drag
          if (isPositionLocked(taskId)) {
            const lockedPos = getLockedPosition(taskId)
            if (lockedPos) {
              console.log(`🔒 [POSITION-LOCK] Preserving local canvasPosition for ${taskId} during sync`)
              normalizedTask.canvasPosition = lockedPos
            }
          }

          // BUG-FIX: Preserve local canvasPosition if remote doesn't have one
          // This prevents sync from clearing positions when remote has no position data
          if (currentTask.canvasPosition && !normalizedTask.canvasPosition) {
            console.log(`🛡️ [SYNC-PROTECT] Preserving local canvasPosition for ${taskId} - remote has no position`)
            normalizedTask.canvasPosition = currentTask.canvasPosition
            normalizedTask.isInInbox = currentTask.isInInbox
          }

          // Update existing task
          tasks.value[idx] = normalizedTask
        } else {
          // Add new task
          tasks.value.push(normalizedTask)
        }
      }
    } finally {
      syncInProgress.value = false
    }
  }

  return {
    ...states,
    ...persistence,
    ...operations,
    ...history,

    // Project Store passthrough (compatibility)
    projects: computed(() => projectStore.projects),
    rootProjects: computed(() => projectStore.rootProjects),
    activeProjectId: computed(() => projectStore.activeProjectId),
    createProject: projectStore.createProject,
    updateProject: projectStore.updateProject,
    deleteProject: projectStore.deleteProject,
    deleteProjects: projectStore.deleteProjects,
    setProjectColor: projectStore.setProjectColor,
    moveTaskToProject: projectStore.moveTaskToProject,
    getProjectById: projectStore.getProjectById,
    getProjectDisplayName: projectStore.getProjectDisplayName,
    getProjectEmoji: projectStore.getProjectEmoji,
    getProjectVisual: projectStore.getProjectVisual,
    isDescendantOf: projectStore.isDescendantOf,
    getChildProjects: projectStore.getChildProjects,
    getProjectHierarchy: projectStore.getProjectHierarchy,
    setProjectViewType: projectStore.setProjectViewType,
    // Undo/Redo support
    initializeFromPouchDB,
    restoreState,

    // BUG-057 FIX: Incremental sync update
    updateTaskFromSync,
    syncInProgress,
    calendarFilteredTasks,

    // Helper functions
    getTaskInstances,
    importTasks, // Exposed for Markdown Import (TASK-087)

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions(),

    // Data integrity validation
    validateDataConsistency: async () => {
      // Basic check
      const { DB_KEYS, useDatabase } = await import('@/composables/useDatabase')
      const db = useDatabase()
      const dbTasks = await db.load<any[]>(DB_KEYS.TASKS)
      return tasks.value.length === (dbTasks?.length || 0)
    }
  }
})
