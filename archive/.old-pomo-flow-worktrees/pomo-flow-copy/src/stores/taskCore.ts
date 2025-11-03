// Task Core Store - Basic CRUD operations
// Extracted from tasks.ts for better maintainability

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

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
  duration?: number
  completedPomodoros?: number
  isLater?: boolean
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
  scheduledDate?: string
  scheduledTime?: string
  estimatedDuration?: number
  instances?: TaskInstance[]
  projectId: string
  parentTaskId?: string | null
  createdAt: Date
  updatedAt: Date
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean
  dependsOn?: string[]
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
}

export interface Project {
  id: string
  name: string
  color: string | string[]
  colorType: 'hex' | 'emoji'
  emoji?: string
  viewType: 'status' | 'date' | 'priority'
  parentId?: string | null
  createdAt: Date
}

export const useTaskCoreStore = defineStore('taskCore', () => {
  // State
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])

  // Basic getters
  const allTasks = computed(() => tasks.value)
  const allProjects = computed(() => projects.value)
  const taskCount = computed(() => tasks.value.length)
  const projectCount = computed(() => projects.value.length)

  // Task CRUD operations
  const createTask = (taskData: Partial<Task>): Task => {
    const now = new Date()
    const task: Task = {
      id: uuidv4(),
      title: taskData.title || '',
      description: taskData.description || '',
      status: taskData.status || 'planned',
      priority: taskData.priority || null,
      progress: taskData.progress || 0,
      completedPomodoros: taskData.completedPomodoros || 0,
      subtasks: taskData.subtasks || [],
      dueDate: taskData.dueDate || '',
      scheduledDate: taskData.scheduledDate,
      scheduledTime: taskData.scheduledTime,
      estimatedDuration: taskData.estimatedDuration,
      instances: taskData.instances || [],
      projectId: taskData.projectId || 'default',
      parentTaskId: taskData.parentTaskId || null,
      canvasPosition: taskData.canvasPosition,
      isInInbox: taskData.isInInbox || false,
      dependsOn: taskData.dependsOn || [],
      connectionTypes: taskData.connectionTypes || {},
      createdAt: now,
      updatedAt: now
    }

    tasks.value.push(task)
    return task
  }

  const updateTask = (taskId: string, updates: Partial<Task>): boolean => {
    const taskIndex = tasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) {
      console.warn(`Task with id ${taskId} not found`)
      return false
    }

    tasks.value[taskIndex] = {
      ...tasks.value[taskIndex],
      ...updates,
      updatedAt: new Date()
    }

    return true
  }

  const deleteTask = (taskId: string): boolean => {
    const taskIndex = tasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) {
      console.warn(`Task with id ${taskId} not found`)
      return false
    }

    tasks.value.splice(taskIndex, 1)
    return true
  }

  const getTask = (taskId: string): Task | undefined => {
    return tasks.value.find(t => t.id === taskId)
  }

  // Project CRUD operations
  const createProject = (projectData: Partial<Project>): Project => {
    const project: Project = {
      id: uuidv4(),
      name: projectData.name || 'New Project',
      color: projectData.color || '#3B82F6',
      colorType: projectData.colorType || 'hex',
      emoji: projectData.emoji,
      viewType: projectData.viewType || 'status',
      parentId: projectData.parentId || null,
      createdAt: new Date()
    }

    projects.value.push(project)
    return project
  }

  const updateProject = (projectId: string, updates: Partial<Project>): boolean => {
    const projectIndex = projects.value.findIndex(p => p.id === projectId)
    if (projectIndex === -1) {
      console.warn(`Project with id ${projectId} not found`)
      return false
    }

    projects.value[projectIndex] = {
      ...projects.value[projectIndex],
      ...updates
    }

    return true
  }

  const deleteProject = (projectId: string): boolean => {
    const projectIndex = projects.value.findIndex(p => p.id === projectId)
    if (projectIndex === -1) {
      console.warn(`Project with id ${projectId} not found`)
      return false
    }

    // Don't allow deletion if tasks are assigned to this project
    const tasksInProject = tasks.value.filter(t => t.projectId === projectId)
    if (tasksInProject.length > 0) {
      console.warn(`Cannot delete project with ${tasksInProject.length} tasks assigned`)
      return false
    }

    projects.value.splice(projectIndex, 1)
    return true
  }

  const getProject = (projectId: string): Project | undefined => {
    return projects.value.find(p => p.id === projectId)
  }

  // Bulk operations
  const bulkUpdateTasks = (taskIds: string[], updates: Partial<Task>): number => {
    let updatedCount = 0
    taskIds.forEach(taskId => {
      if (updateTask(taskId, updates)) {
        updatedCount++
      }
    })
    return updatedCount
  }

  const bulkDeleteTasks = (taskIds: string[]): number => {
    let deletedCount = 0
    taskIds.forEach(taskId => {
      if (deleteTask(taskId)) {
        deletedCount++
      }
    })
    return deletedCount
  }

  // Search and filter
  const searchTasks = (query: string): Task[] => {
    if (!query.trim()) return tasks.value

    const searchTerm = query.toLowerCase()
    return tasks.value.filter(task =>
      task.title.toLowerCase().includes(searchTerm) ||
      task.description.toLowerCase().includes(searchTerm)
    )
  }

  const getTasksByProject = (projectId: string): Task[] => {
    return tasks.value.filter(task => task.projectId === projectId)
  }

  const getTasksByStatus = (status: Task['status']): Task[] => {
    return tasks.value.filter(task => task.status === status)
  }

  const getTasksByPriority = (priority: Task['priority']): Task[] => {
    return tasks.value.filter(task => task.priority === priority)
  }

  // Utility functions
  const clearAllTasks = (): void => {
    tasks.value = []
  }

  const clearAllProjects = (): void => {
    projects.value = []
  }

  const resetStore = (): void => {
    clearAllTasks()
    clearAllProjects()
  }

  return {
    // State
    tasks,
    projects,

    // Getters
    allTasks,
    allProjects,
    taskCount,
    projectCount,

    // Task operations
    createTask,
    updateTask,
    deleteTask,
    getTask,
    searchTasks,
    getTasksByProject,
    getTasksByStatus,
    getTasksByPriority,
    bulkUpdateTasks,
    bulkDeleteTasks,
    clearAllTasks,

    // Project operations
    createProject,
    updateProject,
    deleteProject,
    getProject,
    clearAllProjects,

    // Utility
    resetStore
  }
})

// Export types for use in other modules
export type { Task, Project, Subtask, TaskInstance }