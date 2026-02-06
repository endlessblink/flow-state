import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref } from 'vue'
import { useTaskStates } from './tasks/taskStates'
import { useTaskPersistence } from './tasks/taskPersistence'
import { useTaskOperations } from './tasks/taskOperations'
import { useTaskHistory } from './tasks/taskHistory'
import { useProjectStore } from './projects'
// BUG-1099: Removed synchronous import of canvas store to break circular dependency
// Canvas store access is now done via dynamic import in updateTaskFromSync
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
// TASK-089: Updated to use unified canvas state lock system
// useCanvasOptimisticSync removed

// Export types and utilities for backward compatibility
export type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance } from '@/types/tasks'
import type { Task } from '@/types/tasks'
export { parseDateKey, formatDateKey } from '@/utils/dateUtils'

/**
 * getTaskInstances function - for compatibility with TaskEditModal and Calendar views
 * Returns instances for a task with the following priority:
 * 1. task.instances (explicit TaskInstance array)
 * 2. Synthetic instance from legacy fields (scheduledDate, scheduledTime, estimatedDuration)
 * 3. task.recurringInstances (for recurring tasks)
 * 4. Empty array if no scheduling info
 */
export const getTaskInstances = (task: Task) => {
  // Priority 1: Explicit instances array
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }

  // Priority 2: Legacy fields - create synthetic instance
  if (task.scheduledDate) {
    return [{
      id: `legacy-${task.id}`,
      taskId: task.id,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }

  // Priority 3: Recurring instances
  if (task.recurringInstances && task.recurringInstances.length > 0) {
    return task.recurringInstances
  }

  // Priority 4: No scheduling info
  return []
}

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
    console.error('[TASKS] Failed to clear test tasks:', error)
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

  // High Severity Issue #7: Pending-write registry to prevent drag/sync race conditions
  const pendingWrites = ref<Set<string>>(new Set())

  // BUG-1207: Moved addPendingWrite here (before useTaskOperations) so it can be passed as parameter.
  // Previously defined later in the file, causing "used before declaration" error.
  const _pendingWriteTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const addPendingWrite = (taskId: string) => {
    pendingWrites.value.add(taskId)
    // BUG-1207 FIX (Fix 2.1): Don't auto-expire on short timeout.
    // Previously 30s was too short — VPS latency + sync queue processing can exceed that.
    // Now: removePendingWrite() is called explicitly when the sync queue confirms success.
    // 120s is an absolute safety fallback (e.g., if sync queue hangs or network dies).
    const existingTimeout = _pendingWriteTimeouts.get(taskId)
    if (existingTimeout) clearTimeout(existingTimeout)
    _pendingWriteTimeouts.set(taskId, setTimeout(() => {
      pendingWrites.value.delete(taskId)
      _pendingWriteTimeouts.delete(taskId)
    }, 120000))
  }

  const removePendingWrite = (taskId: string) => {
    pendingWrites.value.delete(taskId)
    const existingTimeout = _pendingWriteTimeouts.get(taskId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      _pendingWriteTimeouts.delete(taskId)
    }
  }

  const isPendingWrite = (taskId: string) => pendingWrites.value.has(taskId)

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
    manualOperationInProgress, saveTasksToStorage, saveSpecificTasks, deleteTaskFromStorage, bulkDeleteTasksFromStorage, persistFilters, runAllTaskMigrations, addPendingWrite
  )

  // 4. Initialize History
  // SAFETY: Pass _rawTasks for undo/redo state restoration
  const history = useTaskHistory(_rawTasks, manualOperationInProgress, saveTasksToStorage)
  const { restoreState, undoRedoEnabledActions } = history

  // 5. Initialization Logic
  const initializeFromDatabase = async () => {
    try {
      const dbReady = await projectStore.initializeFromDatabase()
      if (!dbReady && import.meta.env.DEV) console.debug('[TASKS] Project store failed to initialize')
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

    // DUPLICATE DETECTION - Realtime Sync Entry Point
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
          console.warn('[TASKS:SYNC] Ignoring invalid task from sync (missing id or title):', taskId)
          return
        }
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

          // BUG-1209: Skip sync if task has a pending local write (drag in progress)
          // This is defense-in-depth — isPendingWrite is also checked in the realtime handler,
          // but some code paths (recovery reload, smart merge) can reach here without that check.
          if (isPendingWrite(taskId)) {
            if (import.meta.env.DEV) {
              console.log(`[TASKS:SYNC] Skipping sync for "${taskId.slice(0, 8)}" - pending local write`)
            }
            return
          }

          // BUG-1091: Fix cross-browser sync - when timestamps are equal, ACCEPT remote (DB is source of truth)
          // Previous code used >= which caused split-brain when both browsers had same timestamp
          // Only skip if local is STRICTLY newer (not equal)
          if (currentTask.updatedAt > normalizedTask.updatedAt) {
            if (import.meta.env.DEV) {
              console.log(`[TASKS:SYNC] Skipping older sync for "${currentTask.title?.slice(0, 20)}"`, {
                localUpdatedAt: currentTask.updatedAt,
                remoteUpdatedAt: normalizedTask.updatedAt
              })
            }
            return
          }

          // TASK-1083: Strengthened position version check - ALWAYS check versions, not just when both have positions
          // This prevents realtime events from overwriting fresh local drags
          const localVersion = currentTask.positionVersion ?? 0
          const remoteVersion = normalizedTask.positionVersion ?? 0

          if (localVersion > remoteVersion) {
            // Local is newer - ALWAYS preserve local geometry regardless of what remote has
            if (import.meta.env.DEV) {
              console.log(`[TASKS:POS] Blocked stale sync for "${currentTask.title?.slice(0, 20)}"`, {
                localVersion,
                remoteVersion,
                action: 'preserving local position'
              })
            }
            // Preserve ALL local geometry
            normalizedTask.canvasPosition = currentTask.canvasPosition
            normalizedTask.parentId = currentTask.parentId
            normalizedTask.positionVersion = localVersion
            normalizedTask.positionFormat = currentTask.positionFormat
          } else if (localVersion === remoteVersion && currentTask.canvasPosition && normalizedTask.canvasPosition) {
            // BUG-1124 FIX: Same version - compare updatedAt timestamps to determine which is newer
            // This allows cross-device sync when versions match
            const localUpdated = new Date(currentTask.updatedAt || 0).getTime()
            const remoteUpdated = new Date(normalizedTask.updatedAt || 0).getTime()

            if (remoteUpdated > localUpdated) {
              // Remote is newer - accept remote position (cross-device sync)
              if (import.meta.env.DEV) {
                console.log(`[TASKS:POS] Accepting remote position for "${currentTask.title?.slice(0, 20)}"`, {
                  localVersion,
                  remoteVersion,
                  localUpdated: new Date(localUpdated).toISOString(),
                  remoteUpdated: new Date(remoteUpdated).toISOString(),
                  action: 'accepting newer remote'
                })
              }
              // Keep normalizedTask position as-is (remote wins)
            } else {
              // Local is newer or same - preserve local (likely echo of our own save)
              normalizedTask.canvasPosition = currentTask.canvasPosition
              normalizedTask.parentId = currentTask.parentId
            }
          } else if (localVersion === remoteVersion && currentTask.canvasPosition && !normalizedTask.canvasPosition) {
            // Same version, local has position but remote doesn't - preserve local
            normalizedTask.canvasPosition = currentTask.canvasPosition
            normalizedTask.parentId = currentTask.parentId
          }

          if (currentTask.canvasPosition && !normalizedTask.canvasPosition) {
            // BUG-1074 FIX: Only preserve local position if this isn't an intentional inbox move
            // When isInInbox is true, the user explicitly wants to move to inbox - don't restore position
            if (!normalizedTask.isInInbox) {
              normalizedTask.canvasPosition = currentTask.canvasPosition
              normalizedTask.isInInbox = currentTask.isInInbox
              normalizedTask.parentId = currentTask.parentId  // Also restore parentId to prevent drift
            }
          }

          // DRIFT LOGGING: Track ALL incoming position changes from sync
          if (import.meta.env.DEV && normalizedTask.canvasPosition && currentTask.canvasPosition) {
            const oldPos = currentTask.canvasPosition
            const newPos = normalizedTask.canvasPosition
            if (Math.abs(oldPos.x - newPos.x) > 1 || Math.abs(oldPos.y - newPos.y) > 1) {
              console.log(`[TASKS:POS] Task "${currentTask.title?.slice(0, 20)}" (${taskId.slice(0, 8)})`, {
                before: { x: Math.round(oldPos.x), y: Math.round(oldPos.y) },
                after: { x: Math.round(newPos.x), y: Math.round(newPos.y) },
                parentChange: currentTask.parentId !== normalizedTask.parentId ? `${currentTask.parentId?.slice(0, 8) ?? 'root'} → ${normalizedTask.parentId?.slice(0, 8) ?? 'root'}` : 'same',
                source: 'updateTaskFromSync',
                versions: { local: currentTask.positionVersion ?? 0, remote: normalizedTask.positionVersion ?? 0 }
              })
            }
          }

          // BUG-1206 DEBUG: Log description changes from sync
          if (currentTask.description !== normalizedTask.description) {
            console.warn('🐛 [BUG-1206] SYNC OVERWRITE - description changed!', {
              taskId: taskId.slice(0, 8),
              localDescLength: currentTask.description?.length,
              localDescPreview: currentTask.description?.slice(0, 50),
              remoteDescLength: normalizedTask.description?.length,
              remoteDescPreview: normalizedTask.description?.slice(0, 50),
              localUpdatedAt: currentTask.updatedAt,
              remoteUpdatedAt: normalizedTask.updatedAt
            })
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
            // BUG-1099: Use dynamic import to avoid circular dependency TDZ error
            if (hasRelevantChange) {
              import('./canvas').then(({ useCanvasStore }) => {
                try {
                  const canvasStore = useCanvasStore()
                  canvasStore.syncTrigger++
                } catch { /* Canvas store may not be initialized in all contexts */ }
              }).catch(() => { /* Canvas module not available */ })
            }
          }
        } else {
          // Add new task - ONLY if not deleted
          if (!normalizedTask._soft_deleted) {
            // RACE CONDITION GUARD - Double-check before push
            // Even though findIndex returned -1, another async operation might
            // have added this task between findIndex and now. Check again.
            const existingCount = _rawTasks.value.filter(t => t.id === normalizedTask.id).length

            if (existingCount > 0) {
              // Task already exists - this is a race condition
              // Update instead of push to avoid duplication
              console.error('[TASKS:SYNC] Race condition detected - duplicate task avoided', {
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
                  console.error('[TASKS:SYNC] Unexpected duplicate after push', {
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

  // TASK-1183: Cleanup corrupted tasks with invalid parentId (legacy group IDs)
  const cleanupCorruptedTasks = async () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    let fixed = 0

    for (const task of _rawTasks.value) {
      // Check if parentId exists but is NOT a valid UUID (e.g., "group-1234567890-abc")
      if (task.parentId && !uuidRegex.test(task.parentId)) {
        console.log(`[TASK-CLEANUP] Task "${task.title}" (${task.id.slice(0, 8)}) has invalid parentId: "${task.parentId}", removing`)
        task.parentId = undefined
        fixed++
        // Save the fixed task
        try {
          await operations.updateTask(task.id, { parentId: undefined })
        } catch (e) {
          console.warn(`[TASK-CLEANUP] Failed to save fixed task ${task.id}:`, e)
        }
      }
    }

    console.log(`[TASK-CLEANUP] Fixed ${fixed} corrupted tasks`)
    return fixed
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

    // Clear all tasks (used on sign-out to reset to guest mode)
    clearAll: () => {
      _rawTasks.value = []
    },

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions(),

    // Data integrity validation
    validateDataConsistency: async () => {
      // Basic check
      return true // Supabase handles this now
    },

    // High Severity Issue #7: Pending-write registry API
    addPendingWrite,
    removePendingWrite,
    isPendingWrite,

    // TASK-1183: Cleanup corrupted data
    cleanupCorruptedTasks
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTaskStore, import.meta.hot))
}
