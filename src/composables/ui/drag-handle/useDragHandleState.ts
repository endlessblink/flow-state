import { ref } from 'vue'

export function useDragHandleState() {
    const isDragging = ref(false)
    const isHovered = ref(false)
    const isFocused = ref(false)
    const showTouchFeedback = ref(false)
    const dragGhost = ref(false)

    // Position tracking
    const dragStartPosition = ref({ x: 0, y: 0 })
    const currentPosition = ref({ x: 0, y: 0 })

    return {
        isDragging,
        isHovered,
        isFocused,
        showTouchFeedback,
        dragGhost,
        dragStartPosition,
        currentPosition
    }
}
