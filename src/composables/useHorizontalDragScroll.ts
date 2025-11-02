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

  // Smart drag intention detection
  const detectDragIntent = (target: HTMLElement, clientX: number, clientY: number): boolean => {
    // Check if target or any ancestor is draggable
    const draggableElement = target.closest<HTMLElement>(
      '.draggable, [data-draggable="true"], [draggable="true"], .task-card, .inbox-task-card, [data-inbox-task="true"], .vuedraggable, ' +
      '.vue-flow__node, .vue-flow__handle'
    )

    if (draggableElement) {
      console.log('🎯 [HorizontalDragScroll] Detected drag intent, allowing drag-and-drop:', {
        element: target.tagName,
        classes: target.className,
        closestDraggable: draggableElement.tagName + '.' + draggableElement.className
      })
      return true
    }

    // Check for drag handles and interactive elements within task cards
    const interactiveElement = target.closest<HTMLElement>(
      'button, input, textarea, select, [role="button"], .draggable-handle, ' +
      '.status-icon-button, .task-title, .card-header, .metadata-badges, .card-actions, .task-item-mini'
    )

    if (interactiveElement) {
      // Only consider it interactive if it's within a task card, drag context, OR Vue Flow canvas
      const withinDragContext = interactiveElement.closest<HTMLElement>('.task-card, .inbox-task-card, .vuedraggable, .kanban-swimlane, .vue-flow__pane, .vue-flow__viewport')
      if (withinDragContext) {
        console.log('🎯 [HorizontalDragScroll] Detected interactive element in drag context, allowing normal interaction:', {
          element: target.tagName,
          classes: target.className,
          interactiveType: interactiveElement.tagName + '.' + interactiveElement.className,
          context: withinDragContext.className
        })
        return true
      }
    }

    // Special case: Check if we're within a Vue Flow canvas (Canvas view)
    const withinVueFlow = target.closest<HTMLElement>('.vue-flow__pane, .vue-flow__viewport, .vue-flow__container')
    if (withinVueFlow) {
      console.log('🎯 [HorizontalDragScroll] Detected Vue Flow canvas interaction, allowing Vue Flow drag operations:', {
        element: target.tagName,
        classes: target.className,
        vueFlowContext: withinVueFlow.className
      })
      return true
    }

    return false
  }

  // Start drag
  const handleStart = (clientX: number, clientY: number, target: HTMLElement) => {
    if (!scrollContainer.value) return

    // Enhanced check for draggable elements (task cards, etc.)
    const isDraggableElement =
      target?.closest('.draggable') ||
      target?.closest('[data-draggable="true"]') ||
      target?.closest('.task-card') ||
      target?.closest('[draggable="true"]') ||
      target?.closest('.vue-flow__node') ||
      target?.closest('.vue-flow__handle') ||
      target?.classList.contains('task-card') ||
      target?.getAttribute('draggable') === 'true' ||
      // Task card child elements - allow drags from within task cards
      target?.closest('.card-header') ||
      target?.closest('.status-icon-button') ||
      target?.closest('.task-title') ||
      target?.closest('.metadata-badges') ||
      target?.closest('.card-actions') ||
      target?.closest('.task-item-mini')

    if (isDraggableElement) {
      // Determine which selector matched for better debugging
      let matchedSelector = 'unknown'
      if (target?.classList.contains('task-card')) matchedSelector = 'task-card (direct)'
      else if (target?.closest('.task-card')) matchedSelector = 'task-card (ancestor)'
      else if (target?.closest('.draggable')) matchedSelector = '.draggable'
      else if (target?.closest('[data-draggable="true"]')) matchedSelector = '[data-draggable="true"]'
      else if (target?.closest('[draggable="true"]')) matchedSelector = '[draggable="true"]'
      else if (target?.closest('.vue-flow__node')) matchedSelector = '.vue-flow__node'
      else if (target?.closest('.vue-flow__handle')) matchedSelector = '.vue-flow__handle'
      else if (target?.closest('.card-header')) matchedSelector = '.card-header'
      else if (target?.closest('.status-icon-button')) matchedSelector = '.status-icon-button'
      else if (target?.closest('.task-title')) matchedSelector = '.task-title'
      else if (target?.closest('.metadata-badges')) matchedSelector = '.metadata-badges'
      else if (target?.closest('.card-actions')) matchedSelector = '.card-actions'
      else if (target?.closest('.task-item-mini')) matchedSelector = '.task-item-mini'
      else if (target?.getAttribute('draggable') === 'true') matchedSelector = 'draggable attribute'

      console.log('🔄 [HorizontalDragScroll] Ignoring drag on draggable element:', {
        element: target.tagName,
        classes: target.className,
        matchedSelector: matchedSelector,
        closestTaskCard: !!target?.closest('.task-card'),
        hasDraggableAttr: target?.getAttribute('draggable') === 'true',
        isTaskCard: target?.classList.contains('task-card')
      })
      return // Don't interfere with existing drag-drop
    }

    // Check if target is within our scroll container
    if (!scrollContainer.value.contains(target)) {
      return // Only handle events within our container
    }

    // Log scroll container dimensions for debugging
    console.log('🔄 [HorizontalDragScroll] Container scrollWidth:', scrollContainer.value.scrollWidth)
    console.log('🔄 [HorizontalDragScroll] Container clientWidth:', scrollContainer.value.clientWidth)
    console.log('🔄 [HorizontalDragScroll] Can scroll horizontally:',
      scrollContainer.value.scrollWidth > scrollContainer.value.clientWidth)

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

    // Set cursor and prevent text selection (only for scroll operations)
    scrollContainer.value.style.cursor = dragCursor
    scrollContainer.value.style.userSelect = 'none'
    // Note: touchAction will be set only when we actually start scrolling in handleMove

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

    // Additional containment: ensure no body-level scrolling during ACTIVE scrolling
    if (Math.abs(deltaX) >= threshold) {
      document.body.style.overflowX = 'hidden'
      document.body.style.touchAction = 'pan-y'
      // Also set touch action on scroll container only when actively scrolling
      scrollContainer.value.style.touchAction = 'pan-x'
    }
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

    // Restore body overflow settings
    document.body.style.overflowX = ''
    document.body.style.touchAction = ''

    // Start momentum scrolling if we have velocity
    if (Math.abs(velocity.value) > 0.5) {
      isScrolling.value = true
      applyMomentum()
    }

    onDragEnd?.()
  }

  // Mouse events
  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Check if we're within a task card first - if so, don't even process drag detection
    const withinTaskCard = target.closest('.task-card, .inbox-task-card')

    if (withinTaskCard) {
      console.log('🎯 [HorizontalDragScroll] Within task card, completely bypassing scroll handling')
      return // Don't interfere at all - let task card handle its own drag-and-drop
    }

    // Only process scroll logic if we're not within a task card
    console.log('🔄 [HorizontalDragScroll] Outside task cards, checking drag intent')
    const isDragIntent = detectDragIntent(target, e.clientX, e.clientY)

    if (isDragIntent) {
      console.log('🎯 [HorizontalDragScroll] Drag intent detected, allowing drag-and-drop to handle this event')
      return // Don't interfere - let drag-and-drop handle this
    }

    // Only interfere with scroll events if no drag intent detected and not in task card
    console.log('🔄 [HorizontalDragScroll] No drag intent detected, handling as scroll event')
    e.preventDefault()
    e.stopPropagation()
    handleStart(e.clientX, e.clientY, target)

    // Add global listeners ONLY when scroll drag starts (not for regular drag-and-drop)
    if (isDragging.value && scrollContainer.value) {
      const container = scrollContainer.value as any
      document.addEventListener('mousemove', container._globalMouseMoveHandler)
      document.addEventListener('mouseup', container._globalMouseUpHandler)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return
    e.preventDefault()
    e.stopPropagation()
    handleMove(e.clientX, e.clientY, e)
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging.value) return
    e.preventDefault()
    e.stopPropagation()
    handleEnd(e)
  }

  // Touch events
  const handleTouchStart = (e: TouchEvent) => {
    if (!touchEnabled) return
    const touch = e.touches[0]
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
    ;(container as any)._globalMouseMoveHandler = handleGlobalMouseMove
    ;(container as any)._globalMouseUpHandler = handleGlobalMouseUp

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

    const container = scrollContainer.value as any

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

    // Clean up stored handlers
    delete container._globalMouseMoveHandler
    delete container._globalMouseUpHandler
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