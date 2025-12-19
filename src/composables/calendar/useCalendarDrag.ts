import { ref, type Ref as _Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarCore } from '@/composables/useCalendarCore'
import type { CalendarEvent, DragGhost } from '@/types/tasks'

export interface DragState {
  isDragging: boolean
  draggedTaskId: string | null
  draggedInstanceId: string | null
  source: 'calendar-event' | 'calendar-inbox' | 'sidebar' | null
  dragMode: 'move' | 'duplicate' | null
}

// Re-export for consumers
export type { DragGhost } from '@/types/tasks'

export interface DropTarget {
  type: 'time-slot' | 'day-cell' | 'week-grid' | 'month-day'
  date: string
  time?: string // for time slots
  slotIndex?: number // for time slots
  dayIndex?: number // for week grid
}

/**
 * Unified drag-and-drop system for all calendar views
 * Consolidates duplicate drag logic from day/week/month views (200+ lines)
 */
export function useCalendarDrag() {
  const taskStore = useTaskStore()
  const core = useCalendarCore()

  // Shared drag state across all views
  const dragState = ref<DragState>({
    isDragging: false,
    draggedTaskId: null,
    draggedInstanceId: null,
    source: null,
    dragMode: null
  })

  const dragGhost = ref<DragGhost>({
    visible: false,
    title: '',
    duration: 30,
    slotIndex: 0
  })

  const activeDropTarget = ref<DropTarget | null>(null)

  // === DOCUMENT-LEVEL DRAG TRACKING ===
  // Provides smooth ghost positioning by tracking mouse position during drag

  let documentDragHandler: ((e: DragEvent) => void) | null = null

  /**
   * Calculate slot index from mouse Y position relative to slots container
   * @param clientY - Mouse Y position in viewport coordinates
   * @returns slot index (0-47 for 24 hours * 2 slots/hour)
   */
  const calculateSlotFromMouseY = (clientY: number): number => {
    const container = document.querySelector('.slots-container') as HTMLElement
    if (!container) return dragGhost.value.slotIndex // Keep current if no container

    const rect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop || 0
    const SLOT_HEIGHT = 30

    // Calculate Y position relative to container content (accounting for scroll)
    const relativeY = clientY - rect.top + scrollTop

    // Calculate slot index and clamp to valid range (0-47)
    const slotIndex = Math.floor(relativeY / SLOT_HEIGHT)
    return Math.max(0, Math.min(47, slotIndex))
  }

  /**
   * Start document-level drag tracking for smooth ghost updates
   */
  const startDocumentDragTracking = () => {
    if (documentDragHandler) return // Already tracking

    documentDragHandler = (e: DragEvent) => {
      if (!dragGhost.value.visible) return

      // Update ghost slot position based on mouse Y
      const newSlotIndex = calculateSlotFromMouseY(e.clientY)
      if (newSlotIndex !== dragGhost.value.slotIndex) {
        dragGhost.value.slotIndex = newSlotIndex
      }
    }

    // Use capture phase to ensure we get the event even over non-drop-target elements
    document.addEventListener('dragover', documentDragHandler, { capture: true, passive: true })
  }

  /**
   * Stop document-level drag tracking
   */
  const stopDocumentDragTracking = () => {
    if (documentDragHandler) {
      document.removeEventListener('dragover', documentDragHandler, { capture: true })
      documentDragHandler = null
    }
  }

  // === COMMON DRAG HANDLERS ===

  /**
   * Start dragging a calendar event
   * Used by day/week/month views for dragging existing events
   */
  const startDrag = (event: DragEvent | MouseEvent, calendarEvent: CalendarEvent, viewMode: 'day' | 'week' | 'month') => {
    dragState.value = {
      isDragging: true,
      draggedTaskId: calendarEvent.taskId,
      draggedInstanceId: calendarEvent.instanceId,
      source: 'calendar-event',
      dragMode: (event as MouseEvent).altKey ? 'duplicate' : 'move'
    }

    // Set drag data for HTML5 drag API
    if ('dataTransfer' in event && event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({
        taskId: calendarEvent.taskId,
        instanceId: calendarEvent.instanceId,
        source: 'calendar-event'
      }))
    }

    // Set global fallback for browser compatibility
    (window as Window & typeof globalThis).__draggingTaskId = calendarEvent.taskId

    console.log('🎯 [UnifiedDrag] Drag started:', {
      taskId: calendarEvent.taskId,
      viewMode,
      dragMode: dragState.value.dragMode,
      eventTitle: calendarEvent.title
    })
  }

  /**
   * Handle drag enter on drop targets
   * Shows ghost preview and tracks active drop zone
   */
  const handleDragEnter = (event: DragEvent, target: DropTarget) => {
    event.preventDefault()
    activeDropTarget.value = target

    // Parse drag data
    let dragData: unknown = null

    const data = event.dataTransfer?.getData('application/json')
    if (data) {
      try {
        dragData = JSON.parse(data)
      } catch (error) {
        console.error('❌ [UnifiedDrag] Error parsing drag data:', error)
        return
      }
    } else {
      // Fallback to global state
      const globalTaskId = (window as Window & typeof globalThis).__draggingTaskId
      if (globalTaskId) {
        const task = taskStore.tasks.find(t => t.id === globalTaskId)
        if (task) {
          dragData = {
            taskId: task.id,
            title: task.title,
            source: 'calendar-inbox'
          }
        }
      }
    }

    if (!dragData) {
      console.warn('⚠️ [UnifiedDrag] No drag data available')
      return
    }

    // Update ghost preview for time slot targets
    if (target.type === 'time-slot' && target.slotIndex !== undefined) {
      const task = taskStore.tasks.find(t => t.id === dragData.taskId)
      dragGhost.value = {
        visible: true,
        title: dragData.title || 'New Task',
        duration: task?.estimatedDuration || 30,
        slotIndex: target.slotIndex,
        taskId: dragData.taskId
      }
      // Start document-level tracking for smooth ghost updates
      startDocumentDragTracking()
    }

    console.log('📥 [UnifiedDrag] Drag enter:', { target, dragData })
  }

  /**
   * Handle drag over drop targets
   * Updates visual feedback and ghost position
   */
  const handleDragOver = (event: DragEvent, target?: DropTarget) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = dragState.value.dragMode === 'duplicate' ? 'copy' : 'move'
    }

    if (target) {
      activeDropTarget.value = target

      // Update ghost position for time slots
      if (target.type === 'time-slot' && target.slotIndex !== undefined && dragGhost.value.visible) {
        dragGhost.value.slotIndex = target.slotIndex
      }
    }
  }

  /**
   * Handle drag leave from drop targets
   * Manages visual feedback when drag leaves a valid drop zone
   */
  const handleDragLeave = (event?: DragEvent, target?: DropTarget) => {
    event?.preventDefault()

    // Clear active drop target for visual feedback
    // Note: Keep ghost visible until drag end for better UX
    if (target && activeDropTarget.value?.type === target.type) {
      activeDropTarget.value = null
    }

    console.log('📍 [UnifiedDrag] Drag leave:', {
      target: target?.type,
      hadActiveTarget: !!activeDropTarget.value
    })
  }

  /**
   * Handle drop on targets
   * Processes the actual drop operation based on target type
   */
  const handleDrop = async (event: DragEvent, target: DropTarget) => {
    event.preventDefault()
    activeDropTarget.value = null
    dragGhost.value.visible = false

    // Parse drag data
    let dragData: unknown = null

    const data = event.dataTransfer?.getData('application/json')
    if (data) {
      try {
        dragData = JSON.parse(data)
      } catch (error) {
        console.error('❌ [UnifiedDrag] Error parsing drop data:', error)
        return
      }
    } else {
      // Fallback to global state
      const globalTaskId = (window as Window & typeof globalThis).__draggingTaskId
      if (globalTaskId) {
        dragData = { taskId: globalTaskId, source: 'calendar-event' }
      }
    }

    if (!dragData || !dragData.taskId) {
      console.warn('⚠️ [UnifiedDrag] No valid drag data for drop')
      return
    }

    const taskId = dragData.taskId
    const task = taskStore.tasks.find(t => t.id === taskId)

    if (!task) {
      console.warn('⚠️ [UnifiedDrag] Task not found:', taskId)
      return
    }

    console.log('🎯 [UnifiedDrag] Processing drop:', { task: task.title, target, dragMode: dragState.value.dragMode })

    // Create transaction backup for rollback
    const taskBackup = JSON.parse(JSON.stringify(task))
    let operationSuccess = false

    try {
      switch (target.type) {
        case 'time-slot':
          await handleTimeSlotDrop(task, target, dragData)
          operationSuccess = true
          break
        case 'day-cell':
        case 'month-day':
          await handleDayDrop(task, target, dragData)
          operationSuccess = true
          break
        case 'week-grid':
          await handleWeekGridDrop(task, target, dragData)
          operationSuccess = true
          break
        default:
          console.warn('⚠️ [UnifiedDrag] Unknown target type:', target.type)
          return
      }

      if (operationSuccess) {
        console.log(`✅ [UnifiedDrag] Successfully processed drop: ${task.title}`)
      } else {
        throw new Error('Drop operation returned false')
      }
    } catch (error) {
      console.error('❌ [UnifiedDrag] Error processing drop, rolling back:', error)

      // Rollback task state to prevent data loss
      try {
        taskStore.updateTask(task.id, taskBackup)
        console.log(`🔄 [UnifiedDrag] Rolled back task state: ${task.title}`)
      } catch (rollbackError) {
        console.error('💀 [UnifiedDrag] CRITICAL: Failed to rollback task state:', rollbackError)
        console.error('💀 [UnifiedDrag] Original task backup:', taskBackup)
      }
    }

    // Clear drag state
    clearDragState()
  }

  /**
   * Handle drag end
   * Cleanup drag state and visual feedback
   */
  const handleDragEnd = () => {
    // Stop document-level tracking
    stopDocumentDragTracking()
    console.log('🏁 [UnifiedDrag] Drag ended')
    clearDragState()
  }

  // === DROP HANDLERS BY TARGET TYPE ===

  /**
   * Handle drop on time slot (day/week views)
   */
  const handleTimeSlotDrop = async (task: unknown, target: DropTarget, dragData: unknown) => {
    if (target.type !== 'time-slot' || !target.time) return

    const snappedTime = core.snapTo15Minutes(
      parseInt(target.time.split(':')[0]),
      parseInt(target.time.split(':')[1])
    )
    const timeStr = `${snappedTime.hour.toString().padStart(2, '0')}:${snappedTime.minute.toString().padStart(2, '0')}`

    if (dragData.source === 'calendar-event') {
      // Moving existing calendar event
      console.log(`🎯 [UnifiedDrag] Moving event to ${target.date} at ${timeStr}`)

      taskStore.updateTask(task.id, {
        scheduledDate: target.date,
        scheduledTime: timeStr
      })

      // Update instance if it exists
      if (task.instances?.length > 0) {
        const instance = task.instances[0] // Use first instance for simplicity
        taskStore.updateTaskInstance(task.id, instance.id, {
          scheduledDate: target.date,
          scheduledTime: timeStr
        })
      }
    } else if (dragData.source && dragData.source.includes('unified-inbox')) {
      // Drag from inbox - CRITICAL FIX: Handle inbox drag sources properly
      console.log(`📥 [UnifiedDrag] Moving task from inbox to ${target.date} at ${timeStr}`)

      // Create task instance to schedule the task
      const instance = taskStore.createTaskInstance(task.id, {
        scheduledDate: target.date,
        scheduledTime: timeStr
      })

      if (instance) {
        // Only remove from inbox if instance creation succeeded
        taskStore.updateTask(task.id, {
          isInInbox: false
        })
        console.log(`✅ [UnifiedDrag] Task moved from inbox: ${task.title}`)
      } else {
        console.error(`❌ [UnifiedDrag] Failed to create instance for task: ${task.title}`)
      }
    } else {
      // Drag from other sources
      const instance = taskStore.createTaskInstance(task.id, {
        scheduledDate: target.date,
        scheduledTime: timeStr
      })

      if (instance) {
        taskStore.updateTask(task.id, {
          isInInbox: false
        })
        console.log(`✅ [UnifiedDrag] Task scheduled from unknown source: ${task.title}`)
      } else {
        console.error(`❌ [UnifiedDrag] Failed to create instance for task: ${task.title}`)
      }
    }
  }

  /**
   * Handle drop on day cell (month view)
   */
  const handleDayDrop = async (task: unknown, target: DropTarget, _dragData: unknown) => {
    // Keep existing time or default to 9 AM
    const scheduledTime = task.scheduledTime || '09:00'

    if (dragState.value.dragMode === 'duplicate') {
      // Create duplicate task
      taskStore.createTask({
        title: task.title,
        description: task.description,
        scheduledDate: target.date,
        scheduledTime,
        estimatedDuration: task.estimatedDuration,
        projectId: task.projectId,
        priority: task.priority,
        status: task.status,
        isInInbox: false
      })
    } else {
      // Move existing task
      taskStore.updateTask(task.id, {
        scheduledDate: target.date,
        scheduledTime,
        isInInbox: false
      })
    }
  }

  /**
   * Handle drop on week grid (complex positioning)
   */
  const handleWeekGridDrop = async (task: unknown, target: DropTarget, _dragData: unknown) => {
    if (target.dayIndex === undefined || target.slotIndex === undefined) return

    const WORKING_HOURS_OFFSET = 6
    const newHour = Math.floor(target.slotIndex / 2) + WORKING_HOURS_OFFSET
    const newMinute = (target.slotIndex % 2) * 30
    const timeStr = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

    // Calculate the actual date based on dayIndex
    const weekStart = core.getWeekStart(new Date())
    const targetDate = new Date(weekStart)
    targetDate.setDate(weekStart.getDate() + target.dayIndex)
    const dateString = core.getDateString(targetDate)

    if (dragState.value.dragMode === 'duplicate') {
      // Create duplicate task
      taskStore.createTask({
        title: task.title,
        description: task.description,
        scheduledDate: dateString,
        scheduledTime: timeStr,
        estimatedDuration: task.estimatedDuration,
        projectId: task.projectId,
        priority: task.priority,
        status: task.status,
        isInInbox: false
      })
    } else {
      // Move existing task
      taskStore.updateTask(task.id, {
        scheduledDate: dateString,
        scheduledTime: timeStr
      })
    }
  }

  // === UTILITY FUNCTIONS ===

  /**
   * Clear all drag state
   */
  const clearDragState = () => {
    // Ensure tracking is stopped
    stopDocumentDragTracking()

    dragState.value = {
      isDragging: false,
      draggedTaskId: null,
      draggedInstanceId: null,
      source: null,
      dragMode: null
    }
    dragGhost.value = {
      visible: false,
      title: '',
      duration: 30,
      slotIndex: 0
    }
    activeDropTarget.value = null
    delete (window as Window & typeof globalThis).__draggingTaskId
  }

  /**
   * Check if currently dragging
   */
  const isDragging = () => dragState.value.isDragging

  /**
   * Get ghost style for time slot rendering
   */
  const getGhostStyle = (slotHeight: number = 30) => {
    if (!dragGhost.value.visible) return {}

    const slotSpan = Math.ceil(dragGhost.value.duration / 30)

    return {
      position: 'absolute' as const,
      top: `${dragGhost.value.slotIndex * slotHeight}px`,
      height: `${slotSpan * slotHeight}px`,
      left: '0',
      width: '100%',
      opacity: 0.5,
      pointerEvents: 'none' as const
    }
  }

  return {
    // State
    dragState,
    dragGhost,
    activeDropTarget,

    // Common handlers
    startDrag,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,

    // Utilities
    clearDragState,
    isDragging,
    getGhostStyle
  }
}