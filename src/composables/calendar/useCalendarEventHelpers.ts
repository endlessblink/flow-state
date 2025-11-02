import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'

export interface CalendarEvent {
  id: string // instanceId
  taskId: string
  instanceId: string
  title: string
  startTime: Date
  endTime: Date
  duration: number
  startSlot: number
  slotSpan: number
  color: string
  column: number
  totalColumns: number
}

/**
 * Shared helper functions for calendar event rendering and interaction
 */
export function useCalendarEventHelpers() {
  const taskStore = useTaskStore()

  // Date formatting utilities
  const getDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour} ${period}`
  }

  const formatEventTime = (event: CalendarEvent): string => {
    return event.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Priority helpers
  const getPriorityColor = (priority: string | null): string => {
    switch (priority) {
      case 'high': return 'var(--priority-high-bg)'
      case 'low': return 'var(--priority-low-bg)'
      default: return 'var(--priority-medium-bg)'
    }
  }

  const getPriorityClass = (event: CalendarEvent): string => {
    const task = taskStore.tasks.find(t => t.id === event.taskId)
    return task?.priority || 'medium'
  }

  const getPriorityLabel = (event: CalendarEvent): string => {
    const task = taskStore.tasks.find(t => t.id === event.taskId)
    const priority = task?.priority || 'medium'
    return priority.charAt(0).toUpperCase() + priority.slice(1).replace('_', ' ')
  }

  // Status helpers
  const getTaskStatus = (event: CalendarEvent): Task['status'] => {
    const task = taskStore.tasks.find(t => t.id === event.taskId)
    return task?.status || 'planned'
  }

  const getStatusLabel = (event: CalendarEvent): string => {
    const status = getTaskStatus(event)
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  }

  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      'planned': '○',
      'in_progress': '▶',
      'done': '✓',
      'backlog': '⏸',
      'on_hold': '⏸'
    }
    return icons[status] || '○'
  }

  const cycleTaskStatus = (event: MouseEvent, calendarEvent: CalendarEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
    if (!task) return

    const statusCycle: Task['status'][] = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
    const currentIndex = statusCycle.indexOf(task.status)
    const nextIndex = (currentIndex + 1) % statusCycle.length
    const nextStatus = statusCycle[nextIndex]

    taskStore.moveTask(task.id, nextStatus)
  }

  // Project helpers
  const getTaskProject = (event: CalendarEvent) => {
    const task = taskStore.tasks.find(t => t.id === event.taskId)
    return task ? taskStore.getProjectById(task.projectId) : null
  }

  const getProjectColor = (event: CalendarEvent): string => {
    const project = getTaskProject(event)
    if (!project) return 'var(--glass-bg-heavy)'

    if (project.colorType === 'emoji' && project.emoji) {
      return 'var(--glass-bg-heavy)' // Emoji projects don't have colors
    }

    return project.color || 'var(--glass-bg-heavy)'
  }

  const getProjectEmoji = (event: CalendarEvent): string => {
    const project = getTaskProject(event)
    if (!project || project.colorType !== 'emoji') return ''
    return project.emoji || ''
  }

  const getProjectName = (event: CalendarEvent): string => {
    return taskStore.getProjectDisplayName(event.extendedProps?.projectId || null)
  }

  return {
    // Date utilities
    getDateString,
    formatHour,
    formatEventTime,

    // Priority utilities
    getPriorityColor,
    getPriorityClass,
    getPriorityLabel,

    // Status utilities
    getTaskStatus,
    getStatusLabel,
    getStatusIcon,
    cycleTaskStatus,

    // Project utilities
    getTaskProject,
    getProjectColor,
    getProjectEmoji,
    getProjectName
  }
}
