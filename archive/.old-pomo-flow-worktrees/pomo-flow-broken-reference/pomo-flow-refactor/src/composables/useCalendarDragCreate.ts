import { ref, reactive, nextTick } from 'vue'

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

  // Handle mouse down on time slots
  const handleSlotMouseDown = (event: MouseEvent, slot: TimeSlot) => {
    // Prevent if clicking on an event or resize handle
    if ((event.target as HTMLElement).closest('.calendar-event')) return
    if ((event.target as HTMLElement).classList.contains('resize-handle')) return
    if (event.button !== 0) return // Only left mouse button

    event.preventDefault()
    event.stopPropagation()

    console.log('Slot mousedown triggered:', slot) // Debug log

    startCreateDrag(event, slot)
  }

  const startCreateDrag = (event: MouseEvent, slot: TimeSlot) => {
    isCreatingTask.value = true
    createDragState.isActive = true
    createDragState.startSlot = slot
    createDragState.currentSlot = slot
    createDragState.startCoords = { x: event.clientX, y: event.clientY }

    console.log('Started create drag:', slot) // Debug log

    // Add event listeners to document for mouse move and up
    document.addEventListener('mousemove', handleCreateDragMove, { passive: false })
    document.addEventListener('mouseup', handleCreateDragEnd, { passive: false })

    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    ;(document.body.style as any).webkitUserSelect = 'none'
  }

  const handleCreateDragMove = (event: MouseEvent) => {
    if (!createDragState.isActive || !createDragState.startSlot) return

    event.preventDefault()

    // Find the slot under the mouse cursor
    const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY)
    const slotElement = elementUnderMouse?.closest('.time-slot') as HTMLElement

    if (slotElement) {
      const slotIndex = parseInt(slotElement.dataset.slotIndex || '0')
      const slotDate = slotElement.dataset.slotDate || ''
      const hour = parseInt(slotElement.dataset.hour || '0')
      const minute = parseInt(slotElement.dataset.minute || '0')

      createDragState.currentSlot = {
        slotIndex,
        date: slotDate,
        hour,
        minute,
        id: `${slotDate}-${slotIndex}`
      }

      // Force reactivity update
      nextTick(() => {
        console.log('Current slot updated:', createDragState.currentSlot)
      })
    }
  }

  const handleCreateDragEnd = (event: MouseEvent) => {
    if (!createDragState.isActive || !createDragState.startSlot || !createDragState.currentSlot) {
      resetCreateDrag()
      return
    }

    console.log('Create drag ended:', createDragState) // Debug log

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

    console.log('Opening modal with:', quickCreateData)

    resetCreateDrag()
  }

  const resetCreateDrag = () => {
    isCreatingTask.value = false
    createDragState.isActive = false
    createDragState.startSlot = null
    createDragState.currentSlot = null
    createDragState.startCoords = null

    // Remove event listeners
    document.removeEventListener('mousemove', handleCreateDragMove)
    document.removeEventListener('mouseup', handleCreateDragEnd)

    // Restore text selection
    document.body.style.userSelect = ''
    ;(document.body.style as any).webkitUserSelect = ''
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

  return {
    isCreatingTask,
    showQuickCreateModal,
    quickCreateData,
    handleSlotMouseDown,
    isSlotInCreateRange,
    resetCreateDrag
  }
}
