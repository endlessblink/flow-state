console.log('🔥 TASKS.TS LOADING: This is the ORIGINAL tasks.ts file being loaded...')
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { DB_KEYS, useDatabase } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { getUndoSystem } from '@/composables/undoSingleton'
import type {
  TaskRecurrence as _TaskRecurrence,
  NotificationPreferences as _NotificationPreferences,
  ScheduledNotification as _ScheduledNotification
} from '@/types/recurrence'
// Import all types from central location - no local redefinitions
import type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance } from '@/types/tasks'
import { useSmartViews } from '@/composables/useSmartViews'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { taskDisappearanceLogger } from '@/utils/taskDisappearanceLogger'
// TASK-034: Individual task document storage
import { STORAGE_FLAGS } from '@/config/database'
import {
  saveTasks as saveIndividualTasks,
  loadAllTasks as loadIndividualTasks,
  deleteTask as _deleteIndividualTask,
  deleteTasks as _deleteIndividualTasksBulk,
  syncDeletedTasks,
  migrateFromLegacyFormat
} from '@/utils/individualTaskStorage'

// TASK-048: Individual project document storage
import { } from '@/utils/individualProjectStorage'

// Re-export types for backward compatibility
export type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance }

import { formatDateKey, parseDateKey } from '@/utils/dateUtils'

// Re-export parseDateKey for backward compatibility with components importing from tasks store
export { parseDateKey }
import { useProjectStore } from './projects'
import { useTaskMigrations } from '@/composables/tasks/useTaskMigrations'
import { useTaskFiltering } from '@/composables/tasks/useTaskFiltering'
import { toRef } from 'vue'

// getTaskInstances function - for compatibility with TaskEditModal
// Returns recurring instances for a task, simplified for current system
export const getTaskInstances = (task: Task): RecurringTaskInstance[] => {
  return task.recurringInstances || []
}

// Clear only hardcoded test tasks while preserving user's real tasks
export const clearHardcodedTestTasks = async () => {
  console.log('🗑️ Clearing hardcoded test tasks only (preserving real tasks)...')

  // Import required modules
  const { useDatabase } = await import('@/composables/useDatabase')
  const { usePersistentStorage } = await import('@/composables/usePersistentStorage')
  const { useDemoGuard } = await import('@/composables/useDemoGuard')

  const db = useDatabase()
  const persistentStorage = usePersistentStorage()
  const demoGuard = useDemoGuard()

  try {
    // Demo guard check - confirm before clearing test data
    const allowClear = await demoGuard.allowDemoData()
    if (!allowClear) {
      console.log('🚫 Demo data clearance blocked by user confirmation')
      return
    }

    // Load current tasks from database
    const savedTasks = await db.load<Task[]>(DB_KEYS.TASKS)
    if (!savedTasks || savedTasks.length === 0) {
      console.log('ℹ️ No tasks found in database')
      return
    }

    console.log('📊 Found ' + savedTasks.length + ' total tasks')

    // Identify test tasks to remove (only clear obvious test tasks)
    const testTaskPatterns = [
      /^Test Task$/, // Exact match "Test Task"
      /^Test Task \d+$/, // "Test Task 2", "Test Task 3", etc.
      /^Medium priority task - test completion circle$/,
      /^Low priority task - test completion circle$/,
      /^No priority task - test completion circle$/,
      /^Completed high priority task - test filled circle$/,
      /^Task \d+ - Performance Testing$/, // Performance test tasks
      /^New Task$/, // Generic "New Task" entries
    ]

    const realTasks = savedTasks.filter(task => {
      const isTestTask = testTaskPatterns.some(pattern => pattern.test(task.title))
      if (isTestTask) {
        console.log('🗑️ Removing test task: "' + task.title + '" (ID: ' + task.id + ')')
        return false // Remove this task
      }
      return true // Keep this task
    })

    console.log('✅ Keeping ' + realTasks.length + ' real tasks')
    console.log('🗑️ Removed ' + (savedTasks.length - realTasks.length) + ' test tasks')

    // Use atomic transaction to save tasks and update related data together
    await db.atomicTransaction([
      () => db.save(DB_KEYS.TASKS, realTasks),
      async () => {
        await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, realTasks)
        return
      }
    ], 'clear-test-tasks')

    // Also clear localStorage recovery data that might contain test tasks
    if (typeof window !== 'undefined') {
      const importedTasks = localStorage.getItem('pomo-flow-imported-tasks')
      if (importedTasks) {
        try {
          const parsed = JSON.parse(importedTasks)
          if (Array.isArray(parsed)) {
            const filteredImported = parsed.filter(task => {
              const isTestTask = testTaskPatterns.some(pattern => pattern.test(task.title || ''))
              return !isTestTask
            })
            localStorage.setItem('pomo-flow-imported-tasks', JSON.stringify(filteredImported))
            console.log('✅ Cleaned localStorage imported tasks')
          }
        } catch (error) {
          console.warn('⚠️ Failed to clean localStorage imported tasks:', error)
        }
      }
    }

    console.log('✅ Test tasks cleared successfully! Real tasks preserved.')
    console.log('🔄 Please refresh the page to see the effects')

  } catch (error) {
    console.error('❌ Failed to clear test tasks:', error)
  }
}


