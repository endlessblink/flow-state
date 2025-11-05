import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useTaskStore, formatDateKey } from '@/stores/tasks'
import { useCalendarEventHelpers, type CalendarEvent } from './useCalendarEventHelpers'

export interface TimeSlot {
  id: string
  hour: number
  minute: number
  slotIndex: number
  date: string
}

export interface DragGhost {
  visible: boolean
  title: string
  duration: number
  slotIndex: number
}

/**
 * Day view specific logic for calendar
 * Handles event computation, drag-and-drop, resizing, and time slots
 */
export function useCalendarDayView(currentDate: Ref<Date>, statusFilter: Ref<string | null>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString } = useCalendarEventHelpers()

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Drag ghost state
  const dragGhost = ref<DragGhost>({
    visible: false,
    title: '',
    duration: 30,
    slotIndex: 0
  })

  // Drag mode state
  const dragMode = ref<'none' | 'shift'>('none')

  // Generate time slots for current day
  const timeSlots = computed<TimeSlot[]>(() => {
    const slots: TimeSlot[] = []
    const dateStr = currentDate.value.toISOString().split('T')[0]
    let slotIndex = 0

    hours.forEach(hour => {
      [0, 30].forEach(minute => {
        slots.push({
          id: `${dateStr}-${hour}-${minute}`,
          hour,
          minute,
          slotIndex,
          date: dateStr
        })
        slotIndex++
      })
    })

    return slots
  })

  // Generate calendar events with overlap positioning
  const calendarEvents = computed<CalendarEvent[]>(() => {
    const dateStr = currentDate.value.toISOString().split('T')[0]
    const events: CalendarEvent[] = []

    // Use filtered tasks to respect active status filter
    const allTasks = taskStore.filteredTasks

    // FIXED: No longer automatically create calendar events for tasks due today
    // Tasks should only appear in calendar inbox until manually scheduled by user
    // Calendar events are now created only through explicit user action (drag & drop)

    // Note: This array will be populated by manual scheduling actions only
    // Tasks with dueDate but no explicit scheduling will stay in the inbox

    const positionedEvents = calculateOverlappingPositions(events)
    return positionedEvents
  })

  // Calculate overlapping event positions
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

  // Event styling
  const getEventStyle = (event: CalendarEvent) => {
    const slotHeight = 30
    const widthPercentage = 100 / event.totalColumns
    const leftPercentage = widthPercentage * event.column

    return {
      top: `${event.startSlot * slotHeight}px`,
      height: `${event.slotSpan * slotHeight}px`,
      left: `${leftPercentage}%`,
      width: `${widthPercentage}%`
    }
  }

  const getGhostStyle = () => {
    const slotHeight = 30
    const slotSpan = Math.ceil(dragGhost.value.duration / 30)

    return {
      top: `${dragGhost.value.slotIndex * slotHeight}px`,
      height: `${slotSpan * slotHeight}px`,
      left: '0',
      width: '100%'
    }
  }

  // Drag-and-drop handlers for sidebar → calendar
  const handleDragEnter = (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    try {
      const { title, taskId } = JSON.parse(data)
      const task = taskStore.tasks.find(t => t.id === taskId)

      dragGhost.value = {
        visible: true,
        title: title || 'New Task',
        duration: task?.estimatedDuration || 30,
        slotIndex: slot.slotIndex
      }
    } catch (e) {
      // Invalid data, ignore
    }
  }

  const handleDragOver = (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'

    if (dragGhost.value.visible) {
      dragGhost.value.slotIndex = slot.slotIndex
    }
  }

  const handleDragLeave = () => {
    // Keep ghost visible, only hide on drop
  }

  const handleDrop = (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    const { taskId } = JSON.parse(data)
    const timeStr = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`

    // DEBUG LOG: Track task drop on calendar
    const task = taskStore.tasks.find(t => t.id === taskId)
    console.log(`🎯 CALENDAR DROP: Task "${task?.title}" (ID: ${taskId}) dropped on ${slot.date} at ${timeStr}`)
    console.log(`🎯 CALENDAR DROP: Task inbox status before:`, task?.isInInbox)
    console.log(`🎯 CALENDAR DROP: Task instances before:`, task?.instances?.length || 0)

    // Update task with scheduled date and time, and remove from inbox
    console.log(`🎯 CALENDAR DROP: Updating task with scheduled date ${slot.date} and time ${timeStr}`)
    taskStore.updateTask(taskId, {
      scheduledDate: slot.date,
      scheduledTime: timeStr,
      isInInbox: false // Task is now scheduled, no longer in inbox
    })
    console.log(`🎯 CALENDAR DROP: Task updated successfully with schedule`)

    dragGhost.value.visible = false
  }

  // Event drag-and-drop (repositioning within calendar)
  const startEventDrag = (event: MouseEvent, calendarEvent: CalendarEvent) => {
    event.preventDefault()

    const container = document.querySelector('.calendar-events-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const SLOT_HEIGHT = 30
    const eventElement = (event.target as HTMLElement).closest('.calendar-event') as HTMLElement
    if (!eventElement) return

    const eventRect = eventElement.getBoundingClientRect()
    const clickOffsetY = event.clientY - eventRect.top

    const isDuplicateMode = event.altKey

    const initialSlot = calendarEvent.startSlot
    let lastUpdatedSlot = initialSlot

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        const containerScrollTop = container.scrollTop || 0
        const targetY = e.clientY - rect.top + containerScrollTop - clickOffsetY
        const targetSlot = Math.max(0, Math.min(47, Math.floor(targetY / SLOT_HEIGHT)))

        if (targetSlot !== lastUpdatedSlot) {
          lastUpdatedSlot = targetSlot

          const newHour = Math.floor((targetSlot * 30) / 60)
          const newMinute = (targetSlot * 30) % 60
          const newTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`
          const newDate = currentDate.value.toISOString().split('T')[0]

          if (isDuplicateMode) {
            // In duplicate mode, create a copy of the task with new schedule
            const originalTask = taskStore.getTask(calendarEvent.taskId)
            if (originalTask) {
              taskStore.createTask({
                title: originalTask.title,
                description: originalTask.description,
                scheduledDate: newDate,
                scheduledTime: newTime,
                estimatedDuration: calendarEvent.duration,
                projectId: originalTask.projectId,
                priority: originalTask.priority,
                status: originalTask.status,
                isInInbox: false
              })
            }
          } else {
            // Simple update: modify task's scheduledDate and scheduledTime directly
            taskStore.updateTask(calendarEvent.taskId, {
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

  const handleEventMouseDown = (event: MouseEvent, calendarEvent: CalendarEvent) => {
    if (event.shiftKey) {
      dragMode.value = 'shift'
      return
    }

    event.preventDefault()
    event.stopPropagation()
    startEventDrag(event, calendarEvent)
  }

  const handleEventDragStart = (event: DragEvent, calendarEvent: CalendarEvent) => {
    if (!event.shiftKey) {
      event.preventDefault()
      return
    }

    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({
        taskId: calendarEvent.taskId,
        instanceId: calendarEvent.instanceId
      }))
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  // Event resizing
  const startResize = (event: MouseEvent, calendarEvent: CalendarEvent, direction: 'top' | 'bottom') => {
    event.preventDefault()

    const startY = event.clientY
    const SLOT_HEIGHT = 30
    const originalStartSlot = calendarEvent.startSlot
    const originalDuration = calendarEvent.duration

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY
      const deltaSlots = Math.round(deltaY / SLOT_HEIGHT)

      let newDuration = originalDuration
      let newStartSlot = originalStartSlot

      if (direction === 'bottom') {
        newDuration = Math.max(30, originalDuration + (deltaSlots * 30))
      } else {
        const endSlot = originalStartSlot + Math.ceil(originalDuration / 30)
        newStartSlot = Math.max(0, originalStartSlot + deltaSlots)
        newDuration = Math.max(30, (endSlot - newStartSlot) * 30)
      }

      if (direction === 'bottom') {
        taskStore.updateTask(calendarEvent.taskId, {
          estimatedDuration: newDuration
        })
      } else {
        const [currentHour, currentMinute] = calendarEvent.startTime.toTimeString().slice(0, 5).split(':').map(Number)
        const currentEndTime = currentHour * 60 + currentMinute + originalDuration
        const newStartTime = currentEndTime - newDuration
        const newHour = Math.floor(newStartTime / 60)
        const newMinute = newStartTime % 60

        if (newStartTime >= 0) {
          taskStore.updateTask(calendarEvent.taskId, {
            scheduledTime: `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`,
            estimatedDuration: newDuration
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

  return {
    hours,
    timeSlots,
    calendarEvents,
    dragGhost,
    dragMode,

    // Styling
    getEventStyle,
    getGhostStyle,

    // Drag handlers
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleEventDragStart,
    handleEventMouseDown,

    // Resize handlers
    startResize
  }
}
