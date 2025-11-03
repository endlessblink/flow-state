/**
 * SERVICE-ORCHESTRATOR-BASED TASK MANAGER
 *
 * Replaces direct task store access with ServiceOrchestrator integration.
 * Provides all task management functionality through the unified service layer.
 */

import { ref, computed } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import type { Task, Project } from '@/types/task'

export function useTaskManagerService() {
  const serviceOrchestrator = useServiceOrchestrator()

  // State
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const isInitialized = computed(() => {
    return serviceOrchestrator.getStores().taskStore.tasks.length >= 0
  })

  // Task operations
  const createTask = async (taskData: Partial<Task>): Promise<Task | null> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.createTask(taskData)
      if (result.success && result.data) {
        return result.data
      } else {
        error.value = result.error || 'Failed to create task'
        return null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task | null> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.updateTask(taskId, updates)
      if (result.success && result.data) {
        return result.data
      } else {
        error.value = result.error || 'Failed to update task'
        return null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteTask = async (taskId: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.deleteTask(taskId)
      if (result.success) {
        return true
      } else {
        error.value = result.error || 'Failed to delete task'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Project operations
  const createProject = async (projectData: Partial<Project>): Promise<Project | null> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.createProject(projectData)
      if (result.success && result.data) {
        return result.data
      } else {
        error.value = result.error || 'Failed to create project'
        return null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project | null> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.updateProject(projectId, updates)
      if (result.success && result.data) {
        return result.data
      } else {
        error.value = result.error || 'Failed to update project'
        return null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteProject = async (projectId: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.deleteProject(projectId)
      if (result.success) {
        return true
      } else {
        error.value = result.error || 'Failed to delete project'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Bulk operations
  const createMultipleTasks = async (tasksData: Partial<Task>[]) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.createMultipleTasks(tasksData)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        results: [],
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        warnings: [],
        summary: { total: tasksData.length, successful: 0, failed: tasksData.length }
      }
    } finally {
      isLoading.value = false
    }
  }

  const deleteMultipleTasks = async (taskIds: string[]) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await serviceOrchestrator.deleteMultipleTasks(taskIds)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        results: [],
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        warnings: [],
        summary: { total: taskIds.length, successful: 0, failed: taskIds.length }
      }
    } finally {
      isLoading.value = false
    }
  }

  // Filtering operations (using ServiceOrchestrator's unified filtering)
  const getFilteredTasks = (options?: any) => {
    return serviceOrchestrator.getFilteredTasks(options)
  }

  const getFilteredTaskCount = (options?: any) => {
    return serviceOrchestrator.getFilteredTaskCount(options)
  }

  const getTodayTasks = () => {
    return serviceOrchestrator.getTodayTasks()
  }

  const getTodayTaskCount = () => {
    return serviceOrchestrator.getTodayTaskCount()
  }

  const getWeekendTasks = () => {
    return serviceOrchestrator.getWeekendTasks()
  }

  const getWeekendTaskCount = () => {
    return serviceOrchestrator.getWeekendTaskCount()
  }

  const getTasksForProject = (projectId: string | null, options?: any) => {
    return serviceOrchestrator.getTasksForProject(projectId, options)
  }

  const getTaskCountForProject = (projectId: string | null, options?: any) => {
    return serviceOrchestrator.getTaskCountForProject(projectId, options)
  }

  // Direct store access (read-only)
  const getAllTasks = () => {
    return serviceOrchestrator.getStores().taskStore.tasks
  }

  const getAllProjects = () => {
    return serviceOrchestrator.getStores().taskStore.projects
  }

  const getTaskById = (taskId: string) => {
    return serviceOrchestrator.getStores().taskStore.getTaskById(taskId)
  }

  const getProjectById = (projectId: string) => {
    return serviceOrchestrator.getStores().taskStore.getProjectById(projectId)
  }

  // Utility methods
  const clearError = () => {
    error.value = null
  }

  const refreshData = async () => {
    // Trigger data refresh through stores
    const stores = serviceOrchestrator.getStores()
    await stores.taskStore.loadFromDatabase()
  }

  return {
    // State
    isLoading,
    error,
    isInitialized,

    // Task operations
    createTask,
    updateTask,
    deleteTask,

    // Project operations
    createProject,
    updateProject,
    deleteProject,

    // Bulk operations
    createMultipleTasks,
    deleteMultipleTasks,

    // Filtering operations
    getFilteredTasks,
    getFilteredTaskCount,
    getTodayTasks,
    getTodayTaskCount,
    getWeekendTasks,
    getWeekendTaskCount,
    getTasksForProject,
    getTaskCountForProject,

    // Direct store access
    getAllTasks,
    getAllProjects,
    getTaskById,
    getProjectById,

    // Utility methods
    clearError,
    refreshData,

    // Service access
    serviceOrchestrator
  }
}