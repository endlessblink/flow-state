import { ref, onUnmounted, nextTick, watch } from 'vue'

export interface DragHandleProps {
    disabled: boolean
    showKeyboardNavigation: boolean
}

export interface DragHandleState {
    isDragging: { value: boolean }
    isHovered: { value: boolean }
    isFocused: { value: boolean }
    showTouchFeedback: { value: boolean }
    dragGhost: { value: boolean }
    dragStartPosition: { value: { x: number, y: number } }
    currentPosition: { value: { x: number, y: number } }
}

export interface DragHandleEmits {
    (e: 'dragStart', event: MouseEvent | TouchEvent): void
    (e: 'dragEnd', event: MouseEvent | TouchEvent): void
    (e: 'dragMove', event: MouseEvent | TouchEvent, deltaX: number, deltaY: number): void
    (e: 'keyboardMove', direction: 'up' | 'down' | 'left' | 'right'): void
    (e: 'hoverStart'): void
    (e: 'hoverEnd'): void
}

export function useDragHandleInteraction(
    props: DragHandleProps,
    state: DragHandleState,
    emit: DragHandleEmits
) {
    const animationFrame = ref<number | null>(null)

    // --- Core Lifecycle ---

    const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)

        if (animationFrame.value) {
            cancelAnimationFrame(animationFrame.value)
            animationFrame.value = null
        }
    }

    onUnmounted(() => {
        cleanup()
    })

    // --- Drag Operations ---

    const startDragOperation = (event: MouseEvent | TouchEvent) => {
        state.isDragging.value = true
        state.dragGhost.value = true

        // Calculate initial position
        const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : (event as MouseEvent).clientX
        const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : (event as MouseEvent).clientY

        state.dragStartPosition.value = { x: clientX, y: clientY }
        state.currentPosition.value = { x: clientX, y: clientY }

        emit('dragStart', event)
        startPositionTracking()
    }

    const endDragOperation = (event: MouseEvent | TouchEvent) => {
        if (state.isDragging.value) {
            state.isDragging.value = false
            state.dragGhost.value = false

            if (animationFrame.value) {
                cancelAnimationFrame(animationFrame.value)
                animationFrame.value = null
            }

            emit('dragEnd', event)
        }
    }

    const startPositionTracking = () => {
        const trackPosition = () => {
            if (!state.isDragging.value) return
            // Request next frame for smooth ghost updates (though DOM updates happen reactively)
            animationFrame.value = requestAnimationFrame(trackPosition)
        }
        animationFrame.value = requestAnimationFrame(trackPosition)
    }

    // --- Specific Event Handlers ---

    const handleMouseDown = (event: MouseEvent) => {
        if (props.disabled) return
        event.preventDefault()
        startDragOperation(event)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (event: MouseEvent) => {
        if (!state.isDragging.value) return

        // Update State
        const deltaX = event.clientX - state.dragStartPosition.value.x
        const deltaY = event.clientY - state.dragStartPosition.value.y
        state.currentPosition.value = { x: event.clientX, y: event.clientY }

        emit('dragMove', event, deltaX, deltaY)
    }

    const handleMouseUp = (event: MouseEvent) => {
        endDragOperation(event)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
    }

    // --- Touch Handlers ---

    const handleTouchStart = (event: TouchEvent) => {
        if (props.disabled) return
        event.preventDefault()
        state.showTouchFeedback.value = true
        startDragOperation(event)
        document.addEventListener('touchmove', handleTouchMove)
        document.addEventListener('touchend', handleTouchEnd)
    }

    const handleTouchMove = (event: TouchEvent) => {
        if (!state.isDragging.value) return
        const touch = event.touches[0]
        if (!touch) return

        const deltaX = touch.clientX - state.dragStartPosition.value.x
        const deltaY = touch.clientY - state.dragStartPosition.value.y
        state.currentPosition.value = { x: touch.clientX, y: touch.clientY }

        event.preventDefault() // Block scrolling
        emit('dragMove', event, deltaX, deltaY)
    }

    const handleTouchEnd = (event: TouchEvent) => {
        state.showTouchFeedback.value = false
        endDragOperation(event)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
    }

    // --- Keyboard Handlers ---

    const handleKeyDown = (event: KeyboardEvent) => {
        if (props.disabled) return

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault()
                if (!state.isDragging.value) {
                    // Simulate drag start via keyboard
                    const syntheticEvent = new MouseEvent('mousedown', {
                        clientX: 0, clientY: 0, bubbles: true, cancelable: true
                    })
                    startDragOperation(syntheticEvent)
                }
                break
            case 'Escape':
                if (state.isDragging.value) {
                    event.preventDefault()
                    endDragOperation(event as unknown as MouseEvent)
                }
                break
        }
    }

    const handleArrowKey = (direction: 'up' | 'down' | 'left' | 'right') => {
        if (props.disabled || !props.showKeyboardNavigation) return
        emit('keyboardMove', direction)
    }

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleKeyDown,
        handleArrowKey,
        // Expose start/end for public API if needed
        startDragOperation,
        endDragOperation
    }
}
