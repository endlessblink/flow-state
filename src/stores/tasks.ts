import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useTaskStates } from './tasks/taskStates'
import { useTaskPersistence } from './tasks/taskPersistence'
import { useTaskOperations } from './tasks/taskOperations'
import { useTaskHistory } from './tasks/taskHistory'
import { useProjectStore } from './projects'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

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
  const { saveTasksToStorage, loadFromDatabase, loadPersistedFilters, persistFilters, importTasksFromJSON, importFromRecoveryTool } = persistence

  // 3. Initialize Operations
  const operations = useTaskOperations(
    tasks, states.selectedTaskIds, activeSmartView, activeStatusFilter,
    activeDurationFilter, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks,
    manualOperationInProgress, saveTasksToStorage, persistFilters, runAllTaskMigrations
  )

  // 4. Initialize History
  const history = useTaskHistory(tasks, manualOperationInProgress, saveTasksToStorage)
  const { restoreState, undoRedoEnabledActions } = history

  // 5. Initialization Logic
  const initializeFromPouchDB = async () => {
    try {
      const dbReady = await projectStore.initializeFromPouchDB()
      if (!dbReady) console.warn('⚠️ Project store failed to initialize')
      await loadFromDatabase()
      runAllTaskMigrations()
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
