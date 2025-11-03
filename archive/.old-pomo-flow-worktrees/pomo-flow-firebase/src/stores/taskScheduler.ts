// Task Scheduler Store - Calendar and instance management
// Extracted from tasks.ts for better maintainability

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTaskCoreStore, type Task, type TaskInstance } from './taskCore'

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

export const useTaskSchedulerStore = defineStore('taskScheduler', () => {
  const coreStore = useTaskCoreStore()

  // State
  const selectedDate = ref(new Date())
  const calendarView = ref<'month' | 'week' | 'day'>('month')

  // Computed properties
  const allTasks = computed(() => coreStore.allTasks)

  // Date utilities
  const todayKey = computed(() => formatDateKey(new Date()))
  const selectedDateKey = computed(() => formatDateKey(selectedDate.value))

  // Task scheduling operations
  const scheduleTask = (taskId: string, date: string, time?: string): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) {
      console.warn(`Task with id ${taskId} not found`)
      return false
    }

    const instance: TaskInstance = {
      id: uuidv4(),
      scheduledDate: date,
      scheduledTime: time || '09:00',
      duration: task.estimatedDuration || 25,
      completedPomodoros: 0,
      isLater: false
    }

    // Add instance to task
    const instances = getTaskInstances(task)
    instances.push(instance)

    return coreStore.updateTask(taskId, { instances })
  }

  const rescheduleTask = (taskId: string, instanceId: string, newDate: string, newTime?: string): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    const instances = getTaskInstances(task)
    const instanceIndex = instances.findIndex(i => i.id === instanceId)
    if (instanceIndex === -1) return false

    instances[instanceIndex].scheduledDate = newDate
    if (newTime) {
      instances[instanceIndex].scheduledTime = newTime
    }

    return coreStore.updateTask(taskId, { instances })
  }

  const unscheduleTask = (taskId: string, instanceId: string): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    const instances = getTaskInstances(task)
    const instanceIndex = instances.findIndex(i => i.id === instanceId)
    if (instanceIndex === -1) return false

    instances.splice(instanceIndex, 1)

    return coreStore.updateTask(taskId, { instances })
  }

  const setTaskAsLater = (taskId: string): boolean => {
    const laterInstance: TaskInstance = {
      id: uuidv4(),
      scheduledDate: '',
      scheduledTime: '',
      isLater: true
    }

    return coreStore.updateTask(taskId, { instances: [laterInstance] })
  }

  const clearTaskSchedule = (taskId: string): boolean => {
    return coreStore.updateTask(taskId, { instances: [] })
  }

  // Calendar operations
  const getTasksForDate = (dateKey: string): Task[] => {
    return allTasks.value.filter(task => {
      const instances = getTaskInstances(task)
      return instances.some(instance =>
        !instance.isLater && instance.scheduledDate === dateKey
      )
    })
  }

  const getTasksForDateRange = (startDateKey: string, endDateKey: string): Task[] => {
    const start = parseDateKey(startDateKey)
    const end = parseDateKey(endDateKey)
    if (!start || !end) return []

    return allTasks.value.filter(task => {
      const instances = getTaskInstances(task)
      return instances.some(instance => {
        if (instance.isLater) return false
        const instanceDate = parseDateKey(instance.scheduledDate)
        return instanceDate && instanceDate >= start && instanceDate <= end
      })
    })
  }

  const getTodayTasks = computed(() => getTasksForDate(todayKey.value))
  const getSelectedDateTasks = computed(() => getTasksForDate(selectedDateKey.value))

  // Smart views
  const getUpcomingTasks = (days: number = 7): Task[] => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + days)

    return getTasksForDateRange(
      formatDateKey(today),
      formatDateKey(endDate)
    )
  }

  const getOverdueTasks = computed((): Task[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return allTasks.value.filter(task => {
      const instances = getTaskInstances(task)
      return instances.some(instance => {
        if (instance.isLater || task.status === 'done') return false
        const instanceDate = parseDateKey(instance.scheduledDate)
        return instanceDate && instanceDate < today
      })
    })
  })

  const getLaterTasks = computed((): Task[] => {
    return allTasks.value.filter(task => {
      const instances = getTaskInstances(task)
      return instances.some(instance => instance.isLater)
    })
  })

  // Time-based operations
  const getTasksWithTimeSlots = (dateKey: string): Array<Task & { instance: TaskInstance }> => {
    const tasks = getTasksForDate(dateKey)
    return tasks.map(task => {
      const instances = getTaskInstances(task).filter(i => i.scheduledDate === dateKey)
      return {
        ...task,
        instance: instances[0] // Return the first instance for the date
      }
    })
  }

  // Duration and time tracking
  const updateTaskDuration = (taskId: string, instanceId: string, duration: number): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    const instances = getTaskInstances(task)
    const instance = instances.find(i => i.id === instanceId)
    if (!instance) return false

    instance.duration = duration

    return coreStore.updateTask(taskId, { instances })
  }

  const completeTaskInstance = (taskId: string, instanceId: string): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    const instances = getTaskInstances(task)
    const instance = instances.find(i => i.id === instanceId)
    if (!instance) return false

    instance.completedPomodoros = (instance.completedPomodoros || 0) + 1

    return coreStore.updateTask(taskId, { instances })
  }

  // Calendar navigation
  const goToToday = (): void => {
    selectedDate.value = new Date()
  }

  const goToPreviousDay = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() - 1)
    selectedDate.value = newDate
  }

  const goToNextDay = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() + 1)
    selectedDate.value = newDate
  }

  const goToPreviousWeek = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() - 7)
    selectedDate.value = newDate
  }

  const goToNextWeek = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() + 7)
    selectedDate.value = newDate
  }

  const goToPreviousMonth = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setMonth(newDate.getMonth() - 1)
    selectedDate.value = newDate
  }

  const goToNextMonth = (): void => {
    const newDate = new Date(selectedDate.value)
    newDate.setMonth(newDate.getMonth() + 1)
    selectedDate.value = newDate
  }

  // View management
  const setCalendarView = (view: 'month' | 'week' | 'day'): void => {
    calendarView.value = view
  }

  // Batch operations
  const scheduleMultipleTasks = (taskIds: string[], date: string, time?: string): number => {
    let successCount = 0
    taskIds.forEach(taskId => {
      if (scheduleTask(taskId, date, time)) {
        successCount++
      }
    })
    return successCount
  }

  const rescheduleMultipleTasks = (taskIds: string[], oldDate: string, newDate: string, newTime?: string): number => {
    let successCount = 0
    taskIds.forEach(taskId => {
      const task = coreStore.getTask(taskId)
      if (task) {
        const instances = getTaskInstances(task)
        const instance = instances.find(i => i.scheduledDate === oldDate)
        if (instance && rescheduleTask(taskId, instance.id, newDate, newTime)) {
          successCount++
        }
      }
    })
    return successCount
  }

  return {
    // State
    selectedDate,
    calendarView,

    // Computed
    todayKey,
    selectedDateKey,
    allTasks,
    getTodayTasks,
    getSelectedDateTasks,
    getOverdueTasks,
    getLaterTasks,

    // Task scheduling operations
    scheduleTask,
    rescheduleTask,
    unscheduleTask,
    setTaskAsLater,
    clearTaskSchedule,

    // Calendar operations
    getTasksForDate,
    getTasksForDateRange,
    getUpcomingTasks,
    getTasksWithTimeSlots,

    // Duration and tracking
    updateTaskDuration,
    completeTaskInstance,

    // Navigation
    goToToday,
    goToPreviousDay,
    goToNextDay,
    goToPreviousWeek,
    goToNextWeek,
    goToPreviousMonth,
    goToNextMonth,

    // View management
    setCalendarView,

    // Batch operations
    scheduleMultipleTasks,
    rescheduleMultipleTasks,

    // Utilities
    formatDateKey,
    parseDateKey,
    getTaskInstances
  }
}

// Helper function to generate UUID
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}