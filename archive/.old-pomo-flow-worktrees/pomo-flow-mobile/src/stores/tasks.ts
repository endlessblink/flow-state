import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'

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

export const useTaskStore = defineStore('tasks', () => {
  const db = useDatabase()

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
  
  // Migrate projects to add viewType field
  const migrateProjects = () => {
    projects.value.forEach(project => {
      if (!project.viewType) {
        project.viewType = 'status' // Default to status view
      }
    })
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
  }

  // Auto-save to IndexedDB when tasks or projects change (debounced)
  let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null
  let projectsSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(tasks, (newTasks) => {
    if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
    tasksSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.TASKS, newTasks)
    }, 1000) // Debounce 1 second for better performance
  }, { deep: true, flush: 'post' })

  watch(projects, (newProjects) => {
    if (projectsSaveTimer) clearTimeout(projectsSaveTimer)
    projectsSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.PROJECTS, newProjects)
    }, 1000) // Debounce 1 second
  }, { deep: true, flush: 'post' })

  // Computed - Filtered tasks based on active project AND smart view
  const filteredTasks = computed(() => {
    let filtered = tasks.value

    // Apply project filter first
    if (activeProjectId.value) {
      filtered = filtered.filter(task => task.projectId === activeProjectId.value)
    }

    // Apply smart view filter
    if (activeSmartView.value === 'today') {
      const todayStr = new Date().toISOString().split('T')[0]
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      filtered = filtered.filter(task => {
        // Check instances first (new format) - tasks scheduled for today
        const instances = getTaskInstances(task)
        if (instances.length > 0) {
          if (instances.some(inst => inst.scheduledDate === todayStr)) {
            return true
          }
        }
        
        // Fallback to legacy scheduledDate - tasks scheduled for today
        if (task.scheduledDate === todayStr) {
          return true
        }
        
        // Tasks created today
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        if (taskCreatedDate.getTime() === today.getTime()) {
          return true
        }
        
        // Tasks due today
        if (task.dueDate === todayStr) {
          return true
        }
        
        // Tasks currently in progress
        if (task.status === 'in_progress') {
          return true
        }
        
        return false
      })

    } else if (activeSmartView.value === 'week') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().split('T')[0]

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
    }

    return filtered
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
      projectId: taskData.projectId || '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances, // Use instances array instead of legacy fields
      ...taskData
    }

    tasks.value.push(newTask)
    return newTask
  }

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      tasks.value[taskIndex] = {
        ...tasks.value[taskIndex],
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

  // Date-based task movement functions
  const moveTaskToDate = (taskId: string, dateColumn: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let targetDate: Date | null = null
    
    switch (dateColumn) {
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

    if (targetDate) {
      const dateStr = formatDateKey(targetDate)
      const timeStr = '09:00' // Default time
      const isLater = dateColumn === 'later'
      
      // For "later", check if there's already a later instance
      if (isLater) {
        const existingLaterIndex = task.instances.findIndex(instance => instance.isLater)
        if (existingLaterIndex !== -1) {
          // Update existing later instance
          task.instances[existingLaterIndex] = {
            ...task.instances[existingLaterIndex],
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            duration: task.estimatedDuration || task.instances[existingLaterIndex].duration,
            isLater: true
          }
          console.log(`Updated existing later instance for task "${task.title}"`)
        } else {
          // Create new later instance
          const newInstance = {
            id: `instance-${taskId}-${Date.now()}`,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            duration: task.estimatedDuration || 60,
            isLater: true
          }
          task.instances.push(newInstance)
          console.log(`Created new later instance for task "${task.title}"`)
        }
      } else {
        // For specific dates, remove any existing later instances first
        task.instances = task.instances.filter(instance => !instance.isLater)
        
        // Check if instance already exists at target date
        const existingInstanceIndex = task.instances.findIndex(
          instance => instance.scheduledDate === dateStr
        )
        
        if (existingInstanceIndex !== -1) {
          // Update existing instance
          task.instances[existingInstanceIndex] = {
            ...task.instances[existingInstanceIndex],
            scheduledTime: timeStr,
            duration: task.estimatedDuration || task.instances[existingInstanceIndex].duration,
            isLater: false
          }
          console.log(`Updated existing instance for task "${task.title}" on ${dateStr}`)
        } else {
          // Create new instance
          const newInstance = {
            id: `instance-${taskId}-${Date.now()}`,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            duration: task.estimatedDuration || 60,
            isLater: false
          }
          task.instances.push(newInstance)
          console.log(`Created new instance for task "${task.title}" on ${dateStr}`)
        }
      }
    } else {
      // Remove all instances for no date
      const removedCount = task.instances.length
      task.instances = []
      if (removedCount > 0) {
        console.log(`Removed ${removedCount} instances for task "${task.title}" (moved to no date)`)
      }
    }

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

  return {
    // State
    tasks,
    projects,
    currentView,
    selectedTaskIds,
    activeProjectId,
    activeSmartView,

    // Computed
    filteredTasks,
    tasksByStatus,
    totalTasks,
    completedTasks,
    totalPomodoros,

    // Actions
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    selectTask,
    deselectTask,
    clearSelection,
    setActiveProject,
    setSmartView,
    setProjectViewType,

    // Project management actions
    createProject,
    updateProject,
    deleteProject,
    setProjectColor,
    moveTaskToProject,
    getProjectById,
    getChildProjects,
    getProjectHierarchy,

    // Date and priority movement actions
    moveTaskToDate,
    moveTaskToPriority,

    // Subtask actions
    createSubtask,
    updateSubtask,
    deleteSubtask,

    // Task Instance actions
    createTaskInstance,
    updateTaskInstance,
    deleteTaskInstance,

    // Database actions
    loadFromDatabase,

    // Helper functions
    getTaskInstances
  }
})
