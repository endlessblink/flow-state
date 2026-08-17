import { ref, reactive, onUnmounted } from 'vue'

interface TimeSlot {
  slotIndex: number
  date: string
  hour: number
  minute: number
  id: string
}

interface CreateDragState {
  isActive: boolean
  startSlot: TimeSlot | null
  currentSlot: TimeSlot | null
  startCoords: { x: number; y: number } | null
}

interface ExternalCalendarEventStart {
  startTime: Date
}

const EXTERNAL_DRAG_THRESHOLD_PX = 4

export function useCalendarDragCreate() {
  const isCreatingTask = ref(false)
  const createDragState = reactive<CreateDragState>({
    isActive: false,
    startSlot: null,
    currentSlot: null,
    startCoords: null
  })

  const showQuickCreateModal = ref(false)
  const quickCreateData = reactive({
    startTime: null as Date | null,
    endTime: null as Date | null,
    duration: 30
  })

  let pendingExternalDrag: {
    event: MouseEvent
    eventStart: ExternalCalendarEventStart
  } | null = null

  const getSlotFromExternalEvent = (eventStart: ExternalCalendarEventStart): TimeSlot => {
    const startTime = eventStart.startTime
    const minute = startTime.getMinutes() >= 30 ? 30 : 0
    const slotIndex = startTime.getHours() * 2 + (minute === 30 ? 1 : 0)
    const date = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`

    return {
      id: `${date}-${slotIndex}`,
      slotIndex,
      date,
      hour: startTime.getHours(),
      minute
    }
  }

  const clearPendingExternalDrag = () => {
    document.removeEventListener('mousemove', handleExternalDragMove)
    document.removeEventListener('mouseup', handleExternalDragEnd)
    pendingExternalDrag = null
  }

  const handleExternalDragMove = (event: MouseEvent) => {
    if (!pendingExternalDrag) return

    const deltaX = event.clientX - pendingExternalDrag.event.clientX
    const deltaY = event.clientY - pendingExternalDrag.event.clientY
    if (Math.hypot(deltaX, deltaY) < EXTERNAL_DRAG_THRESHOLD_PX) return

    const { event: startEvent, eventStart } = pendingExternalDrag
    clearPendingExternalDrag()
    startCreateDrag(startEvent, getSlotFromExternalEvent(eventStart))
    handleCreateDragMove(event)
  }

  const handleExternalDragEnd = () => {
    clearPendingExternalDrag()
  }

  // Google/iCal event links need to keep ordinary clicks, but a drag over the
  // event should create a separate local task at the event's start time.
  const handleExternalEventMouseDown = (event: MouseEvent, eventStart: ExternalCalendarEventStart) => {
    if (event.button !== 0) return

    clearPendingExternalDrag()
    pendingExternalDrag = { event, eventStart }
    document.addEventListener('mousemove', handleExternalDragMove)
    document.addEventListener('mouseup', handleExternalDragEnd)
  }

  // Handle mouse down on time slots
  const handleSlotMouseDown = (event: MouseEvent, slot: TimeSlot) => {
    // Prevent if clicking on an event or resize handle
    // Check both old (.calendar-event) and new (.slot-task) class names for compatibility
    if ((event.target as HTMLElement).closest('.calendar-event')) return
    if ((event.target as HTMLElement).closest('.slot-task')) return
    if ((event.target as HTMLElement).closest('.week-event')) return
    if ((event.target as HTMLElement).classList.contains('resize-handle')) return
    if (event.button !== 0) return // Only left mouse button

    event.preventDefault()
    event.stopPropagation()

    startCreateDrag(event, slot)
  }

  const startCreateDrag = (event: MouseEvent, slot: TimeSlot) => {
    isCreatingTask.value = true
    createDragState.isActive = true
    createDragState.startSlot = slot
    createDragState.currentSlot = slot
    createDragState.startCoords = { x: event.clientX, y: event.clientY }

    // Add event listeners to document for mouse move, up, keydown, and window blur
    document.addEventListener('mousemove', handleCreateDragMove, { passive: false })
    document.addEventListener('mouseup', handleCreateDragEnd, { passive: false })
    document.addEventListener('keydown', handleCreateDragKeydown)
    window.addEventListener('blur', handleCreateDragBlur)

    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
      ; (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
  }

  const handleCreateDragMove = (event: MouseEvent) => {
    if (!createDragState.isActive || !createDragState.startSlot) return

    event.preventDefault()

    // Find the slot under the mouse cursor — try day view (.time-slot) then week view (.week-time-cell)
    const elementsUnderMouse = document.elementsFromPoint?.(event.clientX, event.clientY) || []
    const elementUnderMouse = document.elementFromPoint?.(event.clientX, event.clientY)
    const slotElement = elementsUnderMouse.find(element =>
      element.closest('.time-slot') || element.closest('.week-time-cell')
    )?.closest('.time-slot, .week-time-cell') as HTMLElement
      || elementUnderMouse?.closest('.time-slot') as HTMLElement
      || elementUnderMouse?.closest('.week-time-cell') as HTMLElement

    if (slotElement) {
      const isWeekCell = slotElement.classList.contains('week-time-cell')

      let slotIndex: number
      let slotDate: string
      let hour: number
      let minute: number

      if (isWeekCell) {
        // Week view: each cell is 1 hour (60px). Compute 30-min precision from mouse Y.
        const rect = slotElement.getBoundingClientRect()
        const relativeY = event.clientY - rect.top
        const isBottomHalf = relativeY >= rect.height / 2

        hour = parseInt(slotElement.dataset.hour || '0')
        minute = isBottomHalf ? 30 : 0
        slotDate = slotElement.dataset.slotDate || ''
        slotIndex = hour * 2 + (isBottomHalf ? 1 : 0)
      } else {
        // Day view: each slot has explicit data attributes
        slotIndex = parseInt(slotElement.dataset.slotIndex || '0')
        slotDate = slotElement.dataset.slotDate || ''
        hour = parseInt(slotElement.dataset.hour || '0')
        minute = parseInt(slotElement.dataset.minute || '0')
      }

      // Only update if same date — prevent cross-day drag in week view
      if (!createDragState.startSlot.date || slotDate === createDragState.startSlot.date) {
        createDragState.currentSlot = {
          slotIndex,
          date: slotDate || createDragState.startSlot.date,
          hour,
          minute,
          id: `${slotDate}-${slotIndex}`
        }
      }
    }
  }

  const handleCreateDragEnd = (_event: MouseEvent) => {
    if (!createDragState.isActive || !createDragState.startSlot || !createDragState.currentSlot) {
      resetCreateDrag()
      return
    }

    // Calculate start and end times
    const startSlot = createDragState.startSlot
    const endSlot = createDragState.currentSlot

    const startTime = getSlotTime(startSlot)
    let endTime = getSlotTime(endSlot)

    // Ensure end time is after start time
    if (endTime <= startTime) {
      endTime = new Date(startTime.getTime() + 30 * 60000) // Add 30 minutes minimum
    } else {
      // Add 30 minutes to end time to make it inclusive
      endTime = new Date(endTime.getTime() + 30 * 60000)
    }

    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    // Set modal data and show
    quickCreateData.startTime = startTime
    quickCreateData.endTime = endTime
    quickCreateData.duration = duration
    showQuickCreateModal.value = true

    resetCreateDrag()
  }

  const handleCreateDragKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      resetCreateDrag()
    }
  }

  const handleCreateDragBlur = () => {
    // Window lost focus - cleanup to prevent stuck state
    resetCreateDrag()
  }

  const resetCreateDrag = () => {
    clearPendingExternalDrag()
    isCreatingTask.value = false
    createDragState.isActive = false
    createDragState.startSlot = null
    createDragState.currentSlot = null
    createDragState.startCoords = null

    // Remove event listeners
    document.removeEventListener('mousemove', handleCreateDragMove)
    document.removeEventListener('mouseup', handleCreateDragEnd)
    document.removeEventListener('keydown', handleCreateDragKeydown)
    window.removeEventListener('blur', handleCreateDragBlur)

    // Restore text selection
    document.body.style.userSelect = ''
      ; (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''

    // Clear any stuck selection
    window.getSelection()?.removeAllRanges()
  }

  // Check if slot is in create range for visual feedback
  const isSlotInCreateRange = (slot: TimeSlot): boolean => {
    if (!isCreatingTask.value || !createDragState.startSlot || !createDragState.currentSlot) {
      return false
    }

    const startIndex = Math.min(createDragState.startSlot.slotIndex, createDragState.currentSlot.slotIndex)
    const endIndex = Math.max(createDragState.startSlot.slotIndex, createDragState.currentSlot.slotIndex)

    return slot.slotIndex >= startIndex && slot.slotIndex <= endIndex &&
      slot.date === createDragState.startSlot.date
  }

  // Helper function to convert slot to time
  const getSlotTime = (slot: TimeSlot): Date => {
    // Create date in local timezone to avoid timezone shifts
    const [year, month, day] = slot.date.split('-').map(Number)
    const date = new Date(year, month - 1, day, slot.hour, slot.minute, 0, 0)
    return date
  }

  // Ensure listeners are cleaned up on unmount
  onUnmounted(resetCreateDrag)

  return {
    isCreatingTask,
    createDragState,
    showQuickCreateModal,
    quickCreateData,
    handleSlotMouseDown,
    handleExternalEventMouseDown,
    isSlotInCreateRange,
    resetCreateDrag
  }
}
