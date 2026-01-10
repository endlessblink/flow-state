import { computed } from 'vue'
import { useCanvasSelection } from '@/composables/canvas/useCanvasSelection'
import { useCanvasStore } from '@/stores/canvas'
import { isDragSettlingRef } from '@/composables/canvas/useCanvasDragDrop'

export function useCanvasInteractivity(
    canvasStore: any,
    isNodeDragging: { value: boolean },
    resizeState: { value: { isResizing: boolean } },
    isResizeSettling: { value: boolean }
) {
    const {
        selectionBox,
        startSelection,
        updateSelection,
        endSelection
    } = useCanvasSelection()

    const handleMouseDown = (event: MouseEvent) => {
        if (event.shiftKey) {
            startSelection(event)
        }
    }

    const handleMouseMove = (event: MouseEvent) => {
        if (selectionBox.isVisible) {
            updateSelection(event)
        }
    }

    const handleMouseUp = (event: MouseEvent) => {
        if (selectionBox.isVisible) {
            endSelection(event)
        }
    }

    const handleCanvasContainerClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement
        const isPaneClick = target.classList.contains('vue-flow__pane') ||
            target.classList.contains('vue-flow__viewport') ||
            target.classList.contains('vue-flow__transformationpane') ||
            target.classList.contains('vue-flow__container') ||
            target.classList.contains('canvas-container')

        const isInsideNode = target.closest('.vue-flow__node')
        const isInsideEdge = target.closest('.vue-flow__edge')

        if (isPaneClick && !isInsideNode && !isInsideEdge && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            canvasStore.setSelectedNodes([])
        }
    }

    // Interaction state helper
    const isInteracting = computed(() =>
        isNodeDragging.value ||
        isDragSettlingRef.value ||
        resizeState.value.isResizing ||
        isResizeSettling.value
    )

    return {
        selectionBox,
        isInteracting,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleCanvasContainerClick
    }
}
