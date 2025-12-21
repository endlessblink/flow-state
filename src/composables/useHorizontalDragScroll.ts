import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface HorizontalDragScrollOptions {
  /**
   * Minimum drag distance before scrolling starts
   */
  threshold?: number

  /**
   * Scroll multiplier for drag sensitivity
   */
  sensitivity?: number

  /**
   * Momentum friction coefficient (0-1)
   */
  friction?: number

  /**
   * Enable touch events for mobile
   */
  touchEnabled?: boolean

  /**
   * CSS cursor during drag
   */
  dragCursor?: string

  /**
   * Callback when drag starts
   */
  onDragStart?: () => void

  /**
   * Callback when drag ends
   */
  onDragEnd?: () => void
}

export function useHorizontalDragScroll(
  scrollContainer: Ref<HTMLElement | null>,
  options: HorizontalDragScrollOptions = {}
) {
  const {
    threshold = 10,
    sensitivity = 1,
    friction = 0.95,
    touchEnabled = true,
    dragCursor = 'grabbing',
    onDragStart,
    onDragEnd
  } = options

  // State
  const isDragging = ref(false)
  const isScrolling = ref(false)
  const startX = ref(0)
  const startY = ref(0)
  const scrollLeft = ref(0)
  const velocity = ref(0)
  const lastX = ref(0)
  const animationFrameId = ref<number>()

  // Comprehensive drag intent detection - FIXED: Check BEFORE preventDefault
  const detectDragIntent = (target: HTMLElement, _clientX: number, _clientY: number): boolean => {
    // Check for draggable elements (from mapping documentation)
    const draggableElement = target.closest<HTMLElement>(
      '.draggable, [data-draggable="true"], [draggable="true"], .task-card, .inbox-task-card, ' +
      '[data-inbox-task="true"], .vuedraggable, .vue-flow__node, .vue-flow__handle, ' +
      '.calendar-event, .time-slot, .week-event, .month-event'
    )

    if (draggableElement) {
      console.log('🎯 [HorizontalDragScroll] Detected drag intent, allowing drag-and-drop')
      return true
    }

    // Check for interactive elements within draggable components
    const interactiveElement = target.closest<HTMLElement>(
      'button, input, textarea, select, [role="button"], .draggable-handle, ' +
      '.status-icon-button, .task-title, .card-header, .metadata-badges, .card-actions, .task-item-mini, ' +
      '.resize-handle, .event-content, .event-actions'
    )

    if (interactiveElement) {
      console.log('🔘 [HorizontalDragScroll] Detected interactive element, allowing interaction')
      return true
    }

    return false
  }

  // Momentum scrolling
  const applyMomentum = () => {
    if (!scrollContainer.value) return

    if (Math.abs(velocity.value) > 0.1) {
      scrollContainer.value.scrollLeft += velocity.value
      velocity.value *= friction
      animationFrameId.value = requestAnimationFrame(applyMomentum)
    } else {
      velocity.value = 0
      isScrolling.value = false
    }
  }

  // Start drag (only called after drag intent check passes)
  const handleStart = (clientX: number, clientY: number, target: HTMLElement) => {
    if (!scrollContainer.value) return

    // Check if target is within our scroll container
    if (!scrollContainer.value.contains(target)) {
      return // Only handle events within our container
    }

    isDragging.value = true
    startX.value = clientX
    startY.value = clientY
    scrollLeft.value = scrollContainer.value.scrollLeft
    lastX.value = clientX
    velocity.value = 0

    // Cancel any existing momentum
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
    }

    // Set cursor and prevent text selection
    scrollContainer.value.style.cursor = dragCursor
    scrollContainer.value.style.userSelect = 'none'
    scrollContainer.value.style.touchAction = 'pan-x'

    onDragStart?.()
  }

  // Drag move
  const handleMove = (clientX: number, clientY: number, e: MouseEvent | TouchEvent) => {
    if (!isDragging.value || !scrollContainer.value) return

    const deltaX = clientX - startX.value
    const deltaY = clientY - startY.value

    // Check if we've moved enough to start scrolling
    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
      return
    }

    // Calculate velocity for momentum
    const currentVelocity = (clientX - lastX.value) * sensitivity
    velocity.value = currentVelocity * 0.8 + velocity.value * 0.2 // Smooth velocity
    lastX.value = clientX

    // Apply scroll - only modify scrollLeft, don't transform elements
    const walk = deltaX * sensitivity
    const newScrollLeft = scrollLeft.value - walk

    // Ensure we don't scroll beyond boundaries
    const maxScrollLeft = scrollContainer.value.scrollWidth - scrollContainer.value.clientWidth
    scrollContainer.value.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft))

    // Prevent default browser behavior and stop propagation
    e.preventDefault()
    e.stopPropagation()
  }

  // End drag
  const handleEnd = (e?: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return

    isDragging.value = false

    // Reset cursor and styles
    if (scrollContainer.value) {
      scrollContainer.value.style.cursor = ''
      scrollContainer.value.style.userSelect = ''
      scrollContainer.value.style.touchAction = ''
    }

    // Stop event propagation
    if (e) {
      e.stopPropagation()
    }

    // Start momentum scrolling if we have velocity
    if (Math.abs(velocity.value) > 0.5) {
      isScrolling.value = true
      applyMomentum()
    }

    onDragEnd?.()
  }

  // Mouse events
  const handleMouseDown = (e: MouseEvent) => {
    // FIXED: Check for draggable elements BEFORE calling preventDefault()
    const shouldAllowDrag = detectDragIntent(e.target as HTMLElement, e.clientX, e.clientY)
    if (shouldAllowDrag) {
      // Don't interfere with drag operations - let them proceed naturally
      return
    }

    // Only prevent default for non-draggable interactions (horizontal scrolling)
    e.preventDefault()
    e.stopPropagation()
    handleStart(e.clientX, e.clientY, e.target as HTMLElement)

    // Add global listeners when drag starts
    if (isDragging.value && scrollContainer.value) {
      const container = scrollContainer.value as HTMLElement & { _globalMouseMoveHandler?: (e: MouseEvent) => void, _globalMouseUpHandler?: (e: MouseEvent) => void }
      container._globalMouseMoveHandler && document.addEventListener('mousemove', container._globalMouseMoveHandler)
      container._globalMouseUpHandler && document.addEventListener('mouseup', container._globalMouseUpHandler)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return
    e.preventDefault()
    e.stopPropagation()
    handleMove(e.clientX, e.clientY, e)
  }

  const _handleMouseUp = (e: MouseEvent) => {
    if (!isDragging.value) return
    e.preventDefault()
    e.stopPropagation()
    handleEnd(e)
  }

  // Touch events
  const handleTouchStart = (e: TouchEvent) => {
    if (!touchEnabled) return
    const touch = e.touches[0]

    // FIXED: Check for draggable elements BEFORE calling preventDefault()
    const shouldAllowDrag = detectDragIntent(e.target as HTMLElement, touch.clientX, touch.clientY)
    if (shouldAllowDrag) {
      // Don't interfere with drag operations - let them proceed naturally
      return
    }

    // Only prevent default for non-draggable interactions (horizontal scrolling)
    e.preventDefault()
    e.stopPropagation()
    handleStart(touch.clientX, touch.clientY, e.target as HTMLElement)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchEnabled || !isDragging.value) return
    const touch = e.touches[0]
    e.preventDefault()
    e.stopPropagation()
    handleMove(touch.clientX, touch.clientY, e)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchEnabled || !isDragging.value) return
    e.preventDefault()
    e.stopPropagation()
    handleEnd(e)
  }

  // Wheel event for smooth horizontal scrolling
  const handleWheel = (e: WheelEvent) => {
    if (!scrollContainer.value) return

    // Check if we can scroll horizontally
    const canScrollHorizontally =
      scrollContainer.value.scrollWidth > scrollContainer.value.clientWidth

    if (canScrollHorizontally && e.shiftKey) {
      e.preventDefault()
      scrollContainer.value.scrollLeft += e.deltaY
    }
  }

  // Setup event listeners
  onMounted(() => {
    if (!scrollContainer.value) return

    const container = scrollContainer.value

    // Mouse events - only on container, not document
    container.addEventListener('mousedown', handleMouseDown)

    // Add global mouseup/mousemove only when dragging starts
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging.value) {
        handleMouseMove(e)
      }
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isDragging.value) {
        handleEnd(e)
        // Remove global listeners when drag ends
        document.removeEventListener('mousemove', handleGlobalMouseMove)
        document.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }

      // Store global handlers for cleanup
      ; (container as unknown as Record<string, unknown>)._globalMouseMoveHandler = handleGlobalMouseMove as unknown
      ; (container as unknown as Record<string, unknown>)._globalMouseUpHandler = handleGlobalMouseUp as unknown

    // Touch events
    if (touchEnabled) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false })
      container.addEventListener('touchmove', handleTouchMove, { passive: false })
      container.addEventListener('touchend', handleTouchEnd)
      container.addEventListener('touchcancel', handleTouchEnd)
    }

    // Wheel event
    container.addEventListener('wheel', handleWheel, { passive: false })
  })

  // Cleanup
  onUnmounted(() => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
    }

    if (!scrollContainer.value) return

    const container = scrollContainer.value as HTMLElement & { _globalMouseMoveHandler?: (e: MouseEvent) => void, _globalMouseUpHandler?: (e: MouseEvent) => void }

    container.removeEventListener('mousedown', handleMouseDown)

    // Clean up global listeners if they exist
    if (container._globalMouseMoveHandler) {
      document.removeEventListener('mousemove', container._globalMouseMoveHandler)
    }
    if (container._globalMouseUpHandler) {
      document.removeEventListener('mouseup', container._globalMouseUpHandler)
    }

    if (touchEnabled) {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }

    container.removeEventListener('wheel', handleWheel)

    const containerCleanup = container as unknown as Record<string, unknown>
    delete containerCleanup._globalMouseMoveHandler
    delete containerCleanup._globalMouseUpHandler
  })

  // Public methods
  const scrollTo = (position: number, smooth = true) => {
    if (!scrollContainer.value) return

    if (smooth) {
      scrollContainer.value.scrollTo({
        left: position,
        behavior: 'smooth'
      })
    } else {
      scrollContainer.value.scrollLeft = position
    }
  }

  const scrollBy = (delta: number, smooth = true) => {
    if (!scrollContainer.value) return

    if (smooth) {
      scrollContainer.value.scrollBy({
        left: delta,
        behavior: 'smooth'
      })
    } else {
      scrollContainer.value.scrollLeft += delta
    }
  }

  const scrollToElement = (element: HTMLElement, offset = 0) => {
    if (!scrollContainer.value) return

    const containerRect = scrollContainer.value.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    const targetScroll = elementRect.left - containerRect.left + scrollContainer.value.scrollLeft - offset

    scrollTo(targetScroll, true)
  }

  return {
    isDragging,
    isScrolling,
    scrollTo,
    scrollBy,
    scrollToElement
  }
}