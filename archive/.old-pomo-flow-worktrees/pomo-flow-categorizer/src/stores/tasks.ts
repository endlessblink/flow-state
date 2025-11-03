import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { useCloudSync } from '@/composables/useCloudSync'
import { getUndoSystem } from '@/composables/undoSingleton'

export interface Subtask {
  id: string
  parentTaskId: string
  title: string
  description: string
  completedPomodoros: number
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TaskInstance {
  id: string
  scheduledDate: string
  scheduledTime: string
  duration?: number // Duration override (defaults to task.estimatedDuration)
  completedPomodoros?: number // Pomodoros completed for this specific instance
  isLater?: boolean // Flag to distinguish "Later" from "No Date"
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Subtask[]
  dueDate: string
  scheduledDate?: string // DEPRECATED - kept for backward compatibility, use instances instead
  scheduledTime?: string // DEPRECATED - kept for backward compatibility, use instances instead
  estimatedDuration?: number // in minutes
  instances?: TaskInstance[] // Calendar occurrences - enables task reuse
  projectId: string
  parentTaskId?: string | null // For nested tasks - null means root-level task
  createdAt: Date
  updatedAt: Date

  // Canvas workflow fields
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean // True if not yet positioned on canvas
  dependsOn?: string[] // Task IDs this depends on
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
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
}

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

// Helper function for backward compatibility
export const getTaskInstances = (task: Task): TaskInstance[] => {
  // If task has instances array, return it
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }

