import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import type { CalendarEvent, DragGhost } from '@/types/tasks'
import { calculateOverlappingPositions } from '@/utils/calendar/overlapCalculation'

export interface TimeSlot {
  id: string
  hour: number
  minute: number
  slotIndex: number
  date: string
}

// Drag data from calendar drag operations
interface CalendarDragData {
  taskId?: string
  title?: string
  source?: string
  [key: string]: unknown
}

// Re-export for consumers
export type { DragGhost } from '@/types/tasks'

/**
 * Day view specific logic for calendar
 * Handles event computation, drag-and-drop, resizing, and time slots
 */
// Helper function to snap time to 15-minute intervals
function snapTo15Minutes(hour: number, minute: number): { hour: number; minute: number } {
  const totalMinutes = hour * 60 + minute

  // Round to nearest 15-minute interval
  const snappedMinutes = Math.round(totalMinutes / 15) * 15

  // Convert back to hour and minute
  const snappedHour = Math.floor(snappedMinutes / 60)
  const snappedMinute = snappedMinutes % 60

  return { hour: snappedHour, minute: snappedMinute }
}

export function useCalendarDayView(currentDate: Ref<Date>, _statusFilter: Ref<string | null>, timerGrowthMap?: Ref<Map<string, number>>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString } = useCalendarCore()
  const { startDrag: startGlobalDrag, endDrag: endGlobalDrag } = useDragAndDrop()

  // --- MEMORY LEAK FIX: Listener Registry ---
  let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
  let currentMouseUpHandler: (() => void) | null = null
  let currentKeydownHandler: ((e: KeyboardEvent) => void) | null = null
  let currentBlurHandler: (() => void) | null = null

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
    // Clear any stuck selection
    window.getSelection()?.removeAllRanges()
    // Restore text selection
    document.body.style.userSelect = ''
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
  }

  onUnmounted(cleanupAllListeners)
  // ------------------------------------------

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Drag ghost state
  const dragGhost = ref<DragGhost>({
    visible: false,
    title: '',
    duration: 30,
    slotIndex: 0
  })

  // Drag mode state - enable dragging by default
  const dragMode = ref<'none' | 'shift'>('shift')

  // Drag state for visual feedback
  const isDragging = ref(false)
  const draggedEventId = ref<string | null>(null)
  const activeDropSlot = ref<number | null>(null)

  // Resize preview state - shows visual feedback during resize without updating store
  const resizePreview = ref<{
    taskId: string
    direction: 'top' | 'bottom'
    originalDuration: number
    originalStartSlot: number
    previewDuration: number
    previewStartTime: string
    isResizing: boolean
  } | null>(null)

  // Generate time slots for current day
  const timeSlots = computed<TimeSlot[]>(() => {
    const slots: TimeSlot[] = []
    const dateStr = getDateString(currentDate.value)
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

  // Generate calendar events with overlap positioning - simplified and error-resistant
  const calendarEvents = computed<CalendarEvent[]>(() => {
    try {
      const dateStr = getDateString(currentDate.value)
      const events: CalendarEvent[] = []

      // Use calendarFilteredTasks to bypass smart view filters (done tasks stay visible)
      // Only filters by project + hideCalendarDoneTasks toggle
      const filteredTasks = taskStore.calendarFilteredTasks || []

      filteredTasks.forEach(task => {
        if (!task) return // Skip invalid tasks

        try {
          // GUARD: Limit instance processing to prevent OOM from corrupted data
          // If a task has > 100 instances for a single day, something is wrong.
          const MAX_INSTANCES_PER_TASK = 50

          // BUG-1325: Only show tasks with explicit instances[] scheduled for today.
          // Legacy scheduledDate/scheduledTime fields are NO LONGER used for calendar visibility.
          let instanceCount = 0
          const hasInstanceForToday = task.instances && task.instances.some(instance => {
            if (instanceCount++ > MAX_INSTANCES_PER_TASK) return false
            return instance && instance.scheduledDate === dateStr
          })

          // Create calendar events only for tasks with explicit instances
          if (hasInstanceForToday) {
            let startTime: Date
            let duration: number
            let instanceId: string | undefined

            // Use instance-specific schedule
            const todayInstance = task.instances?.find(instance => instance && instance.scheduledDate === dateStr)
            if (!todayInstance || !todayInstance.scheduledTime) return

            const [hour, minute] = todayInstance.scheduledTime.split(':').map(Number)
            if (isNaN(hour) || isNaN(minute)) return

            startTime = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)
            duration = todayInstance.duration || task.estimatedDuration || 30
            instanceId = todayInstance.id

            // Validate startTime
            if (isNaN(startTime.getTime())) return

            // TASK-1285: Apply timer growth if active
            const growthMinutes = (instanceId && timerGrowthMap?.value?.get(instanceId)) || 0
            const visualDuration = duration + growthMinutes

            const endTime = new Date(startTime.getTime() + visualDuration * 60000)
            const startSlot = (startTime.getHours() * 2) + (startTime.getMinutes() >= 30 ? 1 : 0)
            const slotSpan = Math.max(1, Math.ceil(visualDuration / 30))

            // TASK-1285: Instance status for completion tracking (reuses todayInstance from above)
            const event = {
              id: instanceId || task.id,
              taskId: task.id,
              instanceId: instanceId || '',
              title: task.title || 'Untitled Task',
              startTime,
              endTime,
              duration: visualDuration,
              startSlot,
              slotSpan,
              color: getPriorityColor(task.priority),
              column: 0,
              totalColumns: 1,
              isDueDate: false,
              instanceStatus: todayInstance?.status,
              taskStatus: task.status
            }

            events.push(event)
          }
        } catch (taskError) {
          // Continue with other tasks
        }
      })

      // Calculate overlapping positions with error handling
      try {
        const positionedEvents = calculateOverlappingPositions(events)
        return positionedEvents as CalendarEvent[]
      } catch (positionError) {
        // Return events without positioning if calculation fails
        return events as CalendarEvent[]
      }
    } catch (error) {
      // Return empty array to prevent template rendering failure
      return []
    }
  })

  /**
   * Get tasks that should be rendered inside a specific time slot
   * For slot-based rendering (tasks as children of slots, not floating events)
   * Multi-slot tasks appear in each slot they span
   */
  const getTasksForSlot = (slot: TimeSlot): CalendarEvent[] => {
    const allEvents = calendarEvents.value
    const slotEvents = allEvents.filter(event => {
      // Check if this slot is within the event's time range
      const eventEndSlot = event.startSlot + event.slotSpan
      return slot.slotIndex >= event.startSlot && slot.slotIndex < eventEndSlot
    })

    return slotEvents
  }

  /**
   * Check if a task is the "primary" slot (first slot of multi-slot task)
   * Used to determine if we should render full task content vs continuation indicator
   */
  const isTaskPrimarySlot = (slot: TimeSlot, event: CalendarEvent): boolean => {
    return slot.slotIndex === event.startSlot
  }

  // use overlapCalculation utility

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

  /**
   * Compute positioning style for slot tasks (handles overlapping tasks side-by-side)
   * Short tasks (<= 30min) get compact class for single-line layout
   */
  const getSlotTaskStyle = (calEvent: CalendarEvent) => {
    const baseHeight = (calEvent.slotSpan * 30) - 4
    // Mark short tasks for compact CSS styling (single horizontal line)
    const isCompact = calEvent.duration <= 30

    // If no overlap (totalColumns is 1 or undefined), use normal flow with full width
    if (!calEvent.totalColumns || calEvent.totalColumns <= 1) {
      return {
        height: `${baseHeight}px`,
        minHeight: `${baseHeight}px`,
        zIndex: 10,
        '--is-compact': isCompact ? '1' : '0'
      }
    }

    // Calculate width and position for overlapping events (like Google Calendar)
    const gapPercent = 1 // 1% gap between columns
    const totalGaps = calEvent.totalColumns - 1
    const availableWidth = 100 - (totalGaps * gapPercent)
    const widthPercentage = availableWidth / calEvent.totalColumns
    const leftPercentage = (widthPercentage + gapPercent) * (calEvent.column || 0)

    return {
      position: 'absolute' as const,
      top: '2px',
      height: `${baseHeight}px`,
      minHeight: `${baseHeight}px`,
      width: `calc(${widthPercentage}% - 4px)`,
      left: `calc(${leftPercentage}% + 2px)`,
      zIndex: 10 + (calEvent.column || 0), // Later columns render on top
      '--is-compact': isCompact ? '1' : '0'
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
    let parsedData: CalendarDragData | null = null

    // FALLBACK: Check for global dragging state when dataTransfer is empty
    // This handles mouse-based dragging where dataTransfer might not be populated
    if (!data) {


      // Try to get dragged task from global state (CalendarInboxPanel sets this)
      const draggingTaskId = (window as Window & typeof globalThis).__draggingTaskId ||
        document.querySelector('[data-dragging-task-id]')?.getAttribute('data-dragging-task-id')

      if (draggingTaskId) {
        const task = taskStore.tasks.find(t => t.id === draggingTaskId)
        if (task) {

          parsedData = {
            ...task,
            taskId: task.id,
            source: 'calendar-inbox'
          }

        }
      }

      if (!parsedData) {
        return
      }
    } else {
      // Parse dataTransfer data
      try {
        parsedData = JSON.parse(data) as CalendarDragData

      } catch (error) {
        return
      }
    }

    if (!parsedData) {
      return
    }

    // Use the parsedData we already created above
    const { title, taskId } = parsedData
    const task = taskStore.tasks.find(t => t.id === taskId)

    if (!task) {
      return
    }

    dragGhost.value = {
      visible: true,
      title: title || 'New Task',
      duration: task?.estimatedDuration || 30,
      slotIndex: slot.slotIndex
    }
  }

  const handleDragOver = (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()
    // Check if dataTransfer exists before setting dropEffect
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    // Track active drop slot for visual feedback
    activeDropSlot.value = slot.slotIndex

    if (dragGhost.value.visible) {
      dragGhost.value.slotIndex = slot.slotIndex
    }
  }

  const handleDragLeave = () => {
    // Keep ghost visible, only hide on drop
  }

  const handleDrop = async (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) {
      // Try fallback for browser compatibility
      const draggingTaskId = (window as Window & typeof globalThis).__draggingTaskId
      if (!draggingTaskId) {
        return
      }
    }

    try {
      const parsedData = data ? JSON.parse(data) : { taskId: (window as Window & typeof globalThis).__draggingTaskId, source: 'calendar-event' }
      const taskId = parsedData.taskId || parsedData.taskIds?.[0]
      const source = parsedData.source

      if (!taskId) {
        return
      }

      // Calculate snapped time with 15-minute precision
      const snappedTime = snapTo15Minutes(slot.hour, slot.minute)
      const timeStr = `${snappedTime.hour.toString().padStart(2, '0')}:${snappedTime.minute.toString().padStart(2, '0')}`

      const task = taskStore.tasks.find(t => t.id === taskId)



      if (source === 'calendar-event') {
        const instanceToUpdate = task?.instances?.find(i => i.id)

        await taskStore.updateTaskWithSchedule(taskId, {
          scheduledDate: slot.date,
          scheduledTime: timeStr,
          instanceId: instanceToUpdate?.id
        })
      } else {
        // Drag from inbox or other sources
        // Create task instance and update task to remove from inbox
        // BUG-1321: await for proper sync queue + echo protection
        const instance = await taskStore.createTaskInstance(taskId, {
          scheduledDate: slot.date,
          scheduledTime: timeStr
        })

        // If instance was created successfully, log it
        // Dec 16, 2025 fix: DO NOT modify isInInbox or canvasPosition here
        // Calendar and Canvas are INDEPENDENT systems:
        // - Creating an instance removes task from CALENDAR inbox (filtered by !hasInstances)
        // - Canvas state (isInInbox, canvasPosition) should NOT be affected
        if (instance) {
          // Successfully created instance
        }
      }
    } catch (error) {
    }

    dragGhost.value.visible = false

    // Reset drag state
    isDragging.value = false
    draggedEventId.value = null
    activeDropSlot.value = null

  }

  // Event drag-and-drop (repositioning within calendar)
  const _startEventDrag = (event: MouseEvent, calendarEvent: CalendarEvent) => {
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

    const handleMouseMove = async (e: MouseEvent) => {
      requestAnimationFrame(async () => {
        const containerScrollTop = container.scrollTop || 0
        const targetY = e.clientY - rect.top + containerScrollTop - clickOffsetY
        const targetSlot = Math.max(0, Math.min(47, Math.floor(targetY / SLOT_HEIGHT)))

        if (targetSlot !== lastUpdatedSlot) {
          lastUpdatedSlot = targetSlot

          const newHour = Math.floor((targetSlot * 30) / 60)
          const newMinute = (targetSlot * 30) % 60
          const newTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')} `
          const newDate = currentDate.value.toISOString().split('T')[0]

          if (isDuplicateMode) {
            // In duplicate mode, create a copy of the task with new schedule
            const originalTask = taskStore.getTask(calendarEvent.taskId)
            if (originalTask) {
              taskStore.createTask({
                title: originalTask.title,
                description: originalTask.description,
                instances: [{
                  id: `instance-dup-${Date.now()}`,
                  scheduledDate: newDate,
                  scheduledTime: newTime,
                  duration: calendarEvent.duration || 60
                }],
                estimatedDuration: calendarEvent.duration,
                projectId: originalTask.projectId,
                priority: originalTask.priority,
                status: originalTask.status,
                isInInbox: false
              })
            }
          } else {
            // BUG-1325: Update instances[] instead of legacy scheduledDate/scheduledTime
            const task = taskStore.getTask(calendarEvent.taskId)
            if (task) {
              const instanceId = calendarEvent.instanceId || `instance-${calendarEvent.taskId}-${Date.now()}`
              await taskStore.updateTask(calendarEvent.taskId, {
                instances: [{
                  id: instanceId,
                  scheduledDate: newDate,
                  scheduledTime: newTime,
                  duration: calendarEvent.duration || task.estimatedDuration || 60
                }]
              })
            }
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

  const handleEventMouseDown = (event: MouseEvent, _calendarEvent: CalendarEvent) => {
    // Only handle mouse down for resize handles, let HTML5 drag handle dragging
    // Don't interfere with dragstart events
    if (event.shiftKey) {
      dragMode.value = 'shift'
      return
    }

    // Let HTML5 drag events handle the dragging - don't block them
    // Remove preventDefault and stopPropagation to allow drag events
  }

  const handleEventDragStart = (event: DragEvent, calendarEvent: CalendarEvent) => {

    // Set drag state for visual feedback
    isDragging.value = true
    draggedEventId.value = calendarEvent.id

    // Allow dragging calendar events without Shift key or restrictions
    if (event.dataTransfer) {
      const dragData = {
        taskId: calendarEvent.taskId,
        instanceId: calendarEvent.instanceId,
        source: 'calendar-event'
      }



      event.dataTransfer.setData('application/json', JSON.stringify(dragData))
      event.dataTransfer.effectAllowed = 'move'

      // Unified ghost pill — startGlobalDrag creates it and calls setDragImage
      startGlobalDrag(
        { type: 'task', taskId: calendarEvent.taskId, title: calendarEvent.title, source: 'calendar' },
        event
      )
    } else {
    }

    // Don't prevent default - let HTML5 drag work naturally

  }

  const handleEventDragEnd = (_event: DragEvent, _calendarEvent: CalendarEvent) => {
    // Clean up unified drag ghost + body class
    endGlobalDrag()

    // Clean up drag state to prevent stuck states
    if (isDragging.value) {

      isDragging.value = false
      draggedEventId.value = null
      activeDropSlot.value = null

      // Clean up any visual dragging classes that might be stuck
      setTimeout(() => {
        const draggingElements = document.querySelectorAll('.calendar-event.dragging')
        draggingElements.forEach(el => {
          el.classList.remove('dragging')

        })

        const dragOverSlots = document.querySelectorAll('.time-slot.drag-over')
        dragOverSlots.forEach(slot => {
          slot.classList.remove('drag-over')

        })
      }, 50) // Small delay to ensure DOM updates are processed
    }

    // Add fallback cleanup timeout as safety net
    setTimeout(() => {
      if (isDragging.value || draggedEventId.value || activeDropSlot.value !== null) {
        isDragging.value = false
        draggedEventId.value = null
        activeDropSlot.value = null
      }
    }, 2000) // 2 second fallback


  }

  // Event resizing - uses preview state during drag, commits on mouseup
  const startResize = (event: MouseEvent, calendarEvent: CalendarEvent, direction: 'top' | 'bottom') => {
    event.preventDefault()
    event.stopPropagation() // Prevent drag events from interfering

    const startY = event.clientY
    const SLOT_HEIGHT = 30
    const originalStartSlot = calendarEvent.startSlot
    const originalDuration = calendarEvent.duration
    const MIN_DURATION = 15 // 15-minute minimum

    // Get current time information
    const [currentHour, currentMinute] = calendarEvent.startTime.toTimeString().slice(0, 5).split(':').map(Number)
    const currentStartTime = currentHour * 60 + currentMinute
    const originalTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} `

    // Initialize resize preview state
    resizePreview.value = {
      taskId: calendarEvent.taskId,
      direction,
      originalDuration,
      originalStartSlot,
      previewDuration: originalDuration,
      previewStartTime: originalTimeStr,
      isResizing: true
    }

    // Track final values to commit on mouseup
    let finalDuration = originalDuration
    let finalStartTime = originalTimeStr

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!resizePreview.value) return

        const deltaY = e.clientY - startY
        const deltaSlots = Math.round(deltaY / SLOT_HEIGHT)

        let newDuration = originalDuration
        let newStartHour = currentHour
        let newStartMinute = currentMinute

        if (direction === 'bottom') {
          // Resize from bottom - change duration only
          const deltaMinutes = deltaSlots * 30
          newDuration = Math.max(MIN_DURATION, originalDuration + deltaMinutes)

          // Update preview state only (NOT the store)
          resizePreview.value.previewDuration = newDuration
          finalDuration = newDuration



        } else {
          // Resize from top - change start time and maintain end time
          const deltaMinutes = deltaSlots * 30
          const newStartTime = currentStartTime + deltaMinutes

          if (newStartTime >= 0) {
            // Snap new start time to 15-minute intervals
            const snappedTime = snapTo15Minutes(
              Math.floor(newStartTime / 60),
              newStartTime % 60
            )

            newStartHour = snappedTime.hour
            newStartMinute = snappedTime.minute

            // Calculate new duration to maintain end time
            const currentEndTime = currentStartTime + originalDuration
            const actualNewStartTime = newStartHour * 60 + newStartMinute
            newDuration = Math.max(MIN_DURATION, currentEndTime - actualNewStartTime)

            const newTimeStr = `${newStartHour.toString().padStart(2, '0')}:${newStartMinute.toString().padStart(2, '0')} `

            // Update preview state only (NOT the store)
            resizePreview.value.previewDuration = newDuration
            resizePreview.value.previewStartTime = newTimeStr
            finalDuration = newDuration
            finalStartTime = newTimeStr


          }
        }
      })
    }

    const handleMouseUp = async () => {
      // Clear visual state IMMEDIATELY to prevent stuck appearance
      resizePreview.value = null
      cleanupAllListeners()

      // Commit final values to store (async, after cleanup)
      if (direction === 'bottom') {
        await taskStore.updateTask(calendarEvent.taskId, { // BUG-1051: AWAIT to ensure persistence
          estimatedDuration: finalDuration
        })

        // Update instance if present
        const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
        if (task?.instances && task.instances.length > 0) {
          const todayInstance = task.instances.find(instance =>
            instance && instance.scheduledDate === currentDate.value.toISOString().split('T')[0]
          )
          if (todayInstance && todayInstance.id) {
            taskStore.updateTaskInstance(calendarEvent.taskId, todayInstance.id, {
              duration: finalDuration
            })
          }
        }
      } else {
        // Top resize - update both start time and duration
        await taskStore.updateTask(calendarEvent.taskId, { // BUG-1051: AWAIT to ensure persistence
          scheduledTime: finalStartTime,
          estimatedDuration: finalDuration
        })

        // Update instance if present
        const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
        if (task?.instances && task.instances.length > 0) {
          const todayInstance = task.instances.find(instance =>
            instance && instance.scheduledDate === currentDate.value.toISOString().split('T')[0]
          )
          if (todayInstance && todayInstance.id) {
            taskStore.updateTaskInstance(calendarEvent.taskId, todayInstance.id, {
              scheduledTime: finalStartTime,
              duration: finalDuration
            })
          }
        }
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel resize - don't commit changes
        resizePreview.value = null
        cleanupAllListeners()
      }
    }

    const handleBlur = () => {
      // Window lost focus - cleanup to prevent stuck state
      // Don't commit changes on blur (user might have accidentally clicked away)
      resizePreview.value = null
      cleanupAllListeners()
    }

    // Clean up any existing listeners first
    cleanupAllListeners()

    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'

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

  return {
    hours,
    timeSlots,
    calendarEvents,
    dragGhost,
    dragMode,

    // Slot-based rendering (tasks inside slots)
    getTasksForSlot,
    isTaskPrimarySlot,

    // Drag state for visual feedback
    isDragging,
    draggedEventId,
    activeDropSlot,

    // Styling
    getEventStyle,
    getSlotTaskStyle,
    getGhostStyle,

    // Drag handlers
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleEventDragStart,
    handleEventDragEnd,
    handleEventMouseDown,

    // Resize handlers
    startResize,
    resizePreview
  }
}
