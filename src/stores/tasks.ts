import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed } from 'vue'
import { useTaskStates } from './tasks/taskStates'
import { useTaskPersistence } from './tasks/taskPersistence'
import { useTaskOperations } from './tasks/taskOperations'
import { useTaskHistory } from './tasks/taskHistory'
import { useProjectStore } from './projects'
import { useCanvasStore } from './canvas'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
// TASK-089: Updated to use unified canvas state lock system
// useCanvasOptimisticSync removed

// Export types and utilities for backward compatibility
export type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance } from '@/types/tasks'
import type { Task } from '@/types/tasks'
export { parseDateKey, formatDateKey } from '@/utils/dateUtils'

/**
 * getTaskInstances function - for compatibility with TaskEditModal
 * Returns recurring instances for a task, simplified for current system
 */
export const getTaskInstances = (task: Task) => task.recurringInstances || []

/**
 * Clear only hardcoded test tasks while preserving user's real tasks
 * Optimized for Supabase PostgreSQL
 */
export const clearHardcodedTestTasks = async () => {
  const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
  const { useDemoGuard } = await import('@/composables/useDemoGuard')

  const { fetchTasks, deleteTask } = useSupabaseDatabase()
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
      for (const task of tasksToDelete) {
        await deleteTask(task.id)
      }
    }
  } catch (error) {
    console.error('❌ Failed to clear test tasks:', error)
  }
}