export const useTaskStore = defineStore('tasks', () => {
  // Initialize database and external stores
  const db = useDatabase()
  const persistentStorage = usePersistentStorage()
  const projectStore = useProjectStore()

  // State - Start with empty tasks array
  const tasks = ref<Task[]>([])

  // State for filtering (managed locally but used by useTaskFiltering)
  const activeSmartView = ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null>(null)
  const activeStatusFilter = ref<string | null>(null)
  const activeDurationFilter = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)
  const hideDoneTasks = ref(false)

  // Initialize extracted composables
  const { runAllTaskMigrations } = useTaskMigrations(tasks)

  const {
    filteredTasks,
    tasksByStatus,
    filteredTasksWithCanvasPosition,
    smartViewTaskCounts,
    getProjectTaskCount,
    totalTasks,
    completedTasks,
    totalPomodoros,
    doneTasksForColumn,
    tasksWithCanvasPosition
  } = useTaskFiltering(
    tasks,
    toRef(projectStore, 'projects'),
    toRef(projectStore, 'activeProjectId'),
    activeSmartView,
    activeStatusFilter,
    activeDurationFilter,
    hideDoneTasks
  )


  // Flags to manage store state
  let isLoadingFromDatabase = false
  let manualOperationInProgress = false

  // BUG-025: Initial sync is now handled by useReliableSyncManager.initializeSync()
  // which calls loadFromDatabase() after completing bidirectional sync

  // BUG-026 FIX: Disable automatic sync calls - was causing infinite loops
  // User can trigger manual sync via CloudSyncSettings
  const safeSync = async (_context: string) => {
    // DISABLED - was causing sync loop (BUG-026)
    // Syncs were triggering: sync → loadFromDatabase → save → sync → repeat
    // Will re-enable after fixing the root cause
    return
  }


  /**
   * Centralized task save function that respects INDIVIDUAL_ONLY mode
   */
  const saveTasksToStorage = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
    // TASK-054: Prevent Storybook from polluting real database
    if (typeof window !== 'undefined' && window.__STORYBOOK__) {
      console.log('🔒 [STORYBOOK] Skipping task persistence:', context)
      return
    }

    const dbInstance = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
    if (!dbInstance) {
      console.error(`[SAVE - TASKS] PouchDB not available(${context})`)
      return
    }

    if (STORAGE_FLAGS.INDIVIDUAL_ONLY) {
      // Phase 3: Individual docs ONLY - DO NOT write to tasks:data
      await saveIndividualTasks(dbInstance, tasksToSave)
      const currentIds = new Set(tasksToSave.map(t => t.id))
      await syncDeletedTasks(dbInstance, currentIds)
      // BUG-026: Reduced logging
    } else if (STORAGE_FLAGS.DUAL_WRITE_TASKS) {
      // Phase 1/2: Write to BOTH formats
      await db.save(DB_KEYS.TASKS, tasksToSave)
      await saveIndividualTasks(dbInstance, tasksToSave)
      const currentIds = new Set(tasksToSave.map(t => t.id))
      await syncDeletedTasks(dbInstance, currentIds)
    } else {
      // Legacy mode - write to tasks:data only
      await db.save(DB_KEYS.TASKS, tasksToSave)
    }
  }

  /**
   * BUG-025 FIX: Delete stale local tasks:data document
   * Called during initialization to clean up legacy data
   */
  const deleteLegacyTasksDocument = async (): Promise<void> => {
    if (!STORAGE_FLAGS.INDIVIDUAL_ONLY) return // Only in INDIVIDUAL_ONLY mode

    const dbInstance = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
    if (!dbInstance) return

    try {
      const legacyDoc = await dbInstance.get('tasks:data').catch(() => null)
      if (legacyDoc) {
        await dbInstance.remove(legacyDoc)
        console.log('🗑️ [BUG-025] Deleted stale local tasks:data document')
      }
    } catch (_error) {
      // Ignore errors - document might not exist or already deleted
      console.log('ℹ️ [BUG-025] No local tasks:data to delete or already deleted')
    }
  }


  // REMOVED: createDefaultProjects - My Tasks concept removed
  // Previously created default "My Tasks" project with ID '1'


  // REMOVED: createSampleTasks - Demo data removed per TASK-054
  // Users start with an empty app and create their own tasks
  // See AGENTS.md and CLAUDE.md for data safety rules


  // REMOVED: addTestCalendarInstances - Demo data removed per TASK-054




  const currentView = ref('board')
  const selectedTaskIds = ref<string[]>([])

  // Filter persistence
  const FILTER_STORAGE_KEY = 'pomo-flow-filters' // Legacy localStorage key
  let isLoadingFilters = false // Prevent auto-save during load

  interface PersistedFilterState {
    activeProjectId: string | null
    activeSmartView: typeof activeSmartView.value
    activeStatusFilter: string | null
    hideDoneTasks: boolean
  }

  // BUG-025 P4: Load persisted filters from PouchDB (with localStorage fallback)
  const loadPersistedFilters = async () => {
    isLoadingFilters = true
    try {
      // Check if database is ready first
      if (!db.isReady?.value) {
        throw new Error('Database not ready yet')
      }
      // Try PouchDB first
      const saved = await db.load<PersistedFilterState>(DB_KEYS.FILTER_STATE)
      if (saved) {
        // Validate project still exists before restoring
        if (saved.activeProjectId && !projectStore.projects.find(p => p.id === saved.activeProjectId)) {
          saved.activeProjectId = null
        }
        projectStore.setActiveProject(saved.activeProjectId)
        activeSmartView.value = saved.activeSmartView
        activeStatusFilter.value = saved.activeStatusFilter
        hideDoneTasks.value = saved.hideDoneTasks ?? false
        console.log('🔧 [BUG-025] Filter state loaded from PouchDB:', saved)
      } else {
        // Fallback to localStorage for migration
        loadFiltersFromLocalStorage()
      }
    } catch (error) {
      // Database not ready or failed - use localStorage immediately
      console.log('🔧 [BUG-025] Loading filters from localStorage (DB not ready):', (error as Error).message)
      loadFiltersFromLocalStorage()
    } finally {
      isLoadingFilters = false
    }
  }

  // Helper to load filters from localStorage
  const loadFiltersFromLocalStorage = () => {
    try {
      const localSaved = localStorage.getItem(FILTER_STORAGE_KEY)
      if (localSaved) {
        const state: PersistedFilterState = JSON.parse(localSaved)
        if (state.activeProjectId && !projectStore.projects.find(p => p.id === state.activeProjectId)) {
          state.activeProjectId = null
        }
        projectStore.setActiveProject(state.activeProjectId)
        activeSmartView.value = state.activeSmartView
        activeStatusFilter.value = state.activeStatusFilter
        hideDoneTasks.value = state.hideDoneTasks ?? false
        console.log('🔧 Filter state loaded from localStorage:', state)
      }
    } catch (e) {
      console.warn('Failed to load filters from localStorage:', e)
    }
  }

  // BUG-025 P4: Debounced persist function - uses PouchDB with localStorage fallback
  let persistTimeout: ReturnType<typeof setTimeout> | null = null
  const persistFilters = async () => {
    if (isLoadingFilters) return // Don't save while loading
    if (persistTimeout) clearTimeout(persistTimeout)
    persistTimeout = setTimeout(async () => {
      const state: PersistedFilterState = {
        activeProjectId: projectStore.activeProjectId,
        activeSmartView: activeSmartView.value,
        activeStatusFilter: activeStatusFilter.value,
        hideDoneTasks: hideDoneTasks.value
      }
      // Always save to localStorage first (fast, reliable)
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
      // Then try PouchDB for cross-device sync
      if (db.isReady?.value) {
        try {
          await db.save(DB_KEYS.FILTER_STATE, state)
          console.log('🔧 [BUG-025] Filter state persisted to PouchDB:', state)
        } catch (error) {
          console.warn('Failed to persist filters to PouchDB (localStorage already saved):', error)
        }
      }
    }, 500)
  }

  // Load filters (will be called after projects are loaded)
  // Note: Loads from localStorage immediately, then retries PouchDB later if available
  setTimeout(() => loadPersistedFilters(), 100)

  // Import tasks from JSON file (for migration from external storage)
  const importTasksFromJSON = async (jsonFilePath?: string) => {
    try {
      const defaultPath = '/tasks.json'
      let tasksData: any
      if (jsonFilePath) {
        throw new Error('Custom file paths not yet supported')
      } else {
        const response = await fetch(defaultPath)
        if (!response.ok) return
        tasksData = await response.json()
      }

      const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData.data || [])
      if (!tasksArray || tasksArray.length === 0) return

      console.log(`📥 Found ${tasksArray.length} tasks in JSON file, importing...`)

      const importedTasks: Task[] = tasksArray.map((jt: any) => {
        let status: Task['status'] = 'planned'
        if (jt.status === 'done') status = 'done'
        else if (jt.status === 'todo') status = 'planned'
        else if (jt.status === 'in_progress') status = 'in_progress'
        else if (jt.status === 'backlog') status = 'backlog'
        else if (jt.status === 'on_hold') status = 'on_hold'

        let priority: Task['priority'] = null
        if (jt.priority === 'high') priority = 'high'
        else if (jt.priority === 'medium') priority = 'medium'
        else if (jt.priority === 'low') priority = 'low'

        const projectId = jt.project === 'pomo-flow' ? '1' : jt.project || '1'
        const hasCanvasPosition = jt.canvasPosition && typeof jt.canvasPosition.x === 'number' && typeof jt.canvasPosition.y === 'number'

        return {
          id: jt.id || '',
          title: jt.title || '',
          description: jt.description || '',
          status,
          priority,
          progress: jt.progress || 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: formatDateKey(new Date()),
          projectId,
          createdAt: new Date(jt.createdAt || Date.now()),
          updatedAt: new Date(jt.updatedAt || jt.createdAt || Date.now()),
          canvasPosition: hasCanvasPosition ? jt.canvasPosition : undefined,
          isInInbox: hasCanvasPosition ? false : (jt.isInInbox ?? true),
          instances: jt.instances || [],
        }
      })

      const existingIds = new Set(tasks.value.map(t => t.id))
      const newTasks = importedTasks.filter(task => !existingIds.has(task.id))

      if (newTasks.length > 0) {
        tasks.value.push(...newTasks)
        console.log(`✅ Imported ${newTasks.length} new tasks from JSON file`)
      }
    } catch (error) {
      console.log('ℹ️ Could not import tasks from JSON:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Import tasks from recovery tool (localStorage)
  const importFromRecoveryTool = async () => {
    try {
      if (typeof window === 'undefined') return

      const userBackup = localStorage.getItem('pomo-flow-user-backup')
      if (userBackup) {
        console.log('📥 Found user backup, restoring...')
        const userTasks = JSON.parse(userBackup)
        if (Array.isArray(userTasks) && userTasks.length > 0) {
          const restoredTasks: Task[] = userTasks.map(userTask => ({
            ...userTask,
            createdAt: new Date(userTask.createdAt),
            updatedAt: new Date(userTask.updatedAt)
          }))
          tasks.value.push(...restoredTasks)
          console.log(`✅ Restored ${restoredTasks.length} tasks from user backup`)
          localStorage.removeItem('pomo-flow-user-backup')
          return
        }
      }

      const importedTasksStr = localStorage.getItem('pomo-flow-imported-tasks')
      if (!importedTasksStr) return

      const tasksData = JSON.parse(importedTasksStr)
      if (!Array.isArray(tasksData) || tasksData.length === 0) return

      console.log(`📥 Found ${tasksData.length} tasks in recovery tool, importing...`)

      const recoveredTasks: Task[] = tasksData.map((rt: any, index: number) => {
        let status: Task['status'] = 'planned'
        if (rt.status === 'done') status = 'done'
        else if (rt.status === 'todo') status = 'planned'
        else if (rt.status === 'in_progress') status = 'in_progress'
        else if (rt.status === 'backlog') status = 'backlog'
        else if (rt.status === 'on_hold') status = 'on_hold'

        let priority: Task['priority'] = null
        if (rt.priority === 'high') priority = 'high'
        else if (rt.priority === 'medium') priority = 'medium'
        else if (rt.priority === 'low') priority = 'low'

        return {
          id: rt.id || `recovery - ${Date.now()} -${index} `,
          title: rt.title || 'Recovered Task',
          description: rt.description || '',
          status,
          priority,
          progress: rt.progress || 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: formatDateKey(new Date()),
          projectId: rt.projectId || null,
          createdAt: new Date(rt.createdAt || Date.now()),
          updatedAt: new Date(rt.updatedAt || Date.now()),
          isInInbox: true,
          instances: [],
        }
      })

      const existingIds = new Set(tasks.value.map(t => t.id))
      const newTasks = recoveredTasks.filter(task => !existingIds.has(task.id))

      if (newTasks.length > 0) {
        tasks.value.push(...newTasks)
        runAllTaskMigrations()
        console.log(`✅ Imported ${newTasks.length} tasks from recovery tool`)
        localStorage.removeItem('pomo-flow-imported-tasks')
      }
    } catch (error) {
    }
  }

  // Load tasks from PouchDB on initialization
  const loadFromDatabase = async () => {
    try {
      isLoadingFromDatabase = true

      console.log('🔍 [BUG-025] Waiting for PouchDB...')
      let attempts = 0
      while (!window.pomoFlowDb && attempts < 300) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      const dbInstance = window.pomoFlowDb
      if (!dbInstance) {
        console.warn('⚠️ PouchDB not available')
        return
      }

      // 1. Load from individual docs (Phase 4)
      if (STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) {
        try {
          const loadedTasks = await loadIndividualTasks(dbInstance as any)
          if (loadedTasks && loadedTasks.length > 0) {
            const oldTasks = [...tasks.value]
            const loadedTaskIds = new Set(loadedTasks.map(t => t.id))
            const tasksOnlyInMemory = oldTasks.filter(t => !loadedTaskIds.has(t.id))
            let mergedTasks = tasksOnlyInMemory.length > 0 ? [...loadedTasks, ...tasksOnlyInMemory] : loadedTasks

            // BUG-037: Filter before assignment
            const deletionDoc = await dbInstance.get('_local/deleted-tasks').catch(() => ({ taskIds: [] })) as any
            const deletedIds = new Set(deletionDoc.taskIds || [])
            tasks.value = mergedTasks.filter(t => !deletedIds.has(t.id))

            console.log(`✅ Loaded ${tasks.value.length} tasks (Phase 4)`)
            if (STORAGE_FLAGS.INDIVIDUAL_ONLY) {
              deleteLegacyTasksDocument().catch(() => { })
            }
          }
        } catch (e) {
          console.warn('Phase 4 load failed, falling back:', e)
        }
      }

      // 2. Fallback to legacy (Phase 1)
      if ((tasks.value.length === 0 || !STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) && !STORAGE_FLAGS.INDIVIDUAL_ONLY) {
        try {
          const tasksDoc = await dbInstance.get('tasks:data').catch(() => null) as any
          if (tasksDoc?.tasks) {
            tasks.value = tasksDoc.tasks.map((t: any) => ({
              ...t,
              createdAt: new Date(t.createdAt || Date.now()),
              updatedAt: new Date(t.updatedAt || Date.now())
            }))
            console.log(`✅ Loaded ${tasks.value.length} tasks (Legacy)`)
          }
        } catch (e) {
          console.warn('Legacy load failed:', e)
        }
      }

      // 3. Post-load initialization
      runAllTaskMigrations()

      if (STORAGE_FLAGS.DUAL_WRITE_TASKS && tasks.value.length > 0) {
        const existing = await dbInstance.allDocs({ startkey: 'task-', endkey: 'task-\ufff0', limit: 1 })
        if (existing.total_rows === 0) {
          await migrateFromLegacyFormat(dbInstance as any)
        }
      }

      let isInitialized = false
      try {
        await dbInstance.get('_local/app-init')
        isInitialized = true
      } catch { }

      if (tasks.value.length === 0 && !isInitialized) {
        await importFromRecoveryTool()
        if (tasks.value.length === 0) await importTasksFromJSON()
      }

      if (!isInitialized) {
        await dbInstance.put({ _id: '_local/app-init', createdAt: new Date().toISOString() }).catch(() => { })
      }

      try {
        const savedHideDone = await db.load<boolean>(DB_KEYS.HIDE_DONE_TASKS)
        if (savedHideDone !== null) hideDoneTasks.value = savedHideDone
      } catch { }

      safeSync('startup-check')
    } catch (error) {
      console.error('❌ loadFromDatabase failed:', error)
    } finally {
      isLoadingFromDatabase = false
      console.log('✅ loadFromDatabase complete, auto-save re-enabled')
    }
  }

  // Auto-save to IndexedDB when tasks, projects, or settings change (debounced)
  let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null
  let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(tasks, (_newTasks) => {
    // EMERGENCY FIX: Skip watch during manual operations to prevent conflicts
    if (manualOperationInProgress) {
      console.log('⏸️ Skipping auto-save during manual operation')
      return
    }

    // SYNC LOOP FIX: Skip watch during database loads (prevents sync -> load -> save -> sync loop)
    if (isLoadingFromDatabase) {
      console.log('⏸️ Skipping auto-save during database load')
      return
    }

    if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
    tasksSaveTimer = setTimeout(async () => {
      try {
        // BUG-025 FIX: Get CURRENT state when timer fires, not stale captured state
        // This prevents race conditions where rapid edits cause stale data to be saved
        const currentTasks = [...tasks.value]

        // Wait for database to be ready before saving
        while (!db.isReady?.value) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const dbInstance = window.pomoFlowDb
        if (!dbInstance) {
          console.error('❌ PouchDB not available for task persistence')
          return
        }

        // TASK-034: Dual-write mode - save to BOTH formats for safe migration
        if (STORAGE_FLAGS.DUAL_WRITE_TASKS && !STORAGE_FLAGS.INDIVIDUAL_ONLY) {
          // Phase 1 & 2: Write to both formats
          // 1. Save to legacy tasks:data (existing behavior)
          await db.save(DB_KEYS.TASKS, currentTasks)
          console.log('📋 Tasks saved to tasks:data (legacy format)')

          // 2. Also save as individual task-{id} documents
          try {
            await saveIndividualTasks(dbInstance as unknown as PouchDB.Database, currentTasks)
            console.log(`📋 Tasks saved as ${currentTasks.length} individual documents(new format)`)

            // 3. Clean up orphaned task documents (deleted tasks)
            const currentTaskIds = new Set(currentTasks.map(t => t.id))
            const deletedCount = await syncDeletedTasks(dbInstance as unknown as PouchDB.Database, currentTaskIds)
            if (deletedCount > 0) {
              console.log(`🗑️ Cleaned up ${deletedCount} orphaned task documents`)
            }
          } catch (individualError) {
            // Don't fail the whole save if individual docs fail - legacy format is still saved
            console.warn('⚠️ Individual task save failed (legacy format still saved):', individualError)
          }
        } else if (STORAGE_FLAGS.INDIVIDUAL_ONLY) {
          // Phase 3: Individual docs only (after migration is proven stable)
          await saveIndividualTasks(dbInstance as unknown as PouchDB.Database, currentTasks)
          console.log(`📋 Tasks saved as ${currentTasks.length} individual documents ONLY`)

          // Clean up orphaned task documents
          const currentTaskIds = new Set(currentTasks.map(t => t.id))
          await syncDeletedTasks(dbInstance as unknown as PouchDB.Database, currentTaskIds)
        } else {
          // Fallback: Legacy-only mode (both flags off)
          await db.save(DB_KEYS.TASKS, currentTasks)
          console.log('📋 Tasks auto-saved via SaveQueueManager (legacy only)')
        }

        // PHASE 1: Use safe sync wrapper
        await safeSync('tasks-auto-save')
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: 'Tasks auto-save failed',
          error: error as Error,
          context: { taskCount: tasks.value?.length },
          showNotification: true,
          userMessage: 'Failed to save tasks. Your changes may not be persisted.'
        })
      }
    }, 1000) // Debounce 1 second for better performance
  }, { deep: true, flush: 'post' })

  // PHASE 3: DEBUG watcher removed - was causing unnecessary deep comparisons
  // Original: watch(() => projects.value.map(...), ..., { deep: true, immediate: true})
  // Removed to improve performance - debugging should use Vue DevTools instead


  // Auto-save hide done tasks setting
  watch(hideDoneTasks, (newValue) => {
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
    settingsSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.HIDE_DONE_TASKS, newValue)
    }, 500) // Debounce 0.5 second for settings
  }, { flush: 'post' })


  // Actions
  const createTask = async (taskData: Partial<Task>) => {
    const taskId = Date.now().toString()

    // Set manual operation flag to prevent watch system interference
    manualOperationInProgress = true

    try {
      console.log('🚀 [CREATE-TASK] Starting task creation...', {
        taskId,
        manualOperationInProgress: manualOperationInProgress
      });

      // If scheduledDate/Time provided, create instances array
      const instances: TaskInstance[] = []
      if (taskData.scheduledDate && taskData.scheduledTime) {
        const now = new Date()
        instances.push({
          id: `instance - ${taskId} -${Date.now()} `,
          taskId: taskId,
          scheduledDate: taskData.scheduledDate,
          scheduledTime: taskData.scheduledTime,
          duration: taskData.estimatedDuration || 25,
          status: 'scheduled',
          isRecurring: false,
          createdAt: now,
          updatedAt: now
        })
      }

      // If this is a nested task (has parentTaskId), inherit parent's projectId
      // REMOVED: Default to "My Tasks" project - My Tasks concept removed
      let projectId = taskData.projectId || 'uncategorized' // Default to uncategorized
      if (taskData.parentTaskId) {
        const parentTask = tasks.value.find(t => t.id === taskData.parentTaskId)
        if (parentTask) {
          projectId = parentTask.projectId
        }
      }

      // Extract canvasPosition separately to control its assignment
      const { canvasPosition: explicitCanvasPosition, ...taskDataWithoutPosition } = taskData

      // Create task without canvasPosition by default
      const newTask: Task = {
        id: taskId,
        title: taskData.title || 'New Task',
        description: taskData.description || 'Task description...',
        status: taskData.status || 'planned',
        priority: taskData.priority || 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
        projectId,
        createdAt: new Date(),
        updatedAt: new Date(),
        instances, // Use instances array instead of legacy fields
        isInInbox: taskData.isInInbox !== false, // Respect provided isInInbox, default to true
        canvasPosition: explicitCanvasPosition || undefined, // Only set if explicitly provided
        ...taskDataWithoutPosition // Spread all other properties except canvasPosition
      }

      // Add to store for instant UI update
      tasks.value.push(newTask)

      console.log('💾 [CREATE-TASK] About to save tasks to PouchDB...', {
        taskCount: tasks.value.length,
        newTaskId: newTask.id
      });

      // Save to PouchDB for persistence (respects INDIVIDUAL_ONLY)
      await saveTasksToStorage(tasks.value, `createTask - ${newTask.id} `)
      console.log('✅ Task created and saved:', newTask.id)
      return newTask

    } catch (error) {
      console.error('❌ Failed to save new task to PouchDB:', error)
      const err = error as Error & { status?: number; reason?: string }
      console.error('❌ Error details:', {
        name: err.name,
        message: err.message,
        status: err.status,
        reason: err.reason,
        stack: err.stack
      })

      // Rollback if save failed
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value.splice(index, 1)
        console.log('🔄 Rolled back task creation due to save failure')
      }
      throw error
    } finally {
      // Always clear the manual operation flag
      manualOperationInProgress = false
      console.log('🔓 [CREATE-TASK] Task creation completed, flag cleared')
    }
  }

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      const task = tasks.value[taskIndex]

      // === COMPREHENSIVE STATE TRANSITION LOGIC ===
      // This ensures tasks never end up in inconsistent states across canvas/calendar/inbox

      // 1. Auto-archive: When task marked as done, remove from canvas and return to inbox
      if (updates.status === 'done' && task.status !== 'done') {
        updates.isInInbox = true
        updates.canvasPosition = undefined
        console.log(`Task "${task.title}" marked done - returned to inbox, removed from canvas`)
      }

      // 2. Canvas Position Logic: Moving task TO canvas should remove from inbox
      if (updates.canvasPosition && !task.canvasPosition) {
        // Task is being positioned on canvas
        updates.isInInbox = false
        console.log(`Task "${task.title}" moved to canvas - removed from inbox`)
      }

      // 3. Canvas Position Removal: If task removed from canvas and no calendar instances, return to inbox
      if (updates.canvasPosition === undefined && task.canvasPosition && !updates.instances && (!task.instances || task.instances.length === 0)) {
        updates.isInInbox = true
        console.log(`Task "${task.title}" removed from canvas with no instances - returned to inbox`)
      }

      // 4. Calendar Instance Logic: Adding instances does NOT affect canvas inbox
      // Dec 16, 2025 fix: Calendar and Canvas are INDEPENDENT systems
      // - isInInbox controls CANVAS inbox membership only
      // - instances controls CALENDAR inbox membership only
      // - A task can be on canvas AND scheduled on calendar simultaneously
      if (updates.instances && updates.instances.length > 0) {
        // DO NOT modify isInInbox or canvasPosition here
        // Calendar scheduling should not affect canvas state
        console.log(`Task "${task.title}" given calendar instances - canvas state unchanged(independent systems)`)
      }

      // 5. Instance Removal: If all instances removed and no canvas position, return to inbox
      if (updates.instances !== undefined && updates.instances.length === 0) {
        if (task.instances && task.instances.length > 0 && !task.canvasPosition) {
          updates.isInInbox = true
          console.log(`Task "${task.title}" all instances removed - returned to inbox`)
        }
      }

      // 6. CRITICAL FIX: Automatically manage isUncategorized flag when projectId changes
      if ('projectId' in updates) {
        const newProjectId = updates.projectId
        const oldProjectId = task.projectId
        const shouldBeUncategorized = !newProjectId || newProjectId === '' || newProjectId === null || newProjectId === '1'

        if (shouldBeUncategorized !== (task.isUncategorized === true)) {
          updates.isUncategorized = shouldBeUncategorized
          console.log(`Task "${task.title}" isUncategorized flag set to ${shouldBeUncategorized} (projectId: ${oldProjectId} → ${newProjectId})`)
        }
      }

      // 7. FINAL SAFETY CHECK: Prevent orphaned tasks (invisible everywhere)
      // After all transitions, verify task will be visible somewhere
      const finalIsInInbox = updates.isInInbox !== undefined ? updates.isInInbox : task.isInInbox
      const finalCanvasPosition = updates.canvasPosition !== undefined ? updates.canvasPosition : task.canvasPosition
      const finalInstances = updates.instances !== undefined ? updates.instances : task.instances

      const willHaveCanvasPosition = finalCanvasPosition &&
        typeof finalCanvasPosition.x === 'number' &&
        typeof finalCanvasPosition.y === 'number'
      const willHaveCalendarInstances = finalInstances && finalInstances.length > 0

      // If task would be orphaned (not visible anywhere), restore to inbox
      if (finalIsInInbox === false && !willHaveCanvasPosition && !willHaveCalendarInstances) {
        console.warn(`⚠️[ORPHAN_PREVENTION] Task "${task.title}" would become orphaned - restoring to inbox`)
        updates.isInInbox = true
      }

      // Apply the updates atomically against the CURRENT state in the array
      // This prevents race conditions when multiple updates happen in the same tick
      tasks.value[taskIndex] = {
        ...tasks.value[taskIndex],
        ...updates,
        updatedAt: new Date()
      }

      const updatedTask = tasks.value[taskIndex] as Task
      console.log(`🔄 Task "${updatedTask.title}" state updated: `, {
        status: updatedTask.status,
        isInInbox: updatedTask.isInInbox,
        canvasPosition: updatedTask.canvasPosition,
        instanceCount: (updatedTask.instances as any[])?.length || 0
      })
    }
  }

  // EMERGENCY FIX: Simplified error handling (removed complex backup system)
  // The previous backup/restore system was causing cascade failures

  // EMERGENCY FIX: Simplified data validation
  const validateDataConsistency = async (): Promise<boolean> => {
    try {
      // Simple check - just verify PouchDB has data
      const dbTasks = await db.load<Task[]>(DB_KEYS.TASKS)
      const memoryCount = tasks.value.length
      const dbCount = dbTasks?.length || 0

      console.log(`📊 Simple validation - Memory: ${memoryCount}, DB: ${dbCount} `)

      // Basic consistency check (ignoring localStorage for now)
      return memoryCount === dbCount

    } catch (error) {
      console.warn('⚠️ Validation failed, but continuing:', error)
      return true // Don't fail operations due to validation issues
    }
  }

  // Manual operation flag to prevent watch system conflicts

  const deleteTask = async (taskId: string): Promise<void> => {
    console.log('🗑️ [EMERGENCY-FIX] deleteTask called for:', taskId)

    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex === -1) {
      console.warn('⚠️ Task not found for deletion:', taskId)
      return
    }

    const deletedTask = tasks.value[taskIndex]
    console.log(`🗑️ Deleting task: "${deletedTask.title}"`)

    // Mark as user deletion so the disappearance logger knows this is intentional
    taskDisappearanceLogger.markUserDeletion(taskId)

    // Set manual operation flag to prevent watch system interference
    manualOperationInProgress = true

    try {
      // Remove from memory
      tasks.value.splice(taskIndex, 1)

      // Take snapshot after deletion (markUserDeletion already called above)
      taskDisappearanceLogger.takeSnapshot(tasks.value, `deleteTask - ${deletedTask.title.substring(0, 30)} `)

      // BUG-025 FIX: Use centralized save that respects INDIVIDUAL_ONLY mode
      console.log('💾 [DELETE-TASK] Persisting remaining tasks...')

      // Delete the individual task document first
      if (STORAGE_FLAGS.DUAL_WRITE_TASKS || STORAGE_FLAGS.INDIVIDUAL_ONLY) {
        const dbInstance = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
        if (dbInstance) {
          try {
            await _deleteIndividualTask(dbInstance, taskId)
            console.log(`🗑️[BUG-025] Individual task - ${taskId} deleted from PouchDB`)

            // BUG-037 FIX: Track deletion intent to prevent sync resurrection
            // This _local document survives sync and ensures deleted tasks stay deleted
            try {
              interface DeletionTrackingDoc {
                _id: string
                _rev?: string
                taskIds: string[]
                deletedAt: Record<string, string>
              }

              let deletionDoc: DeletionTrackingDoc
              try {
                deletionDoc = await dbInstance.get('_local/deleted-tasks') as DeletionTrackingDoc
              } catch {
                // Document doesn't exist yet, create it
                deletionDoc = {
                  _id: '_local/deleted-tasks',
                  taskIds: [],
                  deletedAt: {}
                }
              }

              // Add this task to the deletion tracking list
              if (!deletionDoc.taskIds.includes(taskId)) {
                deletionDoc.taskIds.push(taskId)
                deletionDoc.deletedAt[taskId] = new Date().toISOString()
                await dbInstance.put(deletionDoc)
                console.log(`🗑️ BUG-037: Tracked deletion intent for task ${taskId}`)
              }
            } catch (trackingError) {
              console.warn('⚠️ BUG-037: Failed to track deletion intent:', trackingError)
              // Non-critical - deletion still proceeds
            }
          } catch (e) {
            console.warn(`⚠️[BUG-025] Delete individual doc failed: `, e)
          }
        }
      }

      // Save remaining tasks (respects INDIVIDUAL_ONLY - won't write to tasks:data)
      await saveTasksToStorage(tasks.value, `deleteTask - ${taskId} `)

      // Trigger sync to push deletion to CouchDB
      await safeSync('task-delete')

      console.log('✅ Task deletion persisted successfully')

      // Optional: Background sync to persistent storage (non-critical, won't fail operation)
      setTimeout(() => {
        persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, tasks.value)
          .catch(error => console.warn('⚠️ Background persistent storage sync failed:', error))
      }, 2000) // 2 second delay to avoid conflicts

    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Task deletion failed',
        error: error as Error,
        context: { taskId, taskTitle: deletedTask?.title },
        showNotification: false // Will retry first
      })

      // Simple retry mechanism
      try {
        console.log('🔄 Retrying task deletion...')

        // BUG-025 FIX: Delete individual doc on retry first
        if (STORAGE_FLAGS.DUAL_WRITE_TASKS || STORAGE_FLAGS.INDIVIDUAL_ONLY) {
          const dbInstance = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
          if (dbInstance) {
            await _deleteIndividualTask(dbInstance, taskId).catch(() => { })
          }
        }

        // Save remaining tasks (respects INDIVIDUAL_ONLY)
        await saveTasksToStorage(tasks.value, `deleteTask - retry - ${taskId} `)
        await safeSync('task-delete-retry')

        console.log('✅ Retry successful')
      } catch (retryError) {
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: 'Task deletion retry failed',
          error: retryError as Error,
          context: { taskId, taskTitle: deletedTask?.title },
          showNotification: true,
          userMessage: 'Failed to delete task. Please try again.'
        })

        // Restore task in memory if both attempts failed
        tasks.value.splice(taskIndex, 0, deletedTask)
        throw retryError
      }
    } finally {
      // Always clear the manual operation flag
      manualOperationInProgress = false
    }
  }

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      tasks.value[taskIndex].status = newStatus
      tasks.value[taskIndex].updatedAt = new Date()
      console.log('Task moved:', tasks.value[taskIndex].title, 'to', newStatus)
    }
  }

  const selectTask = (taskId: string) => {
    if (!selectedTaskIds.value.includes(taskId)) {
      selectedTaskIds.value.push(taskId)
    }
  }

  const deselectTask = (taskId: string) => {
    selectedTaskIds.value = selectedTaskIds.value.filter(id => id !== taskId)
  }

  const clearSelection = () => {
    selectedTaskIds.value = []
  }

  // Subtask management
  const createSubtask = (taskId: string, subtaskData: Partial<Subtask>) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return null

    const newSubtask: Subtask = {
      id: Date.now().toString(),
      parentTaskId: taskId,
      title: subtaskData.title || 'New Subtask',
      description: subtaskData.description || '',
      completedPomodoros: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    task.subtasks.push(newSubtask)
    task.updatedAt = new Date()
    return newSubtask
  }

  const updateSubtask = (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId)
    if (subtaskIndex !== -1) {
      task.subtasks[subtaskIndex] = {
        ...task.subtasks[subtaskIndex],
        ...updates,
        updatedAt: new Date()
      }
      task.updatedAt = new Date()
    }
  }

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId)
    if (subtaskIndex !== -1) {
      task.subtasks.splice(subtaskIndex, 1)
      task.updatedAt = new Date()
    }
  }

  // Task Instance management
  const createTaskInstance = (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return null

    const newInstance: TaskInstance = {
      id: Date.now().toString(),
      scheduledDate: instanceData.scheduledDate,
      scheduledTime: instanceData.scheduledTime,
      duration: instanceData.duration,
      completedPomodoros: instanceData.completedPomodoros || 0
    }

    if (!task.instances) {
      task.instances = []
    }

    task.instances.push(newInstance)
    task.updatedAt = new Date()
    return newInstance
  }

  const updateTaskInstance = (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task || !task.instances) return

    const instanceIndex = task.instances.findIndex(inst => inst.id === instanceId)

    if (instanceIndex !== -1) {
      // Create updated instance
      const updatedInstance = {
        ...task.instances[instanceIndex],
        ...updates
      }

      // Use splice to force Vue reactivity
      task.instances.splice(instanceIndex, 1, updatedInstance)
      task.updatedAt = new Date()
    }
  }

  const deleteTaskInstance = (taskId: string, instanceId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task || !task.instances) return

    const instanceIndex = task.instances.findIndex(inst => inst.id === instanceId)
    if (instanceIndex !== -1) {
      task.instances.splice(instanceIndex, 1)
      task.updatedAt = new Date()
    }
  }

  // BUG-036 FIX: Atomic Bulk Delete to prevent race conditions
  const bulkDeleteTasks = async (taskIds: string[]) => {
    if (!taskIds.length) return

    console.log(`🗑️ [BULK-DELETE] Deleting ${taskIds.length} tasks atomically...`)
    manualOperationInProgress = true

    try {
      // 1. Remove from memory (Atomic splice)
      // Filter out tasks that preserve their order, effectively removing the target IDs
      const tasksToKeep = tasks.value.filter(t => !taskIds.includes(t.id))
      const countRemoved = tasks.value.length - tasksToKeep.length

      if (countRemoved === 0) {
        console.warn('⚠️ Bulk delete: No tasks found to delete in memory')
        manualOperationInProgress = false
        return
      }

      // Snapshot for logger
      taskDisappearanceLogger.takeSnapshot(tasksToKeep, `bulkDelete - ${countRemoved} tasks`)

      // Update state
      tasks.value = tasksToKeep

      const dbInstance = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb

      // 2. Perform DB Operations (Atomic Bulk)
      // We check flags but since we are fixing BUG-036 which only happens in INDIVIDUAL_ONLY or DUAL_WRITE,
      // we assume we need to delete individual docs.
      if ((STORAGE_FLAGS.DUAL_WRITE_TASKS || STORAGE_FLAGS.INDIVIDUAL_ONLY) && dbInstance) {
        await _deleteIndividualTasksBulk(dbInstance, taskIds)

        // BUG-037: Track Deletion Intent for Batch Deletes so Sync doesn't restore them
        try {
          interface DeletionTrackingDoc {
            _id: string
            _rev?: string
            taskIds: string[]
            deletedAt: Record<string, string>
            [key: string]: any
          }

          let deletionDoc: DeletionTrackingDoc
          try {
            deletionDoc = (await dbInstance.get('_local/deleted-tasks')) as unknown as DeletionTrackingDoc
          } catch (e) {
            if ((e as { status?: number }).status === 404) {
              deletionDoc = { _id: '_local/deleted-tasks', taskIds: [], deletedAt: {} }
            } else {
              throw e
            }
          }

          let dirty = false
          const now = new Date().toISOString()
          for (const id of taskIds) {
            if (!deletionDoc.taskIds.includes(id)) {
              deletionDoc.taskIds.push(id)
              deletionDoc.deletedAt[id] = now
              dirty = true
            }
          }

          if (dirty) {
            await dbInstance.put(deletionDoc)
            console.log(`🗑️ [BULK-DELETE] Tracked ${taskIds.length} tasks for sync safety`)
          }

        } catch (trackingError) {
          console.warn('⚠️ Failed to track bulk deletion intent:', trackingError)
        }
      }

      // 3. Save Remaining State (Once)
      // This handles the legacy doc update if needed (if not individual only)
      await saveTasksToStorage(tasks.value, `bulkDelete - ${taskIds.length} tasks`)

      // 4. Trigger Sync (Once)
      await safeSync('task-bulk-delete')

      console.log('✅ Bulk deletion successful')
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Bulk task deletion failed',
        error: error as Error,
        context: { count: taskIds.length },
        showNotification: true
      })
    } finally {
      manualOperationInProgress = false
    }
  }

  // Start task now - move to current time and mark as in progress
  // BUG-025 FIX: Use updateTask() to properly trigger watcher and sync
  const startTaskNow = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    console.log(`Starting task now: "${task.title}"`)

    // Get current time and round to nearest 30-minute slot
    const now = new Date()
    const currentMinutes = now.getMinutes()
    const roundedMinutes = currentMinutes < 30 ? 0 : 30
    const roundedTime = new Date(now)
    roundedTime.setMinutes(roundedMinutes, 0, 0)

    const todayStr = formatDateKey(now)
    const timeStr = `${roundedTime.getHours().toString().padStart(2, '0')}:${roundedTime.getMinutes().toString().padStart(2, '0')} `

    // Create new instance for current time
    const newInstance = {
      id: `instance - ${taskId} -${Date.now()} `,
      scheduledDate: todayStr,
      scheduledTime: timeStr,
      duration: task.estimatedDuration || 60
    }

    // BUG-025 FIX: Use updateTask instead of direct mutation to trigger proper sync
    updateTask(taskId, {
      instances: [newInstance], // Replace all instances with new one
      status: 'in_progress',
      updatedAt: new Date()
    })

    console.log(`Task "${task.title}" scheduled for today at ${timeStr} and marked as in_progress`)
  }

  // Date-based task movement functions
  const moveTaskToSmartGroup = (taskId: string, smartGroupType: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    console.log(`[Smart Groups] Moving task "${task.title}" to smart group: ${smartGroupType} `)

    // Smart group logic - set dueDate but preserve inbox status
    const today = new Date()
    let dueDate = ''

    switch (smartGroupType.toLowerCase()) {
      case 'today':
        dueDate = `${today.getFullYear()} -${String(today.getMonth() + 1).padStart(2, '0')} -${String(today.getDate()).padStart(2, '0')} `
        break
      case 'tomorrow': {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        dueDate = `${tomorrow.getFullYear()} -${String(tomorrow.getMonth() + 1).padStart(2, '0')} -${String(tomorrow.getDate()).padStart(2, '0')} `
        break
      }
      case 'this weekend': {
        const saturday = new Date(today)
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
        saturday.setDate(today.getDate() + daysUntilSaturday)
        dueDate = `${saturday.getFullYear()} -${String(saturday.getMonth() + 1).padStart(2, '0')} -${String(saturday.getDate()).padStart(2, '0')} `
        break
      }
      case 'this week': {
        const sunday = new Date(today)
        const daysUntilSunday = (7 - today.getDay()) % 7 || 7
        sunday.setDate(today.getDate() + daysUntilSunday)
        dueDate = `${sunday.getFullYear()} -${String(sunday.getMonth() + 1).padStart(2, '0')} -${String(sunday.getDate()).padStart(2, '0')} `
        break
      }
      case 'later':
        // For "later", don't set a specific due date
        dueDate = ''
        break
      default:
        console.warn(`[Smart Groups] Unknown smart group type: ${smartGroupType} `)
        return
    }

    // Create updates object - only set dueDate, let caller control isInInbox
    const updates: Partial<Task> = {
      dueDate: dueDate,
    }

    console.log(`[Smart Groups] Applied ${smartGroupType} properties to task "${task.title}": `, {
      dueDate: updates.dueDate,
      staysInInbox: true,
      noInstancesCreated: true
    })

    // Update the task
    updateTask(taskId, updates)
  }

  const moveTaskToDate = (taskId: string, dateColumn: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    console.log(`Moving task "${task.title}" to date column: ${dateColumn} `)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let targetDate: Date | null = null

    switch (dateColumn) {
      case 'overdue':
        // For overdue tasks, set to yesterday to make them overdue
        targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() - 1)
        break
      case 'today':
        targetDate = today
        break
      case 'tomorrow':
        targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + 1)
        break
      case 'thisWeek':
        // End of current week (Sunday)
        targetDate = new Date(today)
        targetDate.setDate(today.getDate() + (7 - today.getDay()))
        break
      case 'nextWeek': {
        // Start of next week (Monday)
        targetDate = new Date(today)
        const daysUntilMonday = (8 - today.getDay()) % 7 || 7
        targetDate.setDate(today.getDate() + daysUntilMonday)
        break
      }
      case 'later':
        // For "Later", create a special instance with far future date and isLater flag
        targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + 30) // 30 days from now
        break
      case 'noDate':
        targetDate = null
        break
    }

    // Initialize instances array if it doesn't exist
    if (!task.instances) {
      task.instances = []
    }

    // Clear all existing instances first to prevent duplicates
    const previousCount = task.instances.length
    task.instances = []

    if (targetDate) {
      const dateStr = formatDateKey(targetDate)
      const timeStr = '09:00' // Default time
      const isLater = dateColumn === 'later'

      // Create single new instance for the target date
      const newInstance = {
        id: `instance - ${taskId} -${Date.now()} `,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        duration: task.estimatedDuration || 60,
        isLater
      }

      task.instances.push(newInstance)
      console.log(`Created new ${isLater ? 'later' : 'scheduled'} instance for task "${task.title}" on ${dateStr} `)
    } else {
      // For no date, instances array is already cleared
      if (previousCount > 0) {
        console.log(`Removed ${previousCount} instances for task "${task.title}"(moved to no date)`)
      }
    }

    // CRITICAL FIX: When a task is scheduled, it should no longer be in the inbox
    if (task.isInInbox !== false) {
      task.isInInbox = false
      console.log(`Task "${task.title}" removed from inbox(scheduled for ${dateColumn})`)
    }

    task.updatedAt = new Date()
    console.log(`Task movement completed.Task now has ${task.instances.length} instances`)
  }

  // Unschedule task - remove from calendar timeline and move to inbox
  const unscheduleTask = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    console.log(`Unscheduling task "${task.title}" - removing from calendar timeline`)

    // Store previous state for logging
    const previousInstanceCount = task.instances?.length || 0
    const wasInInbox = task.isInInbox

    // Clear all scheduled instances
    task.instances = []

    // Remove legacy scheduled date/time fields if they exist
    if (task.scheduledDate) task.scheduledDate = undefined
    if (task.scheduledTime) task.scheduledTime = undefined

    // CRITICAL: Move task to inbox so it appears in calendar inbox for manual scheduling
    task.isInInbox = true

    // Keep the due date intact for smart group matching (Today, Tomorrow, etc.)
    // This ensures the task stays in its smart group in canvas
    console.log(`Task "${task.title}" unscheduled: `, {
      previousInstances: previousInstanceCount,
      wasInInbox,
      nowInInbox: true,
      dueDateKept: task.dueDate,
      canvasPositionKept: !!task.canvasPosition
    })

    task.updatedAt = new Date()
  }

  // Priority-based task movement
  const moveTaskToPriority = (taskId: string, priority: Task['priority'] | 'no_priority') => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    if (priority === 'no_priority') {
      // Remove priority by setting to null
      task.priority = null
    } else {
      task.priority = priority
    }

    task.updatedAt = new Date()
  }

  // Project and view filtering
  // Note: Smart views and project filters can now be combined (no longer mutually exclusive)
  const setActiveProject = (projectId: string | null) => {
    projectStore.setActiveProject(projectId)
    persistFilters()
  }

  const setSmartView = (view: 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null) => {
    activeSmartView.value = view
    persistFilters()
  }

  const toggleHideDoneTasks = () => {
    console.log('🔧 TaskStore: toggleHideDoneTasks called!')
    console.log('🔧 TaskStore: Current value before toggle:', hideDoneTasks.value)

    hideDoneTasks.value = !hideDoneTasks.value
    persistFilters()

    console.log('🔧 TaskStore: New value after toggle:', hideDoneTasks.value)
    console.log('🔧 TaskStore: toggleHideDoneTasks completed successfully')
  }

  // Global status filter management
  const setActiveStatusFilter = (status: string | null) => {
    console.log('🔧 TaskStore: setActiveStatusFilter called!')
    console.log('🔧 TaskStore: Setting status filter from:', activeStatusFilter.value, 'to:', status)

    activeStatusFilter.value = status
    // Clear duration filter when setting status
    if (status) {
      activeDurationFilter.value = null
    }
    persistFilters()

    console.log('🔧 TaskStore: Status filter updated to:', activeStatusFilter.value)
    console.log('🔧 TaskStore: setActiveStatusFilter completed successfully')
  }

  const toggleStatusFilter = (status: string) => {
    console.log('🔧 TaskStore: toggleStatusFilter called!')
    console.log('🔧 TaskStore: Toggling status filter for:', status)
    console.log('🔧 TaskStore: Current status filter:', activeStatusFilter.value)

    // If clicking the same filter that's already active, clear it
    // Otherwise, set the new filter
    const newFilter = activeStatusFilter.value === status ? null : status
    setActiveStatusFilter(newFilter)

    console.log('🔧 TaskStore: toggleStatusFilter completed successfully')
  }

  // Global duration filter management
  const setActiveDurationFilter = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null) => {
    console.log('🔧 TaskStore: setActiveDurationFilter called!')
    console.log('🔧 TaskStore: Setting duration filter from:', activeDurationFilter.value, 'to:', duration)

    activeDurationFilter.value = duration
    // Clear status filter when setting duration
    if (duration) {
      activeStatusFilter.value = null
    }
    persistFilters()

    console.log('🔧 TaskStore: Duration filter updated to:', activeDurationFilter.value)
    console.log('🔧 TaskStore: setActiveDurationFilter completed successfully')
  }

  const toggleDurationFilter = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated') => {
    console.log('🔧 TaskStore: toggleDurationFilter called!')
    console.log('🔧 TaskStore: Toggling duration filter for:', duration)
    console.log('🔧 TaskStore: Current duration filter:', activeDurationFilter.value)

    // If clicking the same filter that's already active, clear it
    // Otherwise, set the new filter
    const newFilter = activeDurationFilter.value === duration ? null : duration
    setActiveDurationFilter(newFilter)

    console.log('🔧 TaskStore: toggleDurationFilter completed successfully')
  }

  const setProjectViewType = (projectId: string, viewType: Project['viewType']) => {
    projectStore.setProjectViewType(projectId, viewType)
  }

  const getTask = (taskId: string): Task | undefined => {
    return tasks.value.find(task => task.id === taskId)
  }

  const getUncategorizedTaskCount = (): number => {
    // Apply the exact same filtering logic as the uncategorized smart view in filteredTasks
    const { isUncategorizedTask } = useSmartViews()

    // Use tasks.value directly (baseTasks)
    let filteredTasks = tasks.value

    // Apply done visibility filter if needed (usually uncategorized shouldn't count done tasks)
    filteredTasks = filteredTasks.filter(task => task.status !== 'done')

    // Apply standard uncategorized filter matching useSmartViews logic
    filteredTasks = filteredTasks.filter(task => isUncategorizedTask(task))

    // Always exclude done tasks for uncategorized count
    // This ensures uncategorized ≤ allActive (which always excludes done)
    // Bug fix: Previously only excluded done when hideDoneTasks was true
    filteredTasks = filteredTasks.filter(task => {
      if (task.status === 'done') return false
      return true
    })

    return filteredTasks.length
  }


  // Nested task management
  const getNestedTasks = (parentTaskId: string | null = null): Task[] => {
    return tasks.value.filter(task => task.parentTaskId === parentTaskId)
  }

  const getTaskChildren = (taskId: string): Task[] => {
    return tasks.value.filter(task => task.parentTaskId === taskId)
  }

  const getTaskHierarchy = (taskId: string): Task[] => {
    const hierarchy: Task[] = []
    let currentTaskId: string | null = taskId

    while (currentTaskId) {
      const task = tasks.value.find(t => t.id === currentTaskId)
      if (!task) break

      hierarchy.unshift(task)
      currentTaskId = task.parentTaskId || null
    }

    return hierarchy
  }

  const isNestedTask = (taskId: string): boolean => {
    const task = tasks.value.find(t => t.id === taskId)
    return task?.parentTaskId !== null && task?.parentTaskId !== undefined
  }

  const hasNestedTasks = (taskId: string): boolean => {
    return tasks.value.some(task => task.parentTaskId === taskId)
  }

  // Undo/Redo enabled actions - simplified to avoid circular dependencies
  interface UndoRedoActionsLocal {
    createTask?: (taskData: Partial<Task>) => Promise<Task>
    updateTask?: (taskId: string, updates: Partial<Task>) => void
    deleteTask?: (taskId: string) => void
    deleteTaskWithUndo?: (taskId: string) => void
    undo?: () => void
    redo?: () => void
    canUndo?: boolean | import('vue').ComputedRef<boolean>
    canRedo?: boolean | import('vue').ComputedRef<boolean>
    startTaskNow?: (taskId: string) => void
    [key: string]: unknown
  }
  const undoRedoEnabledActions = () => {
    // These functions will be initialized lazily using standardized dynamic imports
    let undoRedoActions: UndoRedoActionsLocal | null = null

    const getUndoRedoActions = async () => {
      if (!undoRedoActions) {
        try {
          // Use standardized dynamic import system
          console.log('🔄 Loading unified undo/redo system...')
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          console.log('✅ Unified undo/redo system loaded successfully')

          // Use global instance to ensure keyboard handler and task operations share the same undo system
          if (typeof window !== 'undefined' && window.__pomoFlowUndoSystem) {
            undoRedoActions = window.__pomoFlowUndoSystem
            console.log('✅ Using existing global unified undo system instance')
          } else {
            undoRedoActions = useUnifiedUndoRedo()
            if (typeof window !== 'undefined') {
              window.__pomoFlowUndoSystem = undoRedoActions as UndoRedoActions
            }
            console.log('✅ Created new global unified undo system instance')
          }
          console.log('✅ useUnifiedUndoRedo initialized successfully')
          console.log('✅ Available methods:', Object.keys(undoRedoActions).filter(k => typeof undoRedoActions[k] === 'function').join(', '))
          console.log('✅ DeleteTask method available:', typeof undoRedoActions.deleteTaskWithUndo)
        } catch (error) {
          console.error('❌ UNIFIED UNDO SYSTEM FAILURE - useUnifiedUndoRedo import failed:', error)
          const err = error as Error
          console.error('❌ Error details:', err.message)
          console.error('❌ Error stack:', err.stack)
          console.error('❌ This means deleteTaskWithUndo will use fallback direct operations!')
          console.warn('Unified undo/redo system not available, using direct updates:', error)
          // Fallback to direct updates if undo/redo system fails
          // Create local references to ensure proper closure access
          const localStartTaskNow = (taskId: string) => startTaskNow(taskId)

          console.log('⚠️ FALLBACK ACTIVATED: Using direct operations - NO UNDO SUPPORT!')
          console.log('⚠️ deleteTask will bypass undo system completely')

          undoRedoActions = {
            createTask: (taskData: Partial<Task>) => {
              console.log('⚠️ FALLBACK createTask called - no undo support')
              return createTask(taskData)
            },
            createTaskWithUndo: (taskData: Partial<Task>) => {
              console.log('⚠️ FALLBACK createTaskWithUndo called - no undo support')
              return createTask(taskData)
            },
            updateTask: (taskId: string, updates: Partial<Task>) => {
              console.log('⚠️ FALLBACK updateTask called - no undo support')
              return updateTask(taskId, updates)
            },
            deleteTask: async (taskId: string) => {
              console.log('⚠️ FALLBACK deleteTask called - NO UNDO SUPPORT!')
              console.log('⚠️ Task', taskId, 'will be deleted permanently')
              return await deleteTask(taskId)
            },
            updateTaskWithUndo: (taskId: string, updates: Partial<Task>) => {
              console.log('⚠️ FALLBACK updateTaskWithUndo called - no undo support')
              return updateTask(taskId, updates)
            },
            deleteTaskWithUndo: async (taskId: string) => {
              console.log('⚠️ FALLBACK deleteTaskWithUndo called - NO UNDO SUPPORT!')
              return await deleteTask(taskId)
            },
            moveTask: (taskId: string, newStatus: Task['status']) => moveTask(taskId, newStatus),
            moveTaskWithUndo: (taskId: string, newStatus: Task['status']) => {
              console.log('⚠️ FALLBACK moveTaskWithUndo called - no undo support')
              return moveTask(taskId, newStatus)
            },
            moveTaskToProject: (taskId: string, targetProjectId: string) => projectStore.moveTaskToProject(taskId, targetProjectId),
            moveTaskToDate: (taskId: string, dateColumn: string) => moveTaskToDate(taskId, dateColumn),
            moveTaskToSmartGroup: (taskId: string, smartGroupType: string) => moveTaskToSmartGroup(taskId, smartGroupType),
            createSubtask: (taskId: string, subtaskData: Partial<Subtask>) => createSubtask(taskId, subtaskData),
            updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => updateSubtask(taskId, subtaskId, updates),
            deleteSubtask: (taskId: string, subtaskId: string) => deleteSubtask(taskId, subtaskId),
            createTaskInstance: (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => createTaskInstance(taskId, instanceData),
            updateTaskInstance: (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => updateTaskInstance(taskId, instanceId, updates),
            deleteTaskInstance: (taskId: string, instanceId: string) => deleteTaskInstance(taskId, instanceId),
            createProject: (projectData: Partial<Project>) => projectStore.createProject(projectData),
            updateProject: (projectId: string, updates: Partial<Project>) => projectStore.updateProject(projectId, updates),
            deleteProject: (projectId: string) => projectStore.deleteProject(projectId),
            bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => {
              taskIds.forEach(id => updateTask(id, updates))
            },
            bulkDeleteTasks: (taskIds: string[]) => {
              taskIds.forEach(id => deleteTask(id))
            },
            startTaskNow: localStartTaskNow
          }
          console.log('⚠️ Fallback undoRedoActions created - NO UNDO FUNCTIONALITY!')
        }
      }
      return undoRedoActions
    }

    return {
      // Task actions with undo/redo
      createTaskWithUndo: async (taskData: Partial<Task>) => {
        try {
          // Use the shared singleton undo system to ensure all instances share the same state
          const undoHistory = getUndoSystem()
          console.log('⚡ Using singleton undo system instance for create...')

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value} `)

          const result = undoHistory.createTaskWithUndo(taskData)
          console.log('✅ Task created with undo successfully')

          console.log(`📋 After execution - undo count: ${undoHistory.undoCount.value} `)
          return result
        } catch (error) {
          console.error('❌ Failed to create task with undo:', error)
          throw error
        }
      },
      updateTaskWithUndo: async (taskId: string, updates: Partial<Task>) => {
        console.log('📝 taskStore.updateTaskWithUndo called - using unified undo system')
        console.log('📝 TaskId:', taskId, 'Updates:', updates)

        try {
          // Use the shared singleton undo system to ensure all instances share the same state
          const undoHistory = getUndoSystem()
          console.log('⚡ Using singleton undo system instance for update...')

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value} `)

          const result = undoHistory.updateTaskWithUndo(taskId, updates)
          console.log('✅ Task updated with undo successfully')
          console.log(`✅ Undo count after update: ${undoHistory.undoCount.value} `)

          return result
        } catch (error) {
          console.error('❌ Failed to update task with undo:', error)
          console.error('❌ Falling back to direct update without undo support')
          // Fallback to direct update without undo
          return updateTask(taskId, updates)
        }
      },
      deleteTaskWithUndo: async (taskId: string) => {
        console.log('🗑️ taskStore.deleteTaskWithUndo called - using unified undo system')
        console.log('📋 TaskId:', taskId)

        try {
          // Use the shared singleton undo system to ensure all instances share the same state
          const undoHistory = getUndoSystem()
          console.log('⚡ Using singleton undo system instance for deletion...')

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value} `)

          const result = undoHistory.deleteTaskWithUndo(taskId)
          console.log('✅ Task deleted with undo successfully')
          console.log(`✅ Undo count after deletion: ${undoHistory.undoCount.value} `)
          console.log(`✅ Can undo: ${undoHistory.canUndo.value} `)

          return result
        } catch (error) {
          console.error('❌ Failed to delete task with undo:', error)
          console.error('❌ Falling back to direct deletion without undo support')
          // Fallback to direct deletion without undo
          return deleteTask(taskId)
        }
      },
      moveTaskWithUndo: async (taskId: string, newStatus: Task['status']) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const { moveTaskWithUndo: undoRedoMoveTask } = useUnifiedUndoRedo()
          return await undoRedoMoveTask(taskId, newStatus)
        } catch (error) {
          console.error('Failed to use undo/redo for moveTask:', error)
          // Fallback to direct moveTask operation
          return moveTask(taskId, newStatus)
        }
      },
      moveTaskToProjectWithUndo: async (taskId: string, targetProjectId: string) => {
        // Unified undo/redo doesn't support moveTaskToProject yet
        // Using direct operation for now
        return projectStore.moveTaskToProject(taskId, targetProjectId)
      },
      moveTaskToDateWithUndo: async (taskId: string, dateColumn: string) => {
        // Unified undo/redo doesn't support moveTaskToDate yet
        // Using direct operation for now
        return moveTaskToDate(taskId, dateColumn)
      },
      moveTaskToSmartGroup: (taskId: string, smartGroupType: string) => moveTaskToSmartGroup(taskId, smartGroupType),
      unscheduleTaskWithUndo: async (taskId: string) => {
        // Unified undo/redo doesn't support task unscheduling yet
        // Using direct operation for now
        return unscheduleTask(taskId)
      },
      deleteTaskInstanceWithUndo: async (taskId: string, instanceId: string) => {
        // Unified undo/redo doesn't support task instance deletion yet
        // Using direct deletion for now
        return deleteTaskInstance(taskId, instanceId)
      },

      // Subtask actions with undo/redo
      createSubtaskWithUndo: async (taskId: string, subtaskData: Partial<Subtask>) => {
        // Unified undo/redo doesn't support subtask operations yet
        // Using direct operations for now
        return createSubtask(taskId, subtaskData)
      },
      updateSubtaskWithUndo: async (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
        // Unified undo/redo doesn't support subtask operations yet
        // Using direct operations for now
        return updateSubtask(taskId, subtaskId, updates)
      },
      deleteSubtaskWithUndo: async (taskId: string, subtaskId: string) => {
        // Unified undo/redo doesn't support subtask operations yet
        // Using direct operations for now
        return deleteSubtask(taskId, subtaskId)
      },

      // Task instance actions with undo/redo
      createTaskInstanceWithUndo: async (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
        // Unified undo/redo doesn't support task instance operations yet
        // Using direct operations for now
        return createTaskInstance(taskId, instanceData)
      },
      updateTaskInstanceWithUndo: async (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
        // Unified undo/redo doesn't support task instance operations yet
        // Using direct operations for now
        return updateTaskInstance(taskId, instanceId, updates)
      },

      // Project actions with undo/redo
      createProjectWithUndo: async (projectData: Partial<Project>) => {
        // Unified undo/redo doesn't support project operations yet
        // Using direct operations for now
        return projectStore.createProject(projectData)
      },
      updateProjectWithUndo: async (projectId: string, updates: Partial<Project>) => {
        // Unified undo/redo doesn't support project operations yet
        // Using direct operations for now
        return projectStore.updateProject(projectId, updates)
      },
      deleteProjectWithUndo: async (projectId: string) => {
        // Unified undo/redo doesn't support project operations yet
        // Using direct operations for now
        return projectStore.deleteProject(projectId)
      },

      // Bulk actions with undo/redo
      bulkUpdateTasksWithUndo: async (taskIds: string[], updates: Partial<Task>) => {
        // Unified undo/redo doesn't support bulk operations yet
        // Perform individual updates for now
        taskIds.forEach(taskId => updateTask(taskId, updates))
      },
      bulkDeleteTasksWithUndo: async (taskIds: string[]) => {
        // BUG-036 FIX: Use atomic bulk delete
        // Unified undo/redo doesn't support bulk undo yet, but at least partial data loss is prevented
        await bulkDeleteTasks(taskIds)
      },

      // Task timing actions with undo/redo
      startTaskNowWithUndo: async (taskId: string) => {
        try {
          const actions = await getUndoRedoActions()
          if (actions && typeof actions.startTaskNow === 'function') {
            return actions.startTaskNow(taskId)
          } else {
            console.warn('Undo/Redo startTaskNow function not available, using direct startTaskNow')
            return startTaskNow(taskId)
          }
        } catch (error) {
          console.error('Failed to use undo/redo for startTaskNow:', error)
          return startTaskNow(taskId)
        }
      }
    }
  }

  // REMOVED: getTaskInstances function - using only dueDate now
  // No more complex instance system - tasks are organized by dueDate only

  // Restore state for undo/redo functionality
  const restoreState = async (newTasks: Task[]) => {
    console.log('🔄 [TASK-STORE] restoreState called with', newTasks.length, 'tasks')

    // CRITICAL DATA VALIDATION - Prevent catastrophic data loss
    if (!Array.isArray(newTasks)) {
      errorHandler.report({
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.STATE,
        message: 'restoreState: newTasks is not an array',
        context: { type: typeof newTasks },
        showNotification: true,
        userMessage: 'Undo operation failed - invalid data format'
      })
      return
    }

    // BUG-026: Removed over-aggressive empty array check
    // This was blocking legitimate undo operations when user wants to restore to empty state
    // The undo system (VueUse useManualRefHistory) already has proper state tracking
    // If user explicitly triggered undo, they want to go back to the previous state
    // Previous check: if (newTasks.length === 0 && tasks.value.length > 0) { ... block ...}

    // Validate task objects have required fields (only if there are tasks to validate)
    const invalidTasks = newTasks.filter(task =>
      !task || typeof task !== 'object' || !task.id || !task.title
    )

    if (invalidTasks.length > 0) {
      errorHandler.report({
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.STATE,
        message: 'restoreState: Found invalid task objects',
        context: { invalidCount: invalidTasks.length, sampleIds: invalidTasks.slice(0, 3).map(t => t?.id) },
        showNotification: true,
        userMessage: 'Undo blocked - corrupted task data detected'
      })
      return
    }

    // Emergency backup before making changes
    const backupTasks = [...tasks.value]

    // FIX: Set manual operation flag to prevent watchers from interfering with restore
    manualOperationInProgress = true
    console.log('🔄 [TASK-STORE] manualOperationInProgress set to TRUE for restore')

    // FIX: Direct assignment instead of atomicTransaction (Promise.all runs in parallel which causes race conditions)
    try {
      console.log('🔄 [TASK-STORE] BEFORE assignment: tasks.value.length =', tasks.value.length)

      // Direct assignment - this should be synchronous
      const oldTasks = [...tasks.value]
      tasks.value = [...newTasks]
      taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'undo-restoreTaskState')

      console.log('🔄 [TASK-STORE] AFTER assignment: tasks.value.length =', tasks.value.length)

      // Save to database sequentially (not in parallel)
      // BUG-026: Only save to database if it's ready, otherwise skip DB save
      if (db.isReady?.value) {
        // BUG-025 FIX: Use centralized save that respects INDIVIDUAL_ONLY
        await saveTasksToStorage(tasks.value, 'undo-restoreTaskState')
        console.log('🔄 [TASK-STORE] AFTER saveTasksToStorage: tasks.value.length =', tasks.value.length)
        await safeSync('undo-restore')
      } else {
        console.log('🔄 [TASK-STORE] DB not ready, skipping DB save in restoreState')
      }

      // Also save to persistent storage for redundancy (always works)
      await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, tasks.value)
      console.log('🔄 [TASK-STORE] AFTER persistentStorage.save: tasks.value.length =', tasks.value.length)

      console.log('🔄 [TASK-STORE] State restored successfully. Tasks now has', tasks.value.length, 'items')

      // DEBUG: Log canvas tasks after restore
      const canvasTasks = tasks.value.filter(t => t.isInInbox === false && t.canvasPosition)
      console.log(`🔍[RESTORE - DEBUG] After restore: ${canvasTasks.length} tasks have canvas properties`)
      canvasTasks.forEach(t => {
        console.log(`   - ${t.title}: isInInbox = ${t.isInInbox}, canvasPosition = ${JSON.stringify(t.canvasPosition)} `)
      })

      // Additional validation after restore
      if (tasks.value.length === 0 && backupTasks.length > 0) {
        console.error('⚠️ [DATA-LOSS-PREVENTION] Warning: After restore, task count went from', backupTasks.length, 'to 0. This may indicate a problem.')
      }
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.STATE,
        message: 'Failed to restore state',
        error: error as Error,
        context: { taskCount: newTasks.length, backupCount: backupTasks.length },
        showNotification: true,
        userMessage: 'Undo failed. Restoring from backup.'
      })
      // Emergency restore from backup
      const oldTasksEmergency = [...tasks.value]
      tasks.value = backupTasks
      taskDisappearanceLogger.logArrayReplacement(oldTasksEmergency, tasks.value, 'undo-emergencyRestore')
      try {
        // BUG-025 FIX: Use centralized save that respects INDIVIDUAL_ONLY
        if (db.isReady?.value) {
          await saveTasksToStorage(tasks.value, 'undo-emergencyRestore')
        }
        await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, tasks.value)
        console.log('✅ [EMERGENCY-RECOVERY] Successfully restored from backup')
      } catch (backupError) {
        errorHandler.report({
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.STATE,
          message: 'Emergency backup restore also failed',
          error: backupError as Error,
          showNotification: true,
          userMessage: 'Critical error: Could not restore data. Please refresh the page.'
        })
      }
    } finally {
      // FIX: Always clear the manual operation flag after restore
      manualOperationInProgress = false
      console.log('🔄 [TASK-STORE] manualOperationInProgress set to FALSE after restore')
    }
  }

  // CRITICAL: INITIALIZATION FROM POUCHDB ON STORE CREATION
  const initializeFromPouchDB = async () => {
    console.log('🔄 Initializing store from PouchDB...')

    try {
      // 1. First ensure projects are initialized (dependencies)
      const dbReady = await projectStore.initializeFromPouchDB()
      if (!dbReady) {
        console.warn('⚠️ Project store failed to initialize - continuing with local state')
      }

      // 2. Load tasks using consolidated loading logic
      await loadFromDatabase()

      // Run migrations
      runAllTaskMigrations()

      console.log('✅ Store initialized from PouchDB successfully')
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Store initialization failed',
        error: error as Error,
        showNotification: true,
        userMessage: 'Failed to load your tasks. Please refresh the page.'
      })
    }
  }

  // Initialize store from PouchDB on first load - CRITICAL
  initializeFromPouchDB().catch(err => {
    errorHandler.report({
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DATABASE,
      message: 'Store initialization error',
      error: err as Error,
      showNotification: true,
      userMessage: 'Critical: Task system failed to initialize. Please refresh.'
    })
  })

  return {
    // State
    tasks,
    selectedTaskIds,
    activeSmartView,
    activeStatusFilter,
    activeDurationFilter,
    hideDoneTasks,
    currentView,

    // Project Store passthrough (Re-exporting for backward compatibility)
    projects: computed(() => projectStore.projects),
    activeProjectId: computed(() => projectStore.activeProjectId),

    // Filtering (from useTaskFiltering)
    filteredTasks,
    tasksByStatus,
    filteredTasksWithCanvasPosition,
    smartViewTaskCounts,
    getProjectTaskCount,
    totalTasks,
    completedTasks,
    totalPomodoros,
    doneTasksForColumn,
    tasksWithCanvasPosition,

    // Actions
    createTask,
    updateTask,
    deleteTask,
    bulkDeleteTasks,
    moveTask,
    selectTask,
    deselectTask,
    clearSelection,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    createTaskInstance,
    updateTaskInstance,
    deleteTaskInstance,
    startTaskNow,
    moveTaskToSmartGroup,
    moveTaskToDate,
    unscheduleTask,
    moveTaskToPriority,
    setActiveProject,
    setSmartView,
    toggleHideDoneTasks,
    setActiveStatusFilter,
    toggleStatusFilter,
    setActiveDurationFilter,
    toggleDurationFilter,
    setProjectViewType,
    getTask,
    getTaskInstances,
    getUncategorizedTaskCount,
    getNestedTasks,
    getTaskChildren,
    getTaskHierarchy,
    isNestedTask,
    hasNestedTasks,

    // Project Actions (Pass-through)
    createProject: projectStore.createProject,
    updateProject: projectStore.updateProject,
    deleteProject: projectStore.deleteProject,
    setProjectColor: projectStore.setProjectColor,
    moveTaskToProject: projectStore.moveTaskToProject,
    getProjectById: projectStore.getProjectById,
    getProjectDisplayName: projectStore.getProjectDisplayName,
    getProjectEmoji: projectStore.getProjectEmoji,
    getProjectVisual: projectStore.getProjectVisual,
    isDescendantOf: projectStore.isDescendantOf,
    getChildProjects: projectStore.getChildProjects,
    getProjectHierarchy: projectStore.getProjectHierarchy,

    // Persistence
    loadFromDatabase,
    saveTasksToStorage,
    importTasksFromJSON,
    importFromRecoveryTool,

    // Data integrity validation
    validateDataConsistency,

    // Undo/Redo support
    initializeFromPouchDB,
    restoreState,

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions()
  }
})
