// Consolidated Tasks Store - Main orchestrator
// Replaces the monolithic tasks.ts with modular architecture
// VERSION: Modular-Architecture-v1 - 2025-10-23T07:15:00Z

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { useCloudSync } from '@/composables/useCloudSync'

// Import modular stores
import { useTaskCoreStore, type Task, type Project, type Subtask, type TaskInstance } from './taskCore'
import { useTaskSchedulerStore, formatDateKey, parseDateKey, getTaskInstances } from './taskScheduler'
import { useTaskCanvasStore, type CanvasSection } from './taskCanvas'

export { useTaskCoreStore, useTaskSchedulerStore, useTaskCanvasStore }
export type { Task, Project, Subtask, TaskInstance, CanvasSection }

// Re-export scheduler utilities for backward compatibility
export { formatDateKey, parseDateKey, getTaskInstances }

export const useTaskStore = defineStore('tasks', () => {
  // Initialize modular stores
  const coreStore = useTaskCoreStore()
  const schedulerStore = useTaskSchedulerStore()
  const canvasStore = useTaskCanvasStore()

  // Database integration
  const { saveToDatabase, loadFromDatabase } = useDatabase()
  const { getStorage } = usePersistentStorage()

  // Cloud sync
  const { syncToCloud, syncFromCloud } = useCloudSync()

  // Reactive state from core store
  const tasks = computed(() => coreStore.tasks)
  const projects = computed(() => coreStore.projects)

  // Enhanced computed properties that combine functionality from multiple modules
  const filteredTasks = computed(() => {
    // Combine all tasks with filters from different modules
    const allTasks = coreStore.allTasks

    // Apply scheduler filters
    const scheduledTasks = schedulerStore.getTodayTasks

    // Apply canvas filters
    const canvasTasks = canvasStore.canvasTasks

    // Combine all tasks (could add more sophisticated filtering here)
    return allTasks
  })

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status !== 'done' && t.status !== 'backlog')
  )

  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'done')
  )

  // Smart views
  const todayTasks = computed(() => schedulerStore.getTodayTasks)
  const overdueTasks = computed(() => schedulerStore.getOverdueTasks)
  const laterTasks = computed(() => schedulerStore.getLaterTasks)
  const upcomingTasks = computed(() => schedulerStore.getUpcomingTasks(7))

  // Task operations with database persistence
  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const task = coreStore.createTask(taskData)
    await persistTasks()
    return task
  }

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<boolean> => {
    const success = coreStore.updateTask(taskId, updates)
    if (success) {
      await persistTasks()
    }
    return success
  }

  const deleteTask = async (taskId: string): Promise<boolean> => {
    const success = coreStore.deleteTask(taskId)
    if (success) {
      await persistTasks()
    }
    return success
  }

  const getTask = (taskId: string): Task | undefined => {
    return coreStore.getTask(taskId)
  }

  // Project operations
  const createProject = async (projectData: Partial<Project>): Promise<Project> => {
    const project = coreStore.createProject(projectData)
    await persistProjects()
    return project
  }

  const updateProject = async (projectId: string, updates: Partial<Project>): Promise<boolean> => {
    const success = coreStore.updateProject(projectId, updates)
    if (success) {
      await persistProjects()
    }
    return success
  }

  const deleteProject = async (projectId: string): Promise<boolean> => {
    const success = coreStore.deleteProject(projectId)
    if (success) {
      await persistProjects()
    }
    return success
  }

  const getProject = (projectId: string): Project | undefined => {
    return coreStore.getProject(projectId)
  }

  // Move operations (legacy compatibility)
  const moveTask = async (taskId: string, newStatus: Task['status']): Promise<boolean> => {
    return updateTask(taskId, { status: newStatus })
  }

  const moveTaskToProject = async (taskId: string, projectId: string): Promise<boolean> => {
    return updateTask(taskId, { projectId })
  }

  // Bulk operations
  const bulkUpdateTasks = async (taskIds: string[], updates: Partial<Task>): Promise<number> => {
    const updatedCount = coreStore.bulkUpdateTasks(taskIds, updates)
    if (updatedCount > 0) {
      await persistTasks()
    }
    return updatedCount
  }

  const bulkDeleteTasks = async (taskIds: string[]): Promise<number> => {
    const deletedCount = coreStore.bulkDeleteTasks(taskIds)
    if (deletedCount > 0) {
      await persistTasks()
    }
    return deletedCount
  }

  // Task relationships
  const addTaskDependency = async (taskId: string, dependsOnTaskId: string): Promise<boolean> => {
    const task = getTask(taskId)
    if (!task) return false

    const dependsOn = [...(task.dependsOn || []), dependsOnTaskId]
    return updateTask(taskId, { dependsOn })
  }

  const removeTaskDependency = async (taskId: string, dependsOnTaskId: string): Promise<boolean> => {
    const task = getTask(taskId)
    if (!task) return false

    const dependsOn = (task.dependsOn || []).filter(id => id !== dependsOnTaskId)
    return updateTask(taskId, { dependsOn })
  }

  // Subtask operations
  const createSubtask = async (parentTaskId: string, subtaskData: Omit<Subtask, 'id' | 'parentTaskId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    const parentTask = getTask(parentTaskId)
    if (!parentTask) return false

    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      parentTaskId,
      ...subtaskData,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const subtasks = [...parentTask.subtasks, newSubtask]
    return updateTask(parentTaskId, { subtasks })
  }

  const updateSubtask = async (parentTaskId: string, subtaskId: string, updates: Partial<Subtask>): Promise<boolean> => {
    const parentTask = getTask(parentTaskId)
    if (!parentTask) return false

    const subtasks = parentTask.subtasks.map(subtask =>
      subtask.id === subtaskId
        ? { ...subtask, ...updates, updatedAt: new Date() }
        : subtask
    )

    return updateTask(parentTaskId, { subtasks })
  }

  const deleteSubtask = async (parentTaskId: string, subtaskId: string): Promise<boolean> => {
    const parentTask = getTask(parentTaskId)
    if (!parentTask) return false

    const subtasks = parentTask.subtasks.filter(subtask => subtask.id !== subtaskId)
    return updateTask(parentTaskId, { subtasks })
  }

  // Search and filtering
  const searchTasks = (query: string): Task[] => {
    return coreStore.searchTasks(query)
  }

  const getTasksByProject = (projectId: string): Task[] => {
    return coreStore.getTasksByProject(projectId)
  }

  const getTasksByStatus = (status: Task['status']): Task[] => {
    return coreStore.getTasksByStatus(status)
  }

  const getTasksByPriority = (priority: Task['priority']): Task[] => {
    return coreStore.getTasksByPriority(priority)
  }

  // Task progress tracking
  const updateTaskProgress = async (taskId: string, progress: number): Promise<boolean> => {
    const updates: Partial<Task> = { progress }

    // Auto-complete task if progress reaches 100%
    if (progress >= 100) {
      updates.status = 'done'
    }

    return updateTask(taskId, updates)
  }

  const incrementPomodoros = async (taskId: string): Promise<boolean> => {
    const task = getTask(taskId)
    if (!task) return false

    return updateTask(taskId, {
      completedPomodoros: task.completedPomodoros + 1
    })
  }

  // Analytics
  const getTaskStatistics = computed(() => {
    const total = tasks.value.length
    const completed = completedTasks.value.length
    const inProgress = tasks.value.filter(t => t.status === 'in_progress').length
    const planned = tasks.value.filter(t => t.status === 'planned').length

    const byPriority = {
      high: tasks.value.filter(t => t.priority === 'high').length,
      medium: tasks.value.filter(t => t.priority === 'medium').length,
      low: tasks.value.filter(t => t.priority === 'low').length,
      none: tasks.value.filter(t => t.priority === null).length
    }

    const byProject = projects.value.reduce((acc, project) => {
      acc[project.id] = tasks.value.filter(t => t.projectId === project.id).length
      return acc
    }, {} as Record<string, number>)

    return {
      total,
      completed,
      inProgress,
      planned,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      byPriority,
      byProject
    }
  })

  // Persistence functions
  const persistTasks = async (): Promise<void> => {
    try {
      await saveToDatabase(DB_KEYS.TASKS, tasks.value)
    } catch (error) {
      console.error('Failed to persist tasks:', error)
    }
  }

  const persistProjects = async (): Promise<void> => {
    try {
      await saveToDatabase(DB_KEYS.PROJECTS, projects.value)
    } catch (error) {
      console.error('Failed to persist projects:', error)
    }
  }

  const loadTasks = async (): Promise<void> => {
    try {
      const savedTasks = await loadFromDatabase(DB_KEYS.TASKS)
      if (savedTasks && Array.isArray(savedTasks)) {
        coreStore.tasks = savedTasks
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  const loadProjects = async (): Promise<void> => {
    try {
      const savedProjects = await loadFromDatabase(DB_KEYS.PROJECTS)
      if (savedProjects && Array.isArray(savedProjects)) {
        coreStore.projects = savedProjects
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  // Initialize store
  const initialize = async (): Promise<void> => {
    await Promise.all([
      loadTasks(),
      loadProjects()
    ])
  }

  // Watch for changes and auto-save
  watch(() => tasks.value, persistTasks, { deep: true })
  watch(() => projects.value, persistProjects, { deep: true })

  // Export operations
  const exportTasks = (): string => {
    return JSON.stringify({
      tasks: tasks.value,
      projects: projects.value,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2)
  }

  const importTasks = async (jsonData: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonData)

      if (data.tasks && Array.isArray(data.tasks)) {
        coreStore.tasks = data.tasks
      }

      if (data.projects && Array.isArray(data.projects)) {
        coreStore.projects = data.projects
      }

      await Promise.all([
        persistTasks(),
        persistProjects()
      ])

      return true
    } catch (error) {
      console.error('Failed to import tasks:', error)
      return false
    }
  }

  // Reset functionality
  const resetAllData = async (): Promise<void> => {
    coreStore.resetStore()
    schedulerStore.clearTaskSchedule('all') // Clear all scheduled tasks
    canvasStore.sections = []
    canvasStore.clearSelection()

    await Promise.all([
      persistTasks(),
      persistProjects()
    ])
  }

  return {
    // State
    tasks,
    projects,
    filteredTasks,

    // Computed
    activeTasks,
    completedTasks,
    todayTasks,
    overdueTasks,
    laterTasks,
    upcomingTasks,
    getTaskStatistics,

    // Core operations
    createTask,
    updateTask,
    deleteTask,
    getTask,

    // Project operations
    createProject,
    updateProject,
    deleteProject,
    getProject,

    // Move operations
    moveTask,
    moveTaskToProject,

    // Bulk operations
    bulkUpdateTasks,
    bulkDeleteTasks,

    // Task relationships
    addTaskDependency,
    removeTaskDependency,

    // Subtask operations
    createSubtask,
    updateSubtask,
    deleteSubtask,

    // Search and filtering
    searchTasks,
    getTasksByProject,
    getTasksByStatus,
    getTasksByPriority,

    // Progress tracking
    updateTaskProgress,
    incrementPomodoros,

    // Persistence
    initialize,
    persistTasks,
    persistProjects,
    loadTasks,
    loadProjects,

    // Import/Export
    exportTasks,
    importTasks,

    // Reset
    resetAllData,

    // Utilities
    formatDateKey,
    parseDateKey,
    getTaskInstances,

    // Provide access to modular stores for advanced usage
    coreStore,
    schedulerStore,
    canvasStore
  }
})