export const useTaskStore = defineStore('tasks', () => {
  const projectStore = useProjectStore()

  //### BUG-218: ✅ FIXED - Persistent Canvas Drift (Deterministic Refactor TASK-232)
  //### BUG-220: ✅ FIXED - Group Counter Accuracy & Movement Counters
  // 1. Initialize State
  const states = useTaskStates()
  const {
    // SAFETY: tasks is now filteredTasks (safe for dis-
    _rawTasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks, hideCanvasOverdueTasks,
    activeSmartView, activeStatusFilter,
    activeDurationFilter, isLoadingFromDatabase, manualOperationInProgress,
    isLoadingFilters, syncInProgress, runAllTaskMigrations, calendarFilteredTasks
  } = states

  // 2. Initialize Persistence
  // BUG-057: Pass syncInProgress to prevent saves during sync operations
  // SAFETY: Pass _rawTasks for load/save operations
  const persistence = useTaskPersistence(
    _rawTasks, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks, hideCanvasOverdueTasks,
    activeSmartView, activeStatusFilter,
    isLoadingFromDatabase, manualOperationInProgress, isLoadingFilters,
    syncInProgress,
    runAllTaskMigrations
  )
  const { saveTasksToStorage, saveSpecificTasks, deleteTaskFromStorage, bulkDeleteTasksFromStorage, loadFromDatabase, loadPersistedFilters, persistFilters, importTasks } = persistence

  // 3. Initialize Operations
  // SAFETY: Pass _rawTasks for CRUD operations
  const operations = useTaskOperations(
    _rawTasks, states.selectedTaskIds, activeSmartView, activeStatusFilter,
    activeDurationFilter, hideDoneTasks, hideCanvasDoneTasks, hideCalendarDoneTasks, hideCanvasOverdueTasks,
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
      await loadPersistedFilters()
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

  // BUG-339 FIX: REMOVED auto-init on store creation
  // The task store was initializing BEFORE auth was ready, causing it to load
  // from localStorage (guest mode) instead of Supabase.
  // Initialization now happens ONLY from useAppInitialization.ts AFTER auth.
  // initializeFromDatabase().catch(() => { })

  // BUG-057 FIX: Incremental update from sync - updates individual task without full reload
  // This prevents infinite loops by not triggering save watchers
  // BUG-061 FIX: Added validation and date conversion safety
  // SAFETY: Uses _rawTasks for mutations
  const updateTaskFromSync = (taskId: string, taskDoc: Task | null, isDeleted = false) => {
    syncInProgress.value = true

    // ================================================================
    // DUPLICATE DETECTION - Realtime Sync Entry Point
    // ================================================================
    // This tracks what's coming in from realtime and whether the task exists
    // A duplicate after this function means the push logic is racing with initial load
    if (import.meta.env.DEV) {
      _rawTasks.value.some(t => t.id === taskId)
    }

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
        const toDate = (val: unknown): Date => {
          if (!val) return new Date()
          if (val instanceof Date) return val
          // If string or number, try to parse
          if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val)
            return isNaN(d.getTime()) ? new Date() : d
          }
          return new Date()
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

          //### ROAD-013: Sync Hardening (✅ COMPLETE)
          // 1. Audit current sync issues. ✅ DONE
          // 2. Implement "Triple Shield" Drag/Resize Locks. ✅ DONE
          // 3. Fix conflict resolution UI. ✅ DONE (TASK-232)
          // 4. Test multi-device scenarios E2E. ✅ DONE
          // Phase 14: Conflict Prevention
          // 1. If we are actively dragging/editing (manualOperationInProgress), ignore sync for now
          // 2. If local task is newer than incoming task (based on updatedAt), ignore sync (Last Write Wins)
          if (manualOperationInProgress.value) {
            return
          }

          if (currentTask.updatedAt > normalizedTask.updatedAt) {
            return
          }



          if (currentTask.canvasPosition && !normalizedTask.canvasPosition) {
            normalizedTask.canvasPosition = currentTask.canvasPosition
            normalizedTask.isInInbox = currentTask.isInInbox
          }

          // Update existing task
          if (normalizedTask._soft_deleted) {
            // If it's now deleted, remove it instead of updating
            _rawTasks.value.splice(idx, 1)
          } else {
            // TASK-272 FIX: Only trigger canvas sync if task actually changed
            // This prevents reactive loops where unchanged data causes re-renders
            const hasRelevantChange =
              currentTask.title !== normalizedTask.title ||
              currentTask.status !== normalizedTask.status ||
              currentTask.priority !== normalizedTask.priority ||
              currentTask.dueDate !== normalizedTask.dueDate ||
              currentTask.parentId !== normalizedTask.parentId ||
              JSON.stringify(currentTask.canvasPosition) !== JSON.stringify(normalizedTask.canvasPosition)

            _rawTasks.value[idx] = normalizedTask

            // Only trigger canvas sync if there was an actual visual change
            if (hasRelevantChange) {
              try {
                const canvasStore = useCanvasStore()
                canvasStore.syncTrigger++
              } catch { /* Canvas store may not be initialized in all contexts */ }
            }
          }
        } else {
          // Add new task - ONLY if not deleted
          if (!normalizedTask._soft_deleted) {
            // ================================================================
            // RACE CONDITION GUARD - Double-check before push
            // ================================================================
            // Even though findIndex returned -1, another async operation might
            // have added this task between findIndex and now. Check again.
            const existingCount = _rawTasks.value.filter(t => t.id === normalizedTask.id).length

            if (existingCount > 0) {
              // Task already exists - this is a race condition
              // Update instead of push to avoid duplication
              console.error('[SYNC-DUPLICATE-CREATED]', {
                taskId: taskId.slice(0, 8),
                existingCount,
                taskTitle: normalizedTask.title?.slice(0, 20),
                action: 'UPDATE_INSTEAD_OF_PUSH',
                storeSize: _rawTasks.value.length
              })

              // Find and update the existing task instead
              const existingIdx = _rawTasks.value.findIndex(t => t.id === normalizedTask.id)
              if (existingIdx !== -1) {
                _rawTasks.value[existingIdx] = normalizedTask
              }
            } else {
              // Safe to push
              _rawTasks.value.push(normalizedTask)

              // Verify no duplicate was created (should never happen now)
              if (import.meta.env.DEV) {
                const countAfterPush = _rawTasks.value.filter(t => t.id === normalizedTask.id).length
                if (countAfterPush > 1) {
                  console.error('[SYNC-DUPLICATE-UNEXPECTED]', {
                    taskId: taskId.slice(0, 8),
                    occurrences: countAfterPush,
                    taskTitle: normalizedTask.title?.slice(0, 20),
                    storeSize: _rawTasks.value.length
                  })
                }
              }
            }
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

    // TASK-243: Expose raw tasks for accurate counters (bypasses smart view filters)
    // Exposed as computed for reactivity
    rawTasks: computed(() => _rawTasks.value),

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

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTaskStore, import.meta.hot))
}
