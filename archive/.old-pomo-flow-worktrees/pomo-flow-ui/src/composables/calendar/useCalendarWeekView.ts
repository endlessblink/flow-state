import { computed, type Ref } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useCalendarEventHelpers, type CalendarEvent } from './useCalendarEventHelpers'

export interface WeekDay {
  dayName: string
  date: number
  dateString: string
  fullDate: Date
}

export interface WeekEvent extends CalendarEvent {
  dayIndex: number
}

/**
 * Week view specific logic for calendar
 * Handles 7-day grid, events positioning, drag-and-drop, and resizing
 */
export function useCalendarWeekView(currentDate: Ref<Date>, statusFilter: Ref<string | null>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString } = useCalendarEventHelpers()

  const workingHours = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM to 10 PM

  // Get week start (Monday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Week days computation
  const weekDays = computed<WeekDay[]>(() => {
    const weekStart = getWeekStart(currentDate.value)
    const days: WeekDay[] = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)

      days.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        dateString: getDateString(date),
        fullDate: date
      })
    }

    return days
  })

  // Week events computation with day positioning
  const weekEvents = computed<WeekEvent[]>(() => {
    const eventsByDay: WeekEvent[][] = Array.from({ length: 7 }, () => [])

    weekDays.value.forEach((day, dayIndex) => {
      const dayEvents: WeekEvent[] = []

      // Use filtered tasks to respect active status filter
      taskStore.filteredTasks.forEach(task => {
        const instances = getTaskInstances(task)

        instances
          .filter(instance => instance.scheduledDate === day.dateString)
          .forEach(instance => {
            const [hour, minute] = instance.scheduledTime.split(':').map(Number)
            const duration = instance.duration || task.estimatedDuration || 30

            // Only show if within working hours
            if (hour >= 6 && hour < 23) {
              const startTime = new Date(`${instance.scheduledDate}T${instance.scheduledTime}`)
              const endTime = new Date(startTime.getTime() + duration * 60000)

              dayEvents.push({
                id: instance.id,
                taskId: task.id,
                instanceId: instance.id,
                title: task.title,
                startTime,
                endTime,
                duration,
                startSlot: (hour - 6) * 2 + (minute === 30 ? 1 : 0),
                slotSpan: Math.ceil(duration / 30),
                color: getPriorityColor(task.priority),
                column: 0,
                totalColumns: 1,
                dayIndex
              })
            }
          })
      })

      // Calculate overlapping positions for this day
      eventsByDay[dayIndex] = calculateOverlappingPositions(dayEvents)
    })

    // Flatten all events into a single array
    return eventsByDay.flat()
  })

  // Calculate overlapping event positions for a single day
  const calculateOverlappingPositions = (events: WeekEvent[]): WeekEvent[] => {
    if (events.length === 0) return events

    const sorted = [...events].sort((a, b) => a.startSlot - b.startSlot)

    // Find groups of overlapping events
    const groups: WeekEvent[][] = []
    let currentGroup: WeekEvent[] = []

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
      const columns: WeekEvent[][] = []

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

  // Event styling for week grid
  const getWeekEventStyle = (event: WeekEvent) => {
    const HALF_HOUR_HEIGHT = 30
    const dayColumnWidth = 100 / 7

    // Calculate column positioning within the day
    const eventWidthWithinDay = dayColumnWidth / event.totalColumns
    const eventLeftOffset = (dayColumnWidth * event.dayIndex) + (eventWidthWithinDay * event.column)

    return {
      position: 'absolute',
      top: `${event.startSlot * HALF_HOUR_HEIGHT}px`,
      height: `${event.slotSpan * HALF_HOUR_HEIGHT}px`,
      left: `${eventLeftOffset}%`,
      width: `${eventWidthWithinDay}%`
    }
  }

  // Week drag-and-drop handlers
  const startWeekDrag = (event: MouseEvent, calendarEvent: WeekEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const weekDaysGrid = document.querySelector('.week-days-grid') as HTMLElement
    if (!weekDaysGrid) return

    const gridRect = weekDaysGrid.getBoundingClientRect()
    const dayColumnWidth = gridRect.width / 7
    const HALF_HOUR_HEIGHT = 30
    const WORKING_HOURS_OFFSET = 6

    const eventRect = (event.target as HTMLElement).closest('.week-event')?.getBoundingClientRect()
    if (!eventRect) return

    const clickOffsetY = event.clientY - eventRect.top

    const isDuplicateMode = event.altKey
    let duplicateInstanceId: string | null = null

    let lastUpdatedDayIndex = calendarEvent.dayIndex
    let lastUpdatedSlot = calendarEvent.startSlot

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        const scrollTop = weekDaysGrid.scrollTop || 0

        // Calculate day column
        const relativeX = e.clientX - gridRect.left
        const newDayIndex = Math.max(0, Math.min(6, Math.floor(relativeX / dayColumnWidth)))

        // Calculate time slot
        const mouseYInGrid = e.clientY - gridRect.top + scrollTop
        const eventTopInGrid = mouseYInGrid - clickOffsetY
        const slotFromTop = Math.max(0, Math.min(33, Math.round(eventTopInGrid / HALF_HOUR_HEIGHT)))

        if (slotFromTop !== lastUpdatedSlot || newDayIndex !== lastUpdatedDayIndex) {
          lastUpdatedSlot = slotFromTop
          lastUpdatedDayIndex = newDayIndex

          const newHour = Math.floor(slotFromTop / 2) + WORKING_HOURS_OFFSET
          const newMinute = (slotFromTop % 2) * 30
          const newDate = weekDays.value[newDayIndex].dateString
          const newTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

          if (isDuplicateMode) {
            if (!duplicateInstanceId) {
              const newInstance = taskStore.createTaskInstance(calendarEvent.taskId, {
                scheduledDate: newDate,
                scheduledTime: newTime,
                duration: calendarEvent.duration
              })
              if (newInstance) {
                duplicateInstanceId = newInstance.id
              }
            } else {
              taskStore.updateTaskInstance(calendarEvent.taskId, duplicateInstanceId, {
                scheduledDate: newDate,
                scheduledTime: newTime
              })
            }
          } else {
            taskStore.updateTaskInstance(calendarEvent.taskId, calendarEvent.instanceId, {
              scheduledDate: newDate,
              scheduledTime: newTime
            })
          }
        }
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleWeekEventMouseDown = (event: MouseEvent, calendarEvent: WeekEvent) => {
    if (event.shiftKey) {
      return // Enable HTML5 drag for sidebar unscheduling
    }

    event.preventDefault()
    event.stopPropagation()
    startWeekDrag(event, calendarEvent)
  }

  // Week resize handlers
  const startWeekResize = (event: MouseEvent, calendarEvent: WeekEvent, direction: 'top' | 'bottom') => {
    event.preventDefault()

    const startY = event.clientY
    const HALF_HOUR_HEIGHT = 30
    const WORKING_HOURS_OFFSET = 6
    const originalStartSlot = calendarEvent.startSlot
    const originalDuration = calendarEvent.duration

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY
      const deltaSlots = Math.round(deltaY / HALF_HOUR_HEIGHT)

      let newDuration = originalDuration
      let newStartSlot = originalStartSlot

      if (direction === 'bottom') {
        newDuration = Math.max(30, originalDuration + (deltaSlots * 30))
      } else {
        const endSlot = originalStartSlot + Math.ceil(originalDuration / 30)
        newStartSlot = Math.max(0, Math.min(33, originalStartSlot + deltaSlots))
        newDuration = Math.max(30, (endSlot - newStartSlot) * 30)
      }

      if (direction === 'bottom') {
        taskStore.updateTaskInstance(calendarEvent.taskId, calendarEvent.instanceId, {
          duration: newDuration
        })
      } else {
        const newHour = Math.floor(newStartSlot / 2) + WORKING_HOURS_OFFSET
        const newMinute = (newStartSlot % 2) * 30

        if (newHour >= WORKING_HOURS_OFFSET && newHour < 23) {
          taskStore.updateTaskInstance(calendarEvent.taskId, calendarEvent.instanceId, {
            scheduledTime: `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`,
            duration: newDuration
          })
        }
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Week drop handlers
  const handleWeekDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
  }

  const handleWeekDrop = (event: DragEvent, dateString: string, hour: number) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    const { taskId } = JSON.parse(data)
    const timeStr = `${hour.toString().padStart(2, '0')}:00`

    taskStore.createTaskInstance(taskId, {
      scheduledDate: dateString,
      scheduledTime: timeStr
    })
  }

  // Current time detection for week view
  const isCurrentWeekTimeCell = (dateString: string, hour: number) => {
    const now = new Date()
    const currentHour = now.getHours()
    const todayString = getDateString(now)

    return dateString === todayString && hour === currentHour
  }

  return {
    workingHours,
    weekDays,
    weekEvents,

    // Styling
    getWeekEventStyle,

    // Drag handlers
    handleWeekEventMouseDown,
    handleWeekDragOver,
    handleWeekDrop,

    // Resize handlers
    startWeekResize,

    // Utilities
    isCurrentWeekTimeCell
  }
}