  // Backward compatibility: create synthetic instance from legacy fields
  if (task.scheduledDate && task.scheduledTime) {
    return [{
      id: `legacy-${task.id}`,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }

  // No instances
  return []
}

// Clear only hardcoded test tasks while preserving user's real tasks
export const clearHardcodedTestTasks = async () => {
  console.log('🗑️ Clearing hardcoded test tasks only (preserving real tasks)...')

  // Import required modules
  const { useDatabase } = await import('@/composables/useDatabase')
  const { usePersistentStorage } = await import('@/composables/usePersistentStorage')

  const db = useDatabase()
  const persistentStorage = usePersistentStorage()

  try {
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

    // Save only the real tasks back to database
    await db.save(DB_KEYS.TASKS, realTasks)

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
  const db = useDatabase()
  const persistentStorage = usePersistentStorage()
  const cloudSync = useCloudSync()

  // State - Start with empty tasks array
  const tasks = ref<Task[]>([])



  // Initialize sample tasks (disabled - start with empty)
  const initializeSampleTasks = () => {
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
      if (task.status === 'todo') {
        task.status = 'planned'
        console.log(`🔄 Migrated task "${task.title}" status from "todo" to "planned"`)
      }
    })
  }

  // Migrate tasks to set isInInbox based on canvas position
  const migrateInboxFlag = () => {
    tasks.value.forEach(task => {
      // If isInInbox is undefined, set based on canvasPosition
      if (task.isInInbox === undefined) {
        // Task has canvas position = not in inbox
        // Task has no canvas position = in inbox
        task.isInInbox = !task.canvasPosition
      }
    })
  }

  // Migrate projects to add viewType field
  const migrateProjects = () => {
    projects.value.forEach(project => {
      if (!project.viewType) {
        project.viewType = 'status' // Default to status view
      }
    })
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



  const projects = ref<Project[]>([
    {
      id: '1',
      name: 'My Tasks',
      color: '#3b82f6',
      colorType: 'hex',
      viewType: 'status', // Default to status-based view
      createdAt: new Date(),
    }
  ])

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
        // If color looks like an emoji, set as emoji type
        if (project.color && typeof project.color === 'string' && /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(project.color)) {
          project.colorType = 'emoji'
          project.emoji = project.color
        } else {
          project.colorType = 'hex'
        }
      }
    })
  }

  // Run color migration
  migrateProjectColors()

  const currentView = ref('board')
  const selectedTaskIds = ref<string[]>([])
  const activeProjectId = ref<string | null>(null) // null = show all projects
  const activeSmartView = ref<'today' | 'week' | null>(null)
  const activeStatusFilter = ref<string | null>(null) // null = show all statuses, 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  const hideDoneTasks = ref(false) // Global setting to hide done tasks across all views (disabled by default to show completed tasks for logging)

  // Import tasks from JSON file (for migration from external storage)
  const importTasksFromJSON = async (jsonFilePath?: string) => {
    try {
      // If no path provided, use the default tasks.json path
      const defaultPath = '/tasks.json'

      let tasksData: any[]
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
      const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData.data || [])

      if (!tasksArray || tasksArray.length === 0) {
        console.log('No tasks found in JSON file')
        return
      }

      console.log(`📥 Found ${tasksArray.length} tasks in JSON file, importing...`)

      // Map JSON tasks to Task interface format
      const importedTasks: Task[] = tasksArray.map(jsonTask => {
        // Map status values
        let status: Task['status'] = 'planned'
        if (jsonTask.status === 'done') status = 'done'
        else if (jsonTask.status === 'todo') status = 'planned'
        else if (jsonTask.status === 'in_progress') status = 'in_progress'
        else if (jsonTask.status === 'backlog') status = 'backlog'
        else if (jsonTask.status === 'on_hold') status = 'on_hold'

        // Map priority values
        let priority: Task['priority'] = null
        if (jsonTask.priority === 'high') priority = 'high'
        else if (jsonTask.priority === 'medium') priority = 'medium'
        else if (jsonTask.priority === 'low') priority = 'low'

        // Map project to projectId
        const projectId = jsonTask.project === 'pomo-flow' ? '1' : jsonTask.project || '1'

        return {
          id: jsonTask.id,
          title: jsonTask.title,
          description: jsonTask.description || '',
          status,
          priority,
          progress: jsonTask.progress || 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: new Date().toLocaleDateString(),
          projectId,
          createdAt: new Date(jsonTask.created || jsonTask.createdAt || Date.now()),
          updatedAt: new Date(jsonTask.updated || jsonTask.createdAt || Date.now()),
          isInInbox: true, // Start in inbox until positioned on canvas
          instances: [], // No instances initially
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
      const recoveredTasks: Task[] = tasksData.map((recoveryTask: any, index: number) => {
        // Map status values
        let status: Task['status'] = 'planned'
        if (recoveryTask.status === 'done') status = 'done'
        else if (recoveryTask.status === 'todo') status = 'planned'
        else if (recoveryTask.status === 'in_progress') status = 'in_progress'
        else if (recoveryTask.status === 'backlog') status = 'backlog'
        else if (recoveryTask.status === 'on_hold') status = 'on_hold'

        // Map priority values
        let priority: Task['priority'] = null
        if (recoveryTask.priority === 'high') priority = 'high'
        else if (recoveryTask.priority === 'medium') priority = 'medium'
        else if (recoveryTask.priority === 'low') priority = 'low'

        return {
          id: recoveryTask.id || `recovery-${Date.now()}-${index}`,
          title: recoveryTask.title || 'Recovered Task',
          description: recoveryTask.description || '',
          status,
          priority,
          progress: recoveryTask.progress || 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: new Date().toLocaleDateString(),
          projectId: recoveryTask.projectId || '1',
          createdAt: new Date(recoveryTask.createdAt || Date.now()),
          updatedAt: new Date(recoveryTask.updatedAt || Date.now()),
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

  // Load tasks from IndexedDB on initialization
  const loadFromDatabase = async () => {
    const savedTasks = await db.load<Task[]>(DB_KEYS.TASKS)
    if (savedTasks && savedTasks.length > 0) {
      tasks.value = savedTasks.map(task => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      }))
      console.log(`📂 Loaded ${tasks.value.length} tasks from IndexedDB`)

      // Run task migrations after loading
      migrateLegacyTasks()
      migrateTaskStatuses() // Fix "todo" -> "planned" status mapping
      migrateInboxFlag()
      migrateNestedTaskProjectIds() // Fix nested tasks to inherit parent's projectId

      // DEBUG: Add test instances for calendar filter testing
      addTestCalendarInstances()
    } else {
      // If no tasks in IndexedDB, try to import from recovery tool first, then JSON file
      console.log('📂 No tasks in IndexedDB, attempting import from recovery tool...')
      await importFromRecoveryTool()

      // If still no tasks, try JSON file
      if (tasks.value.length === 0) {
        console.log('📂 No tasks from recovery tool, attempting import from JSON file...')
        await importTasksFromJSON()
      }
    }

    const savedProjects = await db.load<Project[]>(DB_KEYS.PROJECTS)
    if (savedProjects && savedProjects.length > 0) {
      projects.value = savedProjects.map(project => ({
        ...project,
        createdAt: new Date(project.createdAt)
      }))
      console.log(`📂 Loaded ${projects.value.length} projects from IndexedDB`)

      // Run migrations after loading from database
      migrateProjects()
      migrateProjectColors()
    }

    // Load hide done tasks setting (defaults to false to show completed tasks for logging)
    const savedHideDoneTasks = await db.load<boolean>(DB_KEYS.HIDE_DONE_TASKS)
    if (savedHideDoneTasks !== null) {
      hideDoneTasks.value = savedHideDoneTasks
    }
    // If no saved setting exists, keep the default value of false (show done tasks)

    // Auto-sync from cloud on startup if enabled
    cloudSync.syncFromCloud().catch(error => {
      console.warn('Cloud sync on startup failed:', error)
    })
  }

  // Auto-save to IndexedDB when tasks, projects, or settings change (debounced)
  let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null
  let projectsSaveTimer: ReturnType<typeof setTimeout> | null = null
  let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(tasks, (newTasks) => {
    if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
    tasksSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.TASKS, newTasks)
      // Also save to persistent storage for redundancy
      persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, newTasks)
        .catch(error => console.warn('Failed to save to persistent storage:', error))

      // Trigger cloud sync if enabled
      cloudSync.syncNow().catch(error => {
        console.warn('Cloud sync failed:', error)
      })
    }, 1000) // Debounce 1 second for better performance
  }, { deep: true, flush: 'post' })

  watch(projects, (newProjects) => {
    if (projectsSaveTimer) clearTimeout(projectsSaveTimer)
    projectsSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.PROJECTS, newProjects)

      // Trigger cloud sync if enabled
      cloudSync.syncNow().catch(error => {
        console.warn('Cloud sync failed:', error)
      })
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
    console.log('🚨 TaskStore.filteredTasks: After initial assignment:', filtered.length, 'tasks')

    // Apply project filter first (including child projects)
    if (activeProjectId.value) {
      const beforeProjectFilter = filtered.length
      const projectIds = getChildProjectIds(activeProjectId.value)

      // 🚨 DIAGNOSTIC LOGGING - DELETE AFTER DEBUGGING
      console.log('\n🚨🚨🚨 PROJECT FILTER DIAGNOSTIC 🚨🚨🚨')
      console.log(`   Active Project ID: ${activeProjectId.value} (type: ${typeof activeProjectId.value})`)
      console.log(`   Target Project IDs (including children): ${projectIds.join(', ')}`)
      console.log(`   Tasks before filter: ${filtered.length}`)

      // Log task details BEFORE filtering
      console.log('\n   TASKS BEFORE FILTERING:')
      filtered.forEach((task, idx) => {
        const matches = projectIds.includes(task.projectId)
        const looseMatches = projectIds.some(pid => pid == task.projectId)
        const strictType = typeof task.projectId
        console.log(`     [${idx}] "${task.title.substring(0, 40)}"`)
        console.log(`          projectId: ${task.projectId} (type: ${strictType})`)
        console.log(`          Strict match (includes): ${matches ? '✅' : '❌'}`)
        console.log(`          Loose match (==): ${looseMatches ? '✅' : '❌'}`)
      })

      filtered = filtered.filter(task => projectIds.includes(task.projectId))

      console.log(`\n   Tasks after filter: ${filtered.length}`)
      console.log(`   Removed: ${beforeProjectFilter - filtered.length}`)
      if (filtered.length === 0 && beforeProjectFilter > 0) {
        console.log('\n   ⚠️  WARNING: Filtered to 0 tasks but had tasks before!')
        console.log('   This means NO task.projectId matched any target project ID')
        console.log('   Possible causes:')
        console.log('     1. Type mismatch (string vs number)')
        console.log('     2. Task is in child project with different ID')
        console.log('     3. Null/undefined projectId values')
      }
      console.log('🚨🚨🚨 END DIAGNOSTIC 🚨🚨🚨\n')
    }

    // Apply smart view filter
    if (activeSmartView.value === 'today') {
      const todayStr = new Date().toISOString().split('T')[0]
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      console.log('🔧 TaskStore.filteredTasks: Applying "today" smart view filter for date:', todayStr)

      const beforeSmartFilter = filtered.length
      filtered = filtered.filter(task => {
        // Check instances first (new format) - tasks scheduled for today
        const instances = getTaskInstances(task)
        if (instances.length > 0) {
          if (instances.some(inst => inst.scheduledDate === todayStr)) {
            console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" matches today filter (scheduled instance)`)
            return true
          }
        }

        // Fallback to legacy scheduledDate - tasks scheduled for today
        if (task.scheduledDate === todayStr) {
          console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" matches today filter (legacy scheduled)`)
          return true
        }

        // Tasks created today
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        if (taskCreatedDate.getTime() === today.getTime()) {
          console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" matches today filter (created today)`)
          return true
        }

        // Tasks due today
        if (task.dueDate === todayStr) {
          console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" matches today filter (due today)`)
          return true
        }

        // Tasks currently in progress
        if (task.status === 'in_progress') {
          console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" matches today filter (in progress)`)
          return true
        }

        return false
      })
      console.log(`🔧 TaskStore.filteredTasks: Today smart filter applied - removed ${beforeSmartFilter - filtered.length} tasks, ${filtered.length} remaining`)

    } else if (activeSmartView.value === 'week') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      console.log('🔧 TaskStore.filteredTasks: Applying "week" smart view filter for range:', todayStr, 'to', weekEndStr)

      const beforeSmartFilter = filtered.length
      filtered = filtered.filter(task => {
        // Check instances first (new format)
        const instances = getTaskInstances(task)
        if (instances.length > 0) {
          return instances.some(inst => inst.scheduledDate >= todayStr && inst.scheduledDate < weekEndStr)
        }
        // Fallback to legacy scheduledDate
        if (!task.scheduledDate) return false
        return task.scheduledDate >= todayStr && task.scheduledDate < weekEndStr
      })
      console.log(`🔧 TaskStore.filteredTasks: Week smart filter applied - removed ${beforeSmartFilter - filtered.length} tasks, ${filtered.length} remaining`)
    }

    // Apply status filter (NEW GLOBAL STATUS FILTER)
    if (activeStatusFilter.value) {
      const beforeStatusFilter = filtered.length
      filtered = filtered.filter(task => {
        const passesStatusFilter = task.status === activeStatusFilter.value
        console.log(`🔧 TaskStore.filteredTasks: Task "${task.title}" (status: ${task.status}) ${passesStatusFilter ? 'PASSED' : 'FAILED'} status filter "${activeStatusFilter.value}"`)
        return passesStatusFilter
      })
      console.log(`🔧 TaskStore.filteredTasks: Status filter "${activeStatusFilter.value}" applied - removed ${beforeStatusFilter - filtered.length} tasks, ${filtered.length} remaining`)
    }

    // Apply hide done tasks filter (global setting)
    if (hideDoneTasks.value) {
      const beforeHideDone = filtered.length
      filtered = filtered.filter(task => task.status !== 'done')
      console.log(`🔧 TaskStore.filteredTasks: Hide done filter applied - removed ${beforeHideDone - filtered.length} done tasks, ${filtered.length} remaining`)
    }

    // NEW: Include nested tasks when their parent matches the filter
    // Get the IDs of tasks that passed the initial filtering
    const filteredTaskIds = filtered.map(task => task.id)
    console.log('🔧 TaskStore.filteredTasks: Parent task IDs that passed filters:', filteredTaskIds)

    // Collect all nested task IDs from the filtered tasks
    const nestedTaskIds = collectNestedTasks(filteredTaskIds)
    console.log('🔧 TaskStore.filteredTasks: Collected nested task IDs:', nestedTaskIds)

    // Find the actual nested task objects and APPLY THE SAME FILTERS
    const nestedTasks = tasks.value
      .filter(task => nestedTaskIds.includes(task.id))
      .filter(task => {
        console.log(`🔧 TaskStore.filteredTasks: Evaluating nested task "${task.title}" (status: ${task.status})`)

        // Apply project filter to nested tasks (including child projects)
        if (activeProjectId.value) {
          const projectIds = getChildProjectIds(activeProjectId.value)
          if (!projectIds.includes(task.projectId)) {
            console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" rejected by project filter (projectId: ${task.projectId})`)
            return false
          }
        }

        // Apply smart view filter to nested tasks
        if (activeSmartView.value === 'today') {
          const todayStr = new Date().toISOString().split('T')[0]
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          // Check instances first (new format) - tasks scheduled for today
          const instances = getTaskInstances(task)
          if (instances.length > 0) {
            if (instances.some(inst => inst.scheduledDate === todayStr)) {
              console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" matches today filter (scheduled instance)`)
              return true
            }
          }

          // Fallback to legacy scheduledDate - tasks scheduled for today
          if (task.scheduledDate === todayStr) {
            console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" matches today filter (legacy scheduled)`)
            return true
          }

          // Tasks created today
          const taskCreatedDate = new Date(task.createdAt)
          taskCreatedDate.setHours(0, 0, 0, 0)
          if (taskCreatedDate.getTime() === today.getTime()) {
            console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" matches today filter (created today)`)
            return true
          }

          // Tasks due today
          if (task.dueDate === todayStr) {
            console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" matches today filter (due today)`)
            return true
          }

          // Tasks currently in progress
          if (task.status === 'in_progress') {
            console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" matches today filter (in progress)`)
            return true
          }

          console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" does not match today filter`)
          return false
        } else if (activeSmartView.value === 'week') {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayStr = today.toISOString().split('T')[0]
          const weekEnd = new Date(today)
          weekEnd.setDate(weekEnd.getDate() + 7)
          const weekEndStr = weekEnd.toISOString().split('T')[0]

          // Check instances first (new format)
          const instances = getTaskInstances(task)
          if (instances.length > 0) {
            return instances.some(inst => inst.scheduledDate >= todayStr && inst.scheduledDate < weekEndStr)
          }
          // Fallback to legacy scheduledDate
          if (!task.scheduledDate) return false
          return task.scheduledDate >= todayStr && task.scheduledDate < weekEndStr
        }

        // Apply status filter to nested tasks
        if (activeStatusFilter.value && task.status !== activeStatusFilter.value) {
          console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" rejected by status filter "${activeStatusFilter.value}" (status: ${task.status})`)
          return false
        }

        // Apply hide done tasks filter to nested tasks
        if (hideDoneTasks.value && task.status === 'done') {
          console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" rejected by hide done filter`)
          return false
        }

        console.log(`🔧 TaskStore.filteredTasks: Nested task "${task.title}" passed all filters`)
        return true
      })

    console.log(`🚨 TaskStore.filteredTasks: Found ${nestedTasks.length} nested tasks that passed all filters`)

    // Combine filtered tasks with their properly filtered nested tasks
    const allTasks = [...filtered, ...nestedTasks]
    console.log(`🚨 TaskStore.filteredTasks: Combined ${filtered.length} parent tasks + ${nestedTasks.length} nested tasks = ${allTasks.length} total`)

    // Remove duplicates (in case a nested task was also directly filtered)
    const uniqueTasks = allTasks.filter((task, index, self) =>
      index === self.findIndex(t => t.id === task.id)
    )
    console.log(`🚨 TaskStore.filteredTasks: After removing duplicates: ${uniqueTasks.length} unique tasks`)
    console.log('🚨 TaskStore.filteredTasks: Final task list:')
    uniqueTasks.forEach(task => {
      console.log(`🚨 TaskStore.filteredTasks:   - "${task.title}" (ID: ${task.id}, Status: ${task.status}, Project: ${task.projectId})`)
    })
    console.log('🚨 TaskStore.filteredTasks: === END FILTERED TASKS COMPUTATION ===')

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

  const totalTasks = computed(() => tasks.value.length)
  const completedTasks = computed(() => tasks.value.filter(task => task.status === 'done').length)
  const totalPomodoros = computed(() =>
    tasks.value.reduce((sum, task) => sum + task.completedPomodoros, 0)
  )

  // Actions
  const createTask = (taskData: Partial<Task>) => {
    const taskId = Date.now().toString()

    // If scheduledDate/Time provided, create instances array
    const instances: TaskInstance[] = []
    if (taskData.scheduledDate && taskData.scheduledTime) {
      instances.push({
        id: `instance-${taskId}-${Date.now()}`,
        scheduledDate: taskData.scheduledDate,
        scheduledTime: taskData.scheduledTime,
        duration: taskData.estimatedDuration
      })
    }

    // If this is a nested task (has parentTaskId), inherit parent's projectId
    let projectId = taskData.projectId || '1'
    if (taskData.parentTaskId) {
      const parentTask = tasks.value.find(t => t.id === taskData.parentTaskId)
      if (parentTask) {
        projectId = parentTask.projectId
      }
    }

    const newTask: Task = {
      id: taskId,
      title: taskData.title || 'New Task',
      description: taskData.description || 'Task description...',
      status: taskData.status || 'planned',
      priority: taskData.priority || 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: taskData.dueDate || new Date().toLocaleDateString(),
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      instances, // Use instances array instead of legacy fields
      isInInbox: true, // Default: tasks start in inbox
      canvasPosition: undefined, // No canvas position until explicitly placed
      ...taskData
    }

    tasks.value.push(newTask)
    return newTask
  }

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      const task = tasks.value[taskIndex]

      // Auto-archive: When task marked as done, remove from canvas
      if (updates.status === 'done' && task.status !== 'done') {
        updates.isInInbox = true
        updates.canvasPosition = undefined
      }

      tasks.value[taskIndex] = {
        ...task,
        ...updates,
        updatedAt: new Date()
      }
    }
  }

  const deleteTask = (taskId: string) => {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      tasks.value.splice(taskIndex, 1)
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
      case 'thisWeekend':
        // Friday of current week
        targetDate = new Date(today)
        const daysUntilFriday = (5 - today.getDay() + 7) % 7
        targetDate.setDate(today.getDate() + daysUntilFriday)
        break
      case 'nextWeek':
        // Start of next week (Monday)
        targetDate = new Date(today)
        const daysUntilMonday = (8 - today.getDay()) % 7 || 7
        targetDate.setDate(today.getDate() + daysUntilMonday)
        break
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

    task.updatedAt = new Date()
    console.log(`Task movement completed. Task now has ${task.instances.length} instances`)
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
  const setActiveProject = (projectId: string | null) => {
    activeProjectId.value = projectId
    activeSmartView.value = null // Clear smart view when selecting a project
  }

  const setSmartView = (view: 'today' | 'week' | null) => {
    activeSmartView.value = view
    if (view) {
      activeProjectId.value = null // Clear project filter when using smart view
    }
  }

  const toggleHideDoneTasks = () => {
    console.log('🔧 TaskStore: toggleHideDoneTasks called!')
    console.log('🔧 TaskStore: Current value before toggle:', hideDoneTasks.value)

    hideDoneTasks.value = !hideDoneTasks.value

    console.log('🔧 TaskStore: New value after toggle:', hideDoneTasks.value)
    console.log('🔧 TaskStore: toggleHideDoneTasks completed successfully')
  }

  // Global status filter management
  const setActiveStatusFilter = (status: string | null) => {
    console.log('🔧 TaskStore: setActiveStatusFilter called!')
    console.log('🔧 TaskStore: Setting status filter from:', activeStatusFilter.value, 'to:', status)

    activeStatusFilter.value = status

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
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectData.name || 'New Project',
      color: projectData.color || '#4ECDC4',
      colorType: projectData.colorType || 'hex',
      emoji: projectData.emoji,
      viewType: projectData.viewType || 'status',
      parentId: projectData.parentId || null,
      createdAt: new Date(),
      ...projectData
    }

    projects.value.push(newProject)
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
      // Don't allow deletion of the default project
      if (projectId === '1') {
        console.warn('Cannot delete the default project')
        return
      }

      // Move all tasks from this project to the default project
      tasks.value.forEach(task => {
        if (task.projectId === projectId) {
          task.projectId = '1'
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
  const undoRedoEnabledActions = () => {
    // These functions will be initialized lazily to avoid circular dependencies
    let undoRedoActions: any = null

    const getUndoRedoActions = async () => {
      if (!undoRedoActions) {
        try {
          // Try to get the unified undo/redo actions using dynamic import
          console.log('🔄 Attempting to import useUnifiedUndoRedo... [FIXED VERSION]')
          console.log('🔄 Dynamic import path: @/composables/useUnifiedUndoRedo')
          console.log('🔄 Current environment:', typeof window !== 'undefined' ? 'browser' : 'server')
          console.log('🔄 Timestamp:', new Date().toISOString())

          const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
          console.log('✅ useUnifiedUndoRedo imported successfully')

          // Use global instance to ensure keyboard handler and task operations share the same undo system
          if (typeof window !== 'undefined' && (window as any).__pomoFlowUndoSystem) {
            undoRedoActions = (window as any).__pomoFlowUndoSystem
            console.log('✅ Using existing global unified undo system instance')
          } else {
            undoRedoActions = useUnifiedUndoRedo()
            if (typeof window !== 'undefined') {
              ;(window as any).__pomoFlowUndoSystem = undoRedoActions
            }
            console.log('✅ Created new global unified undo system instance')
          }
          console.log('✅ useUnifiedUndoRedo initialized successfully')
          console.log('✅ Available methods:', Object.keys(undoRedoActions).filter(k => typeof undoRedoActions[k] === 'function').join(', '))
          console.log('✅ DeleteTask method available:', typeof undoRedoActions.deleteTaskWithUndo)
        } catch (error) {
          console.error('❌ UNIFIED UNDO SYSTEM FAILURE - useUnifiedUndoRedo import failed:', error)
          console.error('❌ Error details:', error.message)
          console.error('❌ Error stack:', error.stack)
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
            deleteTask: (taskId: string) => {
              console.log('⚠️ FALLBACK deleteTask called - NO UNDO SUPPORT!')
              console.log('⚠️ Task', taskId, 'will be deleted permanently')
              return deleteTask(taskId)
            },
            updateTaskWithUndo: (taskId: string, updates: Partial<Task>) => {
              console.log('⚠️ FALLBACK updateTaskWithUndo called - no undo support')
              return updateTask(taskId, updates)
            },
            deleteTaskWithUndo: (taskId: string) => {
              console.log('⚠️ FALLBACK deleteTaskWithUndo called - NO UNDO SUPPORT!')
              return deleteTask(taskId)
            },
            moveTask: (taskId: string, newStatus: Task['status']) => moveTask(taskId, newStatus),
            moveTaskToProject: (taskId: string, targetProjectId: string) => moveTaskToProject(taskId, targetProjectId),
            moveTaskToDate: (taskId: string, dateColumn: string) => moveTaskToDate(taskId, dateColumn),
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
        const actions = await getUndoRedoActions()
        return actions.moveTask(taskId, newStatus)
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

  // Restore state for undo/redo functionality
  const restoreState = (newTasks: Task[]) => {
    console.log('🔄 [TASK-STORE] restoreState called with', newTasks.length, 'tasks')

    // Use Pinia's $patch for proper reactivity
    tasks.value = [...newTasks]

    console.log('🔄 [TASK-STORE] State restored. Tasks now has', tasks.value.length, 'items')

    // Trigger save to database for persistence
    saveToDatabase()
  }

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
    tasksWithCanvasPosition,
    tasksByStatus,
    totalTasks,
    completedTasks,
    totalPomodoros,

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
    isDescendantOf,
    getChildProjects,
    getProjectHierarchy,

    // Date and priority movement actions
    moveTaskToDate,
    moveTaskToPriority,
    startTaskNow,

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
    getTaskInstances,

    // Undo/Redo support
    restoreState,

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions()
  }
})
