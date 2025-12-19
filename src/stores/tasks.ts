console.log('🔥 TASKS.TS LOADING: This is the ORIGINAL tasks.ts file being loaded...')
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { DB_KEYS, useDatabase } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { useReliableSyncManager } from '@/composables/useReliableSyncManager'
import { getUndoSystem } from '@/composables/undoSingleton'
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
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

// Re-export types for backward compatibility
export type { Task, TaskInstance, Subtask, Project, RecurringTaskInstance }

const padNumber = (value: number) => value.toString().padStart(2, '0')

export const formatDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

export const parseDateKey = (dateKey?: string): Date | null => {
  if (!dateKey) return null
  const [year, month, day] = dateKey.split('-').map(part => Number(part))
  if (!year || !month || !day) return null

  const parsed = new Date(year, month - 1, day)
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

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

    console.log(`📊 Found ${savedTasks.length} total tasks`)

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
        console.log(`🗑️ Removing test task: "${task.title}" (ID: ${task.id})`)
        return false // Remove this task
      }
      return true // Keep this task
    })

    console.log(`✅ Keeping ${realTasks.length} real tasks`)
    console.log(`🗑️ Removed ${savedTasks.length - realTasks.length} test tasks`)

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
  // Initialize database composable
  const db = useDatabase()
  const persistentStorage = usePersistentStorage()
  const reliableSyncManager = useReliableSyncManager()

  // State - Start with empty tasks array
  const tasks = ref<Task[]>([])

  // Safe sync wrapper to prevent infinite loops (moved to store scope)
  let lastSyncTime = 0
  const SYNC_COOLDOWN = 5000 // 5 seconds minimum between syncs
  let syncAttempts = 0
  const MAX_SYNC_ATTEMPTS = 10 // Maximum sync attempts per session

  // Flag to prevent auto-save during database loads (prevents sync loops)
  let isLoadingFromDatabase = false

  const safeSync = async (context: string) => {
    const now = Date.now()

    // Cooldown check
    if (now - lastSyncTime < SYNC_COOLDOWN) {
      console.log(`⏳ [SAFE-SYNC] Skipping sync (${context}) - cooldown active`)
      return
    }

    // Max attempts check
    if (syncAttempts >= MAX_SYNC_ATTEMPTS) {
      console.log(`🛑 [SAFE-SYNC] Max sync attempts reached for this session`)
      return
    }

    lastSyncTime = now
    syncAttempts++

    try {
      console.log(`🔄 [SAFE-SYNC] Triggering sync (${context}) - attempt ${syncAttempts}/${MAX_SYNC_ATTEMPTS}`)
      await reliableSyncManager.triggerSync()
    } catch (error) {
      console.error(`❌ [SAFE-SYNC] Sync failed (${context}):`, error)
    }
  }

  // CRITICAL: IMMEDIATE LOAD FROM POUCHDB ON STORE INITIALIZATION
  const loadTasksFromPouchDB = async () => {
    try {
      console.log('📂 Loading tasks from PouchDB on store init...')

      // Wait for database to be ready using modern composable
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const loadedTasks = await db.load<Task[]>(DB_KEYS.TASKS)

      if (loadedTasks && Array.isArray(loadedTasks)) {
        const oldTasks = [...tasks.value]
        tasks.value = loadedTasks
        taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'loadFromPouchDB')
        console.log(`✅ Loaded ${tasks.value.length} tasks from PouchDB`)
      } else {
        console.log('ℹ️ No tasks in PouchDB, checking localStorage for backup before creating samples')
        // Check localStorage for user backup first
        const userBackup = localStorage.getItem('pomo-flow-user-backup')
        const importedTasks = localStorage.getItem('pomo-flow-imported-tasks')

        if (userBackup) {
          try {
            const backupTasks = JSON.parse(userBackup)
            if (Array.isArray(backupTasks) && backupTasks.length > 0) {
              const oldTasks = [...tasks.value]
              tasks.value = backupTasks
              taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'localStorage-userBackup-restore')
              console.log(`🔄 Restored ${backupTasks.length} tasks from localStorage backup`)
              return
            }
          } catch (error) {
            console.warn('⚠️ Failed to parse localStorage backup:', error)
          }
        }

        if (importedTasks) {
          try {
            const parsedImported = JSON.parse(importedTasks)
            if (Array.isArray(parsedImported) && parsedImported.length > 0) {
              const oldTasks = [...tasks.value]
              tasks.value = parsedImported
              taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'localStorage-importedTasks-restore')
              console.log(`🔄 Restored ${parsedImported.length} tasks from localStorage import`)
              return
            }
          } catch (error) {
            console.warn('⚠️ Failed to parse localStorage import:', error)
          }
        }

        // Preserve existing tasks if they exist, only create samples if truly empty
        if (tasks.value.length === 0) {
          const oldTasks = [...tasks.value]
          tasks.value = createSampleTasks()
          taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'createSampleTasks-initial')
          addTestCalendarInstances() // Add test instances to sample tasks
          console.log('📝 Created sample tasks for first-time users (no backup found)')
          console.log('📊 Sample tasks created:', tasks.value.map(t => ({ id: t.id, title: t.title, projectId: t.projectId, status: t.status })))

          // Save sample tasks to database immediately
          await db.save(DB_KEYS.TASKS, tasks.value)
          console.log('💾 Sample tasks saved to database')
        } else {
          console.log(`🔄 Keeping existing ${tasks.value.length} tasks`)
        }
      }
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to load tasks from PouchDB',
        error: error as Error,
        context: { operation: 'loadTasksFromPouchDB' },
        showNotification: true,
        userMessage: 'Failed to load tasks. Attempting recovery from backup.'
      })

      // Check localStorage for backup before creating sample tasks
      const userBackup = localStorage.getItem('pomo-flow-user-backup')
      const _importedTasks = localStorage.getItem('pomo-flow-imported-tasks')

      if (userBackup) {
        try {
          const backupTasks = JSON.parse(userBackup)
          if (Array.isArray(backupTasks) && backupTasks.length > 0) {
            const oldTasks = [...tasks.value]
            tasks.value = backupTasks
            taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'error-recovery-localStorage-backup')
            console.log(`🔄 Restored ${backupTasks.length} tasks from localStorage backup during error recovery`)
            return
          }
        } catch (parseError) {
          console.warn('⚠️ Failed to parse localStorage backup during error recovery:', parseError)
        }
      }

      // Preserve existing tasks on error, only create samples if truly empty
      if (tasks.value.length === 0) {
        console.log('🔄 Creating fallback sample tasks due to PouchDB failure (no existing tasks or backup)')
        const oldTasks = [...tasks.value]
        tasks.value = createSampleTasks()
        taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'error-recovery-createSampleTasks')
        addTestCalendarInstances() // Add test instances to sample tasks
      } else {
        console.log(`🔄 Preserving existing ${tasks.value.length} tasks despite PouchDB error`)
      }
    }
  }

  // REMOVED: createDefaultProjects - My Tasks concept removed
  // Previously created default "My Tasks" project with ID '1'

  // CRITICAL: Write queue to prevent concurrent PouchDB writes causing 409 conflicts
  const writeQueue = ref<Promise<unknown>>(Promise.resolve())

  const queuedWrite = async (updateFn: (latestDoc: PouchDBDocument | null) => Promise<PouchDBResponse>) => {
    writeQueue.value = writeQueue.value.then(async () => {
      try {
        return await updateFn(null) // latestDoc will be fetched inside updateFn
      } catch (error) {
        console.error('❌ Write queue failed:', error)
        throw error
      }
    })
    return writeQueue.value
  }

  // Create sample tasks for testing when database is empty
  const createSampleTasks = (): Task[] => {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    return [
      {
        id: 'sample-task-1',
        title: 'Work on tasks for lime',
        description: 'Complete the task management features',
        status: 'in_progress',
        priority: 'high',
        progress: 60,
        completedPomodoros: 3,
        subtasks: [],
        dueDate: today,
        instances: [],
        projectId: 'uncategorized', // Uncategorized task
        parentTaskId: null,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
        canvasPosition: undefined,
        isInInbox: false,
        dependsOn: [],
        isUncategorized: false
      },
      {
        id: 'sample-task-2',
        title: 'Blink test task',
        description: 'Test the blinking notification system',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: tomorrow,
        instances: [],
        projectId: 'uncategorized', // Uncategorized task
        parentTaskId: null,
        createdAt: new Date(Date.now() - 43200000),
        updatedAt: new Date(),
        canvasPosition: undefined,
        isInInbox: false, // Set to false so it appears in regular project swimlanes
        dependsOn: [],
        isUncategorized: false
      },
      {
        id: 'sample-task-3',
        title: 'Review calendar integration',
        description: 'Check if calendar view displays tasks correctly',
        status: 'planned',
        priority: 'low',
        progress: 20,
        completedPomodoros: 1,
        subtasks: [],
        dueDate: today,
        instances: [],
        projectId: 'uncategorized', // Uncategorized task
        parentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        canvasPosition: undefined,
        isInInbox: false,
        dependsOn: [],
        isUncategorized: false
      }
    ]
  }

  // Initialize sample tasks (disabled - start with empty)
  const _initializeSampleTasks = () => {
    // Disabled - users add their own tasks
    return
}

  // Migrate legacy tasks to use instances array
  const migrateLegacyTasks = () => {
    tasks.value.forEach(task => {
      // If task has scheduledDate but no instances, create instance from legacy fields
      if (task.scheduledDate && task.scheduledTime && (!task.instances || task.instances.length === 0)) {
        task.instances = [{
          id: `migrated-${task.id}-${Date.now()}`,
          scheduledDate: task.scheduledDate,
          scheduledTime: task.scheduledTime,
          duration: task.estimatedDuration
        }]
        // Keep legacy fields for backward compatibility but they won't be used anymore
      }
    })
  }

  // Run migration on store initialization
  migrateLegacyTasks()

  // Migrate task status values to fix "todo" -> "planned" mapping
  const migrateTaskStatuses = () => {
    tasks.value.forEach(task => {
      // Convert old "todo" status to "planned"
      if ((task.status as string) === 'todo') {
        task.status = 'planned'
        console.log(`🔄 Migrated task "${task.title}" status from "todo" to "planned"`)
      }
    })
  }

  // Migrate tasks to set isInInbox based on canvas position
  const migrateInboxFlag = () => {
    let migratedCount = 0
    let orphanedCount = 0
    tasks.value.forEach(task => {
      // FIX: If task has canvasPosition, it should NOT be in inbox (regardless of current isInInbox value)
      // This fixes the issue where JSON import sets isInInbox: true even for positioned tasks
      if (task.canvasPosition && task.isInInbox !== false) {
        task.isInInbox = false
        migratedCount++
        console.log(`🔄 [INBOX_MIGRATION] Fixed task "${task.title}" - has canvasPosition, setting isInInbox: false`)
      }
      // If isInInbox is undefined and no position, default to inbox
      else if (task.isInInbox === undefined) {
        // Task has no canvas position = in inbox
        task.isInInbox = true
      }

      // FIX: Detect and repair ORPHANED tasks (invisible everywhere)
      // An orphaned task has isInInbox: false but no canvas position and no calendar instances
      const hasCanvasPosition = task.canvasPosition &&
        typeof task.canvasPosition.x === 'number' &&
        typeof task.canvasPosition.y === 'number'
      const hasCalendarInstances = task.instances && task.instances.length > 0

      if (task.isInInbox === false && !hasCanvasPosition && !hasCalendarInstances) {
        console.log(`🔧 [INBOX_MIGRATION] Repairing ORPHANED task: "${task.title}" → restoring to inbox`)
        task.isInInbox = true
        orphanedCount++
      }
    })
    if (migratedCount > 0) {
      console.log(`✅ [INBOX_MIGRATION] Fixed ${migratedCount} tasks with incorrect isInInbox values`)
    }
    if (orphanedCount > 0) {
      console.log(`✅ [INBOX_MIGRATION] Repaired ${orphanedCount} ORPHANED tasks (were invisible everywhere)`)
    }
  }

  // Migrate projects to add viewType field
  const migrateProjects = () => {
    projects.value.forEach(project => {
      if (!project.viewType) {
        project.viewType = 'status' // Default to status view
      }
    })
  }

  // Migrate tasks to add isUncategorized flag
  const migrateTaskUncategorizedFlag = () => {
    let migratedCount = 0
    tasks.value.forEach(task => {
      // Only migrate tasks that don't have the isUncategorized field set
      if (task.isUncategorized === undefined) {
        // Determine if task should be uncategorized based on existing logic
        // REMOVED: projectId === '1' check - My Tasks concept removed
        const shouldBeUncategorized = !task.projectId ||
          task.projectId === '' ||
          task.projectId === null

        task.isUncategorized = shouldBeUncategorized
        migratedCount++

        if (shouldBeUncategorized) {
          console.log(`🔄 Marked task "${task.title}" as uncategorized (projectId: ${task.projectId})`)
        }
      }
    })

    if (migratedCount > 0) {
      console.log(`🔄 Migration complete: Set isUncategorized flag for ${migratedCount} tasks`)
    }
  }

  // DEBUG: Add test calendar instances for filter testing
  const addTestCalendarInstances = () => {
    console.log('🔧 DEBUG: Adding test calendar instances...')
    const today = new Date().toISOString().split('T')[0]

    // Find specific tasks to create instances for
    const workTask = tasks.value.find(t => t.title.includes('Work on tasks for lime'))
    const blinkTask = tasks.value.find(t => t.title.includes('blink'))

    if (workTask) {
      console.log(`🔧 DEBUG: Creating calendar instance for work task: "${workTask.title}"`)
      if (!workTask.instances) workTask.instances = []
      workTask.instances.push({
        id: `test-instance-${workTask.id}-${Date.now()}`,
        scheduledDate: today,
        scheduledTime: '10:00',
        duration: 60
      })
    }

    if (blinkTask) {
      console.log(`🔧 DEBUG: Creating calendar instance for blink task: "${blinkTask.title}"`)
      if (!blinkTask.instances) blinkTask.instances = []
      blinkTask.instances.push({
        id: `test-instance-${blinkTask.id}-${Date.now()}`,
        scheduledDate: today,
        scheduledTime: '14:00',
        duration: 45
      })
    }

    // Also ensure these tasks have the right status for testing
    if (workTask) {
      workTask.status = 'in_progress'
      console.log(`🔧 DEBUG: Set work task status to: ${workTask.status}`)
    }
    if (blinkTask) {
      blinkTask.status = 'planned'
      console.log(`🔧 DEBUG: Set blink task status to: ${blinkTask.status}`)
    }

    console.log('🔧 DEBUG: Test calendar instances added successfully')
  }



  // REMOVED: Default "My Tasks" project - My Tasks concept removed
  // Projects array starts empty and loads from PouchDB
  const projects = ref<Project[]>([])

  // CRITICAL: IMMEDIATE LOAD PROJECTS FROM POUCHDB ON STORE INITIALIZATION
  const loadProjectsFromPouchDB = async () => {
    try {
      console.log('📂 Loading projects from PouchDB on store init...')

      // Wait for database to be ready using modern composable
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const loadedProjects = await db.load<Project[]>(DB_KEYS.PROJECTS)
      if (!loadedProjects) {
        console.log('ℹ️ No projects in PouchDB, creating and saving default project')
        // Save default project to database
        await db.save(DB_KEYS.PROJECTS, projects.value)
        console.log('💾 Default project saved to database')
        return
      }

      if (loadedProjects && Array.isArray(loadedProjects) && loadedProjects.length > 0) {
        // MIGRATION: Remove "My Tasks" project (id: '1') from loaded projects
        // This is part of the "My Tasks" redundancy removal plan
        const filteredProjects = loadedProjects.filter(project =>
          project.id !== '1' && project.name !== 'My Tasks'
        )

        if (filteredProjects.length !== loadedProjects.length) {
          console.log(`🔄 MIGRATION: Removed ${loadedProjects.length - filteredProjects.length} "My Tasks" projects from database`)
          // Save the filtered projects back to database to complete migration
          await db.save(DB_KEYS.PROJECTS, filteredProjects)
          console.log('💾 Migration completed - "My Tasks" removed from database')
        }

        projects.value = filteredProjects
        console.log(`✅ Loaded ${projects.value.length} projects from PouchDB (after "My Tasks" migration)`)
      } else {
        console.log('ℹ️ No projects in PouchDB, saving default project')
        // Save default project to database
        await db.save(DB_KEYS.PROJECTS, projects.value)
        console.log('💾 Default project saved to database')
      }
    } catch (error) {
      console.error('❌ Failed to load projects from PouchDB:', error)
      // Keep default projects on error
    }
  }

  // Run project migration after initialization
  migrateProjects()

  // Migrate nested tasks to inherit parent's projectId
  const migrateNestedTaskProjectIds = () => {
    tasks.value.forEach(task => {
      // If this is a nested task (has parentTaskId), ensure it inherits parent's projectId
      if (task.parentTaskId) {
        const parentTask = tasks.value.find(t => t.id === task.parentTaskId)
        if (parentTask && task.projectId !== parentTask.projectId) {
          console.log(`🔄 Migrated nested task "${task.title}" projectId from ${task.projectId} to ${parentTask.projectId}`)
          task.projectId = parentTask.projectId
        }
      }
    })
  }

  // Migrate projects to add colorType field
  const migrateProjectColors = () => {
    projects.value.forEach(project => {
      if (!project.colorType) {
        // Priority: Check if project has emoji (emoji-first preference)
        if (project.emoji && (!project.color || project.color === undefined)) {
          project.colorType = 'emoji'
        }
        // Legacy: If color looks like an emoji, migrate to emoji type
        else if (project.color && typeof project.color === 'string' && /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(project.color)) {
          project.colorType = 'emoji'
          project.emoji = project.color
        }
        // Default: Set to hex type only if there's actually a color value
        else if (project.color && typeof project.color === 'string') {
          project.colorType = 'hex'
        } else {
          project.colorType = 'emoji' // Default to emoji type for emoji-first approach
        }
      }
    })
  }

  // Run color migration
  migrateProjectColors()

  const currentView = ref('board')
  const selectedTaskIds = ref<string[]>([])
  const activeProjectId = ref<string | null>(null) // null = show all projects
  const activeSmartView = ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null>(null)
  const activeStatusFilter = ref<string | null>(null) // null = show all statuses, 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  const hideDoneTasks = ref(false) // Global setting to hide done tasks across all views (disabled by default to show completed tasks for logging)

  // Filter persistence
  const FILTER_STORAGE_KEY = 'pomo-flow-filters'

  interface PersistedFilterState {
    activeProjectId: string | null
    activeSmartView: typeof activeSmartView.value
    activeStatusFilter: string | null
    hideDoneTasks: boolean
  }

  // Load persisted filters on store initialization
  const loadPersistedFilters = () => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY)
      if (saved) {
        const state: PersistedFilterState = JSON.parse(saved)
        // Validate project still exists before restoring
        if (state.activeProjectId && !projects.value.find(p => p.id === state.activeProjectId)) {
          state.activeProjectId = null
        }
        activeProjectId.value = state.activeProjectId
        activeSmartView.value = state.activeSmartView
        activeStatusFilter.value = state.activeStatusFilter
        hideDoneTasks.value = state.hideDoneTasks
        console.log('🔧 Filter state loaded from localStorage:', state)
      }
    } catch (error) {
      console.warn('Failed to load persisted filters:', error)
    }
  }

  // Debounced persist function
  let persistTimeout: ReturnType<typeof setTimeout> | null = null
  const persistFilters = () => {
    if (persistTimeout) clearTimeout(persistTimeout)
    persistTimeout = setTimeout(() => {
      const state: PersistedFilterState = {
        activeProjectId: activeProjectId.value,
        activeSmartView: activeSmartView.value,
        activeStatusFilter: activeStatusFilter.value,
        hideDoneTasks: hideDoneTasks.value
      }
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
      console.log('🔧 Filter state persisted to localStorage:', state)
    }, 500)
  }

  // Load filters (will be called after projects are loaded)
  // Note: Delayed to ensure projects are available for validation
  setTimeout(() => loadPersistedFilters(), 100)

  // Import tasks from JSON file (for migration from external storage)
  const importTasksFromJSON = async (jsonFilePath?: string) => {
    try {
      // If no path provided, use the default tasks.json path
      const defaultPath = '/tasks.json'

      let tasksData: unknown
      if (jsonFilePath) {
        // For future: if a custom path is provided, we'd need to handle file reading
        throw new Error('Custom file paths not yet supported')
      } else {
        // Try to fetch the default tasks.json file
        const response = await fetch(defaultPath)
        if (!response.ok) {
          console.log('No tasks.json file found, starting fresh')
          return
        }
        tasksData = await response.json()
      }

      // Handle JSON data structure (might be direct array or wrapped in data property)
      const tasksDataObj = tasksData as { data?: unknown[] } | unknown[]
      const tasksArray = Array.isArray(tasksDataObj) ? tasksDataObj : (tasksDataObj.data || [])

      if (!tasksArray || tasksArray.length === 0) {
        console.log('No tasks found in JSON file')
        return
      }

      console.log(`📥 Found ${tasksArray.length} tasks in JSON file, importing...`)

      // Map JSON tasks to Task interface format
      interface JsonTask {
        id?: string
        title?: string
        description?: string
        status?: string
        priority?: string
        progress?: number
        completedPomodoros?: number
        subtasks?: Array<{ id?: string; title?: string; completed?: boolean }>
        dueDate?: string
        instances?: TaskInstance[]
        project?: string
        projectId?: string
        parentTaskId?: string | null
        createdAt?: string | Date
        updatedAt?: string | Date
        canvasPosition?: { x: number; y: number }
        isInInbox?: boolean
        dependsOn?: string[]
        isUncategorized?: boolean
      }
      const importedTasks: Task[] = tasksArray.map((jsonTask: unknown) => {
        const jt = jsonTask as JsonTask
        // Map status values
        let status: Task['status'] = 'planned'
        if (jt.status === 'done') status = 'done'
        else if (jt.status === 'todo') status = 'planned'
        else if (jt.status === 'in_progress') status = 'in_progress'
        else if (jt.status === 'backlog') status = 'backlog'
        else if (jt.status === 'on_hold') status = 'on_hold'

        // Map priority values
        let priority: Task['priority'] = null
        if (jt.priority === 'high') priority = 'high'
        else if (jt.priority === 'medium') priority = 'medium'
        else if (jt.priority === 'low') priority = 'low'

        // Map project to projectId
        const projectId = jt.project === 'pomo-flow' ? '1' : jt.project || '1'

      // FIX: Preserve canvasPosition if it exists in JSON, and set isInInbox based on position
      const hasCanvasPosition = jt.canvasPosition &&
        typeof jt.canvasPosition.x === 'number' &&
        typeof jt.canvasPosition.y === 'number'

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
          // FIX: Use JSON value if available, otherwise default based on canvasPosition
          canvasPosition: hasCanvasPosition ? jt.canvasPosition : undefined,
          isInInbox: hasCanvasPosition ? false : (jt.isInInbox ?? true),
          instances: jt.instances || [], // Preserve instances if available
        }
      })

      // Add imported tasks to existing tasks (avoid duplicates by ID)
      const existingIds = new Set(tasks.value.map(t => t.id))
      const newTasks = importedTasks.filter(task => !existingIds.has(task.id))

      if (newTasks.length > 0) {
        tasks.value.push(...newTasks)
        console.log(`✅ Imported ${newTasks.length} new tasks from JSON file`)
      } else {
        console.log('📋 All tasks from JSON file already exist in database')
      }

    } catch (error) {
      console.log('ℹ️ Could not import tasks from JSON:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Import tasks from recovery tool (localStorage)
  const importFromRecoveryTool = async () => {
    try {
      if (typeof window === 'undefined') {
        console.log('⚠️ Window not available, skipping recovery tool import')
        return
      }

      // First check for user backup
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
          migrateTaskStatuses() // Fix "todo" -> "planned" status mapping for restored tasks
          console.log(`✅ Restored ${restoredTasks.length} tasks from user backup`)

          // Clear the backup after successful restore
          localStorage.removeItem('pomo-flow-user-backup')
          return
        }
      }

      const importedTasks = localStorage.getItem('pomo-flow-imported-tasks')
      if (!importedTasks) {
        console.log('ℹ️ No tasks found in recovery tool storage')
        return
      }

      const tasksData = JSON.parse(importedTasks)
      if (!Array.isArray(tasksData) || tasksData.length === 0) {
        console.log('ℹ️ No valid tasks found in recovery tool storage')
        return
      }

      console.log(`📥 Found ${tasksData.length} tasks in recovery tool, importing...`)

      // Map recovery tool tasks to Task interface format
      interface RecoveryTask {
        id?: string
        title?: string
        description?: string
        status?: string
        priority?: string
        progress?: number
        projectId?: string | null
        createdAt?: string | Date
        updatedAt?: string | Date
      }
      const recoveredTasks: Task[] = tasksData.map((recoveryTask: unknown, index: number) => {
        const rt = recoveryTask as RecoveryTask
        // Map status values
        let status: Task['status'] = 'planned'
        if (rt.status === 'done') status = 'done'
        else if (rt.status === 'todo') status = 'planned'
        else if (rt.status === 'in_progress') status = 'in_progress'
        else if (rt.status === 'backlog') status = 'backlog'
        else if (rt.status === 'on_hold') status = 'on_hold'

        // Map priority values
        let priority: Task['priority'] = null
        if (rt.priority === 'high') priority = 'high'
        else if (rt.priority === 'medium') priority = 'medium'
        else if (rt.priority === 'low') priority = 'low'

        return {
          id: rt.id || `recovery-${Date.now()}-${index}`,
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
          isInInbox: true, // Start in inbox until positioned on canvas
          instances: [], // No instances initially
        }
      })

      // Add recovered tasks to existing tasks (avoid duplicates by ID if available)
      const existingIds = new Set(tasks.value.map(t => t.id))
      const newTasks = recoveredTasks.filter(task => !existingIds.has(task.id))

      if (newTasks.length > 0) {
        tasks.value.push(...newTasks)
        migrateTaskStatuses() // Fix "todo" -> "planned" status mapping for recovered tasks
        console.log(`✅ Imported ${newTasks.length} tasks from recovery tool`)

        // Clear the recovery tool storage after successful import
        localStorage.removeItem('pomo-flow-imported-tasks')
        console.log('🗑️ Cleared recovery tool storage after successful import')
      } else {
        console.log('📋 All tasks from recovery tool already exist in database')
      }

    } catch (error) {
      console.log('ℹ️ Could not import tasks from recovery tool:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Load tasks from PouchDB on initialization
  const loadFromDatabase = async () => {
    console.log('🚀 NEW POUCHDB LOADING: Starting task load from PouchDB...')

    // Set flag to prevent auto-save during load (prevents sync loop)
    isLoadingFromDatabase = true
    // Wait for PouchDB to be available (simple polling)
    let attempts = 0
    while (!window.pomoFlowDb && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    const dbInstance = window.pomoFlowDb
    if (!dbInstance) {
      console.error('❌ PouchDB not available for task loading')
      return
    }

    try {
      // ✅ CORRECT: Tasks are stored as array in tasks:data document
      const result = await dbInstance.allDocs({ include_docs: true })

      console.log('🔍 POUCHDB DEBUG: Total documents found:', result.total_rows)
      console.log('🔍 POUCHDB DEBUG: All document IDs:', result.rows.map((row) => row.id))

      const tasksDoc = result.rows.find((row) => row.id === 'tasks:data')
      console.log('🔍 POUCHDB DEBUG: tasks:data document found:', !!tasksDoc)

      if (tasksDoc?.doc) {
        let taskArray = null

        // Check if doc itself is the array
        if (Array.isArray(tasksDoc.doc)) {
          taskArray = tasksDoc.doc
        }
        // Check if doc has tasks property
        else if (Array.isArray(tasksDoc.doc.tasks)) {
          taskArray = tasksDoc.doc.tasks
        }
        // Check if doc has data property (useDatabase composable structure)
        else if (Array.isArray(tasksDoc.doc.data)) {
          taskArray = tasksDoc.doc.data
        }

        if (taskArray && taskArray.length > 0) {
          const oldTasks = [...tasks.value]
          interface TaskDoc {
            createdAt?: string | Date
            updatedAt?: string | Date
            [key: string]: unknown
          }
          tasks.value = taskArray.map((task: unknown) => {
            const t = task as TaskDoc
            return {
              ...t,
              createdAt: new Date(t.createdAt || Date.now()),
              updatedAt: new Date(t.updatedAt || Date.now())
            }
          }) as Task[]
          taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'debugLoadTasksDirectly-fromDoc')
          console.log(`✅ Loaded ${taskArray.length} tasks from tasks:data`)
        } else {
          console.log('ℹ️ tasks:data exists but is empty')
          const oldTasks = [...tasks.value]
          tasks.value = []
          taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'debugLoadTasksDirectly-emptyDoc')
        }
      } else {
        console.log('ℹ️ No tasks:data document found')
        const oldTasks = [...tasks.value]
        tasks.value = []
        taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'debugLoadTasksDirectly-noDoc')
      }
    } catch (error) {
      console.error('❌ Failed to load tasks from PouchDB:', error)
      const oldTasks = [...tasks.value]
      tasks.value = []
      taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'debugLoadTasksDirectly-error')
      return
    }

    // Run task migrations after loading
    migrateLegacyTasks()
    migrateTaskStatuses() // Fix "todo" -> "planned" status mapping
    migrateInboxFlag()
    migrateNestedTaskProjectIds() // Fix nested tasks to inherit parent's projectId
    migrateTaskUncategorizedFlag() // Set isUncategorized flag for existing tasks

    // DEBUG: DISABLED - was causing infinite sync loop by modifying tasks on every load
    // addTestCalendarInstances()

    // If no tasks found, try to import from recovery tool first, then JSON file
    if (tasks.value.length === 0) {
      console.log('📂 No tasks found, attempting import from recovery tool...')
      await importFromRecoveryTool()

      // If still no tasks, try JSON file
      if (tasks.value.length === 0) {
        console.log('📂 No tasks from recovery tool, attempting import from JSON file...')
        await importTasksFromJSON()
      }
    }

    // REMOVED: Duplicate PouchDB initialization code that was causing race condition
    // Projects are now loaded exclusively by the main database composable (see loadProjectsFromPouchDB function)

    // Load hide done tasks setting (defaults to false to show completed tasks for logging)
    const savedHideDoneTasks = await db.load<boolean>(DB_KEYS.HIDE_DONE_TASKS)
    if (savedHideDoneTasks !== null) {
      hideDoneTasks.value = savedHideDoneTasks
    }
    // If no saved setting exists, keep the default value of false (show done tasks)


    // Test safe sync once
    safeSync('startup-check')

    // Reset flag after loading complete
    isLoadingFromDatabase = false
    console.log('✅ Database load complete, auto-save re-enabled')
  }

  // Auto-save to IndexedDB when tasks, projects, or settings change (debounced)
  let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null
  let projectsSaveTimer: ReturnType<typeof setTimeout> | null = null
  let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(tasks, (newTasks) => {
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
        // Wait for database to be ready before saving
        while (!db.isReady?.value) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Chief Architect: Use SaveQueueManager for conflict prevention
        await db.save(DB_KEYS.TASKS, newTasks)
        console.log('📋 Tasks auto-saved via SaveQueueManager')

        // PHASE 1: Use safe sync wrapper
        await safeSync('tasks-auto-save')
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: 'Tasks auto-save failed',
          error: error as Error,
          context: { taskCount: newTasks?.length },
          showNotification: true,
          userMessage: 'Failed to save tasks. Your changes may not be persisted.'
        })
      }
    }, 1000) // Debounce 1 second for better performance
  }, { deep: true, flush: 'post' })

  // PHASE 3: DEBUG watcher removed - was causing unnecessary deep comparisons
  // Original: watch(() => projects.value.map(...), ..., { deep: true, immediate: true })
  // Removed to improve performance - debugging should use Vue DevTools instead

  // 🔧 CRITICAL: Fix project persistence to use PouchDB instead of IndexedDB
  watch(projects, (newProjects) => {
    if (projectsSaveTimer) clearTimeout(projectsSaveTimer)
    projectsSaveTimer = setTimeout(async () => {
      try {
        // Use PouchDB like tasks (not IndexedDB)
        const dbInstance = window.pomoFlowDb
        if (!dbInstance) {
          console.error('❌ PouchDB not available for project persistence')
          return
        }

        // CRITICAL FIX: Use write queue to prevent concurrent writes and fetch latest _rev
        await queuedWrite(async () => {
          try {
            const existingDoc = await dbInstance.get('projects:data').catch(() => null)
            return await dbInstance.put({
              _id: 'projects:data',
              _rev: existingDoc?._rev || undefined, // Always use latest revision
              data: newProjects,
              createdAt: existingDoc?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          } catch (conflictError) {
            console.error('❌ Projects save conflict, retrying with fresh fetch:', conflictError)
            // Retry once with completely fresh document
            const freshDoc = await dbInstance.get('projects:data')
            return await dbInstance.put({
              _id: 'projects:data',
              _rev: freshDoc._rev,
              data: newProjects,
              createdAt: freshDoc.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }
        })

        console.log(`📋 Projects saved to PouchDB: ${newProjects.length} projects`)

        // PHASE 1: Use safe sync wrapper
        await safeSync('projects-auto-save')
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: 'Projects auto-save failed',
          error: error as Error,
          context: { projectCount: newProjects?.length },
          showNotification: false // Less critical than tasks
        })
      }
    }, 1000) // Debounce 1 second
  }, { deep: true, flush: 'post' })

  // Auto-save hide done tasks setting
  watch(hideDoneTasks, (newValue) => {
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
    settingsSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.HIDE_DONE_TASKS, newValue)
    }, 500) // Debounce 0.5 second for settings
  }, { flush: 'post' })

  // Helper function to recursively collect nested tasks with infinite loop protection
  const collectNestedTasks = (taskIds: string[]): string[] => {
    const allNestedIds: string[] = []
    const visited = new Set<string>() // Prevent infinite loops

    const collectChildren = (parentId: string) => {
      const children = tasks.value.filter(task => task.parentTaskId === parentId)
      children.forEach(child => {
        if (!visited.has(child.id)) {
          visited.add(child.id)
          allNestedIds.push(child.id)
          collectChildren(child.id) // Recursively collect children of children
        }
      })
    }

    taskIds.forEach(parentId => {
      if (!visited.has(parentId)) {
        visited.add(parentId)
        collectChildren(parentId)
      }
    })
    return allNestedIds
  }

  // Computed - Filtered tasks based on active project, smart view, AND status filter
  const filteredTasks = computed(() => {
    // Safety check: ensure tasks array exists and is iterable
    if (!tasks.value || !Array.isArray(tasks.value)) {
      console.warn('TaskStore.filteredTasks: tasks array not initialized, returning empty array')
      return []
    }

    if (shouldLogTaskDiagnostics()) {
      console.log('🚨 TaskStore.filteredTasks: === STARTING FILTERED TASKS COMPUTATION ===')
      console.log('🚨 TaskStore.filteredTasks: Total tasks available:', tasks.value.length)
      console.log('🚨 TaskStore.filteredTasks: activeProjectId:', activeProjectId.value)
      console.log('🚨 TaskStore.filteredTasks: activeSmartView:', activeSmartView.value)
      console.log('🚨 TaskStore.filteredTasks: activeStatusFilter:', activeStatusFilter.value)
      console.log('🚨 TaskStore.filteredTasks: hideDoneTasks:', hideDoneTasks.value)

      // Log all tasks with their basic info
      console.log('🚨 TaskStore.filteredTasks: All tasks in store:')
      tasks.value.forEach(task => {
        console.log(`🚨 TaskStore.filteredTasks:   - "${task.title}" (ID: ${task.id}, Status: ${task.status}, Project: ${task.projectId})`)
      })
    }

    // Helper function to get all child projects (recursively) of a given project
    const getChildProjectIds = (projectId: string): string[] => {
      const ids = [projectId]
      const childProjects = projects.value.filter(p => p.parentId === projectId)
      childProjects.forEach(child => {
        ids.push(...getChildProjectIds(child.id))
      })
      return ids
    }

    let filtered = tasks.value
    if (shouldLogTaskDiagnostics()) {
      console.log('🚨 TaskStore.filteredTasks: After initial assignment:', filtered.length, 'tasks')
    }

    // NEW ARCHITECTURE: Filters are applied SEQUENTIALLY and can be COMBINED
    // Order: Smart View → Project → Status → Hide Done

    // Step 1: Apply smart view filter FIRST (if active)
    if (activeSmartView.value) {
      const { applySmartViewFilter } = useSmartViews()
      filtered = applySmartViewFilter(filtered, activeSmartView.value)
    }

    // Step 2: Apply project filter ON TOP of smart view result (if active)
    // Note: Filters can now be combined - "Today" + "Project X" shows today's tasks in Project X
    if (activeProjectId.value) {
      const beforeProjectFilter = filtered.length
      const projectIds = getChildProjectIds(activeProjectId.value)

      if (shouldLogTaskDiagnostics()) {
        console.log('\n🚨 PROJECT FILTER (Combined with smart view):', activeProjectId.value)
        console.log(`   Target Project IDs (including children): ${projectIds.join(', ')}`)
        console.log(`   Tasks before filter: ${filtered.length}`)
      }

      filtered = filtered.filter(task => projectIds.includes(task.projectId))

      if (shouldLogTaskDiagnostics()) {
        console.log(`   Tasks after filter: ${filtered.length}`)
        console.log(`   Removed: ${beforeProjectFilter - filtered.length}`)
      }
    }

    // Apply status filter (NEW GLOBAL STATUS FILTER)
    if (activeStatusFilter.value) {
      filtered = filtered.filter(task => task.status === activeStatusFilter.value)
    }

    // Apply done task visibility based on user preference
    if (hideDoneTasks.value) {
      const beforeHideDone = filtered.length
      filtered = filtered.filter(task => task.status !== 'done')
      if (shouldLogTaskDiagnostics()) {
        console.log(`🔧 TaskStore.filteredTasks: Hide done tasks enabled - removed ${beforeHideDone - filtered.length} done tasks, ${filtered.length} remaining`)
      }
    } else {
      if (shouldLogTaskDiagnostics()) {
        const doneTaskCount = filtered.filter(task => task.status === 'done').length
        console.log(`🔧 TaskStore.filteredTasks: Hide done tasks disabled - keeping ${doneTaskCount} done tasks in filter results`)
      }
    }

    // NEW: Include nested tasks when their parent matches the filter
    // Get the IDs of tasks that passed the initial filtering
    const filteredTaskIds = filtered.map(task => task.id)
    if (shouldLogTaskDiagnostics()) {
      console.log('🔧 TaskStore.filteredTasks: Parent task IDs that passed filters:', filteredTaskIds)
    }

    // Collect all nested task IDs from the filtered tasks
    const nestedTaskIds = collectNestedTasks(filteredTaskIds)
    if (shouldLogTaskDiagnostics()) {
      console.log('🔧 TaskStore.filteredTasks: Collected nested task IDs:', nestedTaskIds)
    }

    // Find the actual nested task objects and APPLY THE SAME FILTERS
    let nestedTasks: Task[] = []
    try {
      nestedTasks = tasks.value
        .filter(task => nestedTaskIds.includes(task.id))
        .filter(task => {
          try {
            // Validate task object
            if (!task || typeof task !== 'object') return false

            // Apply project filter to nested tasks (including child projects)
            if (activeProjectId.value) {
              const projectIds = getChildProjectIds(activeProjectId.value)
              if (!projectIds.includes(task.projectId)) return false
            }

            // Apply smart view filter to nested tasks
            if (activeSmartView.value === 'today') {
              if (task.status === 'done') return false

              const todayStr = new Date().toISOString().split('T')[0]
              const today = new Date()
              today.setHours(0, 0, 0, 0)

              // Tasks created today
              if (task.createdAt) {
                const taskCreatedDate = new Date(task.createdAt)
                taskCreatedDate.setHours(0, 0, 0, 0)
                if (taskCreatedDate.getTime() === today.getTime()) return true
              }

              // Tasks due today
              if (task.dueDate) {
                const taskDueDate = new Date(task.dueDate)
                if (!isNaN(taskDueDate.getTime()) && formatDateKey(taskDueDate) === todayStr) return true
              }

              // Tasks currently in progress
              if (task.status === 'in_progress') return true

              return false
            } else if (activeSmartView.value === 'week') {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const todayStr = today.toISOString().split('T')[0]
              const weekEnd = new Date(today)
              weekEnd.setDate(weekEnd.getDate() + 7)
              const weekEndStr = weekEnd.toISOString().split('T')[0]

              if (!task.dueDate) return false
              return task.dueDate >= todayStr && task.dueDate <= weekEndStr
            } else if (activeSmartView.value === 'uncategorized') {
              if (task.isUncategorized === true) return true
              if (!task.projectId || task.projectId === '' || task.projectId === null) return true
              return false
            }

            // Apply status filter to nested tasks
            if (activeStatusFilter.value && task.status !== activeStatusFilter.value) return false

            // Apply global done task exclusion to nested tasks
            if (task.status === 'done') return false

            return true
          } catch {
            return false
          }
        })
    } catch {
      nestedTasks = []
    }

    // Combine filtered tasks with their properly filtered nested tasks
    const allTasks = [...filtered, ...nestedTasks]

    // Remove duplicates (in case a nested task was also directly filtered)
    const uniqueTasks = allTasks.filter((task, index, self) =>
      index === self.findIndex(t => t.id === task.id)
    )

    return uniqueTasks
  })

  // Computed - Status groups using filtered tasks
  const tasksByStatus = computed(() => {
    const tasksToGroup = filteredTasks.value
    return {
      planned: tasksToGroup.filter(task => task.status === 'planned'),
      in_progress: tasksToGroup.filter(task => task.status === 'in_progress'),
      done: tasksToGroup.filter(task => task.status === 'done'),
      backlog: tasksToGroup.filter(task => task.status === 'backlog'),
      on_hold: tasksToGroup.filter(task => task.status === 'on_hold')
    }
  })

  // Tasks that have canvas positions (for canvas extent calculation)
  const tasksWithCanvasPosition = computed(() => {
    return tasks.value.filter(task => task.canvasPosition &&
      typeof task.canvasPosition.x === 'number' &&
      typeof task.canvasPosition.y === 'number')
  })

  // Filtered tasks that have canvas positions (for Canvas view with sidebar filters)
  const filteredTasksWithCanvasPosition = computed(() => {
    return filteredTasks.value.filter(task => task.canvasPosition &&
      typeof task.canvasPosition.x === 'number' &&
      typeof task.canvasPosition.y === 'number')
  })

  const totalTasks = computed(() => tasks.value.filter(task => task.status !== 'done').length)
  const completedTasks = computed(() => tasks.value.filter(task => task.status === 'done').length)

  // Done tasks for Done column (respects all other filters but includes done tasks)
  const doneTasksForColumn = computed(() => {
    let doneTasks = tasks.value.filter(task => task.status === 'done')

    // Apply project filter if active
    if (activeProjectId.value) {
      const getChildProjectIds = (projectId: string): string[] => {
        const ids = [projectId]
        const childProjects = projects.value.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
          ids.push(...getChildProjectIds(child.id))
        })
        return ids
      }
      const projectIds = getChildProjectIds(activeProjectId.value)
      doneTasks = doneTasks.filter(task => projectIds.includes(task.projectId))
    }

    // Apply smart view filter if active
    if (activeSmartView.value === 'today') {
      const todayStr = new Date().toISOString().split('T')[0]
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      doneTasks = doneTasks.filter(task => {
        
        // Tasks created today
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        if (taskCreatedDate.getTime() === today.getTime()) return true

        // Tasks due today
        if (task.dueDate) {
          const taskDueDate = new Date(task.dueDate)
          if (!isNaN(taskDueDate.getTime()) && formatDateKey(taskDueDate) === todayStr) return true
        }

        
        return false
      })
    }

    return doneTasks
  })

  const totalPomodoros = computed(() =>
    tasks.value.reduce((sum, task) => sum + task.completedPomodoros, 0)
  )

  // Calendar-aware task filtering - UNIFIED with filteredTasks
  // Uses filteredTasks as base, adds calendar-specific enhancements
  const calendarFilteredTasks = computed(() => {
    if (shouldLogTaskDiagnostics()) {
      console.log('🚨 TaskStore.calendarFilteredTasks: === COMPUTING CALENDAR FILTERED TASKS ===')
      console.log('🚨 TaskStore.calendarFilteredTasks: Using unified filteredTasks as base')
    }

    // Start with the unified filteredTasks (already has smart view + project + status + hideDone filters applied)
    let filtered = [...filteredTasks.value]

    // CALENDAR-SPECIFIC ENHANCEMENT: For "today" smart view, also include unscheduled inbox tasks
    // This is the only calendar-specific behavior that differs from filteredTasks
    if (activeSmartView.value === 'today') {
      // Find unscheduled inbox tasks that should appear in calendar's today view
      const additionalInboxTasks = tasks.value.filter(task => {
        // Skip if task is already in filtered results
        if (filtered.some(t => t.id === task.id)) return false

        // Skip done tasks
        if (task.status === 'done') return false

        // Calendar filtering: IGNORE canvas position entirely
        // A task can be on canvas AND still appear in calendar inbox if not on calendar grid
        // "On calendar" = has instances (time slots), NOT just dueDate
        // dueDate is a deadline, not a calendar time slot

        // Check if task is on the calendar (has instances or legacy schedule)
        const hasInstances = task.instances && task.instances.length > 0
        const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                                 (task.scheduledTime && task.scheduledTime.trim() !== '')
        const isNotOnCalendar = !hasInstances && !hasLegacySchedule

        // Apply project filter if active
        if (activeProjectId.value) {
          const getChildProjectIds = (projectId: string): string[] => {
            const ids = [projectId]
            const childProjects = projects.value.filter(p => p.parentId === projectId)
            childProjects.forEach(child => {
              ids.push(...getChildProjectIds(child.id))
            })
            return ids
          }
          const projectIds = getChildProjectIds(activeProjectId.value)
          if (!projectIds.includes(task.projectId)) return false
        }

        // Apply status filter if active
        if (activeStatusFilter.value && task.status !== activeStatusFilter.value) return false

        // Calendar inbox: show if not on calendar grid (ignore canvas state)
        return isNotOnCalendar
      })

      // Add the additional inbox tasks
      filtered = [...filtered, ...additionalInboxTasks]
    }

    if (shouldLogTaskDiagnostics()) {
      console.log(`🚨 TaskStore.calendarFilteredTasks: Final calendar filtered tasks: ${filtered.length}`)
      console.log('🚨 TaskStore.calendarFilteredTasks: === END CALENDAR FILTERED TASKS ===')
    }

    return filtered
  })

  // Centralized non-done task counter - single source of truth for all task counting
  const nonDoneTaskCount = computed(() => {
    // Use the already-filtered tasks from filteredTasks computed property
    // This ensures we use the exact same logic that excludes done tasks globally
    return filteredTasks.value.length
  })

  // CENTRALIZED TASK COUNTS - Single source of truth for sidebar counts
  // These counts respect the active project filter (if set) to show relevant counts
  // Updated: Fixed timezone bug using local date strings
  const smartViewTaskCounts = computed(() => {
    const { isTodayTask, isWeekTask, isUncategorizedTask, isUnscheduledTask, isInProgressTask } = useSmartViews()

    // Get the base tasks - either all tasks or project-filtered tasks
    let baseTasks = tasks.value

    // If project filter is active, show counts within that project only
    if (activeProjectId.value) {
      const getChildProjectIds = (projectId: string): string[] => {
        const ids = [projectId]
        const childProjects = projects.value.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
          ids.push(...getChildProjectIds(child.id))
        })
        return ids
      }
      const projectIds = getChildProjectIds(activeProjectId.value)
      baseTasks = baseTasks.filter(task => projectIds.includes(task.projectId))
    }

    // Apply hideDoneTasks if enabled (except for specific views that handle it internally)
    if (hideDoneTasks.value) {
      baseTasks = baseTasks.filter(task => task.status !== 'done')
    }

    // Calculate counts for each smart view
    const today = baseTasks.filter(task => isTodayTask(task)).length
    const week = baseTasks.filter(task => isWeekTask(task)).length
    const uncategorized = baseTasks.filter(task => isUncategorizedTask(task)).length
    const unscheduled = baseTasks.filter(task => isUnscheduledTask(task)).length
    const inProgress = baseTasks.filter(task => isInProgressTask(task)).length

    // 'all_active' counts all non-done tasks (previously 'above_my_tasks')
    const allActive = baseTasks.filter(task => task.status !== 'done').length

    // 'all' is just the total of base tasks (respecting project filter)
    const all = baseTasks.length

    return {
      today,
      week,
      uncategorized,
      unscheduled,
      inProgress,
      allActive,
      all
    }
  })

  // Helper to get count for a specific project (respecting active filters)
  const getProjectTaskCount = (projectId: string): number => {
    const getChildProjectIds = (id: string): string[] => {
      const ids = [id]
      const childProjects = projects.value.filter(p => p.parentId === id)
      childProjects.forEach(child => {
        ids.push(...getChildProjectIds(child.id))
      })
      return ids
    }

    const projectIds = getChildProjectIds(projectId)
    let projectTasks = tasks.value.filter(task => projectIds.includes(task.projectId))

    // Apply smart view filter if active
    if (activeSmartView.value) {
      const { applySmartViewFilter } = useSmartViews()
      projectTasks = applySmartViewFilter(projectTasks, activeSmartView.value)
    }

    // Apply status filter if active
    if (activeStatusFilter.value) {
      projectTasks = projectTasks.filter(task => task.status === activeStatusFilter.value)
    }

    // Apply hideDoneTasks if enabled
    if (hideDoneTasks.value) {
      projectTasks = projectTasks.filter(task => task.status !== 'done')
    }

    return projectTasks.length
  }

  // Root projects - projects without parentId (for AppSidebar)
  const rootProjects = computed(() => {
    return projects.value.filter(p => !p.parentId || p.parentId === 'undefined' || p.parentId === undefined)
  })

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
          id: `instance-${taskId}-${Date.now()}`,
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

      // Save to PouchDB for persistence
      await db.save(DB_KEYS.TASKS, tasks.value)
      console.log('✅ Task saved to PouchDB:', newTask.id)

      console.log('✅ Task created and saved to PouchDB:', newTask.id)
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
        console.log(`Task "${task.title}" given calendar instances - canvas state unchanged (independent systems)`)
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
        console.warn(`⚠️ [ORPHAN_PREVENTION] Task "${task.title}" would become orphaned - restoring to inbox`)
        updates.isInInbox = true
      }

      // Apply the updates
      tasks.value[taskIndex] = {
        ...task,
        ...updates,
        updatedAt: new Date()
      }

      // Debug log for state verification
      const updatedTask = tasks.value[taskIndex]
      console.log(`🔄 Task "${updatedTask.title}" state updated:`, {
        status: updatedTask.status,
        isInInbox: updatedTask.isInInbox,
        canvasPosition: updatedTask.canvasPosition,
        instanceCount: updatedTask.instances?.length || 0
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

      console.log(`📊 Simple validation - Memory: ${memoryCount}, DB: ${dbCount}`)

      // Basic consistency check (ignoring localStorage for now)
      return memoryCount === dbCount

    } catch (error) {
      console.warn('⚠️ Validation failed, but continuing:', error)
      return true // Don't fail operations due to validation issues
    }
  }

  // Manual operation flag to prevent watch system conflicts
  let manualOperationInProgress = false

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
      taskDisappearanceLogger.takeSnapshot(tasks.value, `deleteTask-${deletedTask.title.substring(0, 30)}`)

      // EMERGENCY FIX: Single PouchDB operation only (no Promise.all conflicts)
      console.log('💾 Single persistence operation (emergency fix)...')

      await db.save(DB_KEYS.TASKS, tasks.value)

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
        await db.save(DB_KEYS.TASKS, tasks.value)
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

  // Start task now - move to current time and mark as in progress
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
    const timeStr = `${roundedTime.getHours().toString().padStart(2, '0')}:${roundedTime.getMinutes().toString().padStart(2, '0')}`

    // Initialize instances array if it doesn't exist
    if (!task.instances) {
      task.instances = []
    }

    // Clear existing instances to avoid duplicates
    task.instances = []

    // Create new instance for current time
    const newInstance = {
      id: `instance-${taskId}-${Date.now()}`,
      scheduledDate: todayStr,
      scheduledTime: timeStr,
      duration: task.estimatedDuration || 60
    }

    task.instances.push(newInstance)

    // Update task status to in_progress
    task.status = 'in_progress'
    task.updatedAt = new Date()

    console.log(`Task "${task.title}" scheduled for today at ${timeStr} and marked as in_progress`)
  }

  // Date-based task movement functions
  const moveTaskToSmartGroup = (taskId: string, smartGroupType: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    console.log(`[Smart Groups] Moving task "${task.title}" to smart group: ${smartGroupType}`)

    // Smart group logic - set dueDate but preserve inbox status
    const today = new Date()
    let dueDate = ''

    switch (smartGroupType.toLowerCase()) {
      case 'today':
        dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        break
      case 'tomorrow': {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        dueDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
        break
      }
      case 'this weekend': {
        const saturday = new Date(today)
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
        saturday.setDate(today.getDate() + daysUntilSaturday)
        dueDate = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`
        break
      }
      case 'this week': {
        const sunday = new Date(today)
        const daysUntilSunday = (7 - today.getDay()) % 7 || 7
        sunday.setDate(today.getDate() + daysUntilSunday)
        dueDate = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
        break
      }
      case 'later':
        // For "later", don't set a specific due date
        dueDate = ''
        break
      default:
        console.warn(`[Smart Groups] Unknown smart group type: ${smartGroupType}`)
        return
    }

    // Create updates object - only set dueDate, let caller control isInInbox
    const updates: Partial<Task> = {
      dueDate: dueDate,
    }

    console.log(`[Smart Groups] Applied ${smartGroupType} properties to task "${task.title}":`, {
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

    console.log(`Moving task "${task.title}" to date column: ${dateColumn}`)

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
        id: `instance-${taskId}-${Date.now()}`,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        duration: task.estimatedDuration || 60,
        isLater
      }

      task.instances.push(newInstance)
      console.log(`Created new ${isLater ? 'later' : 'scheduled'} instance for task "${task.title}" on ${dateStr}`)
    } else {
      // For no date, instances array is already cleared
      if (previousCount > 0) {
        console.log(`Removed ${previousCount} instances for task "${task.title}" (moved to no date)`)
      }
    }

    // CRITICAL FIX: When a task is scheduled, it should no longer be in the inbox
    if (task.isInInbox !== false) {
      task.isInInbox = false
      console.log(`Task "${task.title}" removed from inbox (scheduled for ${dateColumn})`)
    }

    task.updatedAt = new Date()
    console.log(`Task movement completed. Task now has ${task.instances.length} instances`)
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
    console.log(`Task "${task.title}" unscheduled:`, {
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
    activeProjectId.value = projectId
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

  const setProjectViewType = (projectId: string, viewType: Project['viewType']) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.viewType = viewType
    }
  }

  // Project management actions
  const createProject = (projectData: Partial<Project>) => {
    console.log('🔥 [DEBUG] tasks.ts createProject called with:', projectData)
    console.trace('🔥 [DEBUG] Call stack for createProject')

    const newProject: Project = {
      id: Date.now().toString(),
      name: projectData.name || 'New Project',
      color: projectData.color || '#4ECDC4',
      colorType: projectData.colorType || 'hex',
      emoji: projectData.emoji,
      viewType: projectData.viewType || 'status',
      parentId: projectData.parentId || null, // FIX: Ensure null for root projects
      createdAt: new Date(),
      ...projectData
    }

    console.log('🎯 [DEBUG] Creating new project object:', {
      id: newProject.id,
      name: newProject.name,
      parentId: newProject.parentId,
      colorType: newProject.colorType
    })

    projects.value.push(newProject)

    // FIX: Log projects array after creation
    console.log('📋 [DEBUG] Projects array after creation:', projects.value.length, 'projects')
    console.log('📋 [DEBUG] All projects in store:', projects.value.map(p => ({ id: p.id, name: p.name, parentId: p.parentId })))

    return newProject
  }

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    const projectIndex = projects.value.findIndex(p => p.id === projectId)
    if (projectIndex !== -1) {
      projects.value[projectIndex] = {
        ...projects.value[projectIndex],
        ...updates
      }
    }
  }

  const deleteProject = (projectId: string) => {
    const projectIndex = projects.value.findIndex(p => p.id === projectId)
    if (projectIndex !== -1) {
      // REMOVED: "My Tasks" protection - no more default project with ID '1'

      // Move all tasks from this project to uncategorized (null)
      tasks.value.forEach(task => {
        if (task.projectId === projectId) {
          task.projectId = null
          task.isUncategorized = true
          task.updatedAt = new Date()
        }
      })

      // Move child projects to parent of deleted project
      projects.value.forEach(project => {
        if (project.parentId === projectId) {
          project.parentId = projects.value[projectIndex].parentId
        }
      })

      projects.value.splice(projectIndex, 1)
    }
  }

  const setProjectColor = (projectId: string, color: string, colorType: 'hex' | 'emoji', emoji?: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.color = color
      project.colorType = colorType
      if (colorType === 'emoji' && emoji) {
        project.emoji = emoji
      } else {
        project.emoji = undefined
      }
    }
  }

  const moveTaskToProject = (taskId: string, targetProjectId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.projectId = targetProjectId
      task.updatedAt = new Date()
      console.log(`Task "${task.title}" moved to project "${getProjectById(targetProjectId)?.name}"`)
    }
  }

  const getProjectById = (projectId: string): Project | undefined => {
    return projects.value.find(p => p.id === projectId)
  }

  const getProjectDisplayName = (projectId: string | null | undefined): string => {
    // REMOVED: My Tasks fallback logic - My Tasks concept removed
    if (!projectId) return 'Uncategorized'
    if (projectId === '1') return 'Uncategorized' // Legacy uncategorized project ID
    const project = getProjectById(projectId)
    return project?.name || 'Uncategorized' // Show "Uncategorized" instead of "Unknown Project"
  }

  const getProjectEmoji = (projectId: string | null | undefined): string => {
    if (!projectId) return '📁' // Default folder emoji for uncategorized tasks
    const project = getProjectById(projectId)
    return project?.emoji || '📁' // Return project emoji or default folder emoji
  }

  // Enhanced project visual function that returns either emoji or CSS circle information
  const getProjectVisual = (projectId: string | null | undefined): {
    type: 'emoji' | 'css-circle' | 'default'
    content: string
    color?: string
  } => {
    if (!projectId) {
      return { type: 'default', content: '📁' }
    }

    const project = getProjectById(projectId)
    if (!project) {
      return { type: 'default', content: '📁' }
    }

    // Priority 1: Show emoji if project has one set
    if (project.emoji) {
      return { type: 'emoji', content: project.emoji }
    }

    // Priority 2: Show CSS circle if project has hex color (supports both 'hex' and 'color' types)
    if (project.colorType === 'hex' && typeof project.color === 'string') {
      return {
        type: 'css-circle',
        content: '', // Empty content - CSS will create the circle
        color: project.color
      }
    }

    // Priority 3: Default fallback
    return { type: 'default', content: '📁' }
  }

  const getTask = (taskId: string): Task | undefined => {
    return tasks.value.find(task => task.id === taskId)
  }

  const getTaskInstances = (task: Task): RecurringTaskInstance[] => {
    return task.recurringInstances || []
  }

  const getUncategorizedTaskCount = (): number => {
    // Apply the exact same filtering logic as the uncategorized smart view in filteredTasks
    let filteredTasks = tasks.value

    // Apply project filter (include all projects for uncategorized count)
    // No project filtering needed for uncategorized tasks

    // Apply uncategorized smart view filter
    filteredTasks = filteredTasks.filter(task => {
      // Check isUncategorized flag first
      if (task.isUncategorized === true) {
        return true
      }

      // Backward compatibility: also treat tasks without proper project assignment as uncategorized
      if (!task.projectId || task.projectId === '' || task.projectId === null) {
        return true
      }

      return false
    })

    // Always exclude done tasks for uncategorized count
    // This ensures uncategorized ≤ allActive (which always excludes done)
    // Bug fix: Previously only excluded done when hideDoneTasks was true
    filteredTasks = filteredTasks.filter(task => {
      if (task.status === 'done') return false
      return true
    })

    return filteredTasks.length
  }

  const isDescendantOf = (projectId: string, potentialAncestorId: string): boolean => {
    // Check if projectId is a descendant of potentialAncestorId
    // Used to prevent circular dependencies when nesting projects
    let current = getProjectById(projectId)

    while (current?.parentId) {
      if (current.parentId === potentialAncestorId) {
        return true // projectId is a descendant of potentialAncestorId
      }
      current = getProjectById(current.parentId)
    }

    return false
  }

  const getChildProjects = (parentId: string): Project[] => {
    return projects.value.filter(p => p.parentId === parentId)
  }

  const getProjectHierarchy = (projectId: string): Project[] => {
    const project = getProjectById(projectId)
    if (!project) return []

    const hierarchy = [project]
    let currentId = project.parentId

    while (currentId) {
      const parent = getProjectById(currentId)
      if (parent) {
        hierarchy.unshift(parent)
        currentId = parent.parentId
      } else {
        break
      }
    }

    return hierarchy
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
    createTask: (taskData: Partial<Task>) => Promise<Task>
    updateTask: (taskId: string, updates: Partial<Task>) => void
    deleteTask: (taskId: string) => void
    deleteTaskWithUndo: (taskId: string) => void
    undo?: () => void
    redo?: () => void
    canUndo?: boolean
    canRedo?: boolean
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
            moveTaskToProject: (taskId: string, targetProjectId: string) => moveTaskToProject(taskId, targetProjectId),
            moveTaskToDate: (taskId: string, dateColumn: string) => moveTaskToDate(taskId, dateColumn),
            moveTaskToSmartGroup: (taskId: string, smartGroupType: string) => moveTaskToSmartGroup(taskId, smartGroupType),
            createSubtask: (taskId: string, subtaskData: Partial<Subtask>) => createSubtask(taskId, subtaskData),
            updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => updateSubtask(taskId, subtaskId, updates),
            deleteSubtask: (taskId: string, subtaskId: string) => deleteSubtask(taskId, subtaskId),
            createTaskInstance: (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => createTaskInstance(taskId, instanceData),
            updateTaskInstance: (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => updateTaskInstance(taskId, instanceId, updates),
            deleteTaskInstance: (taskId: string, instanceId: string) => deleteTaskInstance(taskId, instanceId),
            createProject: (projectData: Partial<Project>) => createProject(projectData),
            updateProject: (projectId: string, updates: Partial<Project>) => updateProject(projectId, updates),
            deleteProject: (projectId: string) => deleteProject(projectId),
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

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value}`)

          const result = undoHistory.createTaskWithUndo(taskData)
          console.log('✅ Task created with undo successfully')

          console.log(`📋 After execution - undo count: ${undoHistory.undoCount.value}`)
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

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value}`)

          const result = undoHistory.updateTaskWithUndo(taskId, updates)
          console.log('✅ Task updated with undo successfully')
          console.log(`✅ Undo count after update: ${undoHistory.undoCount.value}`)
          console.log(`✅ Can undo: ${undoHistory.canUndo.value}`)

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

          console.log(`📋 Before execution - undo count: ${undoHistory.undoCount.value}`)

          const result = undoHistory.deleteTaskWithUndo(taskId)
          console.log('✅ Task deleted with undo successfully')
          console.log(`✅ Undo count after deletion: ${undoHistory.undoCount.value}`)
          console.log(`✅ Can undo: ${undoHistory.canUndo.value}`)

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
        return moveTaskToProject(taskId, targetProjectId)
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
        return createProject(projectData)
      },
      updateProjectWithUndo: async (projectId: string, updates: Partial<Project>) => {
        // Unified undo/redo doesn't support project operations yet
        // Using direct operations for now
        return updateProject(projectId, updates)
      },
      deleteProjectWithUndo: async (projectId: string) => {
        // Unified undo/redo doesn't support project operations yet
        // Using direct operations for now
        return deleteProject(projectId)
      },

      // Bulk actions with undo/redo
      bulkUpdateTasksWithUndo: async (taskIds: string[], updates: Partial<Task>) => {
        // Unified undo/redo doesn't support bulk operations yet
        // Perform individual updates for now
        taskIds.forEach(taskId => updateTask(taskId, updates))
      },
      bulkDeleteTasksWithUndo: async (taskIds: string[]) => {
        // Unified undo/redo doesn't support bulk operations yet
        // Perform individual deletions for now
        taskIds.forEach(taskId => deleteTask(taskId))
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

    if (newTasks.length === 0 && tasks.value.length > 0) {
      errorHandler.report({
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.STATE,
        message: 'restoreState: Blocked attempt to restore empty array',
        context: { currentTaskCount: tasks.value.length, newTaskCount: 0 },
        showNotification: true,
        userMessage: 'Undo blocked to prevent data loss'
      })
      return
    }

    // Validate task objects have required fields
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
      await db.save(DB_KEYS.TASKS, tasks.value)
      console.log('🔄 [TASK-STORE] AFTER db.save: tasks.value.length =', tasks.value.length)

      // Also save to persistent storage for redundancy
      await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, tasks.value)
      console.log('🔄 [TASK-STORE] AFTER persistentStorage.save: tasks.value.length =', tasks.value.length)

      console.log('🔄 [TASK-STORE] State restored successfully. Tasks now has', tasks.value.length, 'items')

      // DEBUG: Log canvas tasks after restore
      const canvasTasks = tasks.value.filter(t => t.isInInbox === false && t.canvasPosition)
      console.log(`🔍 [RESTORE-DEBUG] After restore: ${canvasTasks.length} tasks have canvas properties`)
      canvasTasks.forEach(t => {
        console.log(`   - ${t.title}: isInInbox=${t.isInInbox}, canvasPosition=${JSON.stringify(t.canvasPosition)}`)
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
        await db.save(DB_KEYS.TASKS, tasks.value)
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

  // MIGRATION: Convert "My Tasks" projectId='1' tasks to uncategorized
  // This is part of the "My Tasks" redundancy removal plan
  const migrateMyTasksToUncategorized = async () => {
    try {
      const tasksWithMyTasksProject = tasks.value.filter(task => task.projectId === '1')

      if (tasksWithMyTasksProject.length === 0) {
        console.log('ℹ️ No tasks with projectId="1" found - migration not needed')
        return
      }

      console.log(`🔄 MIGRATION: Found ${tasksWithMyTasksProject.length} tasks with projectId="1", converting to uncategorized`)

      // Update tasks to be uncategorized
      let migratedCount = 0
      tasks.value.forEach(task => {
        if (task.projectId === '1') {
          task.projectId = '' // empty string for uncategorized (matches Task interface)
          task.isUncategorized = true // Explicitly mark as uncategorized
          migratedCount++
          console.log(`  → Migrated task: "${task.title}" (id: ${task.id})`)
        }
      })

      // Save migrated tasks to database
      await db.save(DB_KEYS.TASKS, tasks.value)
      console.log(`💾 Migration completed: ${migratedCount} tasks converted to uncategorized and saved to database`)

    } catch (error) {
      console.error('❌ Failed to migrate "My Tasks" tasks to uncategorized:', error)
      // Continue with migration failure - tasks will remain as-is
    }
  }

  // CRITICAL: INITIALIZATION FROM POUCHDB ON STORE CREATION
  const initializeFromPouchDB = async () => {
    console.log('🔄 Initializing store from PouchDB...')

    // FIX #5: Wait for PouchDB to be available before trying to load
    // This fixes the race condition where store tries to load before PouchDB is ready
    let attempts = 0
    while (!window.pomoFlowDb && attempts < 50) {
      console.log(`⏳ Waiting for PouchDB to be available... attempt ${attempts + 1}/50`)
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    const dbInstance = window.pomoFlowDb
    if (!dbInstance) {
      console.error('❌ PouchDB not available for store initialization - skipping database load')
      console.log('⚠️ Store will continue with empty state (no tasks/projects from database)')
      // Continue with empty state if PouchDB is not available
      return
    }

    console.log('✅ PouchDB is available, proceeding with store initialization...')

    try {
      await Promise.all([
        loadTasksFromPouchDB(),
        loadProjectsFromPouchDB()
      ])

      // MIGRATION: Migrate tasks with projectId = '1' to uncategorized
      // This is part of the "My Tasks" redundancy removal plan
      await migrateMyTasksToUncategorized()

      console.log('✅ Store initialized from PouchDB successfully (with "My Tasks" migration)')
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Store initialization failed',
        error: error as Error,
        showNotification: true,
        userMessage: 'Failed to load your tasks. Please refresh the page.'
      })
      // Continue with empty state if initialization fails
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
    projects,
    currentView,
    selectedTaskIds,
    activeProjectId,
    activeSmartView,
    activeStatusFilter,
    hideDoneTasks,

    // Computed
    filteredTasks,
    calendarFilteredTasks,
    doneTasksForColumn,
    tasksWithCanvasPosition,
    filteredTasksWithCanvasPosition,
    tasksByStatus,
    totalTasks,
    completedTasks,
    totalPomodoros,
    nonDoneTaskCount,
    smartViewTaskCounts,
    rootProjects,

    // Centralized count helpers
    getProjectTaskCount,

    // Original actions (without undo/redo - for internal use)
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    selectTask,
    deselectTask,
    clearSelection,
    setActiveProject,
    setSmartView,
    setActiveStatusFilter,
    toggleStatusFilter,
    setProjectViewType,
    toggleHideDoneTasks,

    // Project management actions
    createProject,
    updateProject,
    deleteProject,
    setProjectColor,
    moveTaskToProject,
    getProjectById,
    getProjectDisplayName,
    getProjectEmoji,
    getProjectVisual,
    isDescendantOf,
    getChildProjects,
    getProjectHierarchy,

    // Date and priority movement actions
    moveTaskToDate,
    moveTaskToPriority,
    startTaskNow,
    unscheduleTask,

    // Subtask actions
    createSubtask,
    updateSubtask,
    deleteSubtask,

    // Task Instance actions
    createTaskInstance,
    updateTaskInstance,
    deleteTaskInstance,

    // Nested task management
    getNestedTasks,
    getTaskChildren,
    getTaskHierarchy,
    isNestedTask,
    hasNestedTasks,

    // Database actions
    loadFromDatabase,
    importTasksFromJSON,
    importFromRecoveryTool,

    // Helper functions
    getTask,
    getTaskInstances,
    getUncategorizedTaskCount,

    // Data integrity validation
    validateDataConsistency,

    // Undo/Redo support
    restoreState,

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions()
  }
})

