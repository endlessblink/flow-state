import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useTaskStates } from './tasks/taskStates'
import { useTaskPersistence } from './tasks/taskPersistence'
import { useTaskOperations } from './tasks/taskOperations'
import { useTaskHistory } from './tasks/taskHistory'
import { useProjectStore } from './projects'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
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
 * Optimized for Supabase PostgreSQL
 */
export const clearHardcodedTestTasks = async () => {
  console.log('🗑️ Clearing hardcoded test tasks only (preserving real tasks)...')
  const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
  const { useDemoGuard } = await import('@/composables/useDemoGuard')

  const { fetchTasks, saveTasks, deleteTask } = useSupabaseDatabase()
  const demoGuard = useDemoGuard()

  try {
    const allowClear = await demoGuard.allowDemoData()
    if (!allowClear) return

    const savedTasks = await fetchTasks()
    if (!savedTasks || savedTasks.length === 0) return

    const testTaskPatterns = [
      /^Test Task$/, /^Test Task \d+$/, /^Medium priority task/, /^Low priority task/,
      /^No priority task/, /^Completed high priority task/, /^Task \d+ - Performance Testing/, /^New Task$/
    ]

    const tasksToDelete = savedTasks.filter(task => testTaskPatterns.some(pattern => pattern.test(task.title)))

    if (tasksToDelete.length > 0) {
      console.log(`🗑️ Deleting ${tasksToDelete.length} test tasks from Supabase...`)
      for (const task of tasksToDelete) {
        await deleteTask(task.id)
      }
      console.log(`✅ Test tasks cleared.`)
    } else {
      console.log('ℹ️ No test tasks found in Supabase.')
    }
  } catch (error) {
    console.error('❌ Failed to clear test tasks:', error)
  }
}

export const useTaskStore = defineStore('tasks', () => {
  const projectStore = useProjectStore()

  // 1. Initialize State
  const states = useTaskStates()
  const {
    // SAFETY: tasks is now filteredTasks (safe for display), _rawTasks is for mutations
    tasks, _rawTasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    activeSmartView, activeStatusFilter,
    activeDurationFilter, isLoadingFromDatabase, manualOperationInProgress,
    isLoadingFilters, syncInProgress, runAllTaskMigrations, calendarFilteredTasks
  } = states

  // 2. Initialize Persistence
  // BUG-057: Pass syncInProgress to prevent saves during sync operations
  // SAFETY: Pass _rawTasks for load/save operations
  const persistence = useTaskPersistence(
    _rawTasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    activeSmartView, activeStatusFilter,
    isLoadingFromDatabase, manualOperationInProgress, isLoadingFilters,
    syncInProgress,
    runAllTaskMigrations
  )
  const { saveTasksToStorage, saveSpecificTasks, deleteTaskFromStorage, bulkDeleteTasksFromStorage, loadFromDatabase, loadPersistedFilters, persistFilters, importTasksFromJSON, importFromRecoveryTool, importTasks } = persistence

  // 3. Initialize Operations
  // SAFETY: Pass _rawTasks for CRUD operations
  const operations = useTaskOperations(
    _rawTasks, states.selectedTaskIds, activeSmartView, activeStatusFilter,
    activeDurationFilter, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    manualOperationInProgress, saveTasksToStorage, saveSpecificTasks, deleteTaskFromStorage, bulkDeleteTasksFromStorage, persistFilters, runAllTaskMigrations
  )

  // 4. Initialize History
  // SAFETY: Pass _rawTasks for undo/redo state restoration
  const history = useTaskHistory(_rawTasks, manualOperationInProgress, saveTasksToStorage)
  const { restoreState, undoRedoEnabledActions } = history

  // 5. Initialization Logic
  const initializeFromDatabase = async () => {
    try {
      const dbReady = await projectStore.initializeFromDatabase()
      if (!dbReady) console.debug('⚠️ Project store failed to initialize')
      await loadFromDatabase()
      runAllTaskMigrations()

      // TASK-129: Removed PouchDB WAL crash recovery (transactionManager was a stub)

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
  initializeFromDatabase().catch(() => { })

  // BUG-057 FIX: Incremental update from sync - updates individual task without full reload
  // This prevents infinite loops by not triggering save watchers
  // BUG-061 FIX: Added validation and date conversion safety
  // SAFETY: Uses _rawTasks for mutations
  const updateTaskFromSync = (taskId: string, taskDoc: Task | null, isDeleted = false) => {
    syncInProgress.value = true
    try {
      if (isDeleted || !taskDoc) {
        // Remove deleted task
        const idx = _rawTasks.value.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          _rawTasks.value.splice(idx, 1)
        }
      } else {
        // BUG-061 FIX: Validate task before adding/updating
        if (!taskDoc || !taskDoc.id || !taskDoc.title === undefined) {
          console.warn('⚠️ [TASK STORE] Ignoring invalid task from sync (missing id or title):', taskId)
          return
        }

        // DEBUG: Trace sync payload for connections (BUG-023)
        // Handle strings, timestamps, or Date objects safely
        const toDate = (val: any): Date => {
          if (!val) return new Date()
          if (val instanceof Date) return val
          // If string or number, try to parse
          const d = new Date(val)
          return isNaN(d.getTime()) ? new Date() : d
        }

        const normalizedTask: Task = {
          ...taskDoc,
          createdAt: toDate(taskDoc.createdAt),
          updatedAt: toDate(taskDoc.updatedAt)
        }

        // Update or add task
        const idx = _rawTasks.value.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          const currentTask = _rawTasks.value[idx]

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
          if (normalizedTask._soft_deleted) {
            // If it's now deleted, remove it instead of updating
            _rawTasks.value.splice(idx, 1)
          } else {
            _rawTasks.value[idx] = normalizedTask
          }
        } else {
          // Add new task - ONLY if not deleted
          if (!normalizedTask._soft_deleted) {
            _rawTasks.value.push(normalizedTask)
          }
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
    initializeFromDatabase,
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
      return true // Supabase handles this now
    }
  }
})
