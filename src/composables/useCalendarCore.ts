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
  isDueDate: boolean // Whether this represents a task due date
}

/**
 * Core shared utilities for calendar functionality
 * Consolidates duplicate utilities from multiple calendar files
 */
export function useCalendarCore() {
  const taskStore = useTaskStore()

  // === DATE UTILITIES ===
  // Single implementation of date formatting (found in multiple files)

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

  // === WEEK CALCULATION UTILITIES ===
  // Unified week-start calculation (found in 3 different files with variations)

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // === PRIORITY UTILITIES ===
  // Consolidated priority helpers (from useCalendarEventHelpers)

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

  // === STATUS UTILITIES ===
  // Consolidated status helpers (from useCalendarEventHelpers)

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

  // === PROJECT UTILITIES ===
  // Consolidated project helpers (from useCalendarEventHelpers)

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

    return Array.isArray(project.color) ? project.color[0] : project.color || 'var(--glass-bg-heavy)'
  }

  const getProjectEmoji = (event: CalendarEvent): string => {
    const project = getTaskProject(event)
    if (!project || project.colorType !== 'emoji') return ''
    return project.emoji || ''
  }

  const getProjectName = (event: CalendarEvent): string => {
    const project = getTaskProject(event)
    return project?.name || 'Unknown Project'
  }

  // === OVERLAP CALCULATION UTILITIES ===
  // Unified overlap positioning algorithm (found in multiple files with variations)

  const calculateOverlappingPositions = (events: CalendarEvent[]): CalendarEvent[] => {
    if (events.length === 0) return events

    const sorted = [...events].sort((a, b) => a.startSlot - b.startSlot)

    // Find groups of overlapping events
    const groups: CalendarEvent[][] = []
    let currentGroup: CalendarEvent[] = []

    sorted.forEach((event, index) => {
      if (index === 0) {
        currentGroup.push(event)
        return
      }

      // Check if this event overlaps with any event in current group
      const overlapsWithGroup = currentGroup.some(existing =>
        event.startSlot < existing.startSlot + existing.slotSpan &&
        event.startSlot + event.slotSpan > existing.startSlot
      )

      if (overlapsWithGroup) {
        currentGroup.push(event)
      } else {
        groups.push(currentGroup)
        currentGroup = [event]
      }
    })

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    // Assign columns within each group
    groups.forEach(group => {
      const columns: CalendarEvent[][] = []

      group.forEach(event => {
        let placed = false

        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]
          const hasCollision = column.some(existing =>
            event.startSlot < existing.startSlot + existing.slotSpan &&
            event.startSlot + event.slotSpan > existing.startSlot
          )

          if (!hasCollision) {
            column.push(event)
            event.column = i
            placed = true
            break
          }
        }

        if (!placed) {
          columns.push([event])
          event.column = columns.length - 1
        }
      })

      const totalColumns = columns.length
      group.forEach(event => {
        event.totalColumns = totalColumns
      })
    })

    return sorted
  }

  // === TIME SNAPPING UTILITIES ===
  // Helper for snapping to time intervals (from useCalendarDayView)

  const snapTo15Minutes = (hour: number, minute: number): { hour: number; minute: number } => {
    const totalMinutes = hour * 60 + minute

    // Round to nearest 15-minute interval
    const snappedMinutes = Math.round(totalMinutes / 15) * 15

    // Convert back to hour and minute
    const snappedHour = Math.floor(snappedMinutes / 60)
    const snappedMinute = snappedMinutes % 60

    return { hour: snappedHour, minute: snappedMinute }
  }

  return {
    // Date utilities
    getDateString,
    formatHour,
    formatEventTime,

    // Week calculation utilities
    getWeekStart,

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
    getProjectName,

    // Overlap calculation
    calculateOverlappingPositions,

    // Time snapping
    snapTo15Minutes,

    // Note: CalendarEvent type is already exported as interface above
  }
}