/**
 * Example: Complete Store Methods Implementation
 * This shows what methods should be added to the task store
 */

import { defineStore } from 'pinia'
import type { Task, TaskInstance } from './Task-Interface-Example'

export const useTaskStore = defineStore('tasks', () => {
  // Existing state and methods...
  const tasks = ref<Task[]>([])

  // CORE MISSING METHODS TO ADD:

  /**
   * Get a specific task by ID
   */
  const getTask = (taskId: string): Task | undefined => {
    return tasks.value.find(task => task.id === taskId)
  }

  /**
   * Get count of uncategorized tasks (excluding completed)
   */
  const getUncategorizedTaskCount = (): number => {
    return tasks.value.filter(task =>
      task.isUncategorized && task.status !== 'done'
    ).length
  }

  /**
   * Get all tasks for a specific project
   */
  const getTasksByProject = (projectId: string): Task[] => {
    return tasks.value.filter(task => task.projectId === projectId)
  }

  /**
   * Get tasks by status
   */
  const getTasksByStatus = (status: Task['status']): Task[] => {
    return tasks.value.filter(task => task.status === status)
  }

  /**
   * Get all task instances for a task
   */
  const getTaskInstances = (task: Task): TaskInstance[] => {
    return task.instances || []
  }

  /**
   * Get active tasks (not completed)
   */
  const getActiveTasks = (): Task[] => {
    return tasks.value.filter(task => task.status !== 'done')
  }

  /**
   * Get tasks due today
   */
  const getTasksDueToday = (): Task[] => {
    const today = new Date().toISOString().split('T')[0]
    return tasks.value.filter(task => task.dueDate === today)
  }

  /**
   * Get tasks with scheduled instances
   */
  const getScheduledTasks = (): Task[] => {
    return tasks.value.filter(task =>
      task.scheduledDate && task.scheduledTime
    )
  }

  /**
   * Search tasks by title or description
   */
  const searchTasks = (query: string): Task[] => {
    const lowercaseQuery = query.toLowerCase()
    return tasks.value.filter(task =>
      task.title.toLowerCase().includes(lowercaseQuery) ||
      task.description.toLowerCase().includes(lowercaseQuery)
    )
  }

  // Return all methods from store
  return {
    // Existing methods...
    tasks,

    // NEWLY ADDED METHODS:
    getTask,
    getUncategorizedTaskCount,
    getTasksByProject,
    getTasksByStatus,
    getTaskInstances,
    getActiveTasks,
    getTasksDueToday,
    getScheduledTasks,
    searchTasks
  }
})

// Example usage in components:
/*
<script setup lang="ts">
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()

// Use the restored methods:
const uncategorizedCount = computed(() =>
  taskStore.getUncategorizedTaskCount()
)

const specificTask = computed(() =>
  taskStore.getTask('some-task-id')
)

const projectTasks = computed(() =>
  taskStore.getTasksByProject('project-123')
)

const todayTasks = computed(() =>
  taskStore.getTasksDueToday()
)
</script>
*/