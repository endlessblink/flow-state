import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue'
import { useTaskStore, formatDateKey } from '@/stores/tasks'
import { useCalendarCore, type CalendarEvent } from '@/composables/useCalendarCore'

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
// snapTo15Minutes function moved to useCalendarCore.ts

export function useCalendarDayView(currentDate: Ref<Date>, statusFilter: Ref<string | null>) {
  const taskStore = useTaskStore()
  const core = useCalendarCore()

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

  // Generate calendar events with overlap positioning - simplified and error-resistant
  const calendarEvents = computed<CalendarEvent[]>(() => {
    try {
      const dateStr = currentDate.value.toISOString().split('T')[0]
      const events: CalendarEvent[] = []

      // Use filteredTasks to respect sidebar smart view and project filters
      const filteredTasks = taskStore.filteredTasks || []

      filteredTasks.forEach(task => {
        if (!task) return // Skip invalid tasks

        try {
          // Check if task has instances scheduled for today
          const hasInstanceForToday = task.instances && task.instances.some(instance =>
            instance && instance.scheduledDate === dateStr
          )

          // Check for legacy schedule
          const hasLegacyScheduleToday = task.scheduledDate === dateStr && task.scheduledTime

          // Create calendar events only for tasks with explicit scheduling
          if (hasInstanceForToday || hasLegacyScheduleToday) {
            let startTime: Date
            let duration: number
            let instanceId: string | undefined

            if (hasInstanceForToday) {
              // Use instance-specific schedule
              const todayInstance = task.instances!.find(instance => instance && instance.scheduledDate === dateStr)
              if (!todayInstance || !todayInstance.scheduledTime) return

              const [hour, minute] = todayInstance.scheduledTime.split(':').map(Number)
              if (isNaN(hour) || isNaN(minute)) return

              startTime = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)
              duration = todayInstance.duration || task.estimatedDuration || 30
              instanceId = todayInstance.id
            } else if (task.scheduledTime) {
              // Legacy schedule - use scheduledTime
              const [hour, minute] = task.scheduledTime.split(':').map(Number)
              if (isNaN(hour) || isNaN(minute)) return

              startTime = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)
              duration = task.estimatedDuration || 30
            } else {
              return
            }

            // Validate startTime
            if (isNaN(startTime.getTime())) return

            const endTime = new Date(startTime.getTime() + duration * 60000)
            const startSlot = (startTime.getHours() * 2) + (startTime.getMinutes() >= 30 ? 1 : 0)
            const slotSpan = Math.max(1, Math.ceil(duration / 30))

            const event = {
              id: instanceId || task.id,
              taskId: task.id,
              instanceId: instanceId || '',
              title: task.title || 'Untitled Task',
              startTime,
              endTime,
              duration,
              startSlot,
              slotSpan,
              color: core.getPriorityColor(task.priority),
              column: 0,
              totalColumns: 1,
              isDueDate: false
            }

            events.push(event)
          }
        } catch (taskError) {
          console.warn(`Error processing task ${task.id}:`, taskError)
          // Continue with other tasks
        }
      })

      // Calculate overlapping positions with error handling
      try {
        const positionedEvents = core.calculateOverlappingPositions(events)
        return positionedEvents
      } catch (positionError) {
        console.warn('Error calculating overlapping positions:', positionError)
        // Return events without positioning if calculation fails
        return events
      }
    } catch (error) {
      console.error('Critical error in calendarEvents computation:', error)
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

  // calculateOverlappingPositions function moved to useCalendarCore.ts

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

    console.log('🎯 [CalendarDrag] handleDragEnter called', {
      slotIndex: slot.slotIndex,
      slotDate: slot.date,
      slotTime: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
    })

    let data = event.dataTransfer?.getData('application/json')
    let parsedData: any = null

    // FALLBACK: Check for global dragging state when dataTransfer is empty
    // This handles mouse-based dragging where dataTransfer might not be populated
    if (!data) {
      console.log('🔄 [CalendarDrag] No dataTransfer data, checking global drag state...')

      // Try to get dragged task from global state (CalendarInboxPanel sets this)
      const draggingTaskId = (window as any).__draggingTaskId ||
                            document.querySelector('[data-dragging-task-id]')?.getAttribute('data-dragging-task-id')

      if (draggingTaskId) {
        const task = taskStore.tasks.find(t => t.id === draggingTaskId)
        if (task) {
          console.log('✅ [CalendarDrag] Found task in global state:', task.title)
          parsedData = {
            ...task,
            taskId: task.id,
            source: 'calendar-inbox'
          }
          console.log('📥 [CalendarDrag] Using fallback drag data:', parsedData)
        }
      }

      if (!parsedData) {
        console.warn('⚠️  [CalendarDrag] No drag data available in handleDragEnter - no dataTransfer and no global state')
        return
      }
    } else {
      // Parse dataTransfer data
      try {
        parsedData = JSON.parse(data)
        console.log('📥 [CalendarDrag] Drag data received from dataTransfer:', parsedData)
      } catch (error) {
        console.error('❌ [CalendarDrag] Error parsing drag data:', error)
        return
      }
    }

    // Use the parsedData we already created above
    const { title, taskId } = parsedData
    const task = taskStore.tasks.find(t => t.id === taskId)

    if (!task) {
      console.warn('⚠️  [CalendarDrag] Task not found for taskId:', taskId)
    }

    dragGhost.value = {
      visible: true,
      title: title || 'New Task',
      duration: task?.estimatedDuration || 30,
      slotIndex: slot.slotIndex
    }

    console.log('✅ [CalendarDrag] Ghost preview activated', {
      title: dragGhost.value.title,
      duration: dragGhost.value.duration,
      slotIndex: dragGhost.value.slotIndex,
      taskFound: !!task
    })
  }

  const handleDragOver = (event: DragEvent, slot: TimeSlot) => {
    event.preventDefault()
    // Check if dataTransfer exists before setting dropEffect
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    // Track active drop slot for visual feedback
    activeDropSlot.value = slot.slotIndex

    console.log('🔄 [CalendarDrag] handleDragOver called', {
      slotIndex: slot.slotIndex,
      slotDate: slot.date,
      slotTime: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`,
      dropEffect: event.dataTransfer?.dropEffect,
      ghostVisible: dragGhost.value.visible,
      activeDropSlot: activeDropSlot.value
    })

    if (dragGhost.value.visible) {
      const oldSlotIndex = dragGhost.value.slotIndex
      dragGhost.value.slotIndex = slot.slotIndex

      if (oldSlotIndex !== slot.slotIndex) {
        console.log('📤 [CalendarDrag] Ghost preview moved from slot', oldSlotIndex, 'to slot', slot.slotIndex)
      }
    } else {
      console.log('⚠️  [CalendarDrag] Ghost not visible during drag over')
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
      const draggingTaskId = (window as any).__draggingTaskId
      if (!draggingTaskId) {
        console.warn('🎯 CALENDAR DROP: No drag data available')
        return
      }
    }

    try {
      const parsedData = data ? JSON.parse(data) : { taskId: (window as any).__draggingTaskId, source: 'calendar-event' }
      const taskId = parsedData.taskId || parsedData.taskIds?.[0]
      const source = parsedData.source

      if (!taskId) {
        console.warn('🎯 CALENDAR DROP: No taskId found in drag data:', parsedData)
        return
      }

      // Calculate snapped time with 15-minute precision
      const snappedTime = core.snapTo15Minutes(slot.hour, slot.minute)
      const timeStr = `${snappedTime.hour.toString().padStart(2, '0')}:${snappedTime.minute.toString().padStart(2, '0')}`

      // DEBUG LOG: Track task drop on calendar
      const task = taskStore.tasks.find(t => t.id === taskId)
      console.log(`🎯 CALENDAR DROP: Task "${task?.title}" (ID: ${taskId}) from ${source} dropped on ${slot.date} at ${timeStr} (15-min snapped)`)
      console.log(`🎯 CALENDAR DROP: Original slot time: ${slot.hour}:${slot.minute.toString().padStart(2, '0')}, Snapped to: ${timeStr}`)
      console.log(`🎯 CALENDAR DROP: Task inbox status before:`, task?.isInInbox)
      console.log(`🎯 CALENDAR DROP: Task instances before:`, task?.instances?.length || 0)

      if (source === 'calendar-event') {
        // Moving existing calendar event to new time
        console.log(`🎯 CALENDAR DROP: Moving calendar event to new time slot with 15-min snapping`)

        // Update both legacy and instance-based scheduling
        taskStore.updateTask(taskId, {
          scheduledDate: slot.date,
          scheduledTime: timeStr
        })

        // Update instance directly on the reactive task object for immediate Vue reactivity
        if (task?.instances && task.instances.length > 0) {
          // Find the instance being dragged (could be from any date, not just today)
          const instanceToUpdate = task.instances.find(instance =>
            instance && instance.id
          )
          if (instanceToUpdate) {
            // Direct mutation triggers Vue reactivity
            instanceToUpdate.scheduledDate = slot.date
            instanceToUpdate.scheduledTime = timeStr
            console.log(`🎯 CALENDAR DROP: Updated task instance ${instanceToUpdate.id} directly to ${slot.date} at ${timeStr}`)

            // Also update via store for persistence
            taskStore.updateTaskInstance(taskId, instanceToUpdate.id, {
              scheduledDate: slot.date,
              scheduledTime: timeStr
            })
          }
        }

        // Force Vue to recompute calendar events
        await nextTick()
        nextTick().then(() => {
          // Trigger calendarEvents recomputation
          calendarEvents.value
          console.log('🔄 [CalendarDrag] Forced calendarEvents recomputation after drop')
        })
      } else {
        // Drag from inbox or other sources
        // Create task instance and update task to remove from inbox
        const instance = taskStore.createTaskInstance(taskId, {
          scheduledDate: slot.date,
          scheduledTime: timeStr
        })

        // If instance was created successfully, update task to remove from inbox and canvas
        if (instance) {
          console.log(`🎯 CALENDAR DROP: Instance created successfully:`, instance.id)
          if (task) {
            taskStore.updateTask(taskId, {
              isInInbox: false, // Task is now scheduled, no longer in inbox
              canvasPosition: undefined // Remove from canvas when scheduled in calendar
            })
            console.log(`🎯 CALENDAR DROP: Task removed from inbox and canvas, scheduled for ${slot.date} at ${timeStr}`)
          }
        } else {
          console.log(`🎯 CALENDAR DROP: Failed to create instance for task ${taskId}`)
        }
      }
    } catch (error) {
      console.error('🎯 CALENDAR DROP: Error parsing drag data:', error, data)
    }

    dragGhost.value.visible = false

    // Reset drag state
    isDragging.value = false
    draggedEventId.value = null
    activeDropSlot.value = null
    console.log('🎨 [CalendarDrag] Drag state reset after drop')
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
    console.log('🎯 [CalendarDrag] handleEventDragStart called', {
      taskId: calendarEvent.taskId,
      instanceId: calendarEvent.instanceId,
      eventTitle: calendarEvent.title,
      startSlot: calendarEvent.startSlot,
      duration: calendarEvent.duration
    })

    // Set drag state for visual feedback
    isDragging.value = true
    draggedEventId.value = calendarEvent.id
    console.log('🎨 [CalendarDrag] Drag state activated', {
      isDragging: isDragging.value,
      draggedEventId: draggedEventId.value
    })

    // Allow dragging calendar events without Shift key or restrictions
    if (event.dataTransfer) {
      const dragData = {
        taskId: calendarEvent.taskId,
        instanceId: calendarEvent.instanceId,
        source: 'calendar-event'
      }

      console.log('📤 [CalendarDrag] Setting drag data:', dragData)

      event.dataTransfer.setData('application/json', JSON.stringify(dragData))
      event.dataTransfer.effectAllowed = 'move'

      // Create a custom drag image for better visual feedback
      const dragElement = event.target as HTMLElement
      if (dragElement) {
        // Create a clone for the drag image
        const dragImage = dragElement.cloneNode(true) as HTMLElement
        dragImage.style.opacity = '0.8'
        dragImage.style.transform = 'rotate(-2deg)'
        dragImage.style.maxWidth = '200px'
        dragImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'

        // Temporarily add to body to create image
        document.body.appendChild(dragImage)

        // Set the drag image
        try {
          event.dataTransfer.setDragImage(dragImage, 20, 20)
          console.log('✅ [CalendarDrag] Custom drag image set successfully')

          // Remove the temporary element after a short delay
          setTimeout(() => {
            if (document.body.contains(dragImage)) {
              document.body.removeChild(dragImage)
            }
          }, 100)
        } catch (error) {
          console.warn('⚠️ [CalendarDrag] Could not set custom drag image, using default:', error)
          // Fallback: use the original element
          event.dataTransfer.setDragImage(dragElement, 20, 20)
        }
      }

      console.log('✅ [CalendarDrag] Drag data set successfully, effectAllowed:', event.dataTransfer.effectAllowed)
    } else {
      console.error('❌ [CalendarDrag] No dataTransfer available on drag event')
    }

    // Don't prevent default - let HTML5 drag work naturally
    console.log('🔄 [CalendarDrag] Drag start completed, allowing default behavior')
  }

  const handleEventDragEnd = (event: DragEvent, calendarEvent: CalendarEvent) => {
    console.log('🏁 [CalendarDrag] handleEventDragEnd called', {
      taskId: calendarEvent.taskId,
      instanceId: calendarEvent.instanceId,
      eventTitle: calendarEvent.title,
      wasDragging: isDragging.value,
      draggedEventId: draggedEventId.value
    })

    // Clean up drag state to prevent stuck states
    if (isDragging.value) {
      console.log('🧹 [CalendarDrag] Cleaning up drag state after drag end')
      isDragging.value = false
      draggedEventId.value = null
      activeDropSlot.value = null

      // Clean up any visual dragging classes that might be stuck
      setTimeout(() => {
        const draggingElements = document.querySelectorAll('.calendar-event.dragging')
        draggingElements.forEach(el => {
          el.classList.remove('dragging')
          console.log('🧹 [CalendarDrag] Removed dragging class from element')
        })

        const dragOverSlots = document.querySelectorAll('.time-slot.drag-over')
        dragOverSlots.forEach(slot => {
          slot.classList.remove('drag-over')
          console.log('🧹 [CalendarDrag] Removed drag-over class from time slot')
        })
      }, 50) // Small delay to ensure DOM updates are processed
    }

    // Add fallback cleanup timeout as safety net
    setTimeout(() => {
      if (isDragging.value || draggedEventId.value || activeDropSlot.value !== null) {
        console.warn('⚠️ [CalendarDrag] Drag state still detected after timeout - forcing cleanup')
        isDragging.value = false
        draggedEventId.value = null
        activeDropSlot.value = null
      }
    }, 2000) // 2 second fallback

    console.log('✅ [CalendarDrag] Drag end cleanup completed')
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
    const originalTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

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

          console.log(`🔄 [CalendarResize] Bottom preview: duration ${originalDuration} → ${newDuration}`)

        } else {
          // Resize from top - change start time and maintain end time
          const deltaMinutes = deltaSlots * 30
          const newStartTime = currentStartTime + deltaMinutes

          if (newStartTime >= 0) {
            // Snap new start time to 15-minute intervals
            const snappedTime = core.snapTo15Minutes(
              Math.floor(newStartTime / 60),
              newStartTime % 60
            )

            newStartHour = snappedTime.hour
            newStartMinute = snappedTime.minute

            // Calculate new duration to maintain end time
            const currentEndTime = currentStartTime + originalDuration
            const actualNewStartTime = newStartHour * 60 + newStartMinute
            newDuration = Math.max(MIN_DURATION, currentEndTime - actualNewStartTime)

            const newTimeStr = `${newStartHour.toString().padStart(2, '0')}:${newStartMinute.toString().padStart(2, '0')}`

            // Update preview state only (NOT the store)
            resizePreview.value.previewDuration = newDuration
            resizePreview.value.previewStartTime = newTimeStr
            finalDuration = newDuration
            finalStartTime = newTimeStr

            console.log(`🔄 [CalendarResize] Top preview: start ${originalTimeStr} → ${newTimeStr}, duration ${originalDuration} → ${newDuration}`)
          }
        }
      })
    }

    const handleMouseUp = () => {
      console.log('🏁 [CalendarResize] Resize completed - committing to store')

      // Commit final values to store
      if (direction === 'bottom') {
        taskStore.updateTask(calendarEvent.taskId, {
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
        taskStore.updateTask(calendarEvent.taskId, {
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

      // Clear preview state
      resizePreview.value = null

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    console.log('🚀 [CalendarResize] Resize started', {
      taskId: calendarEvent.taskId,
      direction,
      originalTime: originalTimeStr,
      originalDuration
    })
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
