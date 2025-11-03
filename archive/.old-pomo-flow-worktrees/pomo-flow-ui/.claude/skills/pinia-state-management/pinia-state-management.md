# Pinia State Management

**🗃️ ACTIVATING PINIA STATE MANAGEMENT SKILL**

Specialized skill for Pinia state management in this productivity application, handling complex state operations, persistence, and cross-view synchronization.

## When to Use
- Creating new Pinia stores for state management
- Implementing complex state logic with actions and getters
- Managing cross-component state synchronization
- Handling persistence and localStorage integration
- Optimizing state performance with computed properties
- Debugging state issues and tracking changes

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
🗃️ **PINIA STATE MANAGEMENT SKILL ACTIVATED**
Applying store patterns and cross-store communication strategies...
```

## Store Structure Patterns

### Basic Store Template
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, Project, TaskStatus } from '@/types/task.types'

export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])
  const selectedTaskIds = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters (computed properties)
  const tasksByStatus = computed(() => {
    const grouped = {
      'todo': [] as Task[],
      'in-progress': [] as Task[],
      'done': [] as Task[],
      'cancelled': [] as Task[]
    }

    tasks.value.forEach(task => {
      grouped[task.status].push(task)
    })

    return grouped
  })

  const activeTasks = computed(() =>
    tasks.value.filter(task => task.status !== 'done' && task.status !== 'cancelled')
  )

  // Actions
  const loadTasks = async () => {
    isLoading.value = true
    error.value = null

    try {
      const stored = localStorage.getItem('pomo-tasks')
      if (stored) {
        tasks.value = JSON.parse(stored)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tasks'
    } finally {
      isLoading.value = false
    }
  }

  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    tasks.value.push(newTask)
    saveTasks()
    return newTask
  }

  const updateTask = (id: string, updates: Partial<Task>) => {
    const index = tasks.value.findIndex(task => task.id === id)
    if (index !== -1) {
      tasks.value[index] = {
        ...tasks.value[index],
        ...updates,
        updatedAt: new Date()
      }
      saveTasks()
    }
  }

  // Persistence helpers
  const saveTasks = () => {
    try {
      localStorage.setItem('pomo-tasks', JSON.stringify(tasks.value))
    } catch (err) {
      console.error('Failed to save tasks:', err)
    }
  }

  return {
    // State
    tasks,
    projects,
    selectedTaskIds,
    isLoading,
    error,

    // Getters
    tasksByStatus,
    activeTasks,

    // Actions
    loadTasks,
    addTask,
    updateTask
  }
})
```

### Cross-Store Communication
```typescript
import { useTaskStore } from './tasks'
import { useUIStore } from './ui'

export const useTaskStore = defineStore('tasks', () => {
  const uiStore = useUIStore()

  const startTaskTimer = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      updateTaskStatus(taskId, 'in-progress')
      uiStore.setCurrentView('timer')
    }
  }

  const completeTask = (taskId: string) => {
    updateTaskStatus(taskId, 'done')
    uiStore.showNotification('Task completed! 🎉')
  }
})
```

This skill provides comprehensive Pinia store patterns for complex state management across the productivity application.