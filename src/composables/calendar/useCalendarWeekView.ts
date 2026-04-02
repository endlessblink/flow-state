import { computed, ref, onUnmounted, type Ref } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useCalendarCore } from '@/composables/useCalendarCore'
import type { WeekEvent } from '@/types/tasks'
import { calculateOverlappingPositions } from '@/utils/calendar/overlapCalculation'
import { generateVirtualCalendarEvents } from '@/utils/recurrenceUtils'
import { CALENDAR_SLOT_HEIGHT_PX } from '@/constants/calendar'

export interface WeekDay {
  dayName: string
  date: number
  dateString: string
  fullDate: Date
  isPreview?: boolean
}

// Re-export for consumers
export type { WeekEvent } from '@/types/tasks'

/**
 * Week view specific logic for calendar
 * Handles 7-day grid, events positioning, drag-and-drop, and resizing
 */
export function useCalendarWeekView(currentDate: Ref<Date>, _statusFilter: Ref<string | null>, timerGrowthMap?: Ref<Map<string, number>>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString, getWeekStart } = useCalendarCore()

  // --- MEMORY LEAK FIX: Listener Registry ---
  let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
  let currentMouseUpHandler: (() => void) | null = null
  let currentKeydownHandler: ((e: KeyboardEvent) => void) | null = null
  let currentBlurHandler: (() => void) | null = null

  // Week resize state - exposed for visual feedback
  const isWeekResizing = ref(false)
  const weekResizeTaskId = ref<string | null>(null)

  // Resize preview state — shows visual feedback during resize (matches day view pattern)
  const resizePreview = ref<{
    taskId: string
    direction: 'top' | 'bottom'
    previewDuration: number
    isResizing: boolean
  } | null>(null)

  // TASK-1521: Drag preview state — tracks pending position during mousemove drag.
  // The store is NOT updated until mouseup (preview-then-commit pattern, mirrors resize).
  const weekDragPreview = ref<{
    taskId: string
    instanceId: string
    previewSlot: number
    previewDayIndex: number
    previewDate: string
    previewTime: string
    isDragging: boolean
  } | null>(null)

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
    resizePreview.value = null
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

  // Week days computation (TASK-1321: uses shared getWeekStart from useCalendarCore)
  const weekDays = computed<WeekDay[]>(() => {
    const weekStart = getWeekStart(currentDate.value)
    const days: WeekDay[] = []

    // Show 3 preview days (Mon-Tue-Wed of next week) on Friday/Saturday
    const todayDow = new Date().getDay()
    const extraDays = (todayDow === 5 || todayDow === 6) ? 3 : 0

    for (let i = 0; i < 7 + extraDays; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)

      days.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        dateString: getDateString(date),
        fullDate: date,
        isPreview: i >= 7
      })
    }

    return days
  })

  // Week events computation with day positioning
  const weekEvents = computed<WeekEvent[]>(() => {
    const eventsByDay: WeekEvent[][] = Array.from({ length: weekDays.value.length }, () => [])

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
            .filter((instance) => {
              if (processedCount >= MAX_INSTANCES_PER_TASK) return false
              const matches = instance.scheduledDate === day.dateString
              if (matches) processedCount++
              return matches
            })
            .forEach((instance) => {
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
                  id: instance.id ?? '',
                  taskId: task.id,
                  instanceId: instance.id ?? '',
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
                  instanceStatus: 'status' in instance ? (instance as { status?: 'scheduled' | 'completed' | 'skipped' }).status : undefined,
                  taskStatus: task.status
                })
              }
            })
        } catch (_err) {
          // Task processing error
        }
      })

      // Calculate overlapping positions for this day
      eventsByDay[dayIndex] = calculateOverlappingPositions(dayEvents) as WeekEvent[]
    })

    // TASK-1418: Merge virtual recurring events when toggle is ON
    if (taskStore.showFutureRecurring) {
      const rangeStart = weekDays.value[0].dateString
      const rangeEnd = weekDays.value[weekDays.value.length - 1].dateString
      const virtualEvents = generateVirtualCalendarEvents(
        taskStore.calendarFilteredTasks,
        rangeStart,
        rangeEnd
      )

      for (const virtual of virtualEvents) {
        const dayIndex = weekDays.value.findIndex(d => d.dateString === virtual.scheduledDate)
        if (dayIndex >= 0) {
          const [hour, minute] = (virtual.scheduledTime || '09:00').split(':').map(Number)
          const duration = virtual.duration || 30

          if (hour >= 6 && hour < 23) {
            const startTime = new Date(`${virtual.scheduledDate}T${virtual.scheduledTime || '09:00'}`)
            const endTime = new Date(startTime.getTime() + duration * 60000)

            eventsByDay[dayIndex].push({
              id: virtual.id,
              taskId: virtual.taskId,
              instanceId: virtual.id,
              title: virtual.title,
              projectId: virtual.projectId,
              startTime,
              endTime,
              duration,
              startSlot: (hour - 6) * 2 + (minute === 30 ? 1 : 0),
              slotSpan: Math.ceil(duration / 30),
              color: '#4ECDC4',
              column: 0,
              totalColumns: 1,
              dayIndex,
              isDueDate: false,
              isVirtual: true,
            } as WeekEvent & { isVirtual: boolean })
          }
        }
      }
    }

    // Flatten all events into a single array
    return eventsByDay.flat()
  })

  // use overlapCalculation utility

  // Event styling for week grid
  const getWeekEventStyle = (event: WeekEvent): Record<string, string | number> => {
    const HALF_HOUR_HEIGHT = CALENDAR_SLOT_HEIGHT_PX
    const dayColumnWidth = 100 / weekDays.value.length

    // TASK-1521: Override position with drag preview while dragging (preview-then-commit)
    const isBeingDragged = weekDragPreview.value?.taskId === event.taskId && weekDragPreview.value?.isDragging
    const previewSlot = isBeingDragged ? weekDragPreview.value!.previewSlot : event.startSlot
    const previewDayIndex = isBeingDragged ? weekDragPreview.value!.previewDayIndex : event.dayIndex

    // Calculate column positioning within the day
    const eventWidthWithinDay = dayColumnWidth / event.totalColumns
    const eventLeftOffset = (dayColumnWidth * previewDayIndex) + (eventWidthWithinDay * event.column)

    return {
      position: 'absolute',
      top: `${previewSlot * HALF_HOUR_HEIGHT}px`,
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
    const dayColumnWidth = gridRect.width / weekDays.value.length
    const HALF_HOUR_HEIGHT = CALENDAR_SLOT_HEIGHT_PX
    const WORKING_HOURS_OFFSET = 6

    const eventRect = (event.target as HTMLElement).closest('.week-event')?.getBoundingClientRect()
    if (!eventRect) return

    const clickOffsetY = event.clientY - eventRect.top

    const isDuplicateMode = event.altKey

    const initialSlot = calendarEvent.startSlot
    const initialDayIndex = calendarEvent.dayIndex
    let lastSeenSlot = initialSlot
    let lastSeenDayIndex = initialDayIndex

    // TASK-1521: Track final pending values to commit on mouseup (preview-then-commit pattern)
    const instanceId = calendarEvent.instanceId || `instance-${calendarEvent.taskId}-${Date.now()}`
    let finalSlot = initialSlot
    let finalDayIndex = initialDayIndex
    let finalDate = weekDays.value[initialDayIndex]?.dateString ?? ''
    let finalTime = (() => {
      const h = Math.floor(initialSlot / 2) + WORKING_HOURS_OFFSET
      const m = (initialSlot % 2) * 30
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    })()

    // Initialise preview state so visual position tracks mouse immediately
    if (!isDuplicateMode) {
      weekDragPreview.value = {
        taskId: calendarEvent.taskId,
        instanceId,
        previewSlot: initialSlot,
        previewDayIndex: initialDayIndex,
        previewDate: finalDate,
        previewTime: finalTime,
        isDragging: true
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        const scrollTop = weekDaysGrid.scrollTop || 0

        // Calculate day column
        const relativeX = e.clientX - gridRect.left
        const newDayIndex = Math.max(0, Math.min(weekDays.value.length - 1, Math.floor(relativeX / dayColumnWidth)))

        // Calculate time slot
        const mouseYInGrid = e.clientY - gridRect.top + scrollTop
        const eventTopInGrid = mouseYInGrid - clickOffsetY
        const slotFromTop = Math.max(0, Math.min(33, Math.round(eventTopInGrid / HALF_HOUR_HEIGHT)))

        if (slotFromTop !== lastSeenSlot || newDayIndex !== lastSeenDayIndex) {
          lastSeenSlot = slotFromTop
          lastSeenDayIndex = newDayIndex

          const newHour = Math.floor(slotFromTop / 2) + WORKING_HOURS_OFFSET
          const newMinute = (slotFromTop % 2) * 30
          const newDate = weekDays.value[newDayIndex].dateString
          const newTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

          finalSlot = slotFromTop
          finalDayIndex = newDayIndex
          finalDate = newDate
          finalTime = newTime

          if (!isDuplicateMode && weekDragPreview.value) {
            // TASK-1521: Update visual preview only — no store writes during mousemove
            weekDragPreview.value.previewSlot = slotFromTop
            weekDragPreview.value.previewDayIndex = newDayIndex
            weekDragPreview.value.previewDate = newDate
            weekDragPreview.value.previewTime = newTime
          }
        }
      })
    }

    const commitWeekDrag = async () => {
      // TASK-1521: Clear preview FIRST so the event snaps to its new store position cleanly
      weekDragPreview.value = null

      if (isDuplicateMode) {
        // Duplicate mode: create a copy with the final schedule
        const originalTask = taskStore.getTask(calendarEvent.taskId)
        if (originalTask) {
          taskStore.createTask({
            title: originalTask.title,
            description: originalTask.description,
            instances: [{
              id: `instance-dup-${Date.now()}`,
              scheduledDate: finalDate,
              scheduledTime: finalTime,
              duration: calendarEvent.duration || 60
            }],
            estimatedDuration: calendarEvent.duration,
            projectId: originalTask.projectId,
            priority: originalTask.priority,
            status: originalTask.status
          })
        }
      } else if (finalSlot !== initialSlot || finalDayIndex !== initialDayIndex) {
        // BUG-1325: Update instances[] instead of legacy scheduledDate/scheduledTime
        // TASK-1521: Use updateTaskWithUndo so Ctrl+Z reverts the drag
        const task = taskStore.getTask(calendarEvent.taskId)
        if (task) {
          await taskStore.updateTaskWithUndo(calendarEvent.taskId, {
            instances: [{
              id: instanceId,
              scheduledDate: finalDate,
              scheduledTime: finalTime,
              duration: calendarEvent.duration || task.estimatedDuration || 60
            }]
          })
        }
      }
    }

    const cancelWeekDrag = () => {
      // TASK-1521: Escape cancels the drag — discard pending changes
      weekDragPreview.value = null
      cleanupListeners()
    }

    const handleMouseUp = () => {
      cleanupListeners()
      commitWeekDrag()
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelWeekDrag()
      }
    }

    // Use registry for cleanup
    cleanupListeners()
    currentMouseMoveHandler = handleMouseMove
    currentMouseUpHandler = handleMouseUp
    currentKeydownHandler = handleKeydown

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeydown)
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
    const HALF_HOUR_HEIGHT = CALENDAR_SLOT_HEIGHT_PX
    const WORKING_HOURS_OFFSET = 6
    const originalStartSlot = calendarEvent.startSlot
    const originalDuration = calendarEvent.duration

    // Initialize resize preview for live visual feedback
    resizePreview.value = {
      taskId: calendarEvent.taskId,
      direction,
      previewDuration: originalDuration,
      isResizing: true
    }

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

      // Update preview for live visual feedback
      if (resizePreview.value) {
        resizePreview.value.previewDuration = finalDuration
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

        // Update instance duration if present
        if (calendarEvent.instanceId) {
          taskStore.updateTaskInstance(calendarEvent.taskId, calendarEvent.instanceId, {
            duration: finalDuration
          })
        }
      } else {
        const newHour = Math.floor(finalStartSlot / 2) + WORKING_HOURS_OFFSET
        const newMinute = (finalStartSlot % 2) * 30

        if (newHour >= WORKING_HOURS_OFFSET && newHour < 23) {
          const newScheduledTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

          // Update instance if present (instance-based tasks); fall back to legacy task fields
          if (calendarEvent.instanceId) {
            await taskStore.updateTaskInstance(calendarEvent.taskId, calendarEvent.instanceId, {
              scheduledTime: newScheduledTime,
              duration: finalDuration
            })
          } else {
            await taskStore.updateTask(calendarEvent.taskId, {
              scheduledTime: newScheduledTime,
              estimatedDuration: finalDuration
            })
          }
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

    // BUG-1325: Use instances[] instead of legacy scheduledDate/scheduledTime fields.
    // This is an explicit user scheduling action (drop onto calendar time slot).
    const task = taskStore.getTask(taskId)
    if (!task) return
    const newInstance = {
      id: `instance-${taskId}-${Date.now()}`,
      scheduledDate: dateString,
      scheduledTime: timeStr,
      duration: task.estimatedDuration || 60
    }
    await taskStore.updateTask(taskId, { // BUG-1051: AWAIT to ensure persistence
      instances: [newInstance]
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
    resizePreview,
    cancelWeekResize: cleanupAllListeners, // Allow external cancellation

    // TASK-1521: Drag preview (preview-then-commit)
    weekDragPreview,

    // Utilities
    isCurrentWeekTimeCell
  }
}
