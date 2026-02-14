import { computed, ref, onUnmounted, type Ref } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useCalendarCore } from '@/composables/useCalendarCore'
import type { WeekEvent } from '@/types/tasks'
import { calculateOverlappingPositions } from '@/utils/calendar/overlapCalculation'

export interface WeekDay {
  dayName: string
  date: number
  dateString: string
  fullDate: Date
}

// Re-export for consumers
export type { WeekEvent } from '@/types/tasks'

/**
 * Week view specific logic for calendar
 * Handles 7-day grid, events positioning, drag-and-drop, and resizing
 */
export function useCalendarWeekView(currentDate: Ref<Date>, _statusFilter: Ref<string | null>, timerGrowthMap?: Ref<Map<string, number>>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString } = useCalendarCore()

  // --- MEMORY LEAK FIX: Listener Registry ---
  let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
  let currentMouseUpHandler: (() => void) | null = null
  let currentKeydownHandler: ((e: KeyboardEvent) => void) | null = null
  let currentBlurHandler: (() => void) | null = null

  // Week resize state - exposed for visual feedback
  const isWeekResizing = ref(false)
  const weekResizeTaskId = ref<string | null>(null)

  const cleanupListeners = () => {
    if (currentMouseMoveHandler) {
      document.removeEventListener('mousemove', currentMouseMoveHandler)
      currentMouseMoveHandler = null
    }
    if (currentMouseUpHandler) {
      document.removeEventListener('mouseup', currentMouseUpHandler)
      currentMouseUpHandler = null
    }
  }

  const cleanupAllListeners = () => {
    cleanupListeners()
    if (currentKeydownHandler) {
      document.removeEventListener('keydown', currentKeydownHandler)
      currentKeydownHandler = null
    }
    if (currentBlurHandler) {
      window.removeEventListener('blur', currentBlurHandler)
      currentBlurHandler = null
    }
    // Reset resize state
    isWeekResizing.value = false
    weekResizeTaskId.value = null
    // Clear any stuck selection
    window.getSelection()?.removeAllRanges()
    // Restore text selection
    document.body.style.userSelect = ''
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
  }

  onUnmounted(cleanupAllListeners)
  // ------------------------------------------

  const workingHours = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM to 10 PM
  const dragMode = ref<string | null>(null)

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

      // Use calendarFilteredTasks to bypass smart view filters (done tasks stay visible)
      // Only filters by project + hideCalendarDoneTasks toggle
      taskStore.calendarFilteredTasks.forEach(task => {
        if (!task) return

        try {
          const instances = getTaskInstances(task)

          // GUARD: Limit processed instances per task to prevent OOM
          const MAX_INSTANCES_PER_TASK = 50
          let processedCount = 0

          instances
            .filter((instance: any) => {
              if (processedCount >= MAX_INSTANCES_PER_TASK) return false
              const matches = instance.scheduledDate === day.dateString
              if (matches) processedCount++
              return matches
            })
            .forEach((instance: any) => {
              const [hour, minute] = (instance.scheduledTime || '12:00').split(':').map(Number)
              const baseDuration = instance.duration || task.estimatedDuration || 30

              // TASK-1285: Apply timer growth if active
              const growthMinutes = (instance.id && timerGrowthMap?.value?.get(instance.id)) || 0
              const duration = baseDuration + growthMinutes

              // Only show if within working hours
              if (hour >= 6 && hour < 23) {
                const startTime = new Date(`${instance.scheduledDate}T${instance.scheduledTime}`)
                const endTime = new Date(startTime.getTime() + duration * 60000)

                dayEvents.push({
                  id: instance.id,
                  taskId: task.id,
                  instanceId: instance.id,
                  title: task.title,
                  projectId: task.projectId,
                  startTime,
                  endTime,
                  duration,
                  startSlot: (hour - 6) * 2 + (minute === 30 ? 1 : 0),
                  slotSpan: Math.ceil(duration / 30),
                  color: getPriorityColor(task.priority),
                  column: 0,
                  totalColumns: 1,
                  dayIndex,
                  isDueDate: false,
                  instanceStatus: instance.status,
                  taskStatus: task.status
                })
              }
            })
        } catch (err) {
          // Task processing error
        }
      })

      // Calculate overlapping positions for this day
      eventsByDay[dayIndex] = calculateOverlappingPositions(dayEvents) as WeekEvent[]
    })

    // Flatten all events into a single array
    return eventsByDay.flat()
  })

  // use overlapCalculation utility

  // Event styling for week grid
  const getWeekEventStyle = (event: WeekEvent): Record<string, string | number> => {
    const HALF_HOUR_HEIGHT = 30
    const dayColumnWidth = 100 / 7

    // Calculate column positioning within the day
    const eventWidthWithinDay = dayColumnWidth / event.totalColumns
    const eventLeftOffset = (dayColumnWidth * event.dayIndex) + (eventWidthWithinDay * event.column)

    return {
      position: 'absolute',
      top: `${event.startSlot * HALF_HOUR_HEIGHT}px`,
      height: `${event.slotSpan * HALF_HOUR_HEIGHT}px`,
      left: `calc(${eventLeftOffset}% + 2px)`,
      width: `calc(${eventWidthWithinDay}% - 4px)`
    }
  }

  // Week drag-and-drop handlers
  const _startWeekDrag = (event: MouseEvent, calendarEvent: WeekEvent) => {
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
    const _duplicateInstanceId: string | null = null

    let lastUpdatedDayIndex = calendarEvent.dayIndex
    let lastUpdatedSlot = calendarEvent.startSlot

    const handleMouseMove = async (e: MouseEvent) => {
      requestAnimationFrame(async () => {
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
            await taskStore.updateTask(calendarEvent.taskId, { // BUG-1051: AWAIT to ensure persistence
              scheduledDate: newDate,
              scheduledTime: newTime
            })
          }
        }
      })
    }

    const handleMouseUp = () => {
      cleanupListeners()
    }

    // Use registry for cleanup
    cleanupListeners()
    currentMouseMoveHandler = handleMouseMove
    currentMouseUpHandler = handleMouseUp

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleWeekEventMouseDown = (event: MouseEvent, _calendarEvent: WeekEvent) => {
    // Only handle mouse down for resize handles, let HTML5 drag handle dragging
    // Don't interfere with dragstart events
    if (event.shiftKey) {
      dragMode.value = 'shift'
      return
    }
    // Let HTML5 drag events handle the dragging - don't block them
    // Remove preventDefault and stopPropagation to allow drag events
  }

  // Week resize handlers
  const startWeekResize = (event: MouseEvent, calendarEvent: WeekEvent, direction: 'top' | 'bottom') => {
    event.preventDefault()
    event.stopPropagation() // Prevent drag events from interfering

    // Set resize state for visual feedback
    isWeekResizing.value = true
    weekResizeTaskId.value = calendarEvent.taskId

    const startY = event.clientY
    const HALF_HOUR_HEIGHT = 30
    const WORKING_HOURS_OFFSET = 6
    const originalStartSlot = calendarEvent.startSlot
    const originalDuration = calendarEvent.duration

    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'

    // Track final values to commit on mouseup (don't update store during drag)
    let finalDuration = originalDuration
    let finalStartSlot = originalStartSlot

    const handleMouseMove = (e: MouseEvent) => {
      if (!isWeekResizing.value) return // Guard against stale handlers

      const deltaY = e.clientY - startY
      const deltaSlots = Math.round(deltaY / HALF_HOUR_HEIGHT)

      if (direction === 'bottom') {
        finalDuration = Math.max(30, originalDuration + (deltaSlots * 30))
      } else {
        const endSlot = originalStartSlot + Math.ceil(originalDuration / 30)
        finalStartSlot = Math.max(0, Math.min(33, originalStartSlot + deltaSlots))
        finalDuration = Math.max(30, (endSlot - finalStartSlot) * 30)
      }
    }

    const handleMouseUp = async () => {
      // Clear visual state IMMEDIATELY
      cleanupAllListeners()

      // Commit final values to store (async, after visual cleanup)
      if (direction === 'bottom') {
        await taskStore.updateTask(calendarEvent.taskId, {
          estimatedDuration: finalDuration
        })
      } else {
        const newHour = Math.floor(finalStartSlot / 2) + WORKING_HOURS_OFFSET
        const newMinute = (finalStartSlot % 2) * 30

        if (newHour >= WORKING_HOURS_OFFSET && newHour < 23) {
          await taskStore.updateTask(calendarEvent.taskId, {
            scheduledTime: `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`,
            estimatedDuration: finalDuration
          })
        }
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Restore text selection
        document.body.style.userSelect = ''
        ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
        cleanupAllListeners()
      }
    }

    const handleBlur = () => {
      // Window lost focus - cleanup to prevent stuck state
      document.body.style.userSelect = ''
      ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
      cleanupAllListeners()
    }

    // Clean up any existing listeners first
    cleanupAllListeners()

    // Register all handlers
    currentMouseMoveHandler = handleMouseMove
    currentMouseUpHandler = handleMouseUp
    currentKeydownHandler = handleKeydown
    currentBlurHandler = handleBlur

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('blur', handleBlur)
  }

  // Week drop handlers
  const handleWeekDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  const handleWeekDrop = async (event: DragEvent, dateString: string, hour: number) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    const { taskId } = JSON.parse(data)
    const timeStr = `${hour.toString().padStart(2, '0')}:00`

    // Simple update: modify task's scheduledDate and scheduledTime directly
    await taskStore.updateTask(taskId, { // BUG-1051: AWAIT to ensure persistence
      scheduledDate: dateString,
      scheduledTime: timeStr,
      isInInbox: false // Task is now scheduled, no longer in inbox
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
    isWeekResizing,
    weekResizeTaskId,
    cancelWeekResize: cleanupAllListeners, // Allow external cancellation

    // Utilities
    isCurrentWeekTimeCell
  }
}